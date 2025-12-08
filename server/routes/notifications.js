const express = require('express');
const router = express.Router();
const { requireAuth, getClientIP } = require('../auth');
const { VAPID_PUBLIC_KEY, webpush, AUDIOS_DIR } = require('../config');
const { getSubscriptions, saveSubscriptions, setSubscriptions, getDevotionals, getConfig, getAuditLogs, saveAuditLog, updateDeviceInCache, saveDevicesFromCache, getDevicesCache } = require('../storage');
const { parseUserAgent } = require('../utils');
const { logAudit, getGeoFromIP } = require('../logs');
const path = require('path');
const fs = require('fs');

// GET /api/notifications/vapid-public-key
router.get('/vapid-public-key', (req, res) => {
    res.json({ success: true, publicKey: VAPID_PUBLIC_KEY });
});

// POST /api/notifications/subscribe
router.post('/subscribe', async (req, res) => {
    const subscription = req.body;
    const userAgent = req.headers['user-agent'] || '';
    const clientIP = getClientIP(req);
    const deviceInfo = parseUserAgent(userAgent);
    const pushSubscriptions = getSubscriptions();
    const devicesCache = getDevicesCache();
    
    const existingIndex = pushSubscriptions.findIndex(sub => sub.endpoint === subscription.endpoint);
    
    if (existingIndex === -1) {
        const geoInfo = await getGeoFromIP(clientIP);
        
        subscription.id = Date.now().toString();
        subscription.userAgent = userAgent;
        subscription.createdAt = new Date().toISOString();
        subscription.lastSeen = new Date().toISOString();
        subscription.ip = clientIP;
        subscription.location = geoInfo;
        subscription.device = deviceInfo;
        
        pushSubscriptions.push(subscription);
        
        devicesCache.set(subscription.id, {
            id: subscription.id,
            endpoint: subscription.endpoint,
            userAgent,
            device: deviceInfo,
            ip: clientIP,
            location: geoInfo,
            createdAt: subscription.createdAt,
            lastSeen: subscription.lastSeen,
            isOnline: true
        });
        
        saveSubscriptions(pushSubscriptions);
        saveDevicesFromCache();
        console.log(`Nueva suscripcion push desde ${geoInfo.country} (${deviceInfo.os} ${deviceInfo.osVersion}). Total:`, pushSubscriptions.length);
    } else {
        const geoInfo = await getGeoFromIP(clientIP);
        const now = new Date().toISOString();
        
        pushSubscriptions[existingIndex].ip = clientIP;
        pushSubscriptions[existingIndex].location = geoInfo;
        pushSubscriptions[existingIndex].lastSeen = now;
        pushSubscriptions[existingIndex].device = deviceInfo;
        
        const deviceId = pushSubscriptions[existingIndex].id;
        if (deviceId && devicesCache.has(deviceId)) {
            updateDeviceInCache(deviceId, {
                ip: clientIP,
                location: geoInfo,
                lastSeen: now,
                device: deviceInfo,
                isOnline: true
            });
        }
        
        saveSubscriptions(pushSubscriptions);
        console.log('Suscripcion actualizada. Total:', pushSubscriptions.length);
    }
    
    res.json({ success: true, message: 'Suscrito correctamente' });
});

// POST /api/notifications/check
router.post('/check', (req, res) => {
    const { endpoint } = req.body;
    
    if (!endpoint) {
        return res.json({ success: false, exists: false });
    }
    
    const pushSubscriptions = getSubscriptions();
    const exists = pushSubscriptions.some(sub => sub.endpoint === endpoint);
    res.json({ success: true, exists });
});

// POST /api/notifications/schedule
router.post('/schedule', (req, res) => {
    const { hour, minute } = req.body;
    console.log(`Recordatorio programado para las ${hour}:${minute}`);
    res.json({ success: true, message: 'Recordatorio programado' });
});

// POST /api/notifications/heartbeat
router.post('/heartbeat', async (req, res) => {
    const { endpoint } = req.body;
    const clientIP = getClientIP(req);
    const userAgent = req.headers['user-agent'] || '';
    
    if (!endpoint) {
        return res.json({ success: false, error: 'Endpoint requerido' });
    }
    
    const pushSubscriptions = getSubscriptions();
    const devicesCache = getDevicesCache();
    const existingIndex = pushSubscriptions.findIndex(sub => sub.endpoint === endpoint);
    
    if (existingIndex !== -1) {
        const now = new Date().toISOString();
        const geoInfo = await getGeoFromIP(clientIP);
        const deviceInfo = parseUserAgent(userAgent);
        
        pushSubscriptions[existingIndex].lastSeen = now;
        pushSubscriptions[existingIndex].ip = clientIP;
        pushSubscriptions[existingIndex].location = geoInfo;
        pushSubscriptions[existingIndex].device = deviceInfo;
        
        const deviceId = pushSubscriptions[existingIndex].id;
        if (deviceId && devicesCache.has(deviceId)) {
            updateDeviceInCache(deviceId, {
                lastSeen: now,
                ip: clientIP,
                location: geoInfo,
                device: deviceInfo,
                isOnline: true
            });
        }
        
        if (Math.random() < 0.1) {
            saveSubscriptions(pushSubscriptions);
        }
        
        res.json({ success: true, lastSeen: now });
    } else {
        res.json({ success: false, error: 'Dispositivo no registrado' });
    }
});

