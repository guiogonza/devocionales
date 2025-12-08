const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const webpush = require('web-push');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ Configuraci├│n VAPID para Push Notifications ============
const VAPID_PUBLIC_KEY = 'BDMM2TnLH-5Z3ucGsLZf66-ISqBrDhRdj_z7UkFLIjPfM3pwYqwNvruPuBBTtCD1NARYEEK2dI8lDZLVn3upvd4';
const VAPID_PRIVATE_KEY = 'c3YCxPW4YAMCwh5bF63PNUvUlwv7uGoXhWR25L2PV9g';

webpush.setVapidDetails(
    'mailto:admin@rioiglesia.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

// Directorios
const AUDIOS_DIR = path.join(__dirname, 'audios');
const ICONS_DIR = path.join(__dirname, 'icons');

// ============ Suscripciones Push (persistentes) ============
const SUBSCRIPTIONS_FILE = path.join(__dirname, 'data', 'subscriptions.json');

// Cargar suscripciones desde archivo
function loadSubscriptions() {
    try {
        if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
            const data = fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error al cargar suscripciones:', error);
    }
    return [];
}

// Guardar suscripciones a archivo
function saveSubscriptions() {
    try {
        fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(pushSubscriptions, null, 2), 'utf8');
    } catch (error) {
        console.error('Error al guardar suscripciones:', error);
    }
}

// Almac├®n de suscripciones (persistentes)
let pushSubscriptions = loadSubscriptions();

// ============ Base de datos de devocionales ============
// Almacena vers├¡culos asociados a cada fecha
const DEVOTIONALS_FILE = path.join(__dirname, 'data', 'devotionals.json');

// Asegurar que existe el directorio de datos
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Cargar devocionales desde archivo
function loadDevotionals() {
    try {
        if (fs.existsSync(DEVOTIONALS_FILE)) {
            const data = fs.readFileSync(DEVOTIONALS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error al cargar devocionales:', error);
    }
    return {};
}

// Guardar devocionales a archivo
function saveDevotionals(devotionals) {
    try {
        fs.writeFileSync(DEVOTIONALS_FILE, JSON.stringify(devotionals, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error al guardar devocionales:', error);
        return false;
    }
}

// Base de datos en memoria
let devotionalsDB = loadDevotionals();

// ============ Configuraci├│n de Zona Horaria ============
const CONFIG_FILE = path.join(__dirname, 'data', 'config.json');

// Cargar configuraci├│n
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error al cargar configuraci├│n:', error);
    }
    return { gmtOffset: 0 }; // GMT-0 por defecto
}

// Guardar configuraci├│n
function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error al guardar configuraci├│n:', error);
        return false;
    }
}

let appConfig = loadConfig();

// ============ Sistema de Logs de Auditor├¡a ============
const AUDIT_LOG_FILE = path.join(__dirname, 'data', 'audit_log.json');

