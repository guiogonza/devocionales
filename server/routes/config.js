const express = require('express');
const router = express.Router();
const { requireAuth } = require('../auth');
const { getConfig, saveConfig } = require('../storage');
const { logAudit } = require('../logs');

// GET /api/config - Obtener configuracion
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
        return res.status(400).json({ success: false, error: 'GMT offset invalido (debe estar entre -12 y +14)' });
    }
    
    const config = getConfig();
    config.gmtOffset = parseInt(gmtOffset);
    
    if (saveConfig(config)) {
        logAudit('CONFIG_UPDATED', { gmtOffset: config.gmtOffset }, req);
        console.log('Configuracion actualizada - GMT Offset:', config.gmtOffset);
        res.json({ success: true, message: 'Configuracion guardada', gmtOffset: config.gmtOffset });
    } else {
        res.status(500).json({ success: false, error: 'Error al guardar configuracion' });
    }
});

// GET /api/config/session - Obtener timeout de sesion
router.get('/session', requireAuth, (req, res) => {
    const config = getConfig();
    res.json({
        success: true,
        sessionTimeoutMinutes: config.sessionTimeoutMinutes || 20
    });
});

// PUT /api/config/session - Actualizar timeout de sesion
router.put('/session', requireAuth, (req, res) => {
    const { sessionTimeoutMinutes } = req.body;
    
    if (!sessionTimeoutMinutes || sessionTimeoutMinutes < 1 || sessionTimeoutMinutes > 60) {
        return res.status(400).json({ success: false, error: 'El tiempo debe estar entre 1 y 60 minutos' });
    }
    
    const config = getConfig();
    config.sessionTimeoutMinutes = parseInt(sessionTimeoutMinutes);
    
    if (saveConfig(config)) {
        logAudit('SESSION_TIMEOUT_UPDATED', { sessionTimeoutMinutes: config.sessionTimeoutMinutes }, req);
        console.log('Timeout de sesion actualizado:', config.sessionTimeoutMinutes, 'minutos');
        res.json({ success: true, message: 'Tiempo de sesion actualizado', sessionTimeoutMinutes: config.sessionTimeoutMinutes });
    } else {
        res.status(500).json({ success: false, error: 'Error al guardar configuracion' });
    }
});

// GET /api/config/upload - Obtener limite de subida
router.get('/upload', requireAuth, (req, res) => {
    const config = getConfig();
    res.json({
        success: true,
        maxUploadMB: config.maxUploadMB || 20
    });
});

// PUT /api/config/upload - Actualizar limite de subida
router.put('/upload', requireAuth, (req, res) => {
    const { maxUploadMB } = req.body;
    
    if (!maxUploadMB || maxUploadMB < 5 || maxUploadMB > 100) {
        return res.status(400).json({ success: false, error: 'El limite debe estar entre 5 y 100 MB' });
    }
    
    const config = getConfig();
    config.maxUploadMB = parseInt(maxUploadMB);
    
    if (saveConfig(config)) {
        logAudit('UPLOAD_LIMIT_UPDATED', { maxUploadMB: config.maxUploadMB }, req);
        console.log('Limite de subida actualizado:', config.maxUploadMB, 'MB');
        res.json({ success: true, message: 'Limite de subida actualizado', maxUploadMB: config.maxUploadMB });
    } else {
        res.status(500).json({ success: false, error: 'Error al guardar configuracion' });
    }
});

module.exports = router;