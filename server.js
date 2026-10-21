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

// Pago directo sin verificar (para canales y bots externos)
app.post('/api/claim-task', (req, res) => {
    const { userId, taskId } = req.body;
    db.get(`SELECT * FROM tasks WHERE id = ? AND active = 1`, [taskId], (err, task) => {
        if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });
        db.get(`SELECT * FROM completed_tasks WHERE user_id = ? AND task_id = ?`, [userId, taskId], (err, completed) => {
            if (completed) return res.status(400).json({ error: '⚠️ Ya reclamaste esta tarea' });
            
            db.run(`INSERT INTO completed_tasks (user_id, task_id) VALUES (?, ?)`, [userId, taskId]);
            db.run(`UPDATE users SET balance = balance + ? WHERE id = ?`, [task.reward, userId]);
            
            // Lógica del bono de 3 tareas para el referidor
            db.get(`SELECT referidor_id FROM users WHERE id = ?`, [userId], (err, user) => {
                if (user && user.referidor_id) {
                    db.get(`SELECT COUNT(*) as total FROM completed_tasks WHERE user_id = ?`, [userId], (err, count) => {
                        if (count.total === 3) {
                            db.run(`UPDATE users SET balance = balance + 0.5 WHERE id = ?`, [user.referidor_id]);
                            bot.telegram.sendMessage(user.referidor_id, `🎁 <b>¡Bono extra!</b> Tu referido completó 3 tareas. <b>+0.5 USDT</b>.`, { parse_mode: 'HTML' });
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

// ==================== API RETIRO ====================
app.post('/api/withdraw', (req, res) => {
    const { userId, amount, wallet } = req.body;
    db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, user) => {
        if (user.balance < amount) return res.status(400).json({ error: 'Saldo insuficiente' });
        if (amount < 10) return res.status(400).json({ error: 'Mínimo 10 USDT' });
        if (user.referidos < 5) return res.status(400).json({ error: 'Necesitas 5 referidos para retirar' });
        
        db.run(`UPDATE users SET balance = balance - ?, wallet = ? WHERE id = ?`, [amount, wallet, userId]);
        db.run(`INSERT INTO withdrawals (user_id, amount, wallet) VALUES (?, ?, ?)`, [userId, amount, wallet]);
        res.json({ success: true, message: '✅ Retiro pendiente. Aprobación en 6-24 horas.' });
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

// Rutas para modificar saldo y referidos
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

// Ruta para crear usuarios ficticios (ID negativo)
app.post('/api/admin/fake-user', (req, res) => {
    const { username, referidos } = req.body;
    const fakeId = -Math.floor(Math.random() * 1000000); 
    db.run(`INSERT INTO users (id, username, referidos, balance, banned) VALUES (?, ?, ?, 0, 0)`, 
    [fakeId, username, referidos], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al crear usuario ficticio' });
        }
        res.json({ success: true });
    });
});

// Estadísticas de tareas
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
    db.run(`INSERT INTO tasks (title, link, reward) VALUES (?, ?, ?)`, [req.body.title, req.body.link, req.body.reward]);
    res.json({ success: true });
});

app.delete('/api/admin/tasks/:id', (req, res) => {
    db.run(`DELETE FROM tasks WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
});

app.get('/api/admin/withdrawals', (req, res) => {
    db.all(`SELECT w.*, u.username FROM withdrawals w JOIN users u ON w.user_id = u.id WHERE w.status = 'pending'`, [], (err, rows) => res.json(rows));
});

app.post('/api/admin/withdrawals/:id/approve', (req, res) => {
    db.run(`UPDATE withdrawals SET status = 'approved' WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
});

app.post('/api/admin/withdrawals/:id/reject', (req, res) => {
    db.get(`SELECT * FROM withdrawals WHERE id = ?`, [req.params.id], (err, w) => {
        if (w) {
            db.run(`UPDATE users SET balance = balance + ? WHERE id = ?`, [w.amount, w.user_id]);
            db.run(`UPDATE withdrawals SET status = 'rejected' WHERE id = ?`, [req.params.id]);
        }
        res.json({ success: true });
    });
});

// ==================== INICIO DEL BOT Y SERVIDOR ====================
bot.launch();
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
