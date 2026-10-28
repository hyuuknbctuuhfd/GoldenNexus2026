require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const bot = require('./bot');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/admin', express.static('admin'));

// ==================== LÓGICA DEL CAPITAL (PERSISTENTE) ====================
db.run(`CREATE TABLE IF NOT EXISTS project_config (
    id INTEGER PRIMARY KEY,
    capital_restante REAL,
    ultima_actualizacion INTEGER
)`);

const CAPITAL_INICIAL = 750000;
const CAPITAL_POR_HORA = 1000; 
const CAPITAL_POR_MS = CAPITAL_POR_HORA / (60 * 60 * 1000);

db.get(`SELECT * FROM project_config WHERE id = 1`, [], (err, row) => {
    if (!row) {
        db.run(`INSERT INTO project_config (id, capital_restante, ultima_actualizacion) VALUES (1, ?, ?)`, 
        [CAPITAL_INICIAL, Date.now()]);
    }
});

app.get('/api/capital', (req, res) => {
    db.get(`SELECT * FROM project_config WHERE id = 1`, [], (err, row) => {
        if (err || !row) return res.json({ capital: CAPITAL_INICIAL });
        
        const ahora = Date.now();
        const tiempoTranscurrido = ahora - row.ultima_actualizacion;
        
        let nuevoCapital = row.capital_restante - (tiempoTranscurrido * CAPITAL_POR_MS);
        if (nuevoCapital < 0) nuevoCapital = 0;
        
        db.run(`UPDATE project_config SET capital_restante = ?, ultima_actualizacion = ? WHERE id = 1`, 
        [nuevoCapital, ahora]);
        
        res.json({ capital: nuevoCapital });
    });
});

// ==================== API USUARIO ====================
app.get('/api/user/:id', (req, res) => {
    db.get(`SELECT * FROM users WHERE id = ?`, [req.params.id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json(row);
    });
});

app.post('/api/set-language', (req, res) => {
    db.run(`UPDATE users SET language = ? WHERE id = ?`, [req.body.lang, req.body.userId]);
    res.json({ success: true });
});

// ==================== API RANKING ====================
app.get('/api/ranking', (req, res) => {
    db.all(`SELECT username, referidos FROM users WHERE banned = 0 ORDER BY referidos DESC LIMIT 20`, [], (err, rows) => {
        res.json(rows);
    });
});

// ==================== API TAREAS ====================
app.get('/api/tasks/:userId', (req, res) => {
    const userId = req.params.userId;
    db.all(`SELECT * FROM tasks WHERE active = 1`, [], (err, tasks) => {
        db.all(`SELECT task_id FROM completed_tasks WHERE user_id = ?`, [userId], (err, completed) => {
            const completedIds = completed.map(c => c.task_id);
            res.json({ tasks, completedIds });
        });
    });
});

app.post('/api/claim-task', (req, res) => {
    const { userId, taskId } = req.body;
    db.get(`SELECT * FROM tasks WHERE id = ? AND active = 1`, [taskId], (err, task) => {
        if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });
        db.get(`SELECT * FROM completed_tasks WHERE user_id = ? AND task_id = ?`, [userId, taskId], (err, completed) => {
            if (completed) return res.status(400).json({ error: '⚠️ Ya reclamaste esta tarea' });
            
            db.run(`INSERT INTO completed_tasks (user_id, task_id) VALUES (?, ?)`, [userId, taskId]);
            db.run(`UPDATE users SET balance = balance + ? WHERE id = ?`, [task.reward, userId]);
            
            db.get(`SELECT referidor_id FROM users WHERE id = ?`, [userId], (err, user) => {
                if (user && user.referidor_id) {
                    db.get(`SELECT COUNT(*) as total FROM completed_tasks WHERE user_id = ?`, [userId], (err, count) => {
                        if (count.total === 3) {
                            db.run(`UPDATE users SET balance = balance + 0.5 WHERE id = ?`, [user.referidor_id]);
                            bot.telegram.sendMessage(user.referidor_id, `🎁 <b>¡Bono extra!</b> Tu referido completó 3 tareas. <b>+0.5 USDT</b>.`, { parse_mode: 'HTML' }).catch(e => console.log(e));
                        }
                    });
                }
            });

            res.json({ success: true, message: `✅ ¡Recompensa reclamada! +${task.reward} USDT` });
        });
    });
});

