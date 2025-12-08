const path = require('path');
const fs = require('fs');
const webpush = require('web-push');

// ============ Directorios ============
const DATA_DIR = path.join(__dirname, '..', 'data');
const AUDIOS_DIR = path.join(__dirname, '..', 'audios');
const ICONS_DIR = path.join(__dirname, '..', 'icons');

// ============ Archivos de datos ============
const FILES = {
    subscriptions: path.join(DATA_DIR, 'subscriptions.json'),
    devotionals: path.join(DATA_DIR, 'devotionals.json'),
    config: path.join(DATA_DIR, 'config.json'),
    auditLog: path.join(DATA_DIR, 'audit_log.json'),
    activityLog: path.join(DATA_DIR, 'activity_log.json'),
    admin: path.join(DATA_DIR, 'admin.json'),
    devices: path.join(DATA_DIR, 'devices.json'),
    sessions: path.join(DATA_DIR, 'sessions.json'),
    blockedIps: path.join(DATA_DIR, 'blocked_ips.json'),
    securityLogs: path.join(DATA_DIR, 'security_logs.json')
};

// ============ ConfiguraciÃ³n VAPID para Push Notifications ============
const VAPID_PUBLIC_KEY = 'BDMM2TnLH-5Z3ucGsLZf66-ISqBrDhRdj_z7UkFLIjPfM3pwYqwNvruPuBBTtCD1NARYEEK2dI8lDZLVn3upvd4';
const VAPID_PRIVATE_KEY = 'c3YCxPW4YAMCwh5bF63PNUvUlwv7uGoXhWR25L2PV9g';

webpush.setVapidDetails(
    'mailto:admin@rioiglesia.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

// Asegurar que existen los directorios
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(AUDIOS_DIR)) {
    fs.mkdirSync(AUDIOS_DIR, { recursive: true });
}
if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
}

// Copiar archivos por defecto si no existen
const logoPath = path.join(ICONS_DIR, 'logo.png');
const logoDefaultPath = path.join(ICONS_DIR, 'logo-default.png');
if (!fs.existsSync(logoPath) && fs.existsSync(logoDefaultPath)) {
    fs.copyFileSync(logoDefaultPath, logoPath);
    console.log('📷 Logo por defecto copiado');
}

const pastoresPath = path.join(ICONS_DIR, 'pastores.jpg');
const pastoresDefaultPath = path.join(ICONS_DIR, 'pastores-default.jpg');
if (!fs.existsSync(pastoresPath) && fs.existsSync(pastoresDefaultPath)) {
    fs.copyFileSync(pastoresDefaultPath, pastoresPath);
    console.log('📷 Imagen de pastores por defecto copiada');
}

// ============ Rate Limiting ============
const RATE_LIMIT = {
    maxAttempts: 5,
    blockDuration: 15 * 60 * 1000, // 15 minutos
    attemptWindow: 5 * 60 * 1000   // 5 minutos
};

module.exports = {
    DATA_DIR,
    AUDIOS_DIR,
    ICONS_DIR,
    FILES,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
    RATE_LIMIT,
    webpush
};

