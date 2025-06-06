const express = require('express');
const db = require('../database/database');

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
        };

        res.render('dashboard/index', {
            title: 'Dashboard - Bitácora ADR',
            children,
            recentObservations,
            stats
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
