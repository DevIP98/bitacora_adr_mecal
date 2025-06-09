const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

// Determinar la ruta de la base de datos según el entorno
// CONFIGURACIÓN RENDER: Usar SOLO memoria en producción ya que parece haber restricciones para archivos SQLite
const DB_PATHS = process.env.NODE_ENV === 'production' 
    ? [
        ':memory:'                                       // Única opción: memoria
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
            return;        } catch (error) {
            console.warn(`⚠️ [DATABASE] Falló conexión a ${dbPath}:`, {
                message: error.message,
                code: error.code,
                errno: error.errno
            });
            
            // Limpiar referencia de DB fallida
            if (this.db) {
                try {
                    this.db.close();
                } catch (closeErr) {
                    console.warn('⚠️ [DATABASE] Error cerrando DB fallida:', closeErr.message);
                }
                this.db = null;
            }
            
            // Si no es la última ruta, intentar la siguiente
            if (pathIndex < DB_PATHS.length - 1) {
                console.log('🔄 [DATABASE] Intentando siguiente ruta...');
                return this.tryConnectSequential(pathIndex + 1);
            } else {
                // Si todas las rutas fallaron, arrojar el último error pero de forma controlada
                const finalError = new Error(`❌ [DATABASE] Agotadas todas las rutas. Último error: ${error.message}`);
                finalError.originalError = error;
                throw finalError;
            }
        }
    }    tryConnect(dbPath) {
        return new Promise((resolve, reject) => {
            let connectionResolved = false;

            // Solo crear directorio si no es memoria
            if (dbPath !== ':memory:') {
                const dbDir = path.dirname(dbPath);
                console.log('📁 [DATABASE] Verificando directorio:', dbDir);
                
                try {
                    if (!fs.existsSync(dbDir)) {
                        console.log('📁 [DATABASE] Creando directorio de base de datos:', dbDir);
                        fs.mkdirSync(dbDir, { recursive: true });
                        console.log('✅ [DATABASE] Directorio creado exitosamente');
                    } else {
                        console.log('✅ [DATABASE] Directorio ya existe');
                    }

                    // Verificar permisos de escritura en el directorio
                    fs.accessSync(dbDir, fs.constants.W_OK);
                    console.log('✅ [DATABASE] Permisos de escritura verificados para el directorio');

                    // >>> INICIO NUEVO BLOQUE DE DEPURACIÓN DE ARCHIVO <<<<<
                    console.log(`📁 [DATABASE] Verificando archivo específico: ${dbPath}`);
                    if (fs.existsSync(dbPath)) {
                        console.log('✅ [DATABASE] Archivo existe:', dbPath);
                        try {
                            fs.accessSync(dbPath, fs.constants.R_OK | fs.constants.W_OK);
                            console.log('✅ [DATABASE] Archivo tiene permisos de lectura/escritura.');
                        } catch (fileAccessError) {
                            console.error(`❌ [DATABASE] Error de acceso al archivo ${dbPath} (R_OK | W_OK):`, fileAccessError.message);
                            try {
                                const stats = fs.statSync(dbPath);
                                console.log(`ℹ️ [DATABASE] Estadísticas del archivo ${dbPath}: mode=${stats.mode.toString(8)}, uid=${stats.uid}, gid=${stats.gid}`);
                            } catch (statErr) {
                                console.error(`❌ [DATABASE] Error obteniendo estadísticas del archivo ${dbPath}:`, statErr.message);
                            }
                        }
                    } else {
                        console.log('ℹ️ [DATABASE] Archivo no existe, se intentará crear por SQLite:', dbPath);
                    }
                    // >>> FIN NUEVO BLOQUE DE DEPURACIÓN DE ARCHIVO <<<<<

                    // PRUEBA EXPLÍCITA DE ESCRITURA DE ARCHIVO
                    const testFilePath = path.join(path.dirname(dbPath), 'test_write.txt');
                    try {
                        console.log(`🔬 [DATABASE] Probando escritura explícita: ${testFilePath}`);
                        fs.writeFileSync(testFilePath, 'Test de escritura: ' + new Date().toISOString());
                        console.log('✅ [DATABASE] Escritura exitosa en:', testFilePath);
                        const readBack = fs.readFileSync(testFilePath, 'utf8');
                        console.log(`✅ [DATABASE] Lectura exitosa: ${readBack.substring(0, 20)}...`);
                    } catch (testWriteErr) {
                        console.error('❌ [DATABASE] Error en prueba de escritura:', testWriteErr.message);
                    }
                    // FIN PRUEBA EXPLÍCITA

                } catch (dirOrFileError) {
                    console.error('❌ [DATABASE] Error con directorio o archivo:', dirOrFileError);
                    reject(dirOrFileError);
                    return;
                }
            }
            
            console.log('🔄 [DATABASE] Intentando conectar a:', dbPath);
            
            // Timeout para evitar conexiones colgadas
            const timeoutId = setTimeout(() => {
                if (!connectionResolved) {
                    connectionResolved = true;
                    console.error('⏰ [DATABASE] Timeout en conexión a:', dbPath);
                    reject(new Error(`Timeout conectando a ${dbPath}`));
                }
            }, 5000); // 5 segundos timeout

            this.db = new sqlite3.Database(dbPath, (err) => {
                if (connectionResolved) return;
                clearTimeout(timeoutId);
                connectionResolved = true;

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
                    
                    // Configurar manejo de errores DESPUÉS de conexión exitosa
                    this.db.on('error', (err) => {
                        console.error('❌ [DATABASE] Evento de error SQLite post-conexión:', err);
                        // No rechazar aquí para evitar crashes
                    });
                    
                    resolve();
                }
            });
        });
    }    initDatabase() {
        return new Promise(async (resolve, reject) => {
            try {
                console.log('🔄 [DATABASE] Iniciando conexión...');
                await this.connect();
                
                console.log('🔄 [DATABASE] Creando tablas...');
                await this.createTables();
                
                // Si estamos en memoria y en producción, intentar importar datos
                if (this.currentDbPath === ':memory:' && process.env.NODE_ENV === 'production') {
                    console.log('🔄 [DATABASE] Base de datos en memoria detectada, intentando importar datos...');
                    try {
                        await this.importDataFromJson();
                    } catch (importErr) {
                        console.error('⚠️ [DATABASE] Error importando datos:', importErr.message);
                    }
                }
                
                console.log('🔄 [DATABASE] Verificando usuario por defecto...');
                await this.createDefaultUser();
                
                console.log('✅ [DATABASE] Inicialización completada exitosamente');
                resolve();
            } catch (error) {
                console.error('❌ [DATABASE] Error en inicialización:', {
                    message: error.message,
                    code: error.code,
                    errno: error.errno,
                    originalError: error.originalError?.message
                });
                
                // Verificar si tenemos al menos una conexión parcial
                if (this.db) {
                    console.log('⚠️ [DATABASE] Conexión parcial disponible, intentando operación degradada...');
                    try {
                        // Intentar operaciones básicas con la conexión que tenemos
                        await this.createTables();
                        console.log('✅ [DATABASE] Tablas creadas con conexión degradada');
                        resolve();
                        return;
                    } catch (degradedError) {
                        console.error('❌ [DATABASE] Falló operación degradada:', degradedError.message);
                    }
                }
                
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

    // Obtener todas las observaciones
    getAllObservations() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT o.*, u.name as observer_name, c.name as child_name, c.last_name as child_last_name
                 FROM observations o
                 JOIN users u ON o.observer_id = u.id
                 JOIN children c ON o.child_id = c.id
                 ORDER BY o.created_at DESC`,
                [],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    // Verificar si la base de datos está disponible y funcionando
    async isHealthy() {
        if (!this.db) {
            return false;
        }

        return new Promise((resolve) => {
            this.db.get("SELECT 1 as test", (err, row) => {
                if (err) {
                    console.error('❌ [DATABASE] Health check failed:', err);
                    resolve(false);
                } else {
                    console.log('✅ [DATABASE] Health check passed');
                    resolve(true);
                }
            });
        });
    }

    // Obtener información de estado de la base de datos
    getStatus() {
        return {
            connected: !!this.db,
            currentPath: this.currentDbPath,
            isMemory: this.currentDbPath === ':memory:'
        };
    }

    // Exportar datos a JSON para persistencia en entorno Render
    exportDataToJson() {
        if (!this.db || process.env.NODE_ENV !== 'production') {
            return Promise.resolve(false);
        }

        return new Promise((resolve, reject) => {
            console.log('📤 [DATABASE] Exportando datos a JSON...');
            
            const exportPath = '/tmp/bitacora_data_export.json';
            const data = { users: [], children: [], observations: [] };
            
            Promise.all([
                // Exportar usuarios
                new Promise((resolveUsers, rejectUsers) => {
                    this.db.all("SELECT * FROM users", [], (err, rows) => {
                        if (err) rejectUsers(err);
                        else {
                            data.users = rows;
                            console.log(`📤 [DATABASE] ${rows.length} usuarios exportados`);
                            resolveUsers();
                        }
                    });
                }),
                
                // Exportar niños
                new Promise((resolveChildren, rejectChildren) => {
                    this.db.all("SELECT * FROM children", [], (err, rows) => {
                        if (err) rejectChildren(err);
                        else {
                            data.children = rows;
                            console.log(`📤 [DATABASE] ${rows.length} niños exportados`);
                            resolveChildren();
                        }
                    });
                }),
                
                // Exportar observaciones
                new Promise((resolveObs, rejectObs) => {
                    this.db.all("SELECT * FROM observations", [], (err, rows) => {
                        if (err) rejectObs(err);
                        else {
                            data.observations = rows;
                            console.log(`📤 [DATABASE] ${rows.length} observaciones exportadas`);
                            resolveObs();
                        }
                    });
                })
            ])
            .then(() => {
                try {
                    fs.writeFileSync(exportPath, JSON.stringify(data, null, 2));
                    console.log(`✅ [DATABASE] Datos exportados a ${exportPath}`);
                    resolve(true);
                } catch (writeErr) {
                    console.error('❌ [DATABASE] Error escribiendo exportación:', writeErr);
                    reject(writeErr);
                }
            })
            .catch(err => {
                console.error('❌ [DATABASE] Error exportando datos:', err);
                reject(err);
            });
        });
    }

    // Importar datos desde JSON al iniciar con base de datos en memoria
    importDataFromJson() {
        if (!this.db || this.currentDbPath !== ':memory:' || process.env.NODE_ENV !== 'production') {
            return Promise.resolve(false);
        }

        return new Promise((resolve, reject) => {
            const importPath = '/tmp/bitacora_data_export.json';
            console.log('📥 [DATABASE] Intentando importar datos desde', importPath);
            
            if (!fs.existsSync(importPath)) {
                console.log('ℹ️ [DATABASE] Archivo de importación no existe, omitiendo importación');
                return resolve(false);
            }
            
            try {
                const jsonData = JSON.parse(fs.readFileSync(importPath, 'utf8'));
                console.log('📥 [DATABASE] Datos leídos correctamente:', {
                    users: jsonData.users?.length || 0,
                    children: jsonData.children?.length || 0,
                    observations: jsonData.observations?.length || 0
                });
                
                // Importar datos en secuencia
                Promise.resolve()
                // Primero importar usuarios
                .then(() => {
                    if (!jsonData.users?.length) return;
                    
                    const importPromises = jsonData.users.map(user => {
                        return new Promise((resolveUser, rejectUser) => {
                            this.db.run(
                                `INSERT OR REPLACE INTO users 
                                (id, username, password, name, email, role, created_at) 
                                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                                [user.id, user.username, user.password, user.name, 
                                 user.email, user.role, user.created_at],
                                err => {
                                    if (err) rejectUser(err);
                                    else resolveUser();
                                }
                            );
                        });
                    });
                    
                    return Promise.all(importPromises)
                    .then(() => {
                        console.log(`✅ [DATABASE] ${jsonData.users.length} usuarios importados`);
                    });
                })
                
                // Luego importar niños
                .then(() => {
                    if (!jsonData.children?.length) return;
                    
                    const importPromises = jsonData.children.map(child => {
                        return new Promise((resolveChild, rejectChild) => {
                            this.db.run(
                                `INSERT OR REPLACE INTO children 
                                (id, name, last_name, age, birthdate, group_name, 
                                parent_name, parent_phone, parent_email, emergency_contact, 
                                special_needs, notes, active, created_at, created_by) 
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                [child.id, child.name, child.last_name, child.age, 
                                 child.birthdate, child.group_name, child.parent_name, 
                                 child.parent_phone, child.parent_email, child.emergency_contact,
                                 child.special_needs, child.notes, child.active, 
                                 child.created_at, child.created_by],
                                err => {
                                    if (err) rejectChild(err);
                                    else resolveChild();
                                }
                            );
                        });
                    });
                    
                    return Promise.all(importPromises)
                    .then(() => {
                        console.log(`✅ [DATABASE] ${jsonData.children.length} niños importados`);
                    });
                })
                
                // Finalmente importar observaciones
                .then(() => {
                    if (!jsonData.observations?.length) return;
                    
                    const importPromises = jsonData.observations.map(obs => {
                        return new Promise((resolveObs, rejectObs) => {
                            this.db.run(
                                `INSERT OR REPLACE INTO observations 
                                (id, child_id, observer_id, observation_date, observation_types, 
                                description, tags, talked_with_child, prayed_for_issue, 
                                notified_parents, requires_followup, additional_comments, 
                                created_at, updated_at) 
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                [obs.id, obs.child_id, obs.observer_id, obs.observation_date, 
                                 obs.observation_types, obs.description, obs.tags, 
                                 obs.talked_with_child, obs.prayed_for_issue, obs.notified_parents, 
                                 obs.requires_followup, obs.additional_comments, 
                                 obs.created_at, obs.updated_at],
                                err => {
                                    if (err) rejectObs(err);
                                    else resolveObs();
                                }
                            );
                        });
                    });
                    
                    return Promise.all(importPromises)
                    .then(() => {
                        console.log(`✅ [DATABASE] ${jsonData.observations.length} observaciones importadas`);
                    });
                })
                
                // Finalizar importación
                .then(() => {
                    console.log('✅ [DATABASE] Importación completada exitosamente');
                    resolve(true);
                })
                .catch(importErr => {
                    console.error('❌ [DATABASE] Error durante la importación:', importErr);
                    // A pesar del error, no rechazamos la promesa para permitir que la aplicación continúe
                    resolve(false);
                });
                
            } catch (readErr) {
                console.error('❌ [DATABASE] Error leyendo archivo de importación:', readErr);
                resolve(false);
            }
        });
    }

    close() {
        if (this.db) {
            // Si estamos en producción y usando memoria, exportar datos antes de cerrar
            if (process.env.NODE_ENV === 'production' && this.currentDbPath === ':memory:') {
                console.log('🔄 [DATABASE] Exportando datos antes de cerrar...');
                this.exportDataToJson()
                    .then(() => {
                        this.db.close((err) => {
                            if (err) {
                                console.error('❌ Error al cerrar la base de datos:', err);
                            } else {
                                console.log('✅ [DATABASE] Conexión cerrada después de exportar datos');
                            }
                        });
                    })
                    .catch(err => {
                        console.error('❌ [DATABASE] Error exportando datos al cerrar:', err);
                        this.db.close();
                    });
            } else {
                this.db.close((err) => {
                    if (err) {
                        console.error('❌ [DATABASE] Error al cerrar la base de datos:', err);
                    } else {
                        console.log('✅ [DATABASE] Conexión a la base de datos cerrada');
                    }
                });
            }
        }
    }
}

const database = new Database();
module.exports = database;
