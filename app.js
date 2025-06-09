const express = require('express');
const exphbs = require('express-handlebars');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const moment = require('moment');
const fs = require('fs');

// Configurar SQLite3 como store de sesiones
const SQLiteStore = require('connect-sqlite3')(session);

// Importar rutas
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const childrenRoutes = require('./routes/children');
const observationsRoutes = require('./routes/observations');

// Inicializar la base de datos
const db = require('./database/database');

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

// Configurar sesiones con SQLite3 Store
// Configurar rutas de sesiones con sistema de fallback
// PERSISTENCIA PRIORITARIA: Usar disco persistente PRIMERO para mantener sesiones entre deploys
const SESSION_PATHS = process.env.NODE_ENV === 'production' 
    ? [
        '/opt/render/project/src/database/sessions.db',  // PRIMERO: Disco persistente
        '/tmp/sessions.db',  // Backup: Directorio temporal
        ':memory:'  // ÚLTIMO RECURSO: Memoria (sesiones se pierden)
      ]
    : [path.join(__dirname, 'database', 'sessions.db')];

console.log('🗄️ [SESSION] Rutas de sesiones disponibles:', SESSION_PATHS);

// Función para crear store de sesiones con fallback
function createSessionStore() {
    for (let i = 0; i < SESSION_PATHS.length; i++) {
        const sessionPath = SESSION_PATHS[i];
        console.log(`🔄 [SESSION] Intentando configurar store ${i + 1}/${SESSION_PATHS.length}: ${sessionPath}`);
        
        try {
            if (sessionPath === ':memory:') {
                console.log('⚠️ [SESSION] Usando MemoryStore como fallback');
                return null; // Retornar null para usar el MemoryStore por defecto
            }
            
            // Crear directorio si no existe
            const sessionDir = path.dirname(sessionPath);
            if (!fs.existsSync(sessionDir)) {
                console.log('📁 [SESSION] Creando directorio:', sessionDir);
                fs.mkdirSync(sessionDir, { recursive: true });
            }
            
            // Verificar permisos de escritura
            fs.accessSync(sessionDir, fs.constants.W_OK);
            
            console.log(`✅ [SESSION] Configurando SQLite3 Store en: ${sessionPath}`);
            return new SQLiteStore({
                db: sessionPath,
                table: 'sessions',
                dir: sessionDir,
                concurrentDB: true,
                timeout: 30000
            });
            
        } catch (error) {
            console.warn(`⚠️ [SESSION] Falló configuración en ${sessionPath}:`, error.message);
            continue;
        }
    }
    
    console.log('⚠️ [SESSION] Todas las rutas fallaron, usando MemoryStore');
    return null;
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

console.log('✅ [SESSION] Store configurado:', sessionStore ? 'SQLite3Store' : 'MemoryStore (fallback)');

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

// Rutas
app.use('/auth', authRoutes);
app.use('/dashboard', requireAuth, dashboardRoutes);
app.use('/children', requireAuth, childrenRoutes);
app.use('/observations', requireAuth, observationsRoutes);

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

// Ruta 404
app.use((req, res) => {
    res.status(404).redirect('/auth/login');
});

// Inicializar base de datos y servidor
db.initDatabase().then(async () => {
    console.log('✅ Base de datos inicializada correctamente');
    
    // Crear usuario admin de emergencia
    console.log('🔧 Verificando/creando usuario administrador...');
    await db.createEmergencyAdmin();
    
    app.listen(PORT, () => {
        console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
        console.log(`🌐 Entorno: ${process.env.NODE_ENV || 'development'}`);
        console.log(`📱 Aplicación disponible en: ${process.env.NODE_ENV === 'production' ? 'https://bitacora-adr-mecal.onrender.com' : `http://localhost:${PORT}`}`);
        console.log(`👤 Credenciales: admin / admin123`);
        console.log(`🔍 Debug endpoints:`);
        console.log(`   - GET /debug/users - Ver usuarios registrados`);
        console.log(`   - POST /debug/create-admin - Crear usuario admin`);
    });
}).catch(error => {
    console.error('❌ Error al inicializar la base de datos:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
});
