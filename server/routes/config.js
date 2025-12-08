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
        return res.status(400).json({ success: false, error: 'GMT offset invalido' });
    }
    
    const config = getConfig();
    config.gmtOffset = parseInt(gmtOffset);
    
    if (saveConfig(config)) {
        logAudit('CONFIG_UPDATED', { gmtOffset: config.gmtOffset }, req);
        res.json({ success: true, message: 'Configuracion guardada', gmtOffset: config.gmtOffset });
    } else {
        res.status(500).json({ success: false, error: 'Error al guardar' });
    }
});

// GET /api/config/session
router.get('/session', requireAuth, (req, res) => {
    const config = getConfig();
    res.json({ success: true, sessionTimeoutMinutes: config.sessionTimeoutMinutes || 20 });
});

// PUT /api/config/session
router.put('/session', requireAuth, (req, res) => {
    const { sessionTimeoutMinutes } = req.body;
    
    if (!sessionTimeoutMinutes || sessionTimeoutMinutes < 1 || sessionTimeoutMinutes > 60) {
        return res.status(400).json({ success: false, error: 'Tiempo entre 1 y 60 minutos' });
    }
    
    const config = getConfig();
    config.sessionTimeoutMinutes = parseInt(sessionTimeoutMinutes);
    
    if (saveConfig(config)) {
        logAudit('SESSION_TIMEOUT_UPDATED', { sessionTimeoutMinutes: config.sessionTimeoutMinutes }, req);
        res.json({ success: true, sessionTimeoutMinutes: config.sessionTimeoutMinutes });
    } else {
        res.status(500).json({ success: false, error: 'Error al guardar' });
    }
});

// GET /api/config/upload
router.get('/upload', requireAuth, (req, res) => {
    const config = getConfig();
    res.json({ success: true, maxUploadMB: config.maxUploadMB || 20 });
});

// PUT /api/config/upload
router.put('/upload', requireAuth, (req, res) => {
    const { maxUploadMB } = req.body;
    const validValues = [20, 30, 40, 50];
    
    if (!maxUploadMB || !validValues.includes(parseInt(maxUploadMB))) {
        return res.status(400).json({ success: false, error: 'Limite debe ser 20, 30, 40 o 50 MB' });
    }
    
    const config = getConfig();
    config.maxUploadMB = parseInt(maxUploadMB);
    
    if (saveConfig(config)) {
        logAudit('UPLOAD_LIMIT_UPDATED', { maxUploadMB: config.maxUploadMB }, req);
        res.json({ 
            success: true, 
            message: 'Guardado. Reinicia el servidor para aplicar.', 
            maxUploadMB: config.maxUploadMB,
            requiresRestart: true
        });
    } else {
        res.status(500).json({ success: false, error: 'Error al guardar' });
    }
});

module.exports = router;