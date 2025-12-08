const crypto = require('crypto');
const { RATE_LIMIT } = require('./config');
const { getActiveSessions, saveSessions, getSessionTimeout, getAdminConfig, isIpBlocked, addBlockedIp, getBlockedIps, addSecurityLog } = require('./storage');

// ============ Rate Limiting ============
const loginAttempts = new Map();

function checkRateLimit(ip) {
    const now = Date.now();
    
    // Primero verificar si la IP esta bloqueada permanentemente
    if (isIpBlocked(ip)) {
        addSecurityLog({
            type: 'BLOCKED_IP_ATTEMPT',
            ip,
            timestamp: new Date().toISOString(),
            message: 'Intento de acceso desde IP bloqueada'
        });
        return { 
            allowed: false, 
            reason: 'Esta IP ha sido bloqueada por actividad sospechosa.',
            blocked: true
        };
    }
    
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

function recordLoginAttempt(ip, success, username = 'unknown') {
    const now = Date.now();
    let attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: now, usernames: [] };
    
    if (success) {
        loginAttempts.delete(ip);
        return;
    }
    
    attempts.count++;
    attempts.lastAttempt = now;
    if (!attempts.usernames.includes(username)) {
        attempts.usernames.push(username);
    }
    
    // Registrar intento fallido en logs de seguridad
    addSecurityLog({
        type: 'LOGIN_FAILED',
        ip,
        username,
        timestamp: new Date().toISOString(),
        attemptCount: attempts.count,
        message: `Intento ${attempts.count} de ${RATE_LIMIT.maxAttempts} fallido`
    });
    
    if (attempts.count >= RATE_LIMIT.maxAttempts) {
        attempts.blockedUntil = now + RATE_LIMIT.blockDuration;
        console.log(`IP ${ip} bloqueada temporalmente por ${RATE_LIMIT.blockDuration/60000} minutos`);
        
        // Registrar bloqueo temporal
        addSecurityLog({
            type: 'IP_TEMP_BLOCKED',
            ip,
            username,
            timestamp: new Date().toISOString(),
            duration: RATE_LIMIT.blockDuration / 60000,
            message: `IP bloqueada temporalmente por ${RATE_LIMIT.blockDuration/60000} minutos`,
            attemptedUsernames: attempts.usernames
        });
        
        // Si es la segunda vez que se bloquea, bloquear permanentemente
        if (attempts.previousBlocks >= 1) {
            addBlockedIp({
                ip,
                reason: 'Multiples ataques de fuerza bruta detectados',
                blockedAt: new Date().toISOString(),
                permanent: true,
                attemptedUsernames: attempts.usernames,
                totalAttempts: attempts.count + (attempts.previousAttempts || 0)
            });
            
            addSecurityLog({
                type: 'IP_PERMANENT_BLOCKED',
                ip,
                timestamp: new Date().toISOString(),
                message: 'IP bloqueada permanentemente por ataques repetidos',
                attemptedUsernames: attempts.usernames
            });
            
            console.log(`IP ${ip} bloqueada PERMANENTEMENTE`);
        }
        
        attempts.previousBlocks = (attempts.previousBlocks || 0) + 1;
        attempts.previousAttempts = (attempts.previousAttempts || 0) + attempts.count;
    }
    
    loginAttempts.set(ip, attempts);
}

function getLoginAttempts() {
    return loginAttempts;
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

// ============ Middleware de Autenticacion ============
function requireAuth(req, res, next) {
    // Primero intentar cookie httpOnly, luego header para compatibilidad
    const token = req.cookies?.adminToken || req.headers['x-admin-token'];
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

// Cookie options para seguridad
function getSecureCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: getSessionTimeout(),
        path: '/'
    };
}

module.exports = {
    checkRateLimit,
    recordLoginAttempt,
    getLoginAttempts,
    generateToken,
    validateToken,
    validateCredentials,
    requireAuth,
    getClientIP,
    getSecureCookieOptions
};