// ==================== API CHECK-IN ====================
app.post('/api/checkin', (req, res) => {
    const { userId } = req.body;
    const today = new Date().toISOString().split('T')[0];
    db.get(`SELECT * FROM checkins WHERE user_id = ? AND date = ?`, [userId, today], (err, row) => {
        if (row) return res.status(400).json({ error: 'Ya hiciste check-in hoy' });
        db.run(`INSERT INTO checkins (user_id, date) VALUES (?, ?)`, [userId, today]);
        db.run(`UPDATE users SET balance = balance + 1.0 WHERE id = ?`, [userId]);
        res.json({ success: true, message: '¡Check-in completado! +1.00 USDT' });
    });
});

// ==================== API RETIRO (CORREGIDO) ====================
app.post('/api/withdraw', (req, res) => {
    const { userId, amount, wallet, network } = req.body;
    
    db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'Usuario no encontrado' });

        if (user.balance < amount) return res.status(400).json({ error: 'Saldo insuficiente' });
        if (amount < 10) return res.status(400).json({ error: 'Mínimo 10 USDT' });
        if (user.referidos < 5) return res.status(400).json({ error: '❌ Necesitas 5 referidos para retirar.' });

        // 1. Descontamos el saldo (SOLO saldo, sin network)
        db.run(`UPDATE users SET balance = balance - ? WHERE id = ?`, [amount, userId], function(err) {
            if (err) {
                console.error("Error al descontar saldo:", err);
                return res.status(500).json({ error: 'Error interno al descontar saldo' });
            }
            
            // 2. Guardamos el retiro en la tabla de withdrawals (Aquí sí va el network)
            db.run(`INSERT INTO withdrawals (user_id, amount, wallet, network, status) VALUES (?, ?, ?, ?, 'pending')`, [userId, amount, wallet, network], function(err) {
                if (err) {
                    console.error("Error al guardar retiro:", err);
                    return res.status(500).json({ error: 'Error interno al guardar retiro' });
                }
                res.json({ success: true, message: '✅ Retiro en proceso. Espere aprobación del administrador.' });
            });
        });
    });
});

// ==================== API ADMIN ====================
app.post('/api/admin/login', (req, res) => {
    if (req.body.password === process.env.ADMIN_PASSWORD) res.json({ success: true });
    else res.status(401).json({ error: 'Contraseña incorrecta' });
});

app.get('/api/admin/users', (req, res) => {
    db.all(`SELECT * FROM users ORDER BY created_at DESC`, [], (err, rows) => res.json(rows));
});

app.post('/api/admin/ban/:id', (req, res) => {
    db.run(`UPDATE users SET banned = ? WHERE id = ?`, [req.body.banned, req.params.id]);
    res.json({ success: true });
});