function loadAuditLog() {
    try {
        if (fs.existsSync(AUDIT_LOG_FILE)) {
            const data = fs.readFileSync(AUDIT_LOG_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error al cargar logs de auditor├¡a:', error);
    }
    return [];
}

function saveAuditLog(logs) {
    try {
        // Mantener solo los ├║ltimos 1000 registros
        const trimmedLogs = logs.slice(-1000);
        fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify(trimmedLogs, null, 2), 'utf8');
    } catch (error) {
        console.error('Error al guardar logs de auditor├¡a:', error);
    }
}

let auditLogs = loadAuditLog();

// Cache de geolocalizacion para no hacer muchas peticiones
const geoCache = new Map();

// Funcion para obtener pais de una IP (devuelve objeto con country y countryCode)
async function getGeoFromIP(ip) {
    // Limpiar IP (remover puerto si existe)
    const cleanIP = ip.split(',')[0].trim().replace('::ffff:', '');
    
    // IPs locales
    if (cleanIP === '127.0.0.1' || cleanIP === 'localhost' || cleanIP === '::1' || cleanIP.startsWith('192.168.') || cleanIP.startsWith('10.')) {
        return { country: 'Local', countryCode: 'XX' };
    }
    
    // Verificar cache
    if (geoCache.has(cleanIP)) {
        return geoCache.get(cleanIP);
    }
    
    try {
        const response = await fetch(`http://ip-api.com/json/${cleanIP}?fields=country,countryCode`);
        const data = await response.json();
        const geoInfo = {
            country: data.country || 'Desconocido',
            countryCode: data.countryCode || '??'
        };
        geoCache.set(cleanIP, geoInfo);
        
        // Limpiar cache si es muy grande
        if (geoCache.size > 1000) {
            const firstKey = geoCache.keys().next().value;
            geoCache.delete(firstKey);
        }
        
        return geoInfo;
    } catch (error) {
        console.error('Error obteniendo geolocalizacion:', error.message);
        return { country: 'Desconocido', countryCode: '??' };
    }
}

// Funcion para registrar acciones de auditoria (admin)
async function logAudit(action, details, req = null) {
    const ip = req ? (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection.remoteAddress || 'unknown') : 'system';
    const geoInfo = ip !== 'system' ? await getGeoFromIP(ip) : { country: 'System', countryCode: 'XX' };
    
    const entry = {
        timestamp: new Date().toISOString(),
        action,
        details,
        ip,
        country: geoInfo.country,
        countryCode: geoInfo.countryCode,
        userAgent: req ? req.headers['user-agent'] : 'system'
    };
    auditLogs.push(entry);
    saveAuditLog(auditLogs);
    console.log(`AUDIT: ${action} - ${JSON.stringify(details)} - ${geoInfo.country}`);
}

// ============ Sistema de Logs de Actividad de Usuarios ============
const ACTIVITY_LOG_FILE = path.join(__dirname, 'data', 'activity_log.json');

function loadActivityLog() {
    try {
        if (fs.existsSync(ACTIVITY_LOG_FILE)) {
            const data = fs.readFileSync(ACTIVITY_LOG_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error al cargar logs de actividad:', error);
    }
    return [];
}

function saveActivityLog(logs) {
    try {
        // Mantener solo los ├║ltimos 5000 registros
        const trimmedLogs = logs.slice(-5000);
        fs.writeFileSync(ACTIVITY_LOG_FILE, JSON.stringify(trimmedLogs, null, 2), 'utf8');
    } catch (error) {
        console.error('Error al guardar logs de actividad:', error);
    }
}

let activityLogs = loadActivityLog();

// Funci├│n para registrar actividad de usuarios (con geolocalizaci├│n)
// Funci├│n para detectar sistema operativo desde User Agent
function detectOS(userAgent) {
    if (!userAgent) return { os: 'Desconocido', icon: 'ÔØô' };
    
    const ua = userAgent.toLowerCase();
    
    if (ua.includes('iphone')) return { os: 'iOS (iPhone)', icon: '­ƒô▒' };
    if (ua.includes('ipad')) return { os: 'iOS (iPad)', icon: '­ƒô▒' };
    if (ua.includes('ipod')) return { os: 'iOS (iPod)', icon: '­ƒô▒' };
    if (ua.includes('mac os') || ua.includes('macintosh')) return { os: 'macOS', icon: '­ƒûÑ´©Å' };
    if (ua.includes('android')) {
        if (ua.includes('mobile')) return { os: 'Android (M├│vil)', icon: '­ƒô▒' };
        return { os: 'Android (Tablet)', icon: '­ƒô▒' };
    }
    if (ua.includes('windows phone')) return { os: 'Windows Phone', icon: '­ƒô▒' };
    if (ua.includes('windows')) return { os: 'Windows', icon: '­ƒÆ╗' };
    if (ua.includes('linux')) return { os: 'Linux', icon: '­ƒÉº' };
    if (ua.includes('cros')) return { os: 'Chrome OS', icon: '­ƒÆ╗' };
    
    return { os: 'Desconocido', icon: 'ÔØô' };
}

// Funci├│n para registrar actividad de usuarios (con geolocalizaci├│n)
async function logActivity(action, details, req) {
    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection.remoteAddress || 'unknown';
    const cleanIP = ip.split(',')[0].trim();
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    // Obtener geolocalizaci├│n
    let geoInfo = { country: 'Desconocido', city: '', countryCode: '' };
    try {
        geoInfo = await getGeoInfo(cleanIP);
    } catch (e) {
        console.error('Error obteniendo geo para actividad:', e);
    }
    
    // Detectar sistema operativo
    const osInfo = detectOS(userAgent);
    
    const entry = {
        timestamp: new Date().toISOString(),
        action,
        details,
        ip: cleanIP,
        country: geoInfo.country,
        countryCode: geoInfo.countryCode || '',
        city: geoInfo.city || '',
        os: osInfo.os,
        osIcon: osInfo.icon,
        userAgent: userAgent,
        referer: req.headers['referer'] || 'direct'
    };
    activityLogs.push(entry);
    saveActivityLog(activityLogs);
    console.log(`­ƒæñ ACTIVITY: ${action} - ${osInfo.icon} ${osInfo.os} - IP: ${cleanIP} - ${geoInfo.country} - ${JSON.stringify(details)}`);
}

// ============ Rate Limiting para Login ============
const loginAttempts = new Map(); // IP -> { count, lastAttempt, blockedUntil }
const MAX_LOGIN_ATTEMPTS = 5;
const BLOCK_DURATION = 15 * 60 * 1000; // 15 minutos de bloqueo
const ATTEMPT_WINDOW = 5 * 60 * 1000; // Ventana de 5 minutos para contar intentos

function checkRateLimit(ip) {
    const now = Date.now();
    const attempts = loginAttempts.get(ip);
    
    if (!attempts) return { allowed: true };
    
    // Si est├í bloqueado
    if (attempts.blockedUntil && now < attempts.blockedUntil) {
        const remainingMs = attempts.blockedUntil - now;
        const remainingMins = Math.ceil(remainingMs / 60000);
        return { 
            allowed: false, 
            reason: `Demasiados intentos. Intenta de nuevo en ${remainingMins} minutos.`
        };
    }
    
    // Limpiar intentos antiguos
    if (now - attempts.lastAttempt > ATTEMPT_WINDOW) {
        loginAttempts.delete(ip);
        return { allowed: true };
    }
    
    return { allowed: true };
}

function recordLoginAttempt(ip, success) {
    const now = Date.now();
    let attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: now };
    
    if (success) {
        // Login exitoso - limpiar intentos
        loginAttempts.delete(ip);
        return;
    }
    
    // Incrementar contador de intentos fallidos
    attempts.count++;
    attempts.lastAttempt = now;
    
    if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
        attempts.blockedUntil = now + BLOCK_DURATION;
        console.log(`­ƒÜ½ IP ${ip} bloqueada por ${BLOCK_DURATION/60000} minutos`);
    }
    
    loginAttempts.set(ip, attempts);
}

// ============ Configuracion de Admin (persistente con multiples usuarios) ============
const ADMIN_FILE = path.join(__dirname, 'data', 'admin.json');

// Timeout de sesion - por defecto 5 minutos, configurable
function getSessionTimeout() {
    return (appConfig.sessionTimeoutMinutes || 20) * 60 * 1000;
}

function loadAdminConfig() {
    try {
        if (fs.existsSync(ADMIN_FILE)) {
            const data = fs.readFileSync(ADMIN_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error al cargar config admin:', error);
    }
    // Valores por defecto - primer usuario admin
    return {
        users: [
            {
                id: '1',
                username: process.env.ADMIN_USER || 'admin',
                password: process.env.ADMIN_PASS || 'rio2024',
                role: 'superadmin',
                createdAt: new Date().toISOString()
            }
        ]
    };
}

function saveAdminConfig(config) {
    try {
        fs.writeFileSync(ADMIN_FILE, JSON.stringify(config, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error al guardar config admin:', error);
        return false;
    }
}

let adminConfig = loadAdminConfig();

// Funci├│n para validar credenciales
function validateCredentials(username, password) {
    const user = adminConfig.users.find(u => u.username === username && u.password === password);
    return user || null;
}

// ============ Dispositivos Registrados (mejorado con cache en memoria) ============
const DEVICES_FILE = path.join(__dirname, 'data', 'devices.json');

// Cache en memoria para dispositivos (similar a Redis pero sin dependencia externa)
const devicesCache = new Map();
let devicesCacheLoaded = false;

function loadDevices() {
    try {
        if (fs.existsSync(DEVICES_FILE)) {
            const data = fs.readFileSync(DEVICES_FILE, 'utf8');
            const devices = JSON.parse(data);
            // Cargar en cache
            devices.forEach(d => devicesCache.set(d.id, d));
            devicesCacheLoaded = true;
            return devices;
        }
    } catch (error) {
        console.error('Error al cargar dispositivos:', error);
    }
    devicesCacheLoaded = true;
    return [];
}

function saveDevices(devices) {
    try {
        fs.writeFileSync(DEVICES_FILE, JSON.stringify(devices, null, 2), 'utf8');
    } catch (error) {
        console.error('Error al guardar dispositivos:', error);
    }
}

function saveDevicesFromCache() {
    const devices = Array.from(devicesCache.values());
    saveDevices(devices);
}

// Actualizar dispositivo en cache y persistir
function updateDeviceInCache(deviceId, updates) {
    const device = devicesCache.get(deviceId);
    if (device) {
        Object.assign(device, updates);
        devicesCache.set(deviceId, device);
        // Guardar de forma asíncrona para no bloquear
        setImmediate(() => saveDevicesFromCache());
    }
}

// Función para parsear User-Agent y extraer SO detallado
function parseUserAgent(userAgent) {
    if (!userAgent) return { os: 'Desconocido', osVersion: '', browser: 'Desconocido', deviceType: 'Desconocido', icon: '🌐' };
    
    let os = 'Desconocido';
    let osVersion = '';
    let browser = 'Desconocido';
    let deviceType = 'Desconocido';
    let icon = '🌐';
    
    // Detectar SO
    if (userAgent.includes('Android')) {
        os = 'Android';
        icon = '📱';
        deviceType = 'Móvil';
        const match = userAgent.match(/Android\s+([\d.]+)/);
        if (match) osVersion = match[1];
    } else if (userAgent.includes('iPhone')) {
        os = 'iOS';
        icon = '🍎';
        deviceType = 'iPhone';
        const match = userAgent.match(/iPhone OS ([\d_]+)/);
        if (match) osVersion = match[1].replace(/_/g, '.');
    } else if (userAgent.includes('iPad')) {
        os = 'iPadOS';
        icon = '🍎';
        deviceType = 'iPad';
        const match = userAgent.match(/CPU OS ([\d_]+)/);
        if (match) osVersion = match[1].replace(/_/g, '.');
    } else if (userAgent.includes('Windows NT 10')) {
        os = 'Windows';
        osVersion = '10/11';
        icon = '💻';
        deviceType = 'PC';
    } else if (userAgent.includes('Windows NT 6.3')) {
        os = 'Windows';
        osVersion = '8.1';
        icon = '💻';
        deviceType = 'PC';
    } else if (userAgent.includes('Windows NT 6.1')) {
        os = 'Windows';
        osVersion = '7';
        icon = '💻';
        deviceType = 'PC';
    } else if (userAgent.includes('Mac OS X')) {
        os = 'macOS';
        icon = '💻';
        deviceType = 'Mac';
        const match = userAgent.match(/Mac OS X ([\d_]+)/);
        if (match) osVersion = match[1].replace(/_/g, '.');
    } else if (userAgent.includes('Linux')) {
        os = 'Linux';
        icon = '🐧';
        deviceType = 'PC';
    } else if (userAgent.includes('CrOS')) {
        os = 'Chrome OS';
        icon = '💻';
        deviceType = 'Chromebook';
    }
    
    // Detectar navegador
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
        browser = 'Chrome';
        const match = userAgent.match(/Chrome\/([\d.]+)/);
        if (match) browser += ' ' + match[1].split('.')[0];
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
        browser = 'Safari';
        const match = userAgent.match(/Version\/([\d.]+)/);
        if (match) browser += ' ' + match[1].split('.')[0];
    } else if (userAgent.includes('Firefox')) {
        browser = 'Firefox';
        const match = userAgent.match(/Firefox\/([\d.]+)/);
        if (match) browser += ' ' + match[1].split('.')[0];
    } else if (userAgent.includes('Edg')) {
        browser = 'Edge';
        const match = userAgent.match(/Edg\/([\d.]+)/);
        if (match) browser += ' ' + match[1].split('.')[0];
    } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
        browser = 'Opera';
    }
    
    return { os, osVersion, browser, deviceType, icon };
}

let registeredDevices = loadDevices();

// Funci├│n para obtener info de geolocalizaci├│n por IP (usando servicio gratuito)
async function getGeoFromIP(ip) {
    try {
        // Limpiar IP
        const cleanIP = ip.replace('::ffff:', '').split(',')[0].trim();
        if (cleanIP === '127.0.0.1' || cleanIP === '::1' || cleanIP.startsWith('192.168.') || cleanIP.startsWith('10.')) {
            return { country: 'Local', city: 'Local Network' };
        }
        
        const response = await fetch(`http://ip-api.com/json/${cleanIP}?fields=country,city,countryCode`);
        if (response.ok) {
            const data = await response.json();
            return {
                country: data.country || 'Desconocido',
                countryCode: data.countryCode || '??',
                city: data.city || 'Desconocida'
            };
        }
    } catch (error) {
        console.error('Error obteniendo geolocalizaci├│n:', error);
    }
    return { country: 'Desconocido', city: 'Desconocida' };
}

// Archivo para persistir sesiones
const SESSIONS_FILE = path.join(__dirname, 'data', 'sessions.json');

// Cargar sesiones desde archivo
function loadSessions() {
    try {
        if (fs.existsSync(SESSIONS_FILE)) {
            const data = fs.readFileSync(SESSIONS_FILE, 'utf8');
            const sessions = JSON.parse(data);
            // Filtrar sesiones expiradas
            const validSessions = {};
            const now = Date.now();
            const timeout = getSessionTimeout();
            for (const [token, session] of Object.entries(sessions)) {
                if (now - session.createdAt < timeout) {
                    validSessions[token] = session;
                }
            }
            return new Map(Object.entries(validSessions));
        }
    } catch (error) {
        console.error('Error al cargar sesiones:', error);
    }
    return new Map();
}

// Guardar sesiones a archivo
function saveSessions() {
    try {
        const sessionsObj = Object.fromEntries(activeSessions);
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessionsObj, null, 2), 'utf8');
    } catch (error) {
        console.error('Error al guardar sesiones:', error);
    }
}

// Tokens de sesi├│n activos (persistidos)
const activeSessions = loadSessions();

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function validateToken(token) {
    if (!token) return false;
    const session = activeSessions.get(token);
    if (!session) return false;
    // Token valido segun configuracion
    if (Date.now() - session.createdAt > getSessionTimeout()) {
        activeSessions.delete(token);
        saveSessions();
        return false;
    }
    // Extender sesi├│n en cada uso (sliding expiration)
    session.createdAt = Date.now();
    saveSessions();
    return true;
}

// Middleware de autenticaci├│n para rutas admin
function requireAuth(req, res, next) {
    const token = req.headers['x-admin-token'];
    if (!validateToken(token)) {
        return res.status(401).json({ success: false, error: 'No autorizado' });
    }
    next();
}

// Asegurar que existe el directorio de audios
if (!fs.existsSync(AUDIOS_DIR)) {
    fs.mkdirSync(AUDIOS_DIR, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());

// ============ Headers de Seguridad ============
app.use((req, res, next) => {
    // Ocultar informaci├│n del servidor
    res.removeHeader('X-Powered-By');
    
    // Headers de seguridad
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Solo en rutas admin, headers m├ís estrictos
    if (req.url.startsWith('/admin')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
    }
    
    next();
});

// Logger de todas las peticiones
app.use((req, res, next) => {
    console.log(`­ƒô¿ ${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Middleware para bloquear acceso a audios de fechas futuras
app.use('/audios', (req, res, next) => {
    // Extraer fecha del nombre del archivo (YYYY-MM-DD.mp3)
    const match = req.url.match(/(\d{4}-\d{2}-\d{2})\.mp3/);
    if (match) {
        const dateStr = match[1];
        const today = new Date().toISOString().split('T')[0];
        
        if (dateStr > today) {
            console.log(`­ƒÜ½ Bloqueado acceso a audio futuro: ${dateStr}`);
            return res.status(403).json({
                success: false,
                error: 'Este contenido a├║n no est├í disponible'
            });
        }
    }
    next();
});

// ============ Streaming de Audio con soporte Range (para iOS) ============
app.get('/audios/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(AUDIOS_DIR, filename);
    
    // Verificar que el archivo existe
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Audio no encontrado' });
    }
    
    // Registrar reproducci├│n (solo en la primera solicitud, no en chunks)
    const range = req.headers.range;
    if (!range || range.startsWith('bytes=0-')) {
        const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
        const devotionalDate = dateMatch ? dateMatch[1] : filename;
        const devotionalInfo = devotionalsDB[devotionalDate] || {};
        logActivity('PLAY_DEVOTIONAL', {
            date: devotionalDate,
            title: devotionalInfo.title || 'Sin t├¡tulo',
            filename: filename
        }, req);
    }
    
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    
    // Headers comunes para iOS
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    if (range) {
        // Streaming con Range (iOS lo necesita)
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;
        
        console.log(`­ƒÄÁ Streaming ${filename}: bytes ${start}-${end}/${fileSize}`);
        
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        res.setHeader('Content-Length', chunkSize);
        
        const stream = fs.createReadStream(filePath, { start, end });
        stream.pipe(res);
    } else {
        // Descarga completa
        console.log(`­ƒÄÁ Sirviendo ${filename} completo: ${fileSize} bytes`);
        res.setHeader('Content-Length', fileSize);
        fs.createReadStream(filePath).pipe(res);
    }
});

app.use(express.static(__dirname));

// ============ Iconos PWA ============
const ICON_BASE64 = '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';

app.get('/icons/icon-192.png', (req, res) => {
    const img = Buffer.from(ICON_BASE64, 'base64');
    res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': img.length
    });
    res.end(img);
});

app.get('/icons/icon-512.png', (req, res) => {
    const img = Buffer.from(ICON_BASE64, 'base64');
    res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': img.length
    });
    res.end(img);
});

app.get('/icons/icon-96.png', (req, res) => {
    const img = Buffer.from(ICON_BASE64, 'base64');
    res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': img.length
    });
    res.end(img);
});

// Configuraci├│n de Multer para subida de archivos
// Usar nombre temporal y renombrar despu├®s de recibir la fecha
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, AUDIOS_DIR);
    },
    filename: (req, file, cb) => {
        // Usar nombre temporal ├║nico
        const tempName = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`;
        cb(null, tempName);
    }
});

const fileFilter = (req, file, cb) => {
    // Validar tipo de archivo
    console.log('­ƒôï Tipo de archivo:', file.mimetype);
    if (file.mimetype === 'audio/mpeg' || file.mimetype === 'audio/mp3') {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten archivos MP3'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB m├íximo
    }
});

// Funci├│n para validar formato de fecha
function isValidDate(dateStr) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    return date.getFullYear() === year &&
           date.getMonth() === month - 1 &&
           date.getDate() === day;
}

