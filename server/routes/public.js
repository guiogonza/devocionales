const express = require('express');
const router = express.Router();
const fs = require('fs');
const { AUDIOS_DIR } = require('../config');
const { getDevotionals, saveDevotionals, getConfig } = require('../storage');
const { logActivity, logAudit } = require('../logs');
const { requireAuth } = require('../auth');

// Versión actual de la app (debe coincidir con APP_VERSION en app.js)
const CURRENT_VERSION = '1.1.3';

// GET /api/version - Versión actual de la app
router.get('/version', (req, res) => {
    res.json({
        success: true,
        version: CURRENT_VERSION
    });
});

// Helper para obtener fecha según GMT configurado
function getTodayGMT() {
    const config = getConfig();
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const gmtTime = new Date(utc + ((config.gmtOffset || 0) * 3600000));
    return gmtTime.toISOString().split('T')[0];
}

// GET /api/server-time - Hora del servidor
router.get('/server-time', (req, res) => {
    const config = getConfig();
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const gmtTime = new Date(utc + ((config.gmtOffset || 0) * 3600000));
    
    res.json({
        success: true,
        serverTime: gmtTime.toISOString(),
        gmtOffset: config.gmtOffset || 0,
        today: gmtTime.toISOString().split('T')[0]
    });
});

// GET /api/available-dates - Fechas con devocionales disponibles
router.get('/available-dates', (req, res) => {
    try {
        const files = fs.readdirSync(AUDIOS_DIR);
        const today = getTodayGMT();
        
        const availableDates = files
            .filter(file => {
                const match = file.match(/^(\d{4}-\d{2}-\d{2})\.mp3$/);
                if (!match) return false;
                return match[1] <= today;
            })
            .map(file => file.match(/^(\d{4}-\d{2}-\d{2})\.mp3$/)[1])
            .sort((a, b) => b.localeCompare(a));
        
        res.json({ success: true, dates: availableDates, count: availableDates.length, today });
    } catch (error) {
        console.error('Error obteniendo fechas disponibles:', error);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});

// GET /api/devotionals - Listar todos los devocionales
router.get('/devotionals', (req, res) => {
    const devotionalsDB = getDevotionals();
    const devotionals = Object.entries(devotionalsDB).map(([date, data]) => ({
        date,
        ...data
    })).sort((a, b) => b.date.localeCompare(a.date));
    
    res.json({ success: true, data: devotionals, count: devotionals.length });
});

// GET /api/devotionals/:date - Obtener devocional por fecha
router.get('/devotionals/:date', (req, res) => {
    const { date } = req.params;
    const devotionalsDB = getDevotionals();
    const devotional = devotionalsDB[date];
    
    if (devotional) {
        res.json({
            success: true,
            exists: true,
            data: {
                date,
                title: devotional.title || '',
                verseReference: devotional.verseReference || '',
                verseText: devotional.verseText || '',
                createdAt: devotional.createdAt,
                updatedAt: devotional.updatedAt
            }
        });
    } else {
        res.json({ success: true, exists: false, data: null });
    }
});

// POST /api/track-play - Registrar reproducción
router.post('/track-play', async (req, res) => {
    const { date, title } = req.body;
    if (!date) return res.json({ success: false, error: 'Fecha requerida' });
    await logActivity('PLAY_DEVOTIONAL', { date, title: title || 'Sin título' }, req);
    res.json({ success: true });
});

// PUT /api/devotionals/:date - Actualizar devocional (requiere auth)
router.put('/devotionals/:date', requireAuth, (req, res) => {
    const { date } = req.params;
    const { title, verseReference, verseText } = req.body;
    
    const devotionalsDB = getDevotionals();
    const existsInDB = devotionalsDB[date];
    
    devotionalsDB[date] = {
        title: title || '',
        verseReference: verseReference || '',
        verseText: verseText || '',
        createdAt: existsInDB?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    if (saveDevotionals(devotionalsDB)) {
        logAudit('DEVOTIONAL_UPDATED', { date, title, verseReference }, req);
        res.json({
            success: true,
            message: existsInDB ? 'Devocional actualizado' : 'Devocional creado',
            data: devotionalsDB[date]
        });
    } else {
        res.status(500).json({ success: false, error: 'Error al guardar' });
    }
});

module.exports = router;
module.exports.getTodayGMT = getTodayGMT;
