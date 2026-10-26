const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Crear la carpeta data si no existe
const dataDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

const dbPath = path.resolve(dataDir, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Error abriendo DB:', err.message);
    else console.log('Conectado a SQLite.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        username TEXT,
        balance REAL DEFAULT 0,
        referidos INTEGER DEFAULT 0,
        referidor_id INTEGER,
        language TEXT DEFAULT 'es',
        wallet TEXT,
        network TEXT,
        banned INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // AÑADIDO: Columna 'type' para saber si es canal o bot
    db.run(`CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        link TEXT,
        reward REAL,
        type TEXT DEFAULT 'channel',
        active INTEGER DEFAULT 1
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS completed_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        task_id INTEGER,
        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, task_id)
    )`);

    // AÑADIDO: Columna 'network' para guardar la red (BEP20, TRC20, etc.)
    db.run(`CREATE TABLE IF NOT EXISTS withdrawals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        amount REAL,
        wallet TEXT,
        network TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS checkins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        date TEXT,
        UNIQUE(user_id, date)
    )`);

    // Tabla para el capital del proyecto
    db.run(`CREATE TABLE IF NOT EXISTS project_config (
        id INTEGER PRIMARY KEY,
        capital_restante REAL,
        ultima_actualizacion INTEGER
    )`);
});

module.exports = db;