// POST /api/notifications/send
router.post('/send', async (req, res) => {
    const { title, body, target, targetValue } = req.body;
    
    if (!title) {
        return res.status(400).json({ success: false, error: 'Titulo requerido' });
    }
    
    let pushSubscriptions = getSubscriptions();
    let targetSubscriptions = [...pushSubscriptions];
    
    // Filtrar segun el target
    if (target === 'country' && targetValue) {
        targetSubscriptions = pushSubscriptions.filter(sub => 
            sub.location && sub.location.country === targetValue
        );
        console.log(`Filtrando por pais: ${targetValue} - ${targetSubscriptions.length} dispositivos`);
    } else if (target === 'os' && targetValue) {
        targetSubscriptions = pushSubscriptions.filter(sub => 
            sub.device && sub.device.os === targetValue
        );
        console.log(`Filtrando por SO: ${targetValue} - ${targetSubscriptions.length} dispositivos`);
    } else if (target === 'device' && targetValue) {
        targetSubscriptions = pushSubscriptions.filter(sub => sub.id === targetValue);
        console.log(`Enviando a dispositivo especifico: ${targetValue}`);
    }
    
    console.log(`Enviando notificacion: "${title}" a ${targetSubscriptions.length} suscriptores`);
    
    const payload = JSON.stringify({
        title,
        body: body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-96.png',
        data: { url: '/' }
    });
    
    let successCount = 0;
    let failCount = 0;
    const failedSubscriptions = [];
    
    const sendPromises = targetSubscriptions.map(async (subscription, index) => {
        try {
            await webpush.sendNotification(subscription, payload);
            successCount++;
            console.log(`Notificacion enviada a dispositivo ${index + 1}`);
        } catch (error) {
            failCount++;
            console.error(`Error enviando a dispositivo ${index + 1}:`, error.message);
            if (error.statusCode === 410 || error.statusCode === 404) {
                failedSubscriptions.push(subscription.endpoint);
            }
        }
    });
    
    await Promise.all(sendPromises);
    
    if (failedSubscriptions.length > 0) {
        pushSubscriptions = pushSubscriptions.filter(sub => !failedSubscriptions.includes(sub.endpoint));
        setSubscriptions(pushSubscriptions);
        saveSubscriptions(pushSubscriptions);
        console.log(`Eliminadas ${failedSubscriptions.length} suscripciones invalidas`);
    }
    
    // Log de auditoria
    logAudit('NOTIFICATION_SENT', { 
        title, 
        target: target || 'all', 
        targetValue: targetValue || null,
        sent: successCount, 
        failed: failCount 
    }, req);
    
    res.json({ 
        success: true, 
        sent: successCount,
        failed: failCount,
        message: `Notificacion enviada a ${successCount} dispositivos${failCount > 0 ? `, ${failCount} fallidos` : ''}`
    });
});

// GET /api/notifications/count
router.get('/count', (req, res) => {
    const pushSubscriptions = getSubscriptions();
    res.json({ success: true, count: pushSubscriptions.length });
});

// GET /api/notifications/devices
router.get('/devices', (req, res) => {
    const pushSubscriptions = getSubscriptions();
    
    const devices = pushSubscriptions.map((sub, index) => {
        const deviceInfo = sub.device || parseUserAgent(sub.userAgent);
        const lastSeen = sub.lastSeen || sub.createdAt;
        const lastSeenDate = new Date(lastSeen);
        const now = new Date();
        const diffMinutes = Math.floor((now - lastSeenDate) / 60000);
        
        let lastSeenText = '';
        let isOnline = false;
        
        if (diffMinutes < 5) {
            lastSeenText = 'En linea';
            isOnline = true;
        } else if (diffMinutes < 60) {
            lastSeenText = `Hace ${diffMinutes} min`;
        } else if (diffMinutes < 1440) {
            lastSeenText = `Hace ${Math.floor(diffMinutes / 60)}h`;
        } else {
            lastSeenText = `Hace ${Math.floor(diffMinutes / 1440)}d`;
        }
        
        return {
            id: sub.id || index.toString(),
            deviceType: deviceInfo.deviceType || 'Desconocido',
            icon: deviceInfo.icon || '',
            os: deviceInfo.os || 'Desconocido',
            osVersion: deviceInfo.osVersion || '',
            browser: deviceInfo.browser || 'Desconocido',
            ip: sub.ip || 'Desconocida',
            country: sub.location?.country || 'Desconocido',
            countryCode: sub.location?.countryCode || '??',
            city: sub.location?.city || '',
            createdAt: sub.createdAt || new Date().toISOString(),
            lastSeen,
            lastSeenText,
            isOnline
        };
    });
    
    devices.sort((a, b) => {
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;
        return new Date(b.lastSeen) - new Date(a.lastSeen);
    });
    
    res.json({ 
        success: true, 
        devices, 
        total: devices.length,
        online: devices.filter(d => d.isOnline).length
    });
});

