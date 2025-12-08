const express = require('express');
const router = express.Router();
const { requireAuth, checkRateLimit, recordLoginAttempt, generateToken, validateToken, validateCredentials, getClientIP } = require('../auth');
const { getActiveSessions, saveSessions, getSessionTimeout, getAdminConfig, saveAdminConfig, loadAdminUsers, getAuditLogs, saveAuditLog, setAuditLogs, getActivityLogs, saveActivityLog, setActivityLogs } = require('../storage');
const { logAudit } = require('../logs');

// POST /api/admin/login
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    const ip = getClientIP(req);
    
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
        logAudit('LOGIN_BLOCKED', { username, reason: 'rate_limit' }, req);
        return res.status(429).json({ success: false, error: rateCheck.reason });
    }
    
    const user = validateCredentials(username, password);
    if (user) {
        recordLoginAttempt(ip, true);
        const token = generateToken();
        const activeSessions = getActiveSessions();
        activeSessions.set(token, { createdAt: Date.now(), ip, username: user.username, userId: user.id });
        saveSessions();
        logAudit('LOGIN_SUCCESS', { username: user.username, role: user.role }, req);
        console.log('🔐 Admin autenticado:', user.username);
        res.json({ success: true, token, user: { username: user.username, role: user.role } });
    } else {
        recordLoginAttempt(ip, false);
        logAudit('LOGIN_FAILED', { username, attemptedPassword: '***' }, req);
        console.log('❌ Intento de login fallido para:', username);
        res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
    }
});

// POST /api/admin/logout
router.post('/logout', (req, res) => {
    const token = req.headers['x-admin-token'];
    if (token) {
        const activeSessions = getActiveSessions();
        const session = activeSessions.get(token);
        logAudit('LOGOUT', { username: session?.username || 'unknown' }, req);
        activeSessions.delete(token);
        saveSessions();
    }
    res.json({ success: true });
});

// GET /api/admin/verify
router.get('/verify', (req, res) => {
    const token = req.headers['x-admin-token'];
    const isValid = validateToken(token);
    const activeSessions = getActiveSessions();
    const session = activeSessions.get(token);
    res.json({ 
        success: true, 
        authenticated: isValid,
        user: isValid && session ? { username: session.username } : null,
        expiresIn: isValid && session ? Math.max(0, getSessionTimeout() - (Date.now() - session.createdAt)) : 0
    });
});

// GET /api/admin/users
router.get('/users', requireAuth, (req, res) => {
    const adminConfig = getAdminConfig();
    const users = adminConfig.users.map(u => ({
        id: u.id,
        username: u.username,
        role: u.role,
        createdAt: u.createdAt
    }));
    res.json({ success: true, users });
});

// POST /api/admin/users
router.post('/users', requireAuth, (req, res) => {
    const { username, password, role } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Usuario y contraseña son requeridos' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    
    const adminConfig = getAdminConfig();
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
    console.log('👤 Nuevo usuario creado:', username);
    
    res.json({ success: true, message: 'Usuario creado correctamente', user: { id: newUser.id, username, role: newUser.role } });
});

