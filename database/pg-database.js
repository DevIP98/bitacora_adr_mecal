const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

/**
 * Clase para manejar la base de datos PostgreSQL
 * Implementa la misma interfaz pública que la anterior clase SQLite
 * para mantener compatibilidad
 */
class PostgresDatabase {
    constructor() {
        this.pool = null;
        this.connected = false;
        this.currentDbPath = 'postgres';
    }

    connect() {
        return new Promise((resolve, reject) => {
            try {
                console.log('🔄 [DATABASE] Conectando a PostgreSQL...');
                
                // Para entorno de desarrollo, permite conectar a una base local 
                // Para producción, usa la URL proporcionada por Render
                const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/bitacora';
                
                console.log(`🔄 [DATABASE] Usando conexión: ${connectionString.split('@')[0].replace(/:[^:]*@/, ':***@')}`);
                
                // Configurar el pool de conexiones
                this.pool = new Pool({
                    connectionString,
                    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
                });
                
                // Verificar la conexión
                this.pool.query('SELECT NOW()', (err, result) => {
                    if (err) {
                        console.error('❌ [DATABASE] Error conectando a PostgreSQL:', err);
                        this.connected = false;
                        reject(err);
                    } else {
                        console.log(`✅ [DATABASE] Conectado a PostgreSQL: ${result.rows[0].now}`);
                        this.connected = true;
                        resolve();
                    }
                });
            } catch (error) {
                console.error('❌ [DATABASE] Error en la configuración de PostgreSQL:', error);
                reject(error);
            }
        });
    }

    async initDatabase() {
        return new Promise(async (resolve, reject) => {
            try {
                console.log('🔄 [DATABASE] Iniciando conexión a PostgreSQL...');
                await this.connect();
                
                console.log('🔄 [DATABASE] Creando tablas...');
                await this.createTables();
                
                console.log('🔄 [DATABASE] Verificando usuario por defecto...');
                await this.createDefaultUser();
                
                console.log('✅ [DATABASE] Inicialización completada exitosamente');
                resolve();
            } catch (error) {
                console.error('❌ [DATABASE] Error en inicialización:', {
                    message: error.message,
                    error
                });
                reject(error);
            }
        });
    }

    createTables() {
        return new Promise(async (resolve, reject) => {
            try {
                const queries = [
                    // Tabla de usuarios (maestros/líderes)
                    `CREATE TABLE IF NOT EXISTS users (
                        id SERIAL PRIMARY KEY,
                        username TEXT UNIQUE NOT NULL,
                        password TEXT NOT NULL,
                        name TEXT NOT NULL,
                        email TEXT,
                        role TEXT DEFAULT 'teacher',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )`,

                    // Tabla de niños
                    `CREATE TABLE IF NOT EXISTS children (
                        id SERIAL PRIMARY KEY,
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
                        active BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        created_by INTEGER REFERENCES users(id)
                    )`,

                    // Tabla de observaciones
                    `CREATE TABLE IF NOT EXISTS observations (
                        id SERIAL PRIMARY KEY,
                        child_id INTEGER NOT NULL REFERENCES children(id),
                        observer_id INTEGER NOT NULL REFERENCES users(id),
                        observation_date DATE NOT NULL,
                        observation_types TEXT,
                        description TEXT NOT NULL,
                        tags TEXT,
                        
                        talked_with_child BOOLEAN DEFAULT FALSE,
                        prayed_for_issue BOOLEAN DEFAULT FALSE,
                        notified_parents BOOLEAN DEFAULT FALSE,
                        requires_followup BOOLEAN DEFAULT FALSE,
                        additional_comments TEXT,
                        
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        
                        CONSTRAINT fk_child FOREIGN KEY (child_id) REFERENCES children(id),
                        CONSTRAINT fk_observer FOREIGN KEY (observer_id) REFERENCES users(id)
                    )`,

                    // Tabla de conversaciones reflexivas
                    `CREATE TABLE IF NOT EXISTS reflective_conversations (
                        id SERIAL PRIMARY KEY,
                        child_id INTEGER NOT NULL REFERENCES children(id),
                        observer_id INTEGER NOT NULL REFERENCES users(id),
                        conversation_date DATE NOT NULL,
                        questions_responses TEXT,
                        observer_notes TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        
                        CONSTRAINT fk_child_refl FOREIGN KEY (child_id) REFERENCES children(id),
                        CONSTRAINT fk_observer_refl FOREIGN KEY (observer_id) REFERENCES users(id)
                    )`
                ];

                // Ejecutar cada consulta en secuencia
                for (const query of queries) {
                    await this.pool.query(query);
                }
                
                console.log('✅ [DATABASE] Tablas creadas correctamente');
                resolve();
            } catch (error) {
                console.error('❌ [DATABASE] Error creando tablas:', error);
                reject(error);
            }
        });
    }

