const express = require('express');
const exphbs = require('express-handlebars');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const moment = require('moment');

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
        },        eq: function(a, b) {
            return a === b;
        },
        'JSON.parse': function(context) {
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
        }
    }
});

app.engine('.hbs', hbs.engine);
app.set('view engine', '.hbs');

// Configurar middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configurar sesiones
app.use(session({
    secret: 'bitacora-adr-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 horas
}));

// Middleware para verificar autenticación
const requireAuth = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
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

// Inicializar base de datos y servidor
db.initDatabase().then(() => {
    console.log('Base de datos inicializada correctamente');
    app.listen(PORT, () => {
        console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
    });
}).catch(error => {
    console.error('Error al inicializar la base de datos:', error);
});
