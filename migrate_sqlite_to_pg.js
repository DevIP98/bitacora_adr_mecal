// Script de migración de SQLite a PostgreSQL
// Este script lee la base de datos SQLite existente y la migra a PostgreSQL

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const pgDb = require('./database/pg-database');

// Definir rutas de la base de datos SQLite
const SQLITE_DB_PATHS = [
    path.join(__dirname, 'database', 'bitacora.db'),
    '/opt/render/project/src/database/bitacora.db',
    '/tmp/bitacora.db'
];

// Función para encontrar la base de datos SQLite
function findSqliteDb() {
    for (const dbPath of SQLITE_DB_PATHS) {
        if (fs.existsSync(dbPath)) {
            console.log(`✅ [MIGRATE] Base de datos SQLite encontrada en ${dbPath}`);
            return dbPath;
        }
    }
    console.log('❌ [MIGRATE] No se encontró ninguna base de datos SQLite');
    return null;
}

// Función para conectar a la base de datos SQLite
function connectSqlite(dbPath) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ [MIGRATE] Error al conectar a SQLite:', err.message);
                reject(err);
            } else {
                console.log('✅ [MIGRATE] Conectado a SQLite');
                resolve(db);
            }
        });
    });
}

// Función para obtener datos de SQLite
function getSqliteData(db, tableName) {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM ${tableName}`, (err, rows) => {
            if (err) {
                console.error(`❌ [MIGRATE] Error al consultar tabla ${tableName}:`, err.message);
                resolve([]);
            } else {
                console.log(`✅ [MIGRATE] ${rows.length} filas recuperadas de la tabla ${tableName}`);
                resolve(rows);
            }
        });
    });
}

// Función principal de migración
async function migrateData() {
    console.log('🔄 [MIGRATE] Iniciando migración de SQLite a PostgreSQL...');
    
    // Encontrar la base de datos SQLite
    const dbPath = findSqliteDb();
    if (!dbPath) {
        console.log('⚠️ [MIGRATE] No hay base de datos para migrar');
        return false;
    }
    
    try {
        // Conectar a SQLite
        const sqliteDb = await connectSqlite(dbPath);
        
        // Conectar a PostgreSQL
        await pgDb.connect();
        await pgDb.createTables();
        
        console.log('🔄 [MIGRATE] Extrayendo datos de SQLite...');
        
        // Obtener datos de SQLite
        const users = await getSqliteData(sqliteDb, 'users');
        const children = await getSqliteData(sqliteDb, 'children');
        const observations = await getSqliteData(sqliteDb, 'observations');
        
        console.log('🔄 [MIGRATE] Migrando datos a PostgreSQL...');
        
        // Migrar usuarios
        console.log('🔄 [MIGRATE] Migrando usuarios...');
        for (const user of users) {
            try {
                // Verificar si el usuario ya existe
                const existingUser = await pgDb.getUserByUsername(user.username);
                if (existingUser) {
                    console.log(`⏩ [MIGRATE] Usuario ya existe: ${user.username}`);
                    continue;
                }
                
                await pgDb.createUser(user);
                console.log(`✅ [MIGRATE] Usuario migrado: ${user.username}`);
            } catch (error) {
                console.error(`❌ [MIGRATE] Error al migrar usuario ${user.username}:`, error.message);
            }
        }
        
        // Migrar niños
        console.log('🔄 [MIGRATE] Migrando niños...');
        for (const child of children) {
            try {
                await pgDb.createChild(child);
                console.log(`✅ [MIGRATE] Niño migrado: ${child.name} ${child.last_name}`);
            } catch (error) {
                console.error(`❌ [MIGRATE] Error al migrar niño ${child.name}:`, error.message);
            }
        }
        
        // Migrar observaciones
        console.log('🔄 [MIGRATE] Migrando observaciones...');
        for (const obs of observations) {
            try {
                await pgDb.createObservation(obs);
                console.log(`✅ [MIGRATE] Observación migrada: ${obs.id}`);
            } catch (error) {
                console.error(`❌ [MIGRATE] Error al migrar observación:`, error.message);
            }
        }
        
        // Cerrar conexión SQLite
        sqliteDb.close((err) => {
            if (err) {
                console.error('❌ [MIGRATE] Error al cerrar SQLite:', err.message);
            } else {
                console.log('✅ [MIGRATE] Conexión SQLite cerrada');
            }
        });
        
        console.log('✅ [MIGRATE] Migración completada con éxito');
        return true;
        
    } catch (error) {
        console.error('❌ [MIGRATE] Error en migración:', error.message);
        return false;
    }
}

// Ejecutar migración si este script se ejecuta directamente
if (require.main === module) {
    migrateData()
        .then((success) => {
            console.log('🏁 [MIGRATE] Resultado de la migración:', success ? 'ÉXITO' : 'FALLO');
            process.exit(success ? 0 : 1);
        })
        .catch((error) => {
            console.error('💥 [MIGRATE] Error crítico en la migración:', error);
            process.exit(1);
        });
} else {
    // Exportar la función para uso en otros módulos
    module.exports = {
        migrateData,
        findSqliteDb
    };
}