    async createDefaultUser() {
        try {
            // Verificar si ya existe un usuario administrador
            const result = await this.pool.query("SELECT * FROM users WHERE username = 'admin'");
            
            if (result.rows.length === 0) {
                // Crear usuario administrador por defecto
                const hashedPassword = await bcrypt.hash('admin123', 10);
                
                await this.pool.query(
                    "INSERT INTO users (username, password, name, role) VALUES ($1, $2, $3, $4)",
                    ['admin', hashedPassword, 'Administrador', 'admin']
                );
                
                console.log('✅ [DATABASE] Usuario administrador creado - Usuario: admin, Contraseña: admin123');
            } else {
                console.log('ℹ️ [DATABASE] Usuario administrador ya existe');
            }
        } catch (error) {
            console.error('❌ [DATABASE] Error en createDefaultUser:', error);
            throw error;
        }
    }

    // Métodos para usuarios
    getUserByUsername(username) {
        return new Promise(async (resolve, reject) => {
            try {
                console.log('🔍 [DB] Buscando usuario en base de datos:', username);
                
                const result = await this.pool.query(
                    "SELECT * FROM users WHERE username = $1",
                    [username]
                );
                
                const user = result.rows.length > 0 ? result.rows[0] : null;
                
                console.log('🔍 [DB] Resultado consulta usuario:', user ? 'ENCONTRADO' : 'NO ENCONTRADO');
                if (user) {
                    console.log('🔍 [DB] Datos usuario:', {
                        id: user.id,
                        username: user.username,
                        name: user.name,
                        role: user.role,
                        hasPassword: !!user.password,
                        passwordLength: user.password ? user.password.length : 0
                    });
                }
                
                resolve(user);
            } catch (error) {
                console.error('❌ [DB] Error consultando usuario:', error);
                reject(error);
            }
        });
    }

