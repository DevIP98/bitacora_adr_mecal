const express = require('express');
const db = require('../database/pg-database');

const router = express.Router();

// Dashboard principal
router.get('/', async (req, res) => {
    try {
        // Obtenemos todos los datos necesarios para el dashboard mejorado
        const children = await db.getAllChildren();
        const recentObservations = await db.getRecentObservations(5);
        const observationStats = await db.getObservationStats();
        const topChildren = await db.getTopChildrenWithObservations(5);
        const recentActivity = await db.getRecentActivity(7); // Últimos 7 días
        
        // Estadísticas básicas y avanzadas
        const stats = {
            totalChildren: children.length,
            totalObservations: recentObservations.length,
            observationTypes: observationStats.typeStats,
            observationTags: observationStats.tagStats,
            followupStats: observationStats.followupStats,
            monthlyStats: observationStats.monthlyStats
        };
        
        res.render('dashboard/index', {
            title: 'Dashboard - Bitácora ADR',
            children,
            recentObservations,
            topChildren,
            recentActivity,
            stats,
            success: req.query.success,
            error: req.query.error,
            highlightedChild: req.query.highlighted_child ? parseInt(req.query.highlighted_child) : null
        });
    } catch (error) {
        console.error('Error en dashboard:', error);
        res.render('dashboard/index', {
            title: 'Dashboard - Bitácora ADR',
            error: 'Error al cargar el dashboard: ' + error.message
        });
    }
});

module.exports = router;
