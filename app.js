const express = require('express');
const exphbs = require('express-handlebars');
const bodyParser = require('body-parser');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');
const moment = require('moment');
const fs = require('fs');

// Función de diagnóstico para entorno de Render
function diagnosisFilesystem() {
    console.log('🔍 [DIAGNOSIS] Iniciando diagnóstico del sistema de archivos...');
    console.log('🔍 [DIAGNOSIS] NODE_ENV:', process.env.NODE_ENV);
    
    const testPaths = [
        '/tmp',
        '/opt/render/project/src',
        '/opt/render/project/src/database',
        process.cwd(),
        path.join(process.cwd(), 'database')
    ];
    
    testPaths.forEach(testPath => {
        try {
            console.log(`\n🔍 [DIAGNOSIS] Verificando directorio: ${testPath}`);
            
            // Verificar si existe
            const exists = fs.existsSync(testPath);
            console.log(`🔍 [DIAGNOSIS] ¿Existe?: ${exists}`);
            
            if (exists) {
                // Verificar permisos
                try {
                    fs.accessSync(testPath, fs.constants.R_OK | fs.constants.W_OK);
                    console.log(`✅ [DIAGNOSIS] Permisos R/W: OK`);
                } catch (e) {
                    console.log(`❌ [DIAGNOSIS] Permisos R/W: FALLÓ - ${e.message}`);
                }
                
                // Verificar si es directorio
                try {
                    const stats = fs.statSync(testPath);
                    console.log(`🔍 [DIAGNOSIS] Es directorio: ${stats.isDirectory()}`);
                    console.log(`🔍 [DIAGNOSIS] Modo permisos: ${stats.mode.toString(8)}`);
                    console.log(`🔍 [DIAGNOSIS] UID/GID: ${stats.uid}/${stats.gid}`);
                } catch (e) {
                    console.log(`❌ [DIAGNOSIS] Error obteniendo stats: ${e.message}`);
                }
                
                // Listar contenido
                try {
                    const files = fs.readdirSync(testPath);
                    console.log(`🔍 [DIAGNOSIS] ${files.length} archivos en directorio`);
                } catch (e) {
                    console.log(`❌ [DIAGNOSIS] Error listando directorio: ${e.message}`);
                }
                
                // Prueba de escritura
                if (testPath !== '/opt/render/project/src') { // No escribir en raíz del proyecto
                    const testFile = path.join(testPath, 'diagnosis_test.txt');
                    try {
                        fs.writeFileSync(testFile, `Test escritura: ${new Date().toISOString()}`);
                        console.log(`✅ [DIAGNOSIS] Escritura exitosa en: ${testFile}`);
                        
                        // Prueba de lectura
                        const content = fs.readFileSync(testFile, 'utf8');
                        console.log(`✅ [DIAGNOSIS] Lectura exitosa: ${content.substring(0, 20)}...`);
                        
                        // Limpiar
                        fs.unlinkSync(testFile);
                        console.log(`✅ [DIAGNOSIS] Archivo de prueba eliminado`);
                    } catch (e) {
                        console.log(`❌ [DIAGNOSIS] Error en prueba IO: ${e.message}`);
                    }
                }
            }
        } catch (error) {
            console.log(`❌ [DIAGNOSIS] Error general: ${error.message}`);
        }
    });
    
    console.log('\n🔍 [DIAGNOSIS] Diagnóstico finalizado\n');
}

// Ejecutar diagnóstico al inicio
diagnosisFilesystem();

// Configurar PostgreSQL como store de sesiones
// Importar rutas
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const childrenRoutes = require('./routes/children');
const observationsRoutes = require('./routes/observations');
const adminRoutes = require('./routes/admin');