    getAllUsers() {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.pool.query(
                    "SELECT id, username, name, role, created_at FROM users ORDER BY created_at DESC"
                );
                
                console.log('🔍 [DB] Total usuarios en base de datos:', result.rows.length);
                resolve(result.rows);
            } catch (error) {
                console.error('❌ [DB] Error obteniendo usuarios:', error);
                reject(error);
            }
        });
    }

    async createEmergencyAdmin() {
        try {
            // Verificar si ya existe un admin
            console.log('🔍 [DB] Verificando usuario admin...');
            const existingAdmin = await this.getUserByUsername('admin');
            
            if (!existingAdmin) {
                console.log('🔧 [DB] Creando usuario admin de emergencia...');
                
                const hashedPassword = await bcrypt.hash('admin123', 10);
                console.log('🔍 [DB] Password hasheado, longitud:', hashedPassword.length);
                
                const result = await this.pool.query(
                    "INSERT INTO users (username, password, name, role) VALUES ($1, $2, $3, $4) RETURNING id",
                    ['admin', hashedPassword, 'Administrador', 'admin']
                );
                
                console.log('✅ [DB] Usuario admin creado con ID:', result.rows[0].id);
                return result.rows[0].id;
            } else {
                console.log('ℹ️ [DB] Usuario admin ya existe con ID:', existingAdmin.id);
                return existingAdmin.id;
            }
        } catch (error) {
            console.error('❌ [DB] Error en createEmergencyAdmin:', error);
            throw error;
        }
    }

    createUser(userData) {
        return new Promise(async (resolve, reject) => {
            try {
                const { username, password, name, email, role } = userData;
                
                const result = await this.pool.query(
                    "INSERT INTO users (username, password, name, email, role) VALUES ($1, $2, $3, $4, $5) RETURNING id",
                    [username, password, name, email, role]
                );
                
                resolve(result.rows[0].id);
            } catch (error) {
                reject(error);
            }
        });
    }

    // Métodos para niños
    getAllChildren() {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.pool.query(
                    "SELECT * FROM children WHERE active = TRUE ORDER BY name, last_name"
                );
                
                resolve(result.rows);
            } catch (error) {
                reject(error);
            }
        });
    }

    getChildById(id) {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.pool.query(
                    "SELECT * FROM children WHERE id = $1",
                    [id]
                );
                
                resolve(result.rows.length > 0 ? result.rows[0] : null);
            } catch (error) {
                reject(error);
            }
        });
    }

    createChild(childData) {
        return new Promise(async (resolve, reject) => {
            try {
                const { 
                    name, last_name, age, birthdate, group_name, parent_name, 
                    parent_phone, parent_email, emergency_contact, special_needs, 
                    notes, created_by 
                } = childData;
                
                const result = await this.pool.query(
                    `INSERT INTO children (
                        name, last_name, age, birthdate, group_name, parent_name,
                        parent_phone, parent_email, emergency_contact, special_needs,
                        notes, created_by
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
                    [
                        name, last_name, age, birthdate, group_name, parent_name,
                        parent_phone, parent_email, emergency_contact, special_needs,
                        notes, created_by
                    ]
                );
                
                resolve(result.rows[0].id);
            } catch (error) {
                reject(error);
            }
        });
    }

    updateChild(id, childData) {
        return new Promise(async (resolve, reject) => {
            try {
                const { 
                    name, last_name, age, birthdate, group_name, parent_name,
                    parent_phone, parent_email, emergency_contact, special_needs, notes
                } = childData;
                
                const result = await this.pool.query(
                    `UPDATE children SET 
                     name = $1, last_name = $2, age = $3, birthdate = $4, 
                     group_name = $5, parent_name = $6, parent_phone = $7, 
                     parent_email = $8, emergency_contact = $9, 
                     special_needs = $10, notes = $11
                     WHERE id = $12`,
                    [
                        name, last_name, age, birthdate, group_name, parent_name,
                        parent_phone, parent_email, emergency_contact, special_needs,
                        notes, id
                    ]
                );
                
                resolve(result.rowCount);
            } catch (error) {
                reject(error);
            }
        });
    }

    // Métodos para observaciones
    getObservationsByChild(childId) {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.pool.query(
                    `SELECT o.*, u.name as observer_name, c.name as child_name, 
                     c.last_name as child_last_name
                     FROM observations o
                     JOIN users u ON o.observer_id = u.id
                     JOIN children c ON o.child_id = c.id
                     WHERE o.child_id = $1
                     ORDER BY o.observation_date DESC`,
                    [childId]
                );
                
                resolve(result.rows);
            } catch (error) {
                reject(error);
            }
        });
    }

    getRecentObservations(limit = 10) {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.pool.query(
                    `SELECT o.*, u.name as observer_name, c.name as child_name,
                     c.last_name as child_last_name
                     FROM observations o
                     JOIN users u ON o.observer_id = u.id
                     JOIN children c ON o.child_id = c.id
                     ORDER BY o.created_at DESC
                     LIMIT $1`,
                    [limit]
                );
                
                resolve(result.rows);
            } catch (error) {
                reject(error);
            }
        });
    }

    createObservation(observationData) {
        return new Promise(async (resolve, reject) => {
            try {
                const { 
                    child_id, observer_id, observation_date, observation_types,
                    description, tags, talked_with_child, prayed_for_issue,
                    notified_parents, requires_followup, additional_comments
                } = observationData;
                
                const result = await this.pool.query(
                    `INSERT INTO observations (
                        child_id, observer_id, observation_date, observation_types,
                        description, tags, talked_with_child, prayed_for_issue,
                        notified_parents, requires_followup, additional_comments
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
                    [
                        child_id, observer_id, observation_date, observation_types,
                        description, tags, talked_with_child, prayed_for_issue,
                        notified_parents, requires_followup, additional_comments
                    ]
                );
                
                resolve(result.rows[0].id);
            } catch (error) {
                reject(error);
            }
        });
    }

    getAllObservations() {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.pool.query(
                    `SELECT o.*, u.name as observer_name, c.name as child_name,
                     c.last_name as child_last_name
                     FROM observations o
                     JOIN users u ON o.observer_id = u.id
                     JOIN children c ON o.child_id = c.id
                     ORDER BY o.created_at DESC`
                );
                
                resolve(result.rows);
            } catch (error) {
                reject(error);
            }
        });
    }

    async isHealthy() {
        if (!this.pool || !this.connected) {
            return false;
        }

        try {
            const result = await this.pool.query('SELECT 1 as test');
            console.log('✅ [DATABASE] Health check passed');
            return result.rows[0].test === 1;
        } catch (error) {
            console.error('❌ [DATABASE] Health check failed:', error);
            return false;
        }
    }

    getStatus() {
        return {
            connected: this.connected,
            currentPath: this.currentDbPath,
            isMemory: false
        };
    }

    close() {
        if (this.pool) {
            this.pool.end()
                .then(() => console.log('✅ [DATABASE] Pool de conexiones cerrado'))
                .catch(err => console.error('❌ [DATABASE] Error cerrando pool:', err));
        }
    }
}

const database = new PostgresDatabase();
module.exports = database;