// Funci├│n para obtener lista de audios
function getAudiosList() {
    const files = fs.readdirSync(AUDIOS_DIR);
    const audios = [];
    
    files.forEach(file => {
        if (file.endsWith('.mp3')) {
            const filePath = path.join(AUDIOS_DIR, file);
            const stats = fs.statSync(filePath);
            const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})\.mp3$/);
            
            if (dateMatch) {
                const date = dateMatch[1];
                // Obtener datos del devocional si existe
                const devotional = devotionalsDB[date];
                const title = devotional?.title || null;
                const verseReference = devotional?.verseReference || null;
                const verseText = devotional?.verseText || null;
                
                audios.push({
                    date: date,
                    filename: file,
                    size: stats.size,
                    uploadedAt: stats.mtime.toISOString(),
                    title: title,
                    verseReference: verseReference,
                    verseText: verseText
                });
            }
        }
    });
    
    // Ordenar por fecha descendente
    audios.sort((a, b) => b.date.localeCompare(a.date));
    
    return audios;
}

// ============ API Endpoints ============

// POST /api/admin/login - Iniciar sesi├│n admin
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection.remoteAddress || 'unknown';
    const cleanIP = ip.split(',')[0].trim();
    
    // Verificar rate limiting
    const rateCheck = checkRateLimit(cleanIP);
    if (!rateCheck.allowed) {
        logAudit('LOGIN_BLOCKED', { username, reason: 'rate_limit' }, req);
        return res.status(429).json({ success: false, error: rateCheck.reason });
    }
    
    const user = validateCredentials(username, password);
    if (user) {
        recordLoginAttempt(cleanIP, true); // Limpiar intentos fallidos
        const token = generateToken();
        activeSessions.set(token, { createdAt: Date.now(), ip, username: user.username, userId: user.id });
        saveSessions();
        logAudit('LOGIN_SUCCESS', { username: user.username, role: user.role }, req);
        console.log('­ƒöÉ Admin autenticado:', user.username);
        res.json({ success: true, token, user: { username: user.username, role: user.role } });
    } else {
        recordLoginAttempt(cleanIP, false); // Registrar intento fallido
        logAudit('LOGIN_FAILED', { username, attemptedPassword: '***' }, req);
        console.log('ÔØî Intento de login fallido para:', username);
        res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
    }
});

