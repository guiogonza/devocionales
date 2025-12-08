const fs = require('fs');
const { FILES } = require('./config');

// ============ Funciones genÃ©ricas de almacenamiento ============

function loadJSON(file, defaultValue = {}) {
    try {
        if (fs.existsSync(file)) {
            const data = fs.readFileSync(file, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error(`Error al cargar ${file}:`, error);
    }
    return defaultValue;
}

function saveJSON(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`Error al guardar ${file}:`, error);
        return false;
    }
}

// ============ Suscripciones Push ============
let pushSubscriptions = loadJSON(FILES.subscriptions, []);

function loadSubscriptions() {
    pushSubscriptions = loadJSON(FILES.subscriptions, []);
    return pushSubscriptions;
}

function saveSubscriptions(subs = pushSubscriptions) {
    pushSubscriptions = subs;
    return saveJSON(FILES.subscriptions, subs);
}

function getSubscriptions() {
    return pushSubscriptions;
}

function setSubscriptions(subs) {
    pushSubscriptions = subs;
}

// ============ Devocionales ============
let devotionalsDB = loadJSON(FILES.devotionals, {});

function loadDevotionals() {
    devotionalsDB = loadJSON(FILES.devotionals, {});
    return devotionalsDB;
}

function saveDevotionals(data = devotionalsDB) {
    devotionalsDB = data;
    return saveJSON(FILES.devotionals, data);
}

function getDevotionals() {
    return devotionalsDB;
}

function setDevotionals(data) {
    devotionalsDB = data;
}

// ============ ConfiguraciÃ³n ============
let appConfig = loadJSON(FILES.config, { gmtOffset: 0, sessionTimeoutMinutes: 20 });

function loadConfig() {
    appConfig = loadJSON(FILES.config, { gmtOffset: 0, sessionTimeoutMinutes: 20 });
    return appConfig;
}

function saveConfig(config = appConfig) {
    appConfig = config;
    return saveJSON(FILES.config, config);
}

function getConfig() {
    return appConfig;
}

function setConfig(config) {
    appConfig = config;
}

function getSessionTimeout() {
    return (appConfig.sessionTimeoutMinutes || 20) * 60 * 1000;
}

// ============ Admin Config ============
const defaultAdmin = {
    users: [{
        id: '1',
        username: process.env.ADMIN_USER || 'admin',
        password: process.env.ADMIN_PASS || 'rio2024',
        role: 'superadmin',
        createdAt: new Date().toISOString()
    }]
};

let adminConfig = loadJSON(FILES.admin, defaultAdmin);

function loadAdminConfig() {
    adminConfig = loadJSON(FILES.admin, defaultAdmin);
    return adminConfig;
}

function saveAdminConfig(config = adminConfig) {
    adminConfig = config;
    return saveJSON(FILES.admin, config);
}

function getAdminConfig() {
    return adminConfig;
}

function loadAdminUsers() {
    return adminConfig.users || [];
}

// ============ Dispositivos ============
const devicesCache = new Map();
let devicesCacheLoaded = false;

function loadDevices() {
    const devices = loadJSON(FILES.devices, []);
    devices.forEach(d => devicesCache.set(d.id, d));
    devicesCacheLoaded = true;
    return devices;
}

function saveDevices(devices) {
    return saveJSON(FILES.devices, devices);
}

function saveDevicesFromCache() {
    const devices = Array.from(devicesCache.values());
    return saveDevices(devices);
}

function updateDeviceInCache(deviceId, updates) {
    const device = devicesCache.get(deviceId);
    if (device) {
        Object.assign(device, updates);
        devicesCache.set(deviceId, device);
        setImmediate(() => saveDevicesFromCache());
    }
}

function getDevicesCache() {
    return devicesCache;
}

// Cargar dispositivos al inicio
let registeredDevices = loadDevices();

function getRegisteredDevices() {
    return registeredDevices;
}

function setRegisteredDevices(devices) {
    registeredDevices = devices;
}

// ============ Logs de AuditorÃ­a ============
let auditLogs = loadJSON(FILES.auditLog, []);

function loadAuditLog() {
    auditLogs = loadJSON(FILES.auditLog, []);
    return auditLogs;
}

function saveAuditLog(logs = auditLogs) {
    const trimmedLogs = logs.slice(-1000);
    auditLogs = trimmedLogs;
    return saveJSON(FILES.auditLog, trimmedLogs);
}

function getAuditLogs() {
    return auditLogs;
}

