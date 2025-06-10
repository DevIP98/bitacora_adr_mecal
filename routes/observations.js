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
        
        res.render('observations/index', {
            title: 'Observaciones - Bitácora ADR',
            observations
        });
    } catch (error) {
        console.error('Error al obtener observaciones:', error);
        res.render('observations/index', {
            title: 'Observaciones - Bitácora ADR',
            error: 'Error al cargar las observaciones'
        });
    }
});

module.exports = router;