// POST /api/admin/logout - Cerrar sesi├│n
app.post('/api/admin/logout', (req, res) => {
    const token = req.headers['x-admin-token'];
    if (token) {
        const session = activeSessions.get(token);
        logAudit('LOGOUT', { username: session?.username || 'unknown' }, req);
        activeSessions.delete(token);
        saveSessions();
    }
    res.json({ success: true });
});

// GET /api/admin/verify - Verificar si est├í autenticado
app.get('/api/admin/verify', (req, res) => {
    const token = req.headers['x-admin-token'];
    const isValid = validateToken(token);
    const session = activeSessions.get(token);
    res.json({ 
        success: true, 
        authenticated: isValid,
        user: isValid && session ? { username: session.username } : null,
        expiresIn: isValid && session ? Math.max(0, getSessionTimeout() - (Date.now() - session.createdAt)) : 0
    });
});

// ============ API de Gesti├│n de Usuarios ============

// GET /api/admin/users - Listar usuarios (requiere autenticaci├│n)
app.get('/api/admin/users', requireAuth, (req, res) => {
    const users = adminConfig.users.map(u => ({
        id: u.id,
        username: u.username,
        role: u.role,
        createdAt: u.createdAt
    }));
    res.json({ success: true, users });
});

// POST /api/admin/users - Crear usuario (requiere autenticaci├│n)
app.post('/api/admin/users', requireAuth, (req, res) => {
    const { username, password, role } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Usuario y contrase├▒a son requeridos' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ success: false, error: 'La contrase├▒a debe tener al menos 6 caracteres' });
    }
    
    // Verificar si el usuario ya existe
    if (adminConfig.users.find(u => u.username === username)) {
        return res.status(400).json({ success: false, error: 'El usuario ya existe' });
    }
    
    const newUser = {
        id: Date.now().toString(),
        username,
        password,
        role: role || 'admin',
        createdAt: new Date().toISOString()
    };
    
    adminConfig.users.push(newUser);
    saveAdminConfig(adminConfig);
    
    logAudit('USER_CREATED', { newUsername: username, role: newUser.role }, req);
    console.log('­ƒæñ Nuevo usuario creado:', username);
    
    res.json({ success: true, message: 'Usuario creado correctamente', user: { id: newUser.id, username, role: newUser.role } });
});

// PUT /api/admin/users/:id - Editar usuario (requiere autenticaci├│n)
app.put('/api/admin/users/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const { username, password, role } = req.body;
    
    const userIndex = adminConfig.users.findIndex(u => u.id === id);
    if (userIndex === -1) {
        return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    
    const user = adminConfig.users[userIndex];
    const changes = [];
    
    if (username && username !== user.username) {
        // Verificar que no exista otro usuario con ese nombre
        if (adminConfig.users.find(u => u.username === username && u.id !== id)) {
            return res.status(400).json({ success: false, error: 'El nombre de usuario ya existe' });
        }
        changes.push(`username: ${user.username} ÔåÆ ${username}`);
        user.username = username;
    }
    
    if (password) {
        if (password.length < 6) {
            return res.status(400).json({ success: false, error: 'La contrase├▒a debe tener al menos 6 caracteres' });
        }
        changes.push('password changed');
        user.password = password;
    }
    
    if (role && role !== user.role) {
        changes.push(`role: ${user.role} ÔåÆ ${role}`);
        user.role = role;
    }
    
    saveAdminConfig(adminConfig);
    logAudit('USER_UPDATED', { userId: id, username: user.username, changes: changes.join(', ') }, req);
    
    res.json({ success: true, message: 'Usuario actualizado correctamente' });
});

// DELETE /api/admin/users/:id - Eliminar usuario (requiere autenticacion)
app.delete('/api/admin/users/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    
    const userIndex = adminConfig.users.findIndex(u => u.id === id);
    if (userIndex === -1) {
        return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    
    // No permitir eliminar el ultimo usuario
    if (adminConfig.users.length === 1) {
        return res.status(400).json({ success: false, error: 'No se puede eliminar el ultimo usuario' });
    }
    
    // No permitir eliminar usuarios con rol superadmin
    const userToDelete = adminConfig.users[userIndex];
    if (userToDelete.role === 'superadmin') {
        return res.status(403).json({ success: false, error: 'No se puede eliminar un usuario superadmin. Solo puede cambiar su contrasena.' });
    }
    
    const deletedUser = adminConfig.users[userIndex];
    adminConfig.users.splice(userIndex, 1);
    saveAdminConfig(adminConfig);
    
    // Invalidar sesiones del usuario eliminado
    for (const [token, session] of activeSessions.entries()) {
        if (session.userId === id) {
            activeSessions.delete(token);
        }
    }
    saveSessions();
    
    logAudit('USER_DELETED', { deletedUsername: deletedUser.username }, req);
    console.log('­ƒùæ´©Å Usuario eliminado:', deletedUser.username);
    
    res.json({ success: true, message: 'Usuario eliminado correctamente' });
});

// POST /api/admin/change-password - Cambiar contrase├▒a propia (requiere autenticaci├│n)
app.post('/api/admin/change-password', requireAuth, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const token = req.headers['x-admin-token'];
    const session = activeSessions.get(token);
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, error: 'Faltan campos requeridos' });
    }
    
    const user = adminConfig.users.find(u => u.id === session?.userId);
    if (!user) {
        return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    
    if (currentPassword !== user.password) {
        logAudit('PASSWORD_CHANGE_FAILED', { username: user.username, reason: 'Contrase├▒a actual incorrecta' }, req);
        return res.status(401).json({ success: false, error: 'Contrase├▒a actual incorrecta' });
    }
    
    if (newPassword.length < 6) {
        return res.status(400).json({ success: false, error: 'La nueva contrase├▒a debe tener al menos 6 caracteres' });
    }
    
    user.password = newPassword;
    saveAdminConfig(adminConfig);
    
    logAudit('PASSWORD_CHANGED', { username: user.username }, req);
    console.log('­ƒöæ Contrase├▒a cambiada para:', user.username);
    
    res.json({ success: true, message: 'Contrase├▒a cambiada correctamente' });
});

// GET /api/admin/audit-logs - Obtener logs de auditor├¡a ADMIN (requiere autenticaci├│n)
app.get('/api/admin/audit-logs', requireAuth, (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const action = req.query.action; // Filtro por acci├│n
    const ip = req.query.ip; // Filtro por IP
    const startDate = req.query.startDate; // Filtro por fecha inicio
    const endDate = req.query.endDate; // Filtro por fecha fin
    
    let filteredLogs = [...auditLogs];
    
    // Aplicar filtros
    if (action) {
        filteredLogs = filteredLogs.filter(log => log.action.toLowerCase().includes(action.toLowerCase()));
    }
    if (ip) {
        filteredLogs = filteredLogs.filter(log => log.ip && log.ip.includes(ip));
    }
    if (startDate) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= startDate);
    }
    if (endDate) {
        filteredLogs = filteredLogs.filter(log => log.timestamp <= endDate + 'T23:59:59');
    }
    
    const logs = filteredLogs.slice(-limit).reverse();
    
    // Obtener lista de acciones ├║nicas para el filtro
    const actions = [...new Set(auditLogs.map(log => log.action))];
    
    res.json({ success: true, logs, total: filteredLogs.length, actions });
});

// GET /api/admin/activity-logs - Obtener logs de actividad de USUARIOS (requiere autenticaci├│n)
app.get('/api/admin/activity-logs', requireAuth, (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const action = req.query.action; // Filtro por acci├│n
    const ip = req.query.ip; // Filtro por IP
    const startDate = req.query.startDate; // Filtro por fecha inicio
    const endDate = req.query.endDate; // Filtro por fecha fin
    
    let filteredLogs = [...activityLogs];
    
    // Aplicar filtros
    if (action) {
        filteredLogs = filteredLogs.filter(log => log.action.toLowerCase().includes(action.toLowerCase()));
    }
    if (ip) {
        filteredLogs = filteredLogs.filter(log => log.ip && log.ip.includes(ip));
    }
    if (startDate) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= startDate);
    }
    if (endDate) {
        filteredLogs = filteredLogs.filter(log => log.timestamp <= endDate + 'T23:59:59');
    }
    
    const logs = filteredLogs.slice(-limit).reverse();
    
    // Obtener lista de acciones ├║nicas para el filtro
    const actions = [...new Set(activityLogs.map(log => log.action))];
    
    res.json({ success: true, logs, total: filteredLogs.length, actions });
});