// Inicializar la base de datos PostgreSQL
const db = require('./database/pg-database');
const BackupManager = require('./database/backup');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar Handlebars
const hbs = exphbs.create({
    defaultLayout: 'main',
    extname: '.hbs',
    helpers: {
        formatDate: function(date) {
            return moment(date).format('DD/MM/YYYY');
        },
        formatDateTime: function(date) {
            return moment(date).format('DD/MM/YYYY HH:mm');
        },
        eq: function(a, b) {
            return a === b;
        },
        gt: function(a, b) {
            return a > b;
        },
        unless: function(condition, options) {
            if (!condition) {
                return options.fn(this);
            } else {
                return options.inverse(this);
            }
        },
        parseJSON: function(context) {
            try {
                // Si no hay contexto, retornar array vacío
                if (!context || context === null || context === undefined) {
                    return [];
                }
                
                // Si ya es un array, retornarlo tal como está
                if (Array.isArray(context)) {
                    return context;
                }
                
                // Si es un string, intentar parsearlo
                if (typeof context === 'string') {
                    // Si es un string vacío, retornar array vacío
                    if (context.trim() === '') {
                        return [];
                    }
                    
                    // Intentar parsear como JSON
                    const parsed = JSON.parse(context);
                    
                    // Si el resultado es un array, retornarlo
                    if (Array.isArray(parsed)) {
                        return parsed;
                    }
                    
                    // Si no es un array, encapsularlo en uno
                    return [parsed];
                }
                
                // Para cualquier otro tipo, retornar array vacío
                return [];
                
            } catch (e) {
                console.warn('Error parsing JSON in template:', {
                    context: context,
                    type: typeof context,
                    error: e.message
                });
                return [];
            }
        },        formatQuestionsAndAnswers: function(description) {
            console.log('🔍 formatQuestionsAndAnswers recibió:', description);
            if (!description) return '';
            
            // Revisar si contiene formato de preguntas (🔶 y "Respuesta:")
            if (description.includes('🔶') && description.includes('Respuesta:')) {
                console.log('✅ Detectado formato de preguntas reflexivas');
                // Dividir por el delimitador 🔶
                const parts = description.split('🔶');
                
                let html = '';
                
                // El primer elemento puede ser texto inicial
                if (parts[0].trim()) {
                    // Verificar si tiene el separador de preguntas reflexivas
                    let initialText = parts[0].trim();
                    if (initialText.includes('--- Preguntas reflexivas ---')) {
                        const textParts = initialText.split('--- Preguntas reflexivas ---');
                        if (textParts[0].trim()) {
                            html += `<div class="mb-3"><strong>Observación directa:</strong><br>${textParts[0].trim().replace(/\n/g, '<br>')}</div>`;
                        }
                    } else {
                        html += `<p>${initialText.replace(/\n/g, '<br>')}</p>`;
                    }
                }
                
                // Procesar cada pregunta y respuesta
                for (let i = 1; i < parts.length; i++) {
                    const part = parts[i].trim();
                    if (!part) continue;
                    
                    // Buscar "Respuesta:" para separar pregunta y respuesta
                    const respuestaIndex = part.indexOf('Respuesta:');
                    
                    if (respuestaIndex !== -1) {
                        const question = part.substring(0, respuestaIndex).trim();
                        const answer = part.substring(respuestaIndex + 10).trim(); // 10 = "Respuesta:".length
                        
                        html += '<div class="question-item">';
                        html += `<div class="question"><strong>🔶 ${question}</strong></div>`;
                        if (answer) {
                            html += `<div class="answer"><strong>Respuesta:</strong> ${answer.replace(/\n/g, '<br>')}</div>`;
                        }
                        html += '</div>';
                    } else {
                        // Si no hay formato "Respuesta:", mostrar como pregunta sin respuesta
                        html += '<div class="question-item">';
                        html += `<div class="question"><strong>🔶 ${part.replace(/\n/g, '<br>')}</strong></div>`;
                        html += '</div>';
                    }                }
                
                console.log('🎯 HTML generado:', html);
                return html;            } else {
                console.log('❌ No es formato de preguntas, retornando texto normal');
                // No es formato de preguntas, devolver texto normal con saltos de línea
                return description.replace(/\n/g, '<br>');
            }
        },
          // Helper para detectar si el texto tiene formato de preguntas
        hasQuestionFormat: function(text) {
            const hasFormat = text && text.includes('🔶') && text.includes('Respuesta:');
            console.log('🔍 hasQuestionFormat para:', text ? text.substring(0, 50) + '...' : 'null', 'Resultado:', hasFormat);
            return hasFormat;
        }
    }
});

