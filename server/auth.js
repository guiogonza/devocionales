const crypto = require('crypto');
const { RATE_LIMIT } = require('./config');
const { getActiveSessions, saveSessions, getSessionTimeout, getAdminConfig } = require('./storage');

// ============ Rate Limiting ============
const loginAttempts = new Map();

function checkRateLimit(ip) {
    const now = Date.now();
    const attempts = loginAttempts.get(ip);
    
    if (!attempts) return { allowed: true };
    
    if (attempts.blockedUntil && now < attempts.blockedUntil) {
        const remainingMs = attempts.blockedUntil - now;
        const remainingMins = Math.ceil(remainingMs / 60000);
        return { 
            allowed: false, 
            reason: `Demasiados intentos. Intenta de nuevo en ${remainingMins} minutos.`
        };
    }
    
    if (now - attempts.lastAttempt > RATE_LIMIT.attemptWindow) {
        loginAttempts.delete(ip);
        return { allowed: true };
    }
    
    return { allowed: true };
}

function recordLoginAttempt(ip, success) {
    const now = Date.now();
    let attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: now };
    
    if (success) {
        loginAttempts.delete(ip);
        return;
    }
    
    attempts.count++;
    attempts.lastAttempt = now;
    
    if (attempts.count >= RATE_LIMIT.maxAttempts) {
        attempts.blockedUntil = now + RATE_LIMIT.blockDuration;
        console.log(`🚫 IP ${ip} bloqueada por ${RATE_LIMIT.blockDuration/60000} minutos`);
    }
    
    loginAttempts.set(ip, attempts);
}

// ============ Tokens y Sesiones ============
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function validateToken(token) {
    if (!token) return false;
    const activeSessions = getActiveSessions();
    const session = activeSessions.get(token);
    if (!session) return false;
    
    if (Date.now() - session.createdAt > getSessionTimeout()) {
        activeSessions.delete(token);
        saveSessions();
        return false;
    }
    
    // Sliding expiration
    session.createdAt = Date.now();
    saveSessions();
    return true;
}

function validateCredentials(username, password) {
    const adminConfig = getAdminConfig();
    const user = adminConfig.users.find(u => u.username === username && u.password === password);
    return user || null;
}

// ============ Middleware de Autenticación ============
function requireAuth(req, res, next) {
    const token = req.headers['x-admin-token'];
    if (!validateToken(token)) {
        return res.status(401).json({ success: false, error: 'No autorizado' });
    }
    next();
}

// ============ Helpers ============
function getClientIP(req) {
    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection.remoteAddress || 'unknown';
    return ip.split(',')[0].trim();
}

module.exports = {
    checkRateLimit,
    recordLoginAttempt,
    generateToken,
    validateToken,
    validateCredentials,
    requireAuth,
    getClientIP
};
