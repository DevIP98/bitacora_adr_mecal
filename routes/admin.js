const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/pg-database');
const router = express.Router();

// Middleware para verificar que sea admin
function requireAdmin(req, res, next) {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).render('error', { 
            message: 'Acceso denegado. Solo administradores pueden acceder a esta sección.',
            layout: 'main'
        });
    }
    next();
}

// Aplicar middleware a todas las rutas
router.use(requireAdmin);

// GET /admin/users - Listar todos los usuarios
router.get('/users', async (req, res) => {
    try {
        const users = await db.getAllUsers();
        
        // Enriquecer datos con estadísticas
        const usersWithStats = await Promise.all(users.map(async (user) => {
            try {
                const observations = await db.getObservationsByUser ? await db.getObservationsByUser(user.id) : [];
                return {
                    ...user,
                    totalObservations: observations.length,
                    lastActivity: observations.length > 0 ? observations[0].created_at : null,
                    createdAt: new Date(user.created_at).toLocaleDateString('es-ES')
                };
            } catch (err) {
                console.warn('Error obteniendo estadísticas para usuario:', user.id, err.message);
                return {
                    ...user,
                    totalObservations: 0,
                    lastActivity: null,
                    createdAt: new Date(user.created_at).toLocaleDateString('es-ES')
                };
            }
        }));

        res.render('admin/users', {
            title: 'Gestión de Usuarios',
            users: usersWithStats,
            currentUser: req.session.user,
            success: req.query.success,
            error: req.query.error,
            layout: 'main'
        });
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        res.status(500).render('error', { 
            message: 'Error al cargar usuarios',
            layout: 'main'
        });
    }
});

// GET /admin/users/new - Formulario crear usuario
router.get('/users/new', (req, res) => {
    res.render('admin/user-form', {
        title: 'Nuevo Usuario',
        user: {},
        isEdit: false,
        currentUser: req.session.user,
        layout: 'main'
    });
});

// POST /admin/users - Crear usuario
router.post('/users', async (req, res) => {
    try {
        const { username, name, password, role, email } = req.body;

        // Validaciones
        if (!username || !name || !password || !role) {
            return res.status(400).render('admin/user-form', {
                title: 'Nuevo Usuario',
                user: req.body,
                isEdit: false,
                error: 'Todos los campos obligatorios deben completarse',
                currentUser: req.session.user,
                layout: 'main'
            });
        }

        if (password.length < 6) {
            return res.status(400).render('admin/user-form', {
                title: 'Nuevo Usuario',
                user: req.body,
                isEdit: false,
                error: 'La contraseña debe tener al menos 6 caracteres',
                currentUser: req.session.user,
                layout: 'main'
            });
        }

        // Verificar que el username no exista
        const existingUser = await db.getUserByUsername(username);
        if (existingUser) {
            return res.status(400).render('admin/user-form', {
                title: 'Nuevo Usuario',
                user: req.body,
                isEdit: false,
                error: 'Ya existe un usuario con ese nombre de usuario',
                currentUser: req.session.user,
                layout: 'main'
            });
        }

        // Encriptar contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // Crear usuario
        await db.createUser({
            username,
            name,
            password: hashedPassword,
            email: email || null,
            role
        });

        res.redirect('/admin/users?success=Usuario creado exitosamente');
    } catch (error) {
        console.error('Error al crear usuario:', error);
        res.status(500).render('admin/user-form', {
            title: 'Nuevo Usuario',
            user: req.body,
            isEdit: false,
            error: 'Error interno del servidor',
            currentUser: req.session.user,
            layout: 'main'
        });
    }
});

// GET /admin/users/:id/edit - Formulario editar usuario
router.get('/users/:id/edit', async (req, res) => {
    try {
        const user = await db.getUserById ? await db.getUserById(req.params.id) : null;
        if (!user) {
            return res.status(404).render('error', { 
                message: 'Usuario no encontrado',
                layout: 'main'
            });
        }

        // No permitir que se edite a sí mismo
        if (user.id === req.session.user.id) {
            return res.redirect('/admin/users?error=No puedes editarte a ti mismo desde aquí');
        }

        res.render('admin/user-form', {
            title: 'Editar Usuario',
            user: user,
            isEdit: true,
            currentUser: req.session.user,
            layout: 'main'
        });
    } catch (error) {
        console.error('Error al obtener usuario:', error);
        res.status(500).render('error', { 
            message: 'Error al cargar usuario',
            layout: 'main'
        });
    }
});