app.engine('.hbs', hbs.engine);
app.set('view engine', '.hbs');

// Configurar middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configurar sesiones con PostgreSQL Store
console.log('🔄 [SESSION] Configurando store de sesiones con PostgreSQL');

// Crear store de sesiones con PostgreSQL
function createSessionStore() {
    try {
        console.log('🔄 [SESSION] Intentando configurar pgSessionStore');
        
        // Para entorno de desarrollo, permite conectar a una base local 
        // Para producción, usa la URL proporcionada por Render
        const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/bitacora';
        
        console.log(`✅ [SESSION] Usando conexión para sesiones: ${connectionString.split('@')[0].replace(/:[^:]*@/, ':***@')}`);
        
        // Configurar PgSessionStore
        return new pgSession({
            conObject: {
                connectionString,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
            },
            tableName: 'session',
            createTableIfMissing: true
        });
        
    } catch (error) {
        console.warn('⚠️ [SESSION] Falló configuración de pgSessionStore:', error.message);
        console.log('⚠️ [SESSION] Usando MemoryStore como fallback');
        return null; // Usar MemoryStore como fallback
    }
}

const sessionStore = createSessionStore();

app.use(session({
    store: sessionStore, // Usar el store creado con fallback
    secret: process.env.SESSION_SECRET || 'bitacora-adr-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // HOTFIX: Desactivar secure temporalmente para testing
        maxAge: 24 * 60 * 60 * 1000, // 24 horas
        httpOnly: true,
        sameSite: 'lax' // Mejorar compatibilidad con navegadores
    },
    name: 'bitacora.sid'
}));

console.log('✅ [SESSION] Store configurado:', sessionStore ? 'PostgreSQL Store' : 'MemoryStore (fallback)');

// Middleware de logging para sesiones (habilitado también en producción para debugging)
app.use((req, res, next) => {
    console.log('📝 [SESSION] Info:', {
        sessionId: req.sessionID,
        hasUser: !!req.session.user,
        url: req.url,
        method: req.method,
        cookies: req.headers.cookie ? 'presentes' : 'ausentes',
        userAgent: req.headers['user-agent']?.substring(0, 50)
    });
    next();
});

// Middleware para verificar autenticación
const requireAuth = (req, res, next) => {
    console.log('🔍 [AUTH] Verificando autenticación:', {
        sessionId: req.sessionID,
        hasUser: !!req.session.user,
        user: req.session.user ? req.session.user.username : 'ninguno',
        url: req.url,
        method: req.method,
        cookies: req.headers.cookie ? 'presentes' : 'ausentes',
        sessionData: req.session
    });
    
    if (req.session.user) {
        console.log('✅ [AUTH] Usuario autenticado:', req.session.user.username);
        next();
    } else {
        console.log('❌ [AUTH] Usuario no autenticado, redirigiendo a login');
        console.log('🔍 [AUTH] Datos de sesión completos:', req.session);
        res.redirect('/auth/login');
    }
};

// Hacer disponible la información del usuario en todas las vistas
app.use((req, res, next) => {
    res.locals.user = req.session.user;
    next();
});

// Configurar rutas
app.use('/auth', authRoutes);
app.use('/dashboard', requireAuth, dashboardRoutes);
app.use('/children', requireAuth, childrenRoutes);
app.use('/observations', requireAuth, observationsRoutes);
app.use('/admin', requireAuth, adminRoutes);

// Ruta principal
app.get('/', (req, res) => {
    if (req.session.user) {
        res.redirect('/dashboard');
    } else {
        res.redirect('/auth/login');
    }
});

