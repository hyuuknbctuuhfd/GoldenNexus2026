const { Telegraf, Markup } = require('telegraf');
const db = require('./database');
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = process.env.ADMIN_ID;

// ==================== COMANDO /start ====================
bot.start((ctx) => {
    const userId = ctx.from.id;
    const username = ctx.from.username || 'Usuario';
    const referidorId = ctx.startPayload ? parseInt(ctx.startPayload) : null;

    db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, row) => {
        if (row && row.banned === 1) return ctx.reply('🚫 Has sido expulsado del bot.');

        // Registrar al usuario si es nuevo
        if (!row) {
            db.run(`INSERT INTO users (id, username, referidor_id) VALUES (?, ?, ?)`, [userId, username, referidorId]);
            
            if (referidorId) {
                // Pagar al referidor
                db.run(`UPDATE users SET referidos = referidos + 1, balance = balance + 1.5 WHERE id = ?`, [referidorId]);
                bot.telegram.sendMessage(referidorId, `🎉 <b>¡Nuevo Referido!</b>\n\nHas ganado <b>+1.5 USDT</b> por invitar a un amigo. ¡Sigue así!`, { parse_mode: 'HTML' });
            }
        }

        // MENSAJE DE BIENVENIDA PREMIUM
        const welcomeMessage = `
<b>✨ ¡BIENVENIDO A GOLDNEXUS! ✨</b>

La plataforma #1 donde puedes ganar <b>USDT</b> de forma fácil y rápida realizando microtareas.

<b>💼 ¿Cómo funciona?</b>
🔹 Únete a nuestros canales y bots aliados.
🔹 Completa tareas diarias (Check-in).
🔹 Invita a amigos y sube en el ranking.
🔹 Retira tus ganancias a tu billetera BEP20.

<b>💰 ¡Empieza a ganar ahora mismo!</b>
Toca el botón de abajo para abrir tu billetera y ver las tareas disponibles.

<i>⚡ Powered by GoldNexus</i>
        `;

        ctx.replyWithHTML(welcomeMessage, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🚀 Abrir GoldNexus', web_app: { url: process.env.MINI_APP_URL } }],
                    [{ text: '🌐 Cambiar Idioma', callback_data: 'change_language' }]
                ]
            }
        });
    });
});

// ==================== CAMBIO DE IDIOMA ====================
bot.command('language', (ctx) => {
    ctx.reply('🌐 Elige tu idioma / Choose your language / Выберите язык:', 
        Markup.inlineKeyboard([
            [Markup.button.callback('🇪🇸 Español', 'lang_es')],
            [Markup.button.callback('🇬🇧 English', 'lang_en')],
            [Markup.button.callback('🇷🇺 Русский', 'lang_ru')]
        ])
    );
});

bot.action(/lang_(.+)/, (ctx) => {
    const lang = ctx.match[1];
    db.run(`UPDATE users SET language = ? WHERE id = ?`, [lang, ctx.from.id]);
    ctx.answerCbQuery('✅ Idioma actualizado');
    ctx.editMessageText('✅ Idioma cambiado. Abre la Mini App para ver los cambios.');
});

bot.action('change_language', (ctx) => {
    ctx.reply('🌐 Elige tu idioma / Choose your language / Выберите язык:', 
        Markup.inlineKeyboard([
            [Markup.button.callback('🇪🇸 Español', 'lang_es')],
            [Markup.button.callback('🇬🇧 English', 'lang_en')],
            [Markup.button.callback('🇷🇺 Русский', 'lang_ru')]
        ])
    );
});

// ==================== VERIFICACIÓN DE TAREAS (PAGO DIRECTO) ====================
bot.on('web_app_data', async (ctx) => {
    try {
        const data = JSON.parse(ctx.webAppData.data);
        
        // Si la acción es verificar una tarea
        if (data.action === 'verify_task') {
            const { taskId, userId } = data;
            
            // Buscamos la tarea
            db.get(`SELECT * FROM tasks WHERE id = ? AND active = 1`, [taskId], (err, task) => {
                if (!task) return ctx.reply('❌ Tarea no encontrada.');

                // Verificamos si ya la completó antes
                db.get(`SELECT * FROM completed_tasks WHERE user_id = ? AND task_id = ?`, [userId, taskId], (err, completed) => {
                    if (completed) return ctx.reply('⚠️ Ya completaste esta tarea.');
                    
                    // PAGAMOS DIRECTAMENTE (Sin verificar en Telegram)
                    db.run(`INSERT INTO completed_tasks (user_id, task_id) VALUES (?, ?)`, [userId, taskId]);
                    db.run(`UPDATE users SET balance = balance + ? WHERE id = ?`, [task.reward, userId]);
                    
                    // Bono de referidos de 3 tareas
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

                    // Le avisamos al usuario en el chat
                    ctx.replyWithHTML(`✅ <b>¡Tarea completada con éxito!</b>\n\nHas ganado <b>${task.reward} USDT</b>. Vuelve a la app para seguir avanzando.`, { parse_mode: 'HTML' });
                });
            });
        }
    } catch (e) { 
        console.log("Error web app data", e); 
    }
});

module.exports = bot;