// DELETE /api/notifications/device/:id
router.delete('/device/:id', (req, res) => {
    const { id } = req.params;
    let pushSubscriptions = getSubscriptions();
    const index = pushSubscriptions.findIndex((sub, idx) => (sub.id || idx.toString()) === id);
    
    if (index !== -1) {
        pushSubscriptions.splice(index, 1);
        setSubscriptions(pushSubscriptions);
        saveSubscriptions(pushSubscriptions);
        res.json({ success: true, message: 'Dispositivo eliminado' });
    } else {
        res.status(404).json({ success: false, error: 'Dispositivo no encontrado' });
    }
});

// Sistema de Notificacion Automatica
let lastNotifiedDate = null;

async function sendDailyDevotionalNotification() {
    const config = getConfig();
    const gmtOffset = config.gmtOffset || 0;
    const now = new Date();
    const localTime = new Date(now.getTime() + (gmtOffset * 60 * 60 * 1000));
    const dateStr = localTime.toISOString().split('T')[0];
    
    const audioPath = path.join(AUDIOS_DIR, `${dateStr}.mp3`);
    if (!fs.existsSync(audioPath)) {
        console.log(`No hay devocional para hoy (${dateStr}), no se envia notificacion`);
        return;
    }
    
    const devotionalsDB = getDevotionals();
    const devotional = devotionalsDB[dateStr];
    const title = devotional?.title || 'Devocional del dia';
    const body = 'Escucha el devocional de hoy';
    
    let pushSubscriptions = getSubscriptions();
    if (pushSubscriptions.length === 0) {
        console.log('No hay suscriptores para enviar notificacion');
        return;
    }
    
    console.log(`Enviando notificacion automatica: "${title}" a ${pushSubscriptions.length} suscriptores`);
    
    const payload = JSON.stringify({
        title,
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-96.png',
        data: { url: `/?date=${dateStr}` }
    });
    
    let successCount = 0;
    let failCount = 0;
    const failedSubscriptions = [];
    
    for (const subscription of pushSubscriptions) {
        try {
            await webpush.sendNotification(subscription, payload);
            successCount++;
        } catch (error) {
            failCount++;
            if (error.statusCode === 410 || error.statusCode === 404) {
                failedSubscriptions.push(subscription.endpoint);
            }
        }
    }
    
    if (failedSubscriptions.length > 0) {
        pushSubscriptions = pushSubscriptions.filter(sub => !failedSubscriptions.includes(sub.endpoint));
        setSubscriptions(pushSubscriptions);
        saveSubscriptions(pushSubscriptions);
        console.log(`Eliminadas ${failedSubscriptions.length} suscripciones invalidas`);
    }
    
    console.log(`Notificacion automatica enviada: ${successCount} exitosas, ${failCount} fallidas`);
    
    const auditLogs = getAuditLogs();
    auditLogs.push({
        timestamp: new Date().toISOString(),
        action: 'AUTO_NOTIFICATION_SENT',
        details: { title, successCount, failCount, date: dateStr },
        ip: 'system'
    });
    saveAuditLog(auditLogs);
}

function checkForNewDevotional() {
    const config = getConfig();
    const gmtOffset = config.gmtOffset || 0;
    const now = new Date();
    const localTime = new Date(now.getTime() + (gmtOffset * 60 * 60 * 1000));
    const todayStr = localTime.toISOString().split('T')[0];
    const currentHour = localTime.getUTCHours();
    const currentMinute = localTime.getUTCMinutes();
    
    if (currentHour === 0 && currentMinute < 5 && lastNotifiedDate !== todayStr) {
        const audioPath = path.join(AUDIOS_DIR, `${todayStr}.mp3`);
        if (fs.existsSync(audioPath)) {
            console.log(`Nuevo devocional detectado para ${todayStr}, enviando notificacion...`);
            lastNotifiedDate = todayStr;
            sendDailyDevotionalNotification();
        }
    }
}

// Iniciar verificacion periodica
setInterval(checkForNewDevotional, 60 * 1000);

module.exports = router;
module.exports.sendDailyDevotionalNotification = sendDailyDevotionalNotification;