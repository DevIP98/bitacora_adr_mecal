const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/database');

const router = express.Router();

// Mostrar formulario de login
router.get('/login', (req, res) => {
    res.render('auth/login', { 
        title: 'Iniciar Sesión - Bitácora ADR',
        error: req.query.error,
        success: req.query.success 
    });
});

// Procesar login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    console.log('🔍 [LOGIN] Intento de login:', { 
        username, 
        password: password ? '***' : 'undefined',
        sessionId: req.sessionID,
        timestamp: new Date().toISOString()
    });

    try {
        if (!username || !password) {
            console.log('❌ [LOGIN] Datos faltantes');
            return res.render('auth/login', { 
                title: 'Iniciar Sesión - Bitácora ADR',
                error: 'Por favor ingrese usuario y contraseña' 
            });
        }

        console.log('🔍 [LOGIN] Buscando usuario en base de datos...');
        const user = await db.getUserByUsername(username);
        console.log('🔍 [LOGIN] Usuario encontrado:', user ? 'SÍ' : 'NO');
        
        if (!user) {
            console.log('❌ [LOGIN] Usuario no encontrado:', username);
            return res.render('auth/login', { 
                title: 'Iniciar Sesión - Bitácora ADR',
                error: 'Usuario o contraseña incorrectos' 
            });
        }

        console.log('🔍 [LOGIN] Verificando contraseña...');
        const isValidPassword = await bcrypt.compare(password, user.password);
        console.log('🔍 [LOGIN] Contraseña válida:', isValidPassword);

        if (!isValidPassword) {
            console.log('❌ [LOGIN] Contraseña incorrecta para usuario:', username);
            return res.render('auth/login', { 
                title: 'Iniciar Sesión - Bitácora ADR',
                error: 'Usuario o contraseña incorrectos' 
            });
        }

        // Crear sesión
        req.session.user = {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role
        };

        console.log('✅ [LOGIN] Sesión creada exitosamente:', {
            userId: user.id,
            username: user.username,
            sessionId: req.sessionID
        });

        // Forzar guardado de sesión
        req.session.save((err) => {
            if (err) {
                console.error('❌ [LOGIN] Error guardando sesión:', err);
                return res.render('auth/login', { 
                    title: 'Iniciar Sesión - Bitácora ADR',
                    error: 'Error interno del servidor' 
                });
            }
            
            console.log('✅ [LOGIN] Sesión guardada, redirigiendo a dashboard');
            res.redirect('/dashboard');
        });

    } catch (error) {
        console.error('❌ [LOGIN] Error en proceso de login:', error);
        res.render('auth/login', { 
            title: 'Iniciar Sesión - Bitácora ADR',
            error: 'Error interno del servidor' 
        });
    }
});

// Procesar registro (ahora disponible para todos)
router.post('/register', async (req, res) => {
    try {
        const { username, password, confirmPassword, name, email } = req.body;

        if (!username || !password || !name) {
            return res.redirect('/auth/login?error=Por favor complete todos los campos requeridos');
        }

        if (password !== confirmPassword) {
            return res.redirect('/auth/login?error=Las contraseñas no coinciden');
        }

        if (password.length < 6) {
            return res.redirect('/auth/login?error=La contraseña debe tener al menos 6 caracteres');
        }

        // Verificar si el usuario ya existe
        const existingUser = await db.getUserByUsername(username);
        if (existingUser) {
            return res.redirect('/auth/login?error=El usuario ya existe');
        }

        // Encriptar contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // Crear usuario (todos los usuarios tienen acceso completo)
        await db.createUser({
            username,
            password: hashedPassword,
            name,
            email: email || null,
            role: 'teacher' // Todos son 'teacher' pero tienen acceso completo
        });

        res.redirect('/auth/login?success=Cuenta creada exitosamente. Ya puedes iniciar sesión');
    } catch (error) {
        console.error('Error en registro:', error);
        res.redirect('/auth/login?error=Error interno del servidor');
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error al cerrar sesión:', err);
        }
        res.redirect('/auth/login');
    });
});

module.exports = router;
