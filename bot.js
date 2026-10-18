const { Telegraf, Markup } = require('telegraf');
const db = require('./database');
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = process.env.ADMIN_ID;

bot.start((ctx) => {
    const userId = ctx.from.id;
    const username = ctx.from.username || 'Usuario';
    const referidorId = ctx.startPayload ? parseInt(ctx.startPayload) : null;

    db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, row) => {
        if (row && row.banned === 1) return ctx.reply('🚫 Has sido expulsado del bot.');

        if (!row) {
            db.run(`INSERT INTO users (id, username, referidor_id) VALUES (?, ?, ?)`, [userId, username, referidorId]);
            if (referidorId) {
                db.run(`UPDATE users SET referidos = referidos + 1, balance = balance + 1.5 WHERE id = ?`, [referidorId]);
                bot.telegram.sendMessage(referidorId, `🎉 ¡Nuevo referido! Has ganado +1.5 USDT (ficticio).`);
            }
        }
    });

    ctx.reply(`¡Bienvenido a **GoldNexus**! 🌍\nGana recompensas, sube en el ranking y retira tus USDT.`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.webApp('🚀 Abrir GoldNexus', process.env.MINI_APP_URL)],
            [Markup.button.callback('🌐 Idioma / Language / Язык', 'change_language')]
        ])
    });
});

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

bot.on('web_app_data', async (ctx) => {
    try {
        const data = JSON.parse(ctx.webAppData.data);
        if (data.action === 'verify_task') {
            const { taskId, userId } = data;
            db.get(`SELECT * FROM tasks WHERE id = ? AND active = 1`, [taskId], async (err, task) => {
                if (!task) return ctx.reply('❌ Tarea no encontrada.');
                db.get(`SELECT * FROM completed_tasks WHERE user_id = ? AND task_id = ?`, [userId, taskId], async (err, completed) => {
                    if (completed) return ctx.reply('⚠️ Ya completaste esta tarea.');
                    try {
                        const channelUsername = task.link.replace('https://t.me/', '@');
                        const chatMember = await bot.telegram.getChatMember(channelUsername, userId);
                        if (['member', 'administrator', 'creator'].includes(chatMember.status)) {
                            db.run(`INSERT INTO completed_tasks (user_id, task_id) VALUES (?, ?)`, [userId, taskId]);
                            db.run(`UPDATE users SET balance = balance + ? WHERE id = ?`, [task.reward, userId]);
                            
                            db.get(`SELECT referidor_id FROM users WHERE id = ?`, [userId], (err, user) => {
                                if (user && user.referidor_id) {
                                    db.get(`SELECT COUNT(*) as total FROM completed_tasks WHERE user_id = ?`, [userId], (err, count) => {
                                        if (count.total === 3) {
                                            db.run(`UPDATE users SET balance = balance + 0.5 WHERE id = ?`, [user.referidor_id]);
                                            bot.telegram.sendMessage(user.referidor_id, `🎁 ¡Bono extra! Tu referido completó 3 tareas. +0.5 USDT.`);
                                        }
                                    });
                                }
                            });
                            ctx.reply(`✅ ¡Tarea completada! Has ganado ${task.reward} USDT.`);
                        } else {
                            ctx.reply('❌ No te has unido al canal todavía.');
                        }
                    } catch (error) {
                        ctx.reply('❌ Error. Asegúrate de unirte al canal.');
                    }
                });
            });
        }
    } catch (e) { console.log("Error web app data", e); }
});

module.exports = bot;