// POST /api/track-play - Registrar reproducci├│n de audio (llamado desde el cliente)
app.post('/api/track-play', async (req, res) => {
    const { date, title } = req.body;
    
    if (!date) {
        return res.json({ success: false, error: 'Fecha requerida' });
    }
    
    await logActivity('PLAY_DEVOTIONAL', {
        date: date,
        title: title || 'Sin t├¡tulo'
    }, req);
    
    res.json({ success: true });
});

// GET /api/audios - Listar todos los audios (p├║blico)
app.get('/api/audios', (req, res) => {
    try {
        const audios = getAudiosList();
        res.json({
            success: true,
            data: audios,
            count: audios.length
        });
    } catch (error) {
        console.error('Error al listar audios:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener la lista de audios'
        });
    }
});

// GET /api/audios/:date - Verificar si existe un audio para una fecha
app.get('/api/audios/:date', (req, res) => {
    const { date } = req.params;
    
    if (!isValidDate(date)) {
        return res.status(400).json({
            success: false,
            error: 'Formato de fecha inv├ílido'
        });
    }
    
    // Bloquear acceso a fechas futuras
    if (isFutureDate(date)) {
        return res.json({
            success: true,
            exists: false,
            restricted: true
        });
    }
    
    const filePath = path.join(AUDIOS_DIR, `${date}.mp3`);
    const exists = fs.existsSync(filePath);
    
    if (exists) {
        const stats = fs.statSync(filePath);
        res.json({
            success: true,
            exists: true,
            data: {
                date: date,
                filename: `${date}.mp3`,
                size: stats.size,
                uploadedAt: stats.mtime.toISOString()
            }
        });
    } else {
        res.json({
            success: true,
            exists: false
        });
    }
});

// POST /api/audios - Subir un nuevo audio (requiere autenticaci├│n)
app.post('/api/audios', requireAuth, (req, res) => {
    console.log('­ƒôÑ Recibiendo petici├│n de subida de audio...');
    
    upload.single('audio')(req, res, (err) => {
        console.log('­ƒôª Procesando archivo...');
        
        if (err) {
            console.error('ÔØî Error en multer:', err);
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({
                        success: false,
                        error: 'El archivo excede el tama├▒o m├íximo de 50MB'
                    });
                }
            }
            return res.status(400).json({
                success: false,
                error: err.message || 'Error al procesar el archivo'
            });
        }
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No se proporcionó ningún archivo'
            });
        }
        
        const { date, title, verseReference, verseText } = req.body;
        console.log('📅 Fecha recibida:', date);
        console.log('📁 Archivo temporal:', req.file.filename);
        
        // Validar fecha
        if (!date || !isValidDate(date)) {
            // Eliminar archivo temporal
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                error: 'Fecha invalida. Usa el formato YYYY-MM-DD'
            });
        }
        
        // Permitir subir audios hasta 30 dias en el futuro
        const selectedDate = new Date(date);
        const maxFutureDate = new Date();
        maxFutureDate.setDate(maxFutureDate.getDate() + 30);
        maxFutureDate.setHours(23, 59, 59, 999);
        
        if (selectedDate > maxFutureDate) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                error: 'No se pueden subir audios para mas de 30 dias en el futuro'
            });
        }
        
        // Renombrar archivo temporal al nombre final
        const finalPath = path.join(AUDIOS_DIR, `${date}.mp3`);
        
        try {
            // Si ya existe, eliminarlo primero (sobrescribir)
            if (fs.existsSync(finalPath)) {
                fs.unlinkSync(finalPath);
            }
            
            // Copiar archivo temporal al destino final (m├ís confiable que renameSync en Docker)
            fs.copyFileSync(req.file.path, finalPath);
            
            // Eliminar archivo temporal
            fs.unlinkSync(req.file.path);
            
            console.log('Ô£à Archivo guardado como:', `${date}.mp3`);
            
            const stats = fs.statSync(finalPath);
            
            // Registrar en auditoria
            logAudit('AUDIO_UPLOADED', { date, filename: `${date}.mp3`, size: stats.size }, req);
            
            // Guardar devocional si se enviaron datos
            if (title && verseReference && verseText) {
                devotionalsDB[date] = {
                    title,
                    verseReference,
                    verseText,
                    updatedAt: new Date().toISOString()
                };
                saveDevotionals(devotionalsDB);
                console.log('Devocional guardado para', date);
            }
            
            res.status(201).json({
                success: true,
                message: 'Audio subido correctamente',
                data: {
                    date: date,
                    filename: `${date}.mp3`,
                    size: stats.size,
                    uploadedAt: new Date().toISOString()
                }
            });
        } catch (renameError) {
            console.error('ÔØî Error al renombrar archivo:', renameError);
            // Limpiar archivo temporal si existe
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(500).json({
                success: false,
                error: 'Error al guardar el archivo'
            });
        }
    });
});

// DELETE /api/audios/:date - Eliminar un audio y su devocional (requiere autenticaci├│n)
app.delete('/api/audios/:date', requireAuth, (req, res) => {
    const { date } = req.params;
    
    if (!isValidDate(date)) {
        return res.status(400).json({
            success: false,
            error: 'Formato de fecha inv├ílido'
        });
    }
    
    const filePath = path.join(AUDIOS_DIR, `${date}.mp3`);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({
            success: false,
            error: 'No existe un audio para esa fecha'
        });
    }
    
    try {
        // Eliminar archivo de audio
        fs.unlinkSync(filePath);
        
        // Eliminar tambi├®n el devocional asociado (t├¡tulo, vers├¡culo, etc.)
        if (devotionalsDB[date]) {
            delete devotionalsDB[date];
            saveDevotionals(devotionalsDB);
            console.log('­ƒùæ´©Å Devocional eliminado para:', date);
        }
        
        // Registrar en auditor├¡a
        logAudit('AUDIO_DELETED', { date }, req);
        
        res.json({
            success: true,
            message: 'Audio y devocional eliminados correctamente',
            date: date
        });
    } catch (error) {
        console.error('Error al eliminar audio:', error);
        res.status(500).json({
            success: false,
            error: 'Error al eliminar el archivo'
        });
    }
});

// ============ API de Im├ígenes ============

