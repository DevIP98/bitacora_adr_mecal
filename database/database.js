const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

// Determinar la ruta de la base de datos según el entorno
// HOTFIX: Usar memoria como última opción para garantizar funcionamiento
const DB_PATHS = process.env.NODE_ENV === 'production' 
    ? [
        '/tmp/bitacora.db',  // Intentar /tmp primero
        '/opt/render/project/src/database/bitacora.db',  // Luego disco persistente
        ':memory:'  // Como último recurso, usar memoria
      ]
    : [path.join(__dirname, 'bitacora.db')];

console.log('🗄️ [DATABASE] Rutas disponibles:', DB_PATHS);
console.log('🌐 [DATABASE] Entorno:', process.env.NODE_ENV || 'development');

class Database {
    constructor() {
        this.db = null;
        this.currentDbPath = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.tryConnectSequential(0).then(resolve).catch(reject);
        });
    }

    async tryConnectSequential(pathIndex) {
        if (pathIndex >= DB_PATHS.length) {
            throw new Error('❌ [DATABASE] Agotadas todas las rutas de conexión disponibles');
        }

        const dbPath = DB_PATHS[pathIndex];
        console.log(`🔄 [DATABASE] Intentando conexión ${pathIndex + 1}/${DB_PATHS.length}: ${dbPath}`);

        try {
            await this.tryConnect(dbPath);
            this.currentDbPath = dbPath;
            console.log(`✅ [DATABASE] Conectado exitosamente a: ${dbPath}`);
            return;
        } catch (error) {
            console.warn(`⚠️ [DATABASE] Falló conexión a ${dbPath}:`, error.message);
            
            // Si no es la última ruta, intentar la siguiente
            if (pathIndex < DB_PATHS.length - 1) {
                console.log('🔄 [DATABASE] Intentando siguiente ruta...');
                return this.tryConnectSequential(pathIndex + 1);
            } else {
                throw error;
            }
        }
    }

    tryConnect(dbPath) {
        return new Promise((resolve, reject) => {
            // Solo crear directorio si no es memoria
            if (dbPath !== ':memory:') {
                const dbDir = path.dirname(dbPath);
                console.log('📁 [DATABASE] Verificando directorio:', dbDir);
                
                try {                    if (!fs.existsSync(dbDir)) {
                        console.log('📁 [DATABASE] Creando directorio de base de datos:', dbDir);
                        fs.mkdirSync(dbDir, { recursive: true });
                        console.log('✅ [DATABASE] Directorio creado exitosamente');
                    } else {
                        console.log('✅ [DATABASE] Directorio ya existe');
                    }

                    // Verificar permisos de escritura en el directorio
                    fs.accessSync(dbDir, fs.constants.W_OK);
                    console.log('✅ [DATABASE] Permisos de escritura verificados');

                } catch (dirError) {
                    console.error('❌ [DATABASE] Error con directorio:', dirError);
                    reject(dirError);
                    return;                }
            }
            
            console.log('🔄 [DATABASE] Intentando conectar a:', dbPath);
            this.db = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    console.error('❌ [DATABASE] Error conectando a la base de datos:', {
                        error: err.message,
                        code: err.code,
                        errno: err.errno,
                        path: dbPath
                    });
                    reject(err);
                } else {
                    console.log('✅ [DATABASE] Conectado a la base de datos SQLite en:', dbPath);
                    // Configurar opciones de SQLite para mejor rendimiento
                    this.db.run('PRAGMA foreign_keys = ON');
                    this.db.run('PRAGMA journal_mode = WAL');
                    resolve();
                }
            });

            // Manejar eventos de error no capturados
            this.db.on('error', (err) => {
                console.error('❌ [DATABASE] Evento de error SQLite:', err);
                reject(err);
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
    }    // Métodos para usuarios
    getUserByUsername(username) {
        return new Promise((resolve, reject) => {
            console.log('🔍 [DB] Buscando usuario en base de datos:', username);
            
            const query = "SELECT * FROM users WHERE username = ?";
            this.db.get(query, [username], (err, row) => {
                if (err) {
                    console.error('❌ [DB] Error consultando usuario:', err);
                    reject(err);
                } else {
                    console.log('🔍 [DB] Resultado consulta usuario:', row ? 'ENCONTRADO' : 'NO ENCONTRADO');
                    if (row) {
                        console.log('🔍 [DB] Datos usuario:', {
                            id: row.id,
                            username: row.username,
                            name: row.name,
                            role: row.role,
                            hasPassword: !!row.password,
                            passwordLength: row.password ? row.password.length : 0
                        });
                    }
                    resolve(row);
                }
            });
        });
    }

    // Método para obtener todos los usuarios (debug)
    getAllUsers() {
        return new Promise((resolve, reject) => {
            const query = "SELECT id, username, name, role, created_at FROM users ORDER BY created_at DESC";
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    console.error('❌ [DB] Error obteniendo usuarios:', err);
                    reject(err);
                } else {
                    console.log('🔍 [DB] Total usuarios en base de datos:', rows.length);
                    resolve(rows);
                }
            });
        });
    }

    // Método para crear usuario admin de emergencia
    async createEmergencyAdmin() {
        try {
            // Verificar si ya existe un admin
            console.log('🔍 [DB] Verificando usuario admin...');
            const existingAdmin = await this.getUserByUsername('admin');
            
            if (!existingAdmin) {
                console.log('🔧 [DB] Creando usuario admin de emergencia...');
                
                const hashedPassword = await bcrypt.hash('admin123', 10);
                console.log('🔍 [DB] Password hasheado, longitud:', hashedPassword.length);
                
                await new Promise((resolve, reject) => {
                    const query = "INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)";
                    this.db.run(query, ['admin', hashedPassword, 'Administrador', 'admin'], function(err) {
                        if (err) {
                            console.error('❌ [DB] Error creando usuario admin:', err);
                            reject(err);
                        } else {
                            console.log('✅ [DB] Usuario admin creado con ID:', this.lastID);
                            resolve(this.lastID);
                        }
                    });
                });
            } else {
                console.log('ℹ️ [DB] Usuario admin ya existe con ID:', existingAdmin.id);
            }
        } catch (error) {
            console.error('❌ [DB] Error en createEmergencyAdmin:', error);
        }
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
