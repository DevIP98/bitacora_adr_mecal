const express = require('express');
const db = require('../database/pg-database');

const router = express.Router();

// Dashboard principal
router.get('/', async (req, res) => {
    try {
        const children = await db.getAllChildren();
        const recentObservations = await db.getRecentObservations(5);
        
        // Estadísticas básicas
        const stats = {
            totalChildren: children.length,
            totalObservations: recentObservations.length
        };        res.render('dashboard/index', {
            title: 'Dashboard - Bitácora ADR',
            children,
            recentObservations,
            stats,
            success: req.query.success,
            error: req.query.error,
            highlightedChild: req.query.highlighted_child ? parseInt(req.query.highlighted_child) : null
        });
    } catch (error) {
        console.error('Error en dashboard:', error);
        res.render('dashboard/index', {
            title: 'Dashboard - Bitácora ADR',
            error: 'Error al cargar el dashboard'
        });
    }
});

module.exports = router;