// Configuraci├│n de Multer para im├ígenes
const imageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, ICONS_DIR);
    },
    filename: (req, file, cb) => {
        const tempName = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`;
        cb(null, tempName);
    }
});

const imageFilter = (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten archivos PNG, JPG o WEBP'), false);
    }
};

const uploadImage = multer({
    storage: imageStorage,
    fileFilter: imageFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB m├íximo
    }
});

// POST /api/images - Subir imagen (logo o pastores)
app.post('/api/images', requireAuth, (req, res) => {
    console.log('­ƒô© Recibiendo petici├│n de subida de imagen...');
    
    uploadImage.single('image')(req, res, (err) => {
        if (err) {
            console.error('ÔØî Error en multer:', err);
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({
                        success: false,
                        error: 'La imagen excede el tama├▒o m├íximo de 5MB'
                    });
                }
            }
            return res.status(400).json({
                success: false,
                error: err.message || 'Error al procesar la imagen'
            });
        }
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No se proporcion├│ ninguna imagen'
            });
        }
        
        const imageType = req.body.type; // 'logo' o 'pastores'
        console.log('­ƒû╝´©Å Tipo de imagen:', imageType);
        
        if (!['logo', 'pastores'].includes(imageType)) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                error: 'Tipo de imagen inv├ílido. Debe ser "logo" o "pastores"'
            });
        }
        
        // Determinar extensi├│n y nombre final
        const ext = imageType === 'logo' ? '.png' : '.jpg';
        const finalName = imageType === 'logo' ? 'logo.png' : 'pastores.jpg';
        const finalPath = path.join(ICONS_DIR, finalName);
        
        try {
            // Hacer backup del archivo anterior si existe
            if (fs.existsSync(finalPath)) {
                const backupPath = path.join(ICONS_DIR, `${imageType}_backup_${Date.now()}${ext}`);
                fs.copyFileSync(finalPath, backupPath);
                fs.unlinkSync(finalPath);
            }
            
            // Copiar archivo temporal al destino final
            fs.copyFileSync(req.file.path, finalPath);
            fs.unlinkSync(req.file.path);
            
            console.log('Ô£à Imagen guardada como:', finalName);
            
            res.status(201).json({
                success: true,
                message: `${imageType === 'logo' ? 'Logo' : 'Imagen de pastores'} actualizado correctamente`,
                data: {
                    type: imageType,
                    filename: finalName,
                    path: `/icons/${finalName}`,
                    updatedAt: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('ÔØî Error al guardar imagen:', error);
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(500).json({
                success: false,
                error: 'Error al guardar la imagen'
            });
        }
    });
});

// ============ API de Devocionales (Vers├¡culos) ============

// Funci├│n para obtener la fecha actual seg├║n el GMT configurado (formato YYYY-MM-DD)
function getTodayGMT() {
    const now = new Date();
    // Aplicar el offset de GMT configurado
    const offsetMs = appConfig.gmtOffset * 60 * 60 * 1000;
    const adjustedTime = new Date(now.getTime() + offsetMs);
    return adjustedTime.toISOString().split('T')[0];
}

// Funci├│n para verificar si una fecha es futura respecto al GMT configurado
function isFutureDate(dateStr) {
    const today = getTodayGMT();
    return dateStr > today;
}

// GET /api/server-time - Obtener hora del servidor seg├║n GMT configurado
app.get('/api/server-time', (req, res) => {
    const now = new Date();
    const offsetMs = appConfig.gmtOffset * 60 * 60 * 1000;
    const adjustedTime = new Date(now.getTime() + offsetMs);
    
    const gmtLabel = appConfig.gmtOffset >= 0 ? `GMT+${appConfig.gmtOffset}` : `GMT${appConfig.gmtOffset}`;
    
    res.json({
        success: true,
        serverTime: adjustedTime.toISOString(),
        today: getTodayGMT(),
        timezone: gmtLabel,
        gmtOffset: appConfig.gmtOffset
    });
});

// GET /api/config - Obtener configuraci├│n actual (p├║blico)
app.get('/api/config', (req, res) => {
    res.json({
        success: true,
        config: {
            gmtOffset: appConfig.gmtOffset,
            timezone: appConfig.gmtOffset >= 0 ? `GMT+${appConfig.gmtOffset}` : `GMT${appConfig.gmtOffset}`
        }
    });
});

// PUT /api/config - Actualizar configuraci├│n (requiere auth)
app.put('/api/config', requireAuth, (req, res) => {
    const { gmtOffset } = req.body;
    
    if (typeof gmtOffset !== 'number' || gmtOffset < -12 || gmtOffset > 14) {
        return res.status(400).json({
            success: false,
            error: 'GMT offset debe ser un n├║mero entre -12 y +14'
        });
    }
    
    appConfig.gmtOffset = gmtOffset;
    
    if (saveConfig(appConfig)) {
        const gmtLabel = gmtOffset >= 0 ? `GMT+${gmtOffset}` : `GMT${gmtOffset}`;
        console.log(`ÔÅ░ Zona horaria actualizada a: ${gmtLabel}`);
        res.json({
            success: true,
            message: `Zona horaria actualizada a ${gmtLabel}`,
            config: {
                gmtOffset: appConfig.gmtOffset,
                timezone: gmtLabel
            }
        });
    } else {
        res.status(500).json({
            success: false,
            error: 'Error al guardar la configuracion'
        });
    }
});

// GET /api/config/session - Obtener configuracion de sesion (requiere auth)
app.get('/api/config/session', requireAuth, (req, res) => {
    res.json({
        success: true,
        sessionTimeoutMinutes: appConfig.sessionTimeoutMinutes || 20
    });
});

// PUT /api/config/session - Actualizar tiempo de sesion (requiere auth)
app.put('/api/config/session', requireAuth, (req, res) => {
    const { sessionTimeoutMinutes } = req.body;
    
    if (typeof sessionTimeoutMinutes !== 'number' || sessionTimeoutMinutes < 1 || sessionTimeoutMinutes > 60) {
        return res.status(400).json({
            success: false,
            error: 'El tiempo de sesion debe ser entre 1 y 60 minutos'
        });
    }
    
    appConfig.sessionTimeoutMinutes = sessionTimeoutMinutes;
    
    if (saveConfig(appConfig)) {
        logAudit('SESSION_TIMEOUT_CHANGED', { minutes: sessionTimeoutMinutes }, req);
        res.json({
            success: true,
            message: `Tiempo de sesion actualizado a ${sessionTimeoutMinutes} minutos`,
            sessionTimeoutMinutes
        });
    } else {
        res.status(500).json({
            success: false,
            error: 'Error al guardar la configuracion'
        });
    }
});

// GET /api/available-dates - Obtener fechas con devocionales disponibles (hasta hoy)
app.get('/api/available-dates', (req, res) => {
    try {
        const today = getTodayGMT();
        
        // Obtener lista de archivos de audio existentes
        const audioFiles = fs.readdirSync(AUDIOS_DIR)
            .filter(file => file.endsWith('.mp3'))
            .map(file => file.replace('.mp3', ''));
        
        // Filtrar solo fechas que:
        // 1. No sean futuras
        // 2. Tengan archivo de audio existente
        const availableDates = audioFiles
            .filter(date => date <= today && isValidDate(date))
            .sort((a, b) => b.localeCompare(a)); // M├ís reciente primero
        
        console.log('­ƒôà Fechas disponibles:', availableDates);
        
        res.json({
            success: true,
            dates: availableDates,
            today: today,
            count: availableDates.length
        });
    } catch (error) {
        console.error('Error obteniendo fechas disponibles:', error);
        res.status(500).json({ success: false, error: 'Error al obtener fechas' });
    }
});

// GET /api/devotionals/:date - Obtener devocional por fecha (p├║blico, con restricci├│n de fecha futura)
app.get('/api/devotionals/:date', (req, res) => {
    const { date } = req.params;
    
    if (!isValidDate(date)) {
        return res.status(400).json({
            success: false,
            error: 'Formato de fecha inv├ílido'
        });
    }
    
    // Bloquear acceso a fechas futuras (basado en GMT-0)
    if (isFutureDate(date)) {
        return res.json({
            success: true,
            exists: false,
            restricted: true,
            message: 'Este devocional a├║n no est├í disponible'
        });
    }
    
    const devotional = devotionalsDB[date];
    
    if (devotional) {
        res.json({
            success: true,
            exists: true,
            data: {
                date: date,
                title: devotional.title || '',
                verseReference: devotional.verseReference,
                verseText: devotional.verseText,
                updatedAt: devotional.updatedAt
            }
        });
    } else {
        res.json({
            success: true,
            exists: false
        });
    }
});

// GET /api/devotionals - Listar todos los devocionales (p├║blico)
app.get('/api/devotionals', (req, res) => {
    try {
        const devotionals = Object.entries(devotionalsDB).map(([date, data]) => ({
            date,
            title: data.title || '',
            verseReference: data.verseReference,
            verseText: data.verseText,
            updatedAt: data.updatedAt
        })).sort((a, b) => b.date.localeCompare(a.date));
        
        res.json({
            success: true,
            data: devotionals,
            count: devotionals.length
        });
    } catch (error) {
        console.error('Error al listar devocionales:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener la lista de devocionales'
        });
    }
});

// GET /api/devotionals/dates - Obtener solo las fechas disponibles (para calendario)
app.get('/api/devotionals/dates', (req, res) => {
    try {
        const dates = Object.keys(devotionalsDB);
        res.json({
            success: true,
            dates: dates
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener fechas' });
    }
});

// POST /api/devotionals - Guardar/actualizar devocional (requiere autenticaci├│n)
app.post('/api/devotionals', requireAuth, (req, res) => {
    const { date, verseReference, verseText } = req.body;
    
    console.log('­ƒôû Guardando devocional:', { date, verseReference });
    
    if (!date || !isValidDate(date)) {
        return res.status(400).json({
            success: false,
            error: 'Fecha inv├ílida. Usa el formato YYYY-MM-DD'
        });
    }
    
    if (!verseReference || !verseText) {
        return res.status(400).json({
            success: false,
            error: 'Se requiere referencia y texto del vers├¡culo'
        });
    }
    
    // Guardar en memoria
    const title = req.body.title || '';
    devotionalsDB[date] = {
        title: title.trim(),
        verseReference: verseReference.trim(),
        verseText: verseText.trim(),
        updatedAt: new Date().toISOString()
    };
    
    // Persistir a archivo
    if (saveDevotionals(devotionalsDB)) {
        console.log('Ô£à Devocional guardado para:', date);
        res.status(201).json({
            success: true,
            message: 'Devocional guardado correctamente',
            data: {
                date,
                verseReference: devotionalsDB[date].verseReference,
                verseText: devotionalsDB[date].verseText,
                updatedAt: devotionalsDB[date].updatedAt
            }
        });
    } else {
        res.status(500).json({
            success: false,
            error: 'Error al guardar el devocional'
        });
    }
});

// PUT /api/devotionals/:date - Actualizar devocional existente (requiere autenticación)
app.put('/api/devotionals/:date', requireAuth, (req, res) => {
    const { date } = req.params;
    const { title, verseReference, verseText } = req.body;
    
    console.log('📝 Actualizando devocional:', { date, title, verseReference });
    
    if (!isValidDate(date)) {
        return res.status(400).json({
            success: false,
            error: 'Fecha inválida. Usa el formato YYYY-MM-DD'
        });
    }
    
    // Verificar que existe el devocional o el audio
    const audioPath = path.join(AUDIOS_DIR, `${date}.mp3`);
    const existsInDB = devotionalsDB[date];
    const existsAudio = fs.existsSync(audioPath);
    
    if (!existsInDB && !existsAudio) {
        return res.status(404).json({
            success: false,
            error: 'No existe un devocional para esta fecha'
        });
    }
    
    // Actualizar en memoria
    devotionalsDB[date] = {
        title: (title || '').trim(),
        verseReference: (verseReference || '').trim(),
        verseText: (verseText || '').trim(),
        updatedAt: new Date().toISOString()
    };
    
    // Persistir a archivo
    if (saveDevotionals(devotionalsDB)) {
        console.log('✅ Devocional actualizado para:', date);
        res.json({
            success: true,
            message: 'Devocional actualizado correctamente',
            data: devotionalsDB[date]
        });
    } else {
        res.status(500).json({
            success: false,
            error: 'Error al guardar el devocional'
        });
    }
});

// DELETE /api/devotionals/:date - Eliminar devocional (requiere autenticación)
app.delete('/api/devotionals/:date', requireAuth, (req, res) => {
    const { date } = req.params;
    
    if (!isValidDate(date)) {
        return res.status(400).json({
            success: false,
            error: 'Formato de fecha inv├ílido'
        });
    }
    
    if (!devotionalsDB[date]) {
        return res.status(404).json({
            success: false,
            error: 'No existe un devocional para esa fecha'
        });
    }
    
    delete devotionalsDB[date];
    
    if (saveDevotionals(devotionalsDB)) {
        console.log('­ƒùæ´©Å Devocional eliminado para:', date);
        res.json({
            success: true,
            message: 'Devocional eliminado correctamente',
            date: date
        });
    } else {
        res.status(500).json({
            success: false,
            error: 'Error al eliminar el devocional'
        });
    }
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
    });
});

// ============ Notificaciones Push ============

// GET /api/notifications/vapid-public-key - Obtener clave p├║blica VAPID
app.get('/api/notifications/vapid-public-key', (req, res) => {
    res.json({ 
        success: true, 
        publicKey: VAPID_PUBLIC_KEY 
    });
});

// Funci├│n para obtener IP del cliente
function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
           req.headers['x-real-ip'] || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress ||
           'unknown';
}

// Funci├│n para obtener info de geolocalizaci├│n (usando API gratuita)
async function getGeoInfo(ip) {
    try {
        // Ignorar IPs locales
        if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip === 'unknown') {
            return { country: 'Local', city: 'Local', countryCode: 'LO' };
        }
        
        const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,regionName`);
        const data = await response.json();
        
        if (data.status === 'success') {
            return {
                country: data.country || 'Desconocido',
                city: data.city || '',
                region: data.regionName || '',
                countryCode: data.countryCode || ''
            };
        }
    } catch (error) {
        console.error('Error obteniendo geolocalizaci├│n:', error.message);
    }
    return { country: 'Desconocido', city: '', countryCode: '' };
}