function setAuditLogs(logs) {
    auditLogs = logs;
}

// ============ Logs de Actividad ============
let activityLogs = loadJSON(FILES.activityLog, []);

function loadActivityLog() {
    activityLogs = loadJSON(FILES.activityLog, []);
    return activityLogs;
}

function saveActivityLog(logs = activityLogs) {
    const trimmedLogs = logs.slice(-5000);
    activityLogs = trimmedLogs;
    return saveJSON(FILES.activityLog, trimmedLogs);
}

function getActivityLogs() {
    return activityLogs;
}

function setActivityLogs(logs) {
    activityLogs = logs;
}

// ============ Sesiones ============
let activeSessions = new Map();

function loadSessions() {
    const sessionsObj = loadJSON(FILES.sessions, {});
    const timeout = getSessionTimeout();
    const now = Date.now();
    const validSessions = {};
    
    for (const [token, session] of Object.entries(sessionsObj)) {
        if (now - session.createdAt < timeout) {
            validSessions[token] = session;
        }
    }
    
    activeSessions = new Map(Object.entries(validSessions));
    return activeSessions;
}

function saveSessions() {
    const sessionsObj = Object.fromEntries(activeSessions);
    return saveJSON(FILES.sessions, sessionsObj);
}

function getActiveSessions() {
    return activeSessions;
}

// Cargar sesiones al inicio
loadSessions();

// ============ IPs Bloqueadas ============
let blockedIps = loadJSON(FILES.blockedIps, []);

function loadBlockedIps() {
    blockedIps = loadJSON(FILES.blockedIps, []);
    return blockedIps;
}

function saveBlockedIps(ips = blockedIps) {
    blockedIps = ips;
    return saveJSON(FILES.blockedIps, ips);
}

function getBlockedIps() {
    return blockedIps;
}

function addBlockedIp(ipData) {
    blockedIps.push(ipData);
    return saveBlockedIps();
}

function removeBlockedIp(ip) {
    blockedIps = blockedIps.filter(b => b.ip !== ip);
    return saveBlockedIps();
}

function isIpBlocked(ip) {
    const now = Date.now();
    const blocked = blockedIps.find(b => b.ip === ip);
    if (!blocked) return false;
    if (blocked.permanent) return true;
    if (blocked.expiresAt && now > blocked.expiresAt) {
        removeBlockedIp(ip);
        return false;
    }
    return true;
}

// ============ Logs de Seguridad ============
let securityLogs = loadJSON(FILES.securityLogs, []);

function loadSecurityLogs() {
    securityLogs = loadJSON(FILES.securityLogs, []);
    return securityLogs;
}

function saveSecurityLog(logs = securityLogs) {
    const trimmedLogs = logs.slice(-2000);
    securityLogs = trimmedLogs;
    return saveJSON(FILES.securityLogs, trimmedLogs);
}

function getSecurityLogs() {
    return securityLogs;
}

function addSecurityLog(logEntry) {
    securityLogs.push(logEntry);
    saveSecurityLog();
}

module.exports = {
    // GenÃ©ricos
    loadJSON,
    saveJSON,
    
    // Suscripciones
    loadSubscriptions,
    saveSubscriptions,
    getSubscriptions,
    setSubscriptions,
    
    // Devocionales
    loadDevotionals,
    saveDevotionals,
    getDevotionals,
    setDevotionals,
    
    // Config
    loadConfig,
    saveConfig,
    getConfig,
    setConfig,
    getSessionTimeout,
    
    // Admin
    loadAdminConfig,
    saveAdminConfig,
    getAdminConfig,
    loadAdminUsers,
    
    // Dispositivos
    loadDevices,
    saveDevices,
    saveDevicesFromCache,
    updateDeviceInCache,
    getDevicesCache,
    getRegisteredDevices,
    setRegisteredDevices,
    
    // Logs AuditorÃ­a
    loadAuditLog,
    saveAuditLog,
    getAuditLogs,
    setAuditLogs,
    
    // Logs Actividad
    loadActivityLog,
    saveActivityLog,
    getActivityLogs,
    setActivityLogs,
    
    // Sesiones
    loadSessions,
    saveSessions,
    getActiveSessions,
    // IPs Bloqueadas
    loadBlockedIps,
    saveBlockedIps,
    getBlockedIps,
    addBlockedIp,
    removeBlockedIp,
    isIpBlocked,
    
    // Logs Seguridad
    loadSecurityLogs,
    saveSecurityLog,
    getSecurityLogs,
    addSecurityLog
};

