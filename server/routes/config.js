const express = require('express');
const router = express.Router();
const { requireAuth } = require('../auth');
const { getConfig, saveConfig } = require('../storage');
const { logAudit } = require('../logs');

// GET /api/config - Obtener configuración
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

// GET /api/config/session - Obtener timeout de sesión
router.get('/session', requireAuth, (req, res) => {
    const config = getConfig();
    res.json({
        success: true,
        sessionTimeoutMinutes: config.sessionTimeoutMinutes || 20
    });
});

// PUT /api/config/session - Actualizar timeout de sesión
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

module.exports = router;