// POST /api/notifications/subscribe - Suscribir a notificaciones
app.post('/api/notifications/subscribe', async (req, res) => {
    const subscription = req.body;
    const userAgent = req.headers['user-agent'] || '';
    const clientIP = getClientIP(req);
    
    // Parsear User-Agent para obtener SO detallado
    const deviceInfo = parseUserAgent(userAgent);
    
    // Evitar duplicados
    const existingIndex = pushSubscriptions.findIndex(
        sub => sub.endpoint === subscription.endpoint
    );
    
    if (existingIndex === -1) {
        // Nueva suscripción - obtener geolocalización
        const geoInfo = await getGeoInfo(clientIP);
        
        // Agregar metadata completa
        subscription.id = Date.now().toString();
        subscription.userAgent = userAgent;
        subscription.createdAt = new Date().toISOString();
        subscription.lastSeen = new Date().toISOString();
        subscription.ip = clientIP;
        subscription.location = geoInfo;
        subscription.device = deviceInfo;
        
        pushSubscriptions.push(subscription);
        
        // También guardar en cache de dispositivos
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
        
        saveSubscriptions();
        saveDevicesFromCache();
        console.log(`✅ Nueva suscripción push desde ${geoInfo.country} (${deviceInfo.os} ${deviceInfo.osVersion}). Total:`, pushSubscriptions.length);
    } else {
        // Actualizar información
        const geoInfo = await getGeoInfo(clientIP);
        const now = new Date().toISOString();
        
        pushSubscriptions[existingIndex].ip = clientIP;
        pushSubscriptions[existingIndex].location = geoInfo;
        pushSubscriptions[existingIndex].lastSeen = now;
        pushSubscriptions[existingIndex].device = deviceInfo;
        
        // Actualizar cache
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
        
        saveSubscriptions();
        console.log('ℹ️ Suscripción actualizada. Total:', pushSubscriptions.length);
    }
    
    res.json({ success: true, message: 'Suscrito correctamente' });
});

// POST /api/notifications/check - Verificar si una suscripci├│n existe
app.post('/api/notifications/check', (req, res) => {
    const { endpoint } = req.body;
    
    if (!endpoint) {
        return res.json({ success: false, exists: false });
    }
    
    const exists = pushSubscriptions.some(sub => sub.endpoint === endpoint);
    res.json({ success: true, exists });
});

// POST /api/notifications/schedule - Programar recordatorio
app.post('/api/notifications/schedule', (req, res) => {
    const { hour, minute } = req.body;
    console.log(`Recordatorio programado para las ${hour}:${minute}`);
    res.json({ success: true, message: 'Recordatorio programado' });
});

// POST /api/notifications/heartbeat - Actualizar última conexión del dispositivo
app.post('/api/notifications/heartbeat', async (req, res) => {
    const { endpoint } = req.body;
    const clientIP = getClientIP(req);
    const userAgent = req.headers['user-agent'] || '';
    
    if (!endpoint) {
        return res.json({ success: false, error: 'Endpoint requerido' });
    }
    
    const existingIndex = pushSubscriptions.findIndex(sub => sub.endpoint === endpoint);
    
    if (existingIndex !== -1) {
        const now = new Date().toISOString();
        const geoInfo = await getGeoInfo(clientIP);
        const deviceInfo = parseUserAgent(userAgent);
        
        // Actualizar en suscripciones
        pushSubscriptions[existingIndex].lastSeen = now;
        pushSubscriptions[existingIndex].ip = clientIP;
        pushSubscriptions[existingIndex].location = geoInfo;
        pushSubscriptions[existingIndex].device = deviceInfo;
        
        // Actualizar cache
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
        
        // Guardar cada 10 heartbeats para no sobrecargar I/O
        if (Math.random() < 0.1) {
            saveSubscriptions();
        }
        
        res.json({ success: true, lastSeen: now });
    } else {
        res.json({ success: false, error: 'Dispositivo no registrado' });
    }
});

// POST /api/notifications/send - Enviar notificación a todos (para admin)
app.post('/api/notifications/send', async (req, res) => {
    const { title, body } = req.body;
    
    if (!title) {
        return res.status(400).json({ success: false, error: 'T├¡tulo requerido' });
    }
    
    console.log(`­ƒôñ Enviando notificaci├│n: "${title}" a ${pushSubscriptions.length} suscriptores`);
    
    const payload = JSON.stringify({
        title: title,
        body: body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-96.png',
        data: {
            url: '/'
        }
    });
    
    let successCount = 0;
    let failCount = 0;
    const failedSubscriptions = [];
    
    // Enviar a todos los suscriptores
    const sendPromises = pushSubscriptions.map(async (subscription, index) => {
        try {
            await webpush.sendNotification(subscription, payload);
            successCount++;
            console.log(`Ô£à Notificaci├│n enviada a dispositivo ${index + 1}`);
        } catch (error) {
            failCount++;
            console.error(`ÔØî Error enviando a dispositivo ${index + 1}:`, error.message);
            // Si el error es 410 (Gone) o 404, el suscriptor ya no existe
            if (error.statusCode === 410 || error.statusCode === 404) {
                failedSubscriptions.push(subscription.endpoint);
            }
        }
    });
    
    await Promise.all(sendPromises);
    
    // Limpiar suscripciones inv├ílidas
    if (failedSubscriptions.length > 0) {
        pushSubscriptions = pushSubscriptions.filter(
            sub => !failedSubscriptions.includes(sub.endpoint)
        );
        saveSubscriptions();
        console.log(`­ƒº╣ Eliminadas ${failedSubscriptions.length} suscripciones inv├ílidas`);
    }
    
    res.json({ 
        success: true, 
        message: `Notificaci├│n enviada a ${successCount} dispositivos${failCount > 0 ? `, ${failCount} fallidos` : ''}` 
    });
});

