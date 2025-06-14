const express = require('express');
const db = require('../database/pg-database');

const router = express.Router();

// Mostrar formulario para nueva observación
router.get('/add', async (req, res) => {
    try {
        const children = await db.getAllChildren();
        const childId = req.query.child_id;
        
        res.render('observations/add', {
            title: 'Nueva Observación - Bitácora ADR',
            children,
            selectedChildId: childId,
            error: req.query.error,
            success: req.query.success
        });
    } catch (error) {
        console.error('Error al cargar formulario de observación:', error);
        res.redirect('/dashboard?error=Error al cargar el formulario de observación');
    }
});

// Procesar nueva observación
router.post('/add', async (req, res) => {
    try {
        const {
            child_id,
            observation_date,
            observation_types,
            description,
            reflexive_questions,
            tags,
            talked_with_child,
            prayed_for_issue,
            notified_parents,
            requires_followup,
            additional_comments
        } = req.body;        if (!child_id || !observation_date || !description) {
            return res.redirect(`/observations/add?error=Por favor complete todos los campos requeridos&child_id=${child_id || ''}`);
        }

        // Verificar que hay al menos un tipo de observación seleccionado
        if (!observation_types) {
            return res.redirect(`/observations/add?error=Por favor seleccione al menos un tipo de observación&child_id=${child_id || ''}`);
        }

        // Función para convertir a array y limpiar
        const toArray = (value) => {
            if (!value) return [];
            if (Array.isArray(value)) return value.filter(Boolean);
            return [value].filter(Boolean);
        };        // Combinar descripción directa con preguntas reflexivas
        let finalDescription = description.trim();
        
        console.log('Datos recibidos:');
        console.log('- description:', description);
        console.log('- reflexive_questions:', reflexive_questions);
        
        if (reflexive_questions && reflexive_questions.trim()) {
            if (finalDescription) {
                finalDescription += '\n\n--- Preguntas reflexivas ---\n\n' + reflexive_questions.trim();
            } else {
                finalDescription = reflexive_questions.trim();
            }
        }
        
        console.log('- finalDescription:', finalDescription);

        // Convertir arrays a JSON strings
        const observationData = {
            child_id: parseInt(child_id),
            observer_id: req.session.user.id,
            observation_date,
            observation_types: JSON.stringify(toArray(observation_types)),
            description: finalDescription,
            tags: JSON.stringify(toArray(tags)),
            talked_with_child: talked_with_child === 'on' ? 1 : 0,
            prayed_for_issue: prayed_for_issue === 'on' ? 1 : 0,
            notified_parents: notified_parents === 'on' ? 1 : 0,
            requires_followup: requires_followup === 'on' ? 1 : 0,
            additional_comments: additional_comments || null
        };        await db.createObservation(observationData);
        
        // Verificar si viene del dashboard
        const returnUrl = req.headers.referer && req.headers.referer.includes('/dashboard') 
            ? '/dashboard' 
            : `/children/${child_id}`;
            
        if (returnUrl === '/dashboard') {
            res.redirect(`/dashboard?success=Observación registrada exitosamente&highlighted_child=${child_id}`);
        } else {
            res.redirect(`${returnUrl}?success=Observación registrada exitosamente`);
        }    } catch (error) {
        console.error('Error al crear observación:', error);
        const childId = req.body.child_id || '';
        res.redirect(`/observations/add?error=Error al registrar la observación&child_id=${childId}`);
    }
});

// Ver todas las observaciones
router.get('/', async (req, res) => {
    try {
        const observations = await db.getRecentObservations(50); // Últimas 50 observaciones
        
        // Verificar si el usuario es administrador
        const isAdmin = req.session.user && req.session.user.role === 'admin';
        
        res.render('observations/index', {
            title: 'Observaciones - Bitácora ADR',
            observations,
            isAdmin,
            success: req.query.success
        });
    } catch (error) {
        console.error('Error al obtener observaciones:', error);
        res.render('observations/index', {
            title: 'Observaciones - Bitácora ADR',
            error: 'Error al cargar las observaciones'
        });
    }
});

// Middleware para verificar que sea administrador
function requireAdmin(req, res, next) {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).render('error', { 
            message: 'Acceso denegado. Solo administradores pueden eliminar observaciones.',
            layout: 'main'
        });
    }
    next();
}

// Ruta para eliminar una observación (solo admin)
router.get('/delete/:id', requireAdmin, async (req, res) => {
    try {
        const observationId = req.params.id;
        
        // Obtener información de la observación antes de eliminarla
        const observation = await db.getObservationById(observationId);
        if (!observation) {
            return res.status(404).render('error', {
                message: 'La observación no fue encontrada',
                layout: 'main'
            });
        }
        
        // Guardar el ID del niño para redireccionar después
        const childId = observation.child_id;
        
        // Verificar de dónde vino la solicitud para redireccionar apropiadamente
        const referer = req.headers.referer || '';
        
        // Eliminar la observación
        await db.deleteObservation(observationId);
        
        // Decidir a dónde redireccionar basado en la URL de referencia
        if (referer.includes('/observations')) {
            // Si viene de la página de observaciones, volver ahí
            res.redirect('/observations?success=Observación eliminada correctamente');
        } else {
            // Por defecto, ir al perfil del niño
            res.redirect(`/children/${childId}?success=Observación eliminada correctamente`);
        }
    } catch (error) {
        console.error('Error al eliminar observación:', error);
        res.status(500).render('error', {
            message: 'Error al eliminar la observación',
            layout: 'main'
        });
    }
});

// Confirmación de eliminación de observación (solo admin)
router.get('/confirm-delete/:id', requireAdmin, async (req, res) => {
    try {
        const observationId = req.params.id;
        const observation = await db.getObservationById(observationId);
        
        if (!observation) {
            return res.status(404).render('error', {
                message: 'La observación no fue encontrada',
                layout: 'main'
            });
        }
        
        // Renderizar página de confirmación
        res.render('observations/confirm-delete', {
            title: 'Confirmar Eliminación - Bitácora ADR',
            observation,
            layout: 'main'
        });
    } catch (error) {
        console.error('Error al preparar eliminación:', error);
        res.status(500).render('error', {
            message: 'Error al preparar la eliminación de la observación',
            layout: 'main'
        });
    }
});

module.exports = router;
