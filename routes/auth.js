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
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.redirect('/auth/login?error=Por favor ingrese usuario y contraseña');
        }

        const user = await db.getUserByUsername(username);
        
        if (!user) {
            return res.redirect('/auth/login?error=Usuario no encontrado');
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
            return res.redirect('/auth/login?error=Contraseña incorrecta');
        }

        // Crear sesión
        req.session.user = {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role
        };

        res.redirect('/dashboard');
    } catch (error) {
        console.error('Error en login:', error);
        res.redirect('/auth/login?error=Error interno del servidor');
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