// GET /api/notifications/count - Contar suscriptores
app.get('/api/notifications/count', (req, res) => {
    res.json({ 
        success: true, 
        count: pushSubscriptions.length 
    });
});

// GET /api/notifications/devices - Listar dispositivos registrados
app.get('/api/notifications/devices', (req, res) => {
    const devices = pushSubscriptions.map((sub, index) => {
        // Usar info parseada si existe, sino parsear del userAgent
        const deviceInfo = sub.device || parseUserAgent(sub.userAgent);
        
        // Calcular tiempo desde última conexión
        const lastSeen = sub.lastSeen || sub.createdAt;
        const lastSeenDate = new Date(lastSeen);
        const now = new Date();
        const diffMinutes = Math.floor((now - lastSeenDate) / 60000);
        
        let lastSeenText = '';
        let isOnline = false;
        
        if (diffMinutes < 5) {
            lastSeenText = 'En línea';
            isOnline = true;
        } else if (diffMinutes < 60) {
            lastSeenText = `Hace ${diffMinutes} min`;
        } else if (diffMinutes < 1440) {
            const hours = Math.floor(diffMinutes / 60);
            lastSeenText = `Hace ${hours}h`;
        } else {
            const days = Math.floor(diffMinutes / 1440);
            lastSeenText = `Hace ${days}d`;
        }
        
        return {
            id: sub.id || index.toString(),
            // Info del dispositivo
            deviceType: deviceInfo.deviceType || 'Desconocido',
            icon: deviceInfo.icon || '🌐',
            os: deviceInfo.os || 'Desconocido',
            osVersion: deviceInfo.osVersion || '',
            browser: deviceInfo.browser || 'Desconocido',
            // Ubicación
            ip: sub.ip || 'Desconocida',
            country: sub.location?.country || 'Desconocido',
            countryCode: sub.location?.countryCode || '??',
            city: sub.location?.city || '',
            // Tiempos
            createdAt: sub.createdAt || new Date().toISOString(),
            lastSeen: lastSeen,
            lastSeenText: lastSeenText,
            isOnline: isOnline
        };
    });
    
    // Ordenar: online primero, luego por última conexión
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

// DELETE /api/notifications/device/:id - Eliminar dispositivo
app.delete('/api/notifications/device/:id', (req, res) => {
    const { id } = req.params;
    const index = pushSubscriptions.findIndex((sub, idx) => (sub.id || idx.toString()) === id);
    
    if (index !== -1) {
        pushSubscriptions.splice(index, 1);
        saveSubscriptions();
        res.json({ success: true, message: 'Dispositivo eliminado' });
    } else {
        res.status(404).json({ success: false, error: 'Dispositivo no encontrado' });
    }
});

// ============ Sistema de Notificaci├│n Autom├ítica ============

// Funci├│n para enviar notificaci├│n del devocional diario
async function sendDailyDevotionalNotification() {
    // Obtener fecha actual seg├║n la zona horaria configurada
    const gmtOffset = appConfig.gmtOffset || 0;
    const now = new Date();
    const localTime = new Date(now.getTime() + (gmtOffset * 60 * 60 * 1000));
    const dateStr = localTime.toISOString().split('T')[0];
    
    // Verificar si hay un audio para hoy
    const audioPath = path.join(AUDIOS_DIR, `${dateStr}.mp3`);
    if (!fs.existsSync(audioPath)) {
        console.log(`­ƒô¡ No hay devocional para hoy (${dateStr}), no se env├¡a notificaci├│n`);
        return;
    }
    
    // Obtener el t├¡tulo del devocional
    const devotional = devotionalsDB[dateStr];
    const title = devotional?.title || '­ƒÖÅ Devocional del d├¡a';
    const body = 'Escucha el devocional de hoy';
    
    if (pushSubscriptions.length === 0) {
        console.log('­ƒô¡ No hay suscriptores para enviar notificaci├│n');
        return;
    }
    
    console.log(`­ƒôñ Enviando notificaci├│n autom├ítica: "${title}" a ${pushSubscriptions.length} suscriptores`);
    
    const payload = JSON.stringify({
        title: title,
        body: body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-96.png',
        data: {
            url: `/?date=${dateStr}`
        }
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
    
    // Limpiar suscripciones inv├ílidas
    if (failedSubscriptions.length > 0) {
        pushSubscriptions = pushSubscriptions.filter(
            sub => !failedSubscriptions.includes(sub.endpoint)
        );
        saveSubscriptions();
        console.log(`­ƒº╣ Eliminadas ${failedSubscriptions.length} suscripciones inv├ílidas`);
    }
    
    console.log(`Ô£à Notificaci├│n autom├ítica enviada: ${successCount} exitosas, ${failCount} fallidas`);
    
    // Registrar en auditor├¡a
    auditLogs.push({
        timestamp: new Date().toISOString(),
        action: 'AUTO_NOTIFICATION_SENT',
        details: { title, successCount, failCount, date: dateStr },
        ip: 'system'
    });
    saveAuditLog(auditLogs);
}

// Variable para rastrear la ├║ltima fecha notificada
let lastNotifiedDate = null;

// Verificar cada minuto si hay un nuevo devocional disponible
function checkForNewDevotional() {
    const gmtOffset = appConfig.gmtOffset || 0;
    const now = new Date();
    const localTime = new Date(now.getTime() + (gmtOffset * 60 * 60 * 1000));
    const todayStr = localTime.toISOString().split('T')[0];
    const currentHour = localTime.getUTCHours();
    const currentMinute = localTime.getUTCMinutes();
    
    // Verificar si es medianoche (00:00-00:05) seg├║n la zona horaria configurada
    // y si no hemos notificado hoy
    if (currentHour === 0 && currentMinute < 5 && lastNotifiedDate !== todayStr) {
        const audioPath = path.join(AUDIOS_DIR, `${todayStr}.mp3`);
        if (fs.existsSync(audioPath)) {
            console.log(`­ƒöö Nuevo devocional detectado para ${todayStr}, enviando notificaci├│n...`);
            lastNotifiedDate = todayStr;
            sendDailyDevotionalNotification();
        }
    }
}

// Iniciar verificaci├│n peri├│dica (cada minuto)
setInterval(checkForNewDevotional, 60 * 1000);

// Tambi├®n verificar al iniciar el servidor (por si se reinicia durante la medianoche)
setTimeout(() => {
    const gmtOffset = appConfig.gmtOffset || 0;
    const now = new Date();
    const localTime = new Date(now.getTime() + (gmtOffset * 60 * 60 * 1000));
    const todayStr = localTime.toISOString().split('T')[0];
    console.log(`­ƒôà Servidor iniciado. Fecha local (GMT${gmtOffset >= 0 ? '+' : ''}${gmtOffset}): ${todayStr}`);
}, 1000);

// Endpoint para enviar notificaci├│n manual (prueba)
app.post('/api/admin/send-daily-notification', requireAuth, async (req, res) => {
    try {
        await sendDailyDevotionalNotification();
        res.json({ success: true, message: 'Notificaci├│n enviada' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
ÔòöÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòù
Ôòæ                                                            Ôòæ
Ôòæ   ­ƒÄÁ Servidor de Devocionales iniciado                    Ôòæ
Ôòæ                                                            Ôòæ
Ôòæ   ­ƒôì Local:    http://localhost:${PORT}                      Ôòæ
Ôòæ   ­ƒô▒ Red:      http://192.168.40.9:${PORT}                   Ôòæ
Ôòæ   ­ƒôé Audios:   ${AUDIOS_DIR}
Ôòæ                                                            Ôòæ
Ôòæ   Endpoints disponibles:                                   Ôòæ
Ôòæ   GET    /api/audios        - Listar audios               Ôòæ
Ôòæ   GET    /api/audios/:date  - Verificar audio por fecha   Ôòæ
Ôòæ   POST   /api/audios        - Subir audio                 Ôòæ
Ôòæ   DELETE /api/audios/:date  - Eliminar audio              Ôòæ
Ôòæ                                                            Ôòæ
ÔòÜÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòØ
    `);
});
