const express = require('express');
const db = require('../database/pg-database');

const router = express.Router();

// Listar todos los niños
router.get('/', async (req, res) => {
    try {
        const children = await db.getAllChildren();
        res.render('children/index', {
            title: 'Gestión de Niños - Bitácora ADR',
            children
        });
    } catch (error) {
        console.error('Error al obtener niños:', error);
        res.render('children/index', {
            title: 'Gestión de Niños - Bitácora ADR',
            error: 'Error al cargar la lista de niños'
        });
    }
});

// Mostrar formulario para agregar niño
router.get('/add', (req, res) => {
    res.render('children/add', {
        title: 'Agregar Niño - Bitácora ADR',
        error: req.query.error,
        success: req.query.success
    });
});

// Procesar adición de niño
router.post('/add', async (req, res) => {
    try {
        const childData = {
            name: req.body.name,
            last_name: req.body.last_name,
            age: req.body.age ? parseInt(req.body.age) : null,
            birthdate: req.body.birthdate || null,
            group_name: req.body.group_name || null,
            parent_name: req.body.parent_name || null,
            parent_phone: req.body.parent_phone || null,
            parent_email: req.body.parent_email || null,
            emergency_contact: req.body.emergency_contact || null,
            special_needs: req.body.special_needs || null,
            notes: req.body.notes || null,
            created_by: req.session.user.id
        };

        if (!childData.name || !childData.last_name) {
            return res.redirect('/children/add?error=El nombre y apellido son requeridos');
        }

        await db.createChild(childData);
        res.redirect('/children?success=Niño agregado exitosamente');
    } catch (error) {
        console.error('Error al agregar niño:', error);
        res.redirect('/children/add?error=Error al agregar el niño');
    }
});

// Ver detalles de un niño
router.get('/:id', async (req, res) => {
    try {
        const childId = req.params.id;
        const child = await db.getChildById(childId);
        
        if (!child) {
            return res.redirect('/children?error=Niño no encontrado');
        }

        const observations = await db.getObservationsByChild(childId);
          // Verificar si el usuario es administrador
        const isAdmin = req.session.user && req.session.user.role === 'admin';
        
        res.render('children/detail', {
            title: `${child.name} ${child.last_name} - Bitácora ADR`,
            child,
            observations,
            isAdmin, // Pasar la información de si es admin a la vista
            success: req.query.success // Para mostrar mensajes de éxito después de eliminar
        });
    } catch (error) {
        console.error('Error al obtener detalles del niño:', error);
        res.redirect('/children?error=Error al cargar los detalles del niño');
    }
});

// Mostrar formulario de edición
router.get('/:id/edit', async (req, res) => {
    try {
        const child = await db.getChildById(req.params.id);
        
        if (!child) {
            return res.redirect('/children?error=Niño no encontrado');
        }

        res.render('children/edit', {
            title: `Editar ${child.name} ${child.last_name} - Bitácora ADR`,
            child,
            error: req.query.error,
            success: req.query.success
        });
    } catch (error) {
        console.error('Error al cargar formulario de edición:', error);
        res.redirect('/children?error=Error al cargar el formulario de edición');
    }
});

// Procesar edición de niño
router.post('/:id/edit', async (req, res) => {
    try {
        const childId = req.params.id;
        const childData = {
            name: req.body.name,
            last_name: req.body.last_name,
            age: req.body.age ? parseInt(req.body.age) : null,
            birthdate: req.body.birthdate || null,
            group_name: req.body.group_name || null,
            parent_name: req.body.parent_name || null,
            parent_phone: req.body.parent_phone || null,
            parent_email: req.body.parent_email || null,
            emergency_contact: req.body.emergency_contact || null,
            special_needs: req.body.special_needs || null,
            notes: req.body.notes || null
        };

        if (!childData.name || !childData.last_name) {
            return res.redirect(`/children/${childId}/edit?error=El nombre y apellido son requeridos`);
        }

        await db.updateChild(childId, childData);
        res.redirect(`/children/${childId}?success=Información actualizada exitosamente`);
    } catch (error) {
        console.error('Error al actualizar niño:', error);
        res.redirect(`/children/${req.params.id}/edit?error=Error al actualizar la información`);
    }
});

module.exports = router;