app.post('/api/admin/add-balance', (req, res) => {
    const { userId, amount } = req.body;
    db.run(`UPDATE users SET balance = balance + ? WHERE id = ?`, [amount, userId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.post('/api/admin/add-refs', (req, res) => {
    const { userId, amount } = req.body;
    db.run(`UPDATE users SET referidos = referidos + ? WHERE id = ?`, [amount, userId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.post('/api/admin/fake-user', (req, res) => {
    const { username, referidos } = req.body;
    const fakeId = -Math.floor(Math.random() * 1000000); 
    db.run(`INSERT INTO users (id, username, referidos, balance, banned) VALUES (?, ?, ?, 0, 0)`, 
    [fakeId, username, referidos], (err) => {
        if (err) return res.status(500).json({ error: 'Error al crear usuario ficticio' });
        res.json({ success: true });
    });
});

app.get('/api/admin/stats', (req, res) => {
    const query = `
        SELECT t.id, t.title, t.reward, COUNT(c.id) as completados 
        FROM tasks t 
        LEFT JOIN completed_tasks c ON t.id = c.task_id 
        GROUP BY t.id
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/admin/tasks', (req, res) => {
    db.all(`SELECT * FROM tasks`, [], (err, rows) => res.json(rows));
});

app.post('/api/admin/tasks', (req, res) => {
    const { title, link, reward, type } = req.body;
    
    if (!title || !link) {
        return res.status(400).json({ error: 'El título y el enlace son obligatorios' });
    }

    db.run(`INSERT INTO tasks (title, link, reward, type) VALUES (?, ?, ?, ?)`, 
    [title, link, reward, type || 'channel'], (err) => {
        if (err) {
            console.error("Error al guardar tarea:", err);
            return res.status(500).json({ error: 'Error interno al guardar la tarea' });
        }
        res.json({ success: true, message: 'Tarea creada con éxito' });
    });
});

app.delete('/api/admin/tasks/:id', (req, res) => {
    db.run(`DELETE FROM tasks WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
});

app.get('/api/admin/withdrawals', (req, res) => {
    db.all(`SELECT w.*, u.username FROM withdrawals w JOIN users u ON w.user_id = u.id WHERE w.status = 'pending'`, [], (err, rows) => res.json(rows));
});

app.post('/api/admin/withdrawals/:id/approve', (req, res) => {
    db.get(`SELECT * FROM withdrawals WHERE id = ?`, [req.params.id], (err, w) => {
        if (w) {
            db.run(`UPDATE withdrawals SET status = 'approved' WHERE id = ?`, [req.params.id]);
            const mensaje = `✅ <b>¡Retiro Aprobado!</b>\n\nTu solicitud de retiro por <b>${w.amount} USDT</b> ha sido procesada con éxito en la red ${w.network}.\n\n<i>Gracias por confiar en PayNex.</i>`;
            bot.telegram.sendMessage(w.user_id, mensaje, { parse_mode: 'HTML' }).catch(e => console.log(e));
        }
        res.json({ success: true });
    });
});

app.post('/api/admin/withdrawals/:id/reject', (req, res) => {
    db.get(`SELECT * FROM withdrawals WHERE id = ?`, [req.params.id], (err, w) => {
        if (w) {
            db.run(`UPDATE users SET balance = balance + ? WHERE id = ?`, [w.amount, w.user_id]);
            db.run(`UPDATE withdrawals SET status = 'rejected' WHERE id = ?`, [req.params.id]);
            const mensaje = `❌ <b>Retiro Rechazado</b>\n\nTu solicitud de retiro por <b>${w.amount} USDT</b> no pudo ser procesada.\nEl saldo ha sido devuelto a tu cuenta.`;
            bot.telegram.sendMessage(w.user_id, mensaje, { parse_mode: 'HTML' }).catch(e => console.log(e));
        }
        res.json({ success: true });
    });
});

app.post('/api/admin/broadcast', (req, res) => {
    const { message, imageUrl, buttonText, buttonUrl } = req.body;
    if (!message && !imageUrl) return res.status(400).json({ error: 'El mensaje está vacío' });

    db.all(`SELECT id FROM users WHERE banned = 0`, [], (err, rows) => {
        if (err || rows.length === 0) return res.status(404).json({ error: 'No hay usuarios' });

        rows.forEach((user, index) => {
            setTimeout(() => {
                try {
                    if (imageUrl) {
                        const keyboard = buttonText && buttonUrl ? {
                            inline_keyboard: [[{ text: buttonText, url: buttonUrl }]]
                        } : undefined;
                        bot.telegram.sendPhoto(user.id, imageUrl, { caption: message, parse_mode: 'HTML', reply_markup: keyboard }).catch(e => console.log(e.message));
                    } else {
                        bot.telegram.sendMessage(user.id, message, { parse_mode: 'HTML' }).catch(e => console.log(e.message));
                    }
                } catch (error) { console.log(error); }
            }, index * 350);
        });
        res.json({ success: true, message: `Enviando a ${rows.length} usuarios...` });
    });
});

// ==================== INICIO DEL BOT Y SERVIDOR ====================
bot.launch();
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