// POST /admin/users/:id - Actualizar usuario (usando POST con _method)
router.post('/users/:id', async (req, res) => {
    try {
        const { name, role, password, _method } = req.body;
        const userId = req.params.id;

        if (_method !== 'PUT') {
            return res.status(400).json({ error: 'Método no permitido' });
        }

        // No permitir que se edite a sí mismo
        if (parseInt(userId) === req.session.user.id) {
            return res.redirect('/admin/users?error=No puedes editarte a ti mismo');
        }

        const user = await db.getUserById ? await db.getUserById(userId) : null;
        if (!user) {
            return res.redirect('/admin/users?error=Usuario no encontrado');
        }

        // Preparar datos de actualización
        const updateData = { name, role };
        
        // Solo actualizar contraseña si se proporciona
        if (password && password.trim() !== '') {
            if (password.length < 6) {
                return res.status(400).render('admin/user-form', {
                    title: 'Editar Usuario',
                    user: { ...user, name, role },
                    isEdit: true,
                    error: 'La contraseña debe tener al menos 6 caracteres',
                    currentUser: req.session.user,
                    layout: 'main'
                });
            }
            updateData.password = await bcrypt.hash(password, 10);
        }

        await db.updateUser(userId, updateData);
        res.redirect('/admin/users?success=Usuario actualizado exitosamente');
    } catch (error) {
        console.error('Error al actualizar usuario:', error);
        res.redirect('/admin/users?error=Error interno del servidor');
    }
});

// POST /admin/users/:id/delete - Eliminar usuario
router.post('/users/:id/delete', async (req, res) => {
    try {
        const userId = req.params.id;

        // No permitir que se elimine a sí mismo
        if (parseInt(userId) === req.session.user.id) {
            return res.redirect('/admin/users?error=No puedes eliminarte a ti mismo');
        }

        const user = await db.getUserById ? await db.getUserById(userId) : null;
        if (!user) {
            return res.redirect('/admin/users?error=Usuario no encontrado');
        }

        // Verificar si el usuario tiene observaciones
        try {
            const observations = await db.getObservationsByUser ? await db.getObservationsByUser(userId) : [];
            if (observations.length > 0) {
                return res.redirect(`/admin/users?error=No se puede eliminar. El usuario tiene ${observations.length} observaciones registradas.`);
            }
        } catch (err) {
            console.warn('Error verificando observaciones del usuario:', err.message);
        }

        await db.deleteUser(userId);
        res.redirect('/admin/users?success=Usuario eliminado exitosamente');
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        res.redirect('/admin/users?error=Error interno del servidor');
    }
});

// GET /admin/users/:id - Ver detalle de usuario
router.get('/users/:id', async (req, res) => {
    try {
        const user = await db.getUserById ? await db.getUserById(req.params.id) : null;
        if (!user) {
            return res.status(404).render('error', { 
                message: 'Usuario no encontrado',
                layout: 'main'
            });
        }

        let observations = [];
        try {
            observations = await db.getObservationsByUser ? await db.getObservationsByUser(user.id) : [];
        } catch (err) {
            console.warn('Error obteniendo observaciones del usuario:', err.message);
        }
        
        res.render('admin/user-detail', {
            title: `Usuario: ${user.name}`,
            user: {
                ...user,
                createdAt: new Date(user.created_at).toLocaleDateString('es-ES'),
                totalObservations: observations.length
            },
            observations: observations.slice(0, 10), // Últimas 10 observaciones
            currentUser: req.session.user,
            layout: 'main'
        });
    } catch (error) {
        console.error('Error al obtener detalle usuario:', error);
        res.status(500).render('error', { 
            message: 'Error al cargar usuario',
            layout: 'main'
        });
    }
});

module.exports = router;
