const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

// Determinar la ruta de la base de datos según el entorno
const DB_PATH = process.env.NODE_ENV === 'production' 
    ? path.join(__dirname, 'bitacora.db')
    : path.join(__dirname, 'bitacora.db');

class Database {
    constructor() {
        this.db = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            // Crear directorio si no existe (importante para producción)
            const fs = require('fs');
            const dbDir = path.dirname(DB_PATH);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            this.db = new sqlite3.Database(DB_PATH, (err) => {
                if (err) {
                    console.error('❌ Error conectando a la base de datos:', err);
                    reject(err);
                } else {
                    console.log('✅ Conectado a la base de datos SQLite en:', DB_PATH);
                    // Configurar opciones de SQLite para mejor rendimiento
                    this.db.run('PRAGMA foreign_keys = ON');
                    this.db.run('PRAGMA journal_mode = WAL');
                    resolve();
                }
            });
        });
    }

    initDatabase() {
        return new Promise(async (resolve, reject) => {
            try {
                await this.connect();
                await this.createTables();
                await this.createDefaultUser();
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    createTables() {
        return new Promise((resolve, reject) => {
            const queries = [
                // Tabla de usuarios (maestros/líderes)
                `CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    name TEXT NOT NULL,
                    email TEXT,
                    role TEXT DEFAULT 'teacher',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,

                // Tabla de niños
                `CREATE TABLE IF NOT EXISTS children (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    last_name TEXT NOT NULL,
                    age INTEGER,
                    birthdate DATE,
                    group_name TEXT,
                    parent_name TEXT,
                    parent_phone TEXT,
                    parent_email TEXT,
                    emergency_contact TEXT,
                    special_needs TEXT,
                    notes TEXT,
                    active BOOLEAN DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_by INTEGER,
                    FOREIGN KEY (created_by) REFERENCES users(id)
                )`,

                // Tabla de observaciones
                `CREATE TABLE IF NOT EXISTS observations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    child_id INTEGER NOT NULL,
                    observer_id INTEGER NOT NULL,
                    observation_date DATE NOT NULL,
                    observation_types TEXT, -- JSON array de tipos de observación
                    description TEXT NOT NULL,
                    tags TEXT, -- JSON array de etiquetas (positivo, seguimiento, alerta)
                    
                    -- Acciones tomadas
                    talked_with_child BOOLEAN DEFAULT 0,
                    prayed_for_issue BOOLEAN DEFAULT 0,
                    notified_parents BOOLEAN DEFAULT 0,
                    requires_followup BOOLEAN DEFAULT 0,
                    additional_comments TEXT,
                    
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    
                    FOREIGN KEY (child_id) REFERENCES children(id),
                    FOREIGN KEY (observer_id) REFERENCES users(id)
                )`,

                // Tabla de conversaciones reflexivas
                `CREATE TABLE IF NOT EXISTS reflective_conversations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    child_id INTEGER NOT NULL,
                    observer_id INTEGER NOT NULL,
                    conversation_date DATE NOT NULL,
                    questions_responses TEXT, -- JSON con preguntas y respuestas
                    observer_notes TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    
                    FOREIGN KEY (child_id) REFERENCES children(id),
                    FOREIGN KEY (observer_id) REFERENCES users(id)
                )`
            ];

            let completed = 0;
            queries.forEach((query, index) => {
                this.db.run(query, (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    completed++;
                    if (completed === queries.length) {
                        console.log('Tablas creadas correctamente');
                        resolve();
                    }
                });
            });
        });
    }

    async createDefaultUser() {
        return new Promise(async (resolve, reject) => {
            try {
                // Verificar si ya existe un usuario administrador
                this.db.get("SELECT * FROM users WHERE username = 'admin'", async (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (!row) {
                        // Crear usuario administrador por defecto
                        const hashedPassword = await bcrypt.hash('admin123', 10);
                        this.db.run(
                            "INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)",
                            ['admin', hashedPassword, 'Administrador', 'admin'],
                            (err) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    console.log('Usuario administrador creado - Usuario: admin, Contraseña: admin123');
                                    resolve();
                                }
                            }
                        );
                    } else {
                        resolve();
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    // Métodos para usuarios
    getUserByUsername(username) {
        return new Promise((resolve, reject) => {
            this.db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    createUser(userData) {
        return new Promise((resolve, reject) => {
            const { username, password, name, email, role } = userData;
            this.db.run(
                "INSERT INTO users (username, password, name, email, role) VALUES (?, ?, ?, ?, ?)",
                [username, password, name, email, role],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    // Métodos para niños
    getAllChildren() {
        return new Promise((resolve, reject) => {
            this.db.all("SELECT * FROM children WHERE active = 1 ORDER BY name, last_name", (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    getChildById(id) {
        return new Promise((resolve, reject) => {
            this.db.get("SELECT * FROM children WHERE id = ?", [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    createChild(childData) {
        return new Promise((resolve, reject) => {
            const { name, last_name, age, birthdate, group_name, parent_name, parent_phone, parent_email, emergency_contact, special_needs, notes, created_by } = childData;
            this.db.run(
                `INSERT INTO children (name, last_name, age, birthdate, group_name, parent_name, parent_phone, parent_email, emergency_contact, special_needs, notes, created_by) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [name, last_name, age, birthdate, group_name, parent_name, parent_phone, parent_email, emergency_contact, special_needs, notes, created_by],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    updateChild(id, childData) {
        return new Promise((resolve, reject) => {
            const { name, last_name, age, birthdate, group_name, parent_name, parent_phone, parent_email, emergency_contact, special_needs, notes } = childData;
            this.db.run(
                `UPDATE children SET name = ?, last_name = ?, age = ?, birthdate = ?, group_name = ?, parent_name = ?, parent_phone = ?, parent_email = ?, emergency_contact = ?, special_needs = ?, notes = ? 
                 WHERE id = ?`,
                [name, last_name, age, birthdate, group_name, parent_name, parent_phone, parent_email, emergency_contact, special_needs, notes, id],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    // Métodos para observaciones
    getObservationsByChild(childId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT o.*, u.name as observer_name, c.name as child_name, c.last_name as child_last_name
                 FROM observations o
                 JOIN users u ON o.observer_id = u.id
                 JOIN children c ON o.child_id = c.id
                 WHERE o.child_id = ?
                 ORDER BY o.observation_date DESC`,
                [childId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    getRecentObservations(limit = 10) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT o.*, u.name as observer_name, c.name as child_name, c.last_name as child_last_name
                 FROM observations o
                 JOIN users u ON o.observer_id = u.id
                 JOIN children c ON o.child_id = c.id
                 ORDER BY o.created_at DESC
                 LIMIT ?`,
                [limit],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    createObservation(observationData) {
        return new Promise((resolve, reject) => {
            const { child_id, observer_id, observation_date, observation_types, description, tags, talked_with_child, prayed_for_issue, notified_parents, requires_followup, additional_comments } = observationData;
            this.db.run(
                `INSERT INTO observations (child_id, observer_id, observation_date, observation_types, description, tags, talked_with_child, prayed_for_issue, notified_parents, requires_followup, additional_comments)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [child_id, observer_id, observation_date, observation_types, description, tags, talked_with_child, prayed_for_issue, notified_parents, requires_followup, additional_comments],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('Error al cerrar la base de datos:', err);
                } else {
                    console.log('Conexión a la base de datos cerrada');
                }
            });
        }
    }
}

const database = new Database();
module.exports = database;