// PUT /api/admin/users/:id
router.put('/users/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const { username, password, role } = req.body;
    
    const adminConfig = getAdminConfig();
    const userIndex = adminConfig.users.findIndex(u => u.id === id);
    if (userIndex === -1) {
        return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    
    const user = adminConfig.users[userIndex];
    const changes = [];
    
    if (username && username !== user.username) {
        if (adminConfig.users.find(u => u.username === username && u.id !== id)) {
            return res.status(400).json({ success: false, error: 'El nombre de usuario ya existe' });
        }
        changes.push(`username: ${user.username} → ${username}`);
        user.username = username;
    }
    
    if (password) {
        if (password.length < 6) {
            return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 6 caracteres' });
        }
        changes.push('password changed');
        user.password = password;
    }
    
    if (role && role !== user.role) {
        changes.push(`role: ${user.role} → ${role}`);
        user.role = role;
    }
    
    saveAdminConfig(adminConfig);
    logAudit('USER_UPDATED', { userId: id, username: user.username, changes: changes.join(', ') }, req);
    
    res.json({ success: true, message: 'Usuario actualizado correctamente' });
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    
    const adminConfig = getAdminConfig();
    const userIndex = adminConfig.users.findIndex(u => u.id === id);
    if (userIndex === -1) {
        return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    
    if (adminConfig.users.length === 1) {
        return res.status(400).json({ success: false, error: 'No se puede eliminar el último usuario' });
    }
    
    const userToDelete = adminConfig.users[userIndex];
    if (userToDelete.role === 'superadmin') {
        return res.status(403).json({ success: false, error: 'No se puede eliminar un usuario superadmin. Solo puede cambiar su contraseña.' });
    }
    
    const deletedUser = adminConfig.users[userIndex];
    adminConfig.users.splice(userIndex, 1);
    saveAdminConfig(adminConfig);
    
    const activeSessions = getActiveSessions();
    for (const [token, session] of activeSessions.entries()) {
        if (session.userId === id) {
            activeSessions.delete(token);
        }
    }
    saveSessions();
    
    logAudit('USER_DELETED', { deletedUsername: deletedUser.username }, req);
    console.log('🗑️ Usuario eliminado:', deletedUser.username);
    
    res.json({ success: true, message: 'Usuario eliminado correctamente' });
});

// POST /api/admin/change-password
router.post('/change-password', requireAuth, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const token = req.headers['x-admin-token'];
    const activeSessions = getActiveSessions();
    const session = activeSessions.get(token);
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, error: 'Faltan campos requeridos' });
    }
    
    const adminConfig = getAdminConfig();
    const user = adminConfig.users.find(u => u.id === session?.userId);
    if (!user) {
        return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    
    if (currentPassword !== user.password) {
        logAudit('PASSWORD_CHANGE_FAILED', { username: user.username, reason: 'Contraseña actual incorrecta' }, req);
        return res.status(401).json({ success: false, error: 'Contraseña actual incorrecta' });
    }
    
    if (newPassword.length < 6) {
        return res.status(400).json({ success: false, error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }
    
    user.password = newPassword;
    saveAdminConfig(adminConfig);
    
    logAudit('PASSWORD_CHANGED', { username: user.username }, req);
    console.log('🔑 Contraseña cambiada para:', user.username);
    
    res.json({ success: true, message: 'Contraseña cambiada correctamente' });
});

// GET /api/admin/audit-logs
router.get('/audit-logs', requireAuth, (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const action = req.query.action;
    const ip = req.query.ip;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    
    let filteredLogs = [...getAuditLogs()];
    
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
    const actions = [...new Set(getAuditLogs().map(log => log.action))];
    
    res.json({ success: true, logs, total: filteredLogs.length, actions });
});

// GET /api/admin/activity-logs
router.get('/activity-logs', requireAuth, (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const action = req.query.action;
    const ip = req.query.ip;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    
    let filteredLogs = [...getActivityLogs()];
    
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
    const actions = [...new Set(getActivityLogs().map(log => log.action))];
    
    res.json({ success: true, logs, total: filteredLogs.length, actions });
});

// DELETE /api/admin/audit-logs
router.delete('/audit-logs', requireAuth, async (req, res) => {
    try {
        const { timestamps } = req.body;
        const token = req.headers['x-admin-token'];
        const activeSessions = getActiveSessions();
        const session = activeSessions.get(token);
        
        if (!session) {
            return res.status(401).json({ success: false, error: 'Sesión no válida' });
        }
        
        const users = loadAdminUsers();
        const user = users.find(u => u.id === session.userId);
        
        if (!user) {
            return res.status(401).json({ success: false, error: 'Usuario no encontrado' });
        }
        
        let auditLogs = getAuditLogs();
        let count = 0;
        if (timestamps && Array.isArray(timestamps) && timestamps.length > 0) {
            const originalLength = auditLogs.length;
            auditLogs = auditLogs.filter(log => !timestamps.includes(log.timestamp));
            count = originalLength - auditLogs.length;
        } else {
            count = auditLogs.length;
            auditLogs = [];
        }
        
        setAuditLogs(auditLogs);
        saveAuditLog(auditLogs);
        
        await logAudit('AUDIT_LOGS_DELETED', { deletedCount: count, deletedBy: user.username }, req);
        
        res.json({ success: true, message: `${count} logs de auditoría eliminados` });
    } catch (error) {
        console.error('Error eliminando audit logs:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// DELETE /api/admin/activity-logs
router.delete('/activity-logs', requireAuth, async (req, res) => {
    try {
        const { timestamps } = req.body;
        const token = req.headers['x-admin-token'];
        const activeSessions = getActiveSessions();
        const session = activeSessions.get(token);
    
        if (!session) {
            return res.status(401).json({ success: false, error: 'Sesión no válida' });
        }
        
        const users = loadAdminUsers();
        const user = users.find(u => u.id === session.userId);
        
        if (!user) {
            return res.status(401).json({ success: false, error: 'Usuario no encontrado' });
        }
        
        let activityLogs = getActivityLogs();
        let count = 0;
        if (timestamps && Array.isArray(timestamps) && timestamps.length > 0) {
            const originalLength = activityLogs.length;
            activityLogs = activityLogs.filter(log => !timestamps.includes(log.timestamp));
            count = originalLength - activityLogs.length;
        } else {
            count = activityLogs.length;
            activityLogs = [];
        }
        
        setActivityLogs(activityLogs);
        saveActivityLog(activityLogs);
        
        await logAudit('ACTIVITY_LOGS_DELETED', { deletedCount: count, deletedBy: user.username }, req);
        
        res.json({ success: true, message: `${count} logs de actividad eliminados` });
    } catch (error) {
        console.error('Error eliminando activity logs:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// POST /api/admin/send-daily-notification
router.post('/send-daily-notification', requireAuth, async (req, res) => {
    // Esta función será implementada en notifications.js
    res.json({ success: false, error: 'Use /api/notifications/send instead' });
});

module.exports = router;