// Health check endpoint para Render
app.get('/healthz', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        service: 'Bitácora ADR - Sistema de Ministerio Infantil',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Endpoint de debug para verificar usuarios (solo en desarrollo/testing)
app.get('/debug/users', async (req, res) => {
    try {
        console.log('🔍 [DEBUG] Consultando usuarios...');
        const users = await db.getAllUsers();
        res.json({
            environment: process.env.NODE_ENV || 'development',
            timestamp: new Date().toISOString(),
            count: users.length,
            users: users.map(u => ({
                id: u.id,
                username: u.username,
                name: u.name,
                role: u.role,
                created_at: u.created_at
            }))
        });
    } catch (error) {
        console.error('❌ [DEBUG] Error consultando usuarios:', error);
        res.status(500).json({ 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Endpoint de debug para crear usuario admin
app.post('/debug/create-admin', async (req, res) => {
    try {
        console.log('🔧 [DEBUG] Forzando creación de usuario admin...');
        await db.createEmergencyAdmin();
        res.json({
            success: true,
            message: 'Usuario admin creado/verificado',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ [DEBUG] Error creando admin:', error);
        res.status(500).json({ 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Endpoint de debug para verificar sesiones SQLite
app.get('/debug/sessions', (req, res) => {
    try {
        const sessionInfo = {
            currentSessionId: req.sessionID,
            hasUser: !!req.session.user,
            user: req.session.user ? {
                id: req.session.user.id,
                username: req.session.user.username,
                name: req.session.user.name,
                role: req.session.user.role
            } : null,
            sessionCookie: req.session.cookie,
            storeType: 'SQLite3Store',
            timestamp: new Date().toISOString()
        };

        console.log('🔍 [DEBUG] Info de sesión:', sessionInfo);
        res.json(sessionInfo);
    } catch (error) {
        console.error('❌ [DEBUG] Error consultando sesión:', error);
        res.status(500).json({ 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Ruta de debug para verificar estado de la base de datos
app.get('/debug/database', async (req, res) => {
    try {
        const status = db.getStatus();
        const healthy = await db.isHealthy();
        
        res.json({
            status: 'Database Debug Information',
            connected: status.connected,
            currentPath: status.currentPath,
            isMemory: status.isMemory,
            healthy: healthy,            availablePaths: process.env.NODE_ENV === 'production' 
                ? [':memory:']
                : ['./database/bitacora.db'],
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error checking database status',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Endpoint de debug para verificar backup
app.get('/debug/backup', async (req, res) => {
    try {
        if (process.env.NODE_ENV !== 'production' || !global.backupManager) {
            return res.json({
                error: 'Backup manager no disponible',
                environment: process.env.NODE_ENV || 'development',
                timestamp: new Date().toISOString()
            });
        }

        const backupInfo = global.backupManager.getBackupInfo();
        
        res.json({
            status: 'Backup System Information',
            backupInfo: backupInfo,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error checking backup status',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Endpoint para forzar backup manual
app.post('/debug/backup/create', async (req, res) => {
    try {
        if (process.env.NODE_ENV !== 'production' || !global.backupManager) {
            return res.json({
                error: 'Backup manager no disponible',
                environment: process.env.NODE_ENV || 'development',
                timestamp: new Date().toISOString()
            });
        }

        console.log('🔧 [DEBUG] Forzando backup manual...');
        const backupData = await global.backupManager.createBackup();
        
        res.json({
            success: true,
            message: 'Backup creado manualmente',
            data: {
                users: backupData.users.length,
                children: backupData.children.length,
                observations: backupData.observations.length,
                total: backupData.metadata.totalRecords
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ [DEBUG] Error creando backup:', error);
        res.status(500).json({
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Middleware de manejo de errores
app.use((error, req, res, next) => {
    console.error('❌ Error no manejado:', error);
    
    if (process.env.NODE_ENV === 'production') {
        res.status(500).render('error', { 
            title: 'Error del Servidor',
            error: 'Ha ocurrido un error interno. Por favor, inténtalo nuevamente.'
        });
    } else {
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
});

// Manejo de cierre graceful para guardar datos en memoria
if (process.env.NODE_ENV === 'production') {
    const gracefulShutdown = () => {
        console.log('🔄 [SERVER] Cerrando servidor...');
        if (db && db.getStatus().isMemory) {
            console.log('🔄 [SERVER] Exportando datos de base de datos en memoria antes de cerrar...');
            db.exportDataToJson()
                .then(() => {
                    console.log('✅ [SERVER] Datos exportados correctamente');
                    process.exit(0);
                })
                .catch(err => {
                    console.error('❌ [SERVER] Error exportando datos:', err);
                    process.exit(1);
                });
        } else {
            process.exit(0);
        }
    };

    // Registrar eventos de cierre
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGUSR2', gracefulShutdown); // Nodemon restart
}

// Ruta 404
app.use((req, res) => {
    res.status(404).redirect('/auth/login');
});

// Inicializar base de datos y servidor
db.initDatabase().then(async () => {
    console.log('✅ Base de datos inicializada correctamente');
    console.log(`📊 [DATABASE] Usando ruta: ${db.currentDbPath || 'desconocida'}`);
    
    // Crear usuario admin de emergencia
    console.log('🔧 Verificando/creando usuario administrador...');
    await db.createEmergencyAdmin();
    
    // Inicializar sistema de backup en producción
    if (process.env.NODE_ENV === 'production') {
        console.log('🔄 [BACKUP] Iniciando sistema de backup automático...');
        const backupManager = new BackupManager(db);
        
        // Intentar restaurar desde backup existente
        const backupRestored = await backupManager.restoreFromBackup();
        if (backupRestored) {
            console.log('📥 [BACKUP] Información de backup anterior disponible');
        }
        
        // Iniciar backup automático
        await backupManager.startPeriodicBackup();
        
        // Hacer el backup manager global para usar en endpoints
        global.backupManager = backupManager;
    }
    
    startServer();
}).catch(error => {
    console.error('❌ Error al inicializar la base de datos:', error);
    console.error('Stack trace:', error.stack);
    
    // En lugar de terminar la aplicación, intentar con modo degradado
    console.log('🚨 [FALLBACK] Intentando iniciar en modo degradado...');
    
    // Verificar si hay al menos una conexión parcial
    if (db.db) {
        console.log('⚠️ [FALLBACK] Base de datos parcialmente disponible, continuando...');
        startServer();
    } else {
        console.error('💀 [FATAL] No se pudo establecer ninguna conexión de base de datos');
        console.log('🔄 [FATAL] Intentando último recurso con memoria...');
        
        // Último intento: forzar conexión en memoria
        try {
            db.db = new (require('sqlite3').Database)(':memory:');
            console.log('⚠️ [FALLBACK] Usando base de datos en memoria como último recurso');
            startServer();
        } catch (memoryError) {
            console.error('💀 [FATAL] Fallo total:', memoryError);
            process.exit(1);
        }
    }
});

function startServer() {
    app.listen(PORT, () => {
        console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
        console.log(`🌐 Entorno: ${process.env.NODE_ENV || 'development'}`);
        console.log(`📊 [DATABASE] Base de datos activa en: ${db.currentDbPath || 'desconocida'}`);
        console.log(`💾 [BACKUP] Sistema: ${global.backupManager ? 'activo' : 'desactivado'}`);
        console.log(`📱 Aplicación disponible en: ${process.env.NODE_ENV === 'production' ? 'https://bitacora-adr-mecal.onrender.com' : `http://localhost:${PORT}`}`);
        console.log(`👤 Credenciales: admin / admin123`);
        console.log(`🔍 Debug endpoints:`);
        console.log(`   - GET /debug/users - Ver usuarios registrados`);
        console.log(`   - GET /debug/database - Estado de base de datos`);
        console.log(`   - GET /debug/backup - Estado del sistema de backup`);
        console.log(`   - POST /debug/create-admin - Crear usuario admin`);
        console.log(`   - POST /debug/backup/create - Crear backup manual`);
    });
}
