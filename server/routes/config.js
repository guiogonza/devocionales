const express = require('express');
const router = express.Router();
const { requireAuth } = require('../auth');
const { getDevotionals, saveDevotionals, getConfig, saveConfig, getSessionTimeout } = require('../storage');
const { logAudit } = require('../logs');

// Helpers
function getTodayGMT() {
    const config = getConfig();
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const gmtTime = new Date(utc + ((config.gmtOffset || 0) * 3600000));
    return gmtTime.toISOString().split('T')[0];
}

function isFutureDate(dateStr) {
    const today = getTodayGMT();
    return dateStr > today;
}

// GET /api/server-time
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

// GET /api/config
router.get('/', (req, res) => {
    const config = getConfig();
    res.json({
        success: true,
        gmtOffset: config.gmtOffset || 0,
        timezone: `GMT${config.gmtOffset >= 0 ? '+' : ''}${config.gmtOffset || 0}`
    });
});

// PUT /api/config
router.put('/', requireAuth, (req, res) => {
    const { gmtOffset } = req.body;
    
    if (gmtOffset === undefined || gmtOffset < -12 || gmtOffset > 14) {
        return res.status(400).json({ success: false, error: 'GMT offset inválido (debe estar entre -12 y +14)' });
    }
    
    const config = getConfig();
    config.gmtOffset = parseInt(gmtOffset);
    
    if (saveConfig(config)) {
        logAudit('CONFIG_UPDATED', { gmtOffset: config.gmtOffset }, req);
        console.log('⚙️ Configuración actualizada - GMT Offset:', config.gmtOffset);
        res.json({ success: true, message: 'Configuración guardada', gmtOffset: config.gmtOffset });
    } else {
        res.status(500).json({ success: false, error: 'Error al guardar configuración' });
    }
});

// GET /api/config/session
router.get('/session', requireAuth, (req, res) => {
    const config = getConfig();
    res.json({
        success: true,
        sessionTimeoutMinutes: config.sessionTimeoutMinutes || 20
    });
});

// PUT /api/config/session
router.put('/session', requireAuth, (req, res) => {
    const { sessionTimeoutMinutes } = req.body;
    
    if (!sessionTimeoutMinutes || sessionTimeoutMinutes < 1 || sessionTimeoutMinutes > 60) {
        return res.status(400).json({ success: false, error: 'El tiempo debe estar entre 1 y 60 minutos' });
    }
    
    const config = getConfig();
    config.sessionTimeoutMinutes = parseInt(sessionTimeoutMinutes);
    
    if (saveConfig(config)) {
        logAudit('SESSION_TIMEOUT_UPDATED', { sessionTimeoutMinutes: config.sessionTimeoutMinutes }, req);
        console.log('⚙️ Timeout de sesión actualizado:', config.sessionTimeoutMinutes, 'minutos');
        res.json({ success: true, message: 'Tiempo de sesión actualizado', sessionTimeoutMinutes: config.sessionTimeoutMinutes });
    } else {
        res.status(500).json({ success: false, error: 'Error al guardar configuración' });
    }
});

// GET /api/available-dates
router.get('/available-dates', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const { AUDIOS_DIR } = require('../config');
    
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

// GET /api/devotionals/:date
router.get('/devotionals/:date', (req, res) => {
    const { date } = req.params;
    const devotionalsDB = getDevotionals();
    const devotional = devotionalsDB[date];
    
    if (devotional) {
        res.json({
            success: true,
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
        res.json({ success: true, data: null });
    }
});

// GET /api/devotionals
router.get('/devotionals', (req, res) => {
    const devotionalsDB = getDevotionals();
    const devotionals = Object.entries(devotionalsDB).map(([date, data]) => ({
        date,
        ...data
    })).sort((a, b) => b.date.localeCompare(a.date));
    
    res.json({ success: true, data: devotionals, count: devotionals.length });
});

// GET /api/devotionals/dates
router.get('/devotionals/dates', (req, res) => {
    const devotionalsDB = getDevotionals();
    const dates = Object.keys(devotionalsDB);
    res.json({ success: true, dates, count: dates.length });
});

// POST /api/devotionals
router.post('/devotionals', requireAuth, (req, res) => {
    const { date, title, verseReference, verseText } = req.body;
    
    if (!date) {
        return res.status(400).json({ success: false, error: 'Fecha requerida' });
    }
    
    // Validar que no sea más de 30 días en el futuro
    const today = new Date();
    const targetDate = new Date(date);
    const diffDays = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays > 30) {
        return res.status(400).json({ success: false, error: 'No se pueden crear devocionales para más de 30 días en el futuro' });
    }
    
    const devotionalsDB = getDevotionals();
    devotionalsDB[date] = {
        title: title || '',
        verseReference: verseReference || '',
        verseText: verseText || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    if (saveDevotionals(devotionalsDB)) {
        logAudit('DEVOTIONAL_CREATED', { date, title, verseReference }, req);
        res.json({
            success: true,
            message: 'Devocional creado',
            data: devotionalsDB[date]
        });
    } else {
        res.status(500).json({ success: false, error: 'Error al guardar' });
    }
});

// PUT /api/devotionals/:date
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

// DELETE /api/devotionals/:date
router.delete('/devotionals/:date', requireAuth, (req, res) => {
    const { date } = req.params;
    const devotionalsDB = getDevotionals();
    
    if (!devotionalsDB[date]) {
        return res.status(404).json({ success: false, error: 'Devocional no encontrado' });
    }
    
    delete devotionalsDB[date];
    
    if (saveDevotionals(devotionalsDB)) {
        logAudit('DEVOTIONAL_DELETED', { date }, req);
        res.json({ success: true, message: 'Devocional eliminado' });
    } else {
        res.status(500).json({ success: false, error: 'Error al eliminar' });
    }
});

module.exports = router;
module.exports.getTodayGMT = getTodayGMT;
module.exports.isFutureDate = isFutureDate;
