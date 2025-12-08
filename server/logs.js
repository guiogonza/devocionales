const { getAuditLogs, saveAuditLog, setAuditLogs, getActivityLogs, saveActivityLog, setActivityLogs } = require('./storage');
const { detectOS } = require('./utils');

// Cache de geolocalización
const geoCache = new Map();

// ============ Geolocalización ============
async function getGeoFromIP(ip) {
    const cleanIP = ip.split(',')[0].trim().replace('::ffff:', '');
    
    if (cleanIP === '127.0.0.1' || cleanIP === 'localhost' || cleanIP === '::1' || 
        cleanIP.startsWith('192.168.') || cleanIP.startsWith('10.')) {
        return { country: 'Local', countryCode: 'XX', city: 'Local Network' };
    }
    
    if (geoCache.has(cleanIP)) {
        return geoCache.get(cleanIP);
    }
    
    try {
        const response = await fetch(`http://ip-api.com/json/${cleanIP}?fields=country,countryCode,city`);
        const data = await response.json();
        const geoInfo = {
            country: data.country || 'Desconocido',
            countryCode: data.countryCode || '??',
            city: data.city || ''
        };
        geoCache.set(cleanIP, geoInfo);
        
        if (geoCache.size > 1000) {
            const firstKey = geoCache.keys().next().value;
            geoCache.delete(firstKey);
        }
        
        return geoInfo;
    } catch (error) {
        console.error('Error obteniendo geolocalización:', error.message);
        return { country: 'Desconocido', countryCode: '??', city: '' };
    }
}

// ============ Log de Auditoría (Admin) ============
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
    
    const auditLogs = getAuditLogs();
    auditLogs.push(entry);
    saveAuditLog(auditLogs);
    console.log(`AUDIT: ${action} - ${JSON.stringify(details)} - ${geoInfo.country}`);
}

// ============ Log de Actividad (Usuarios) ============
async function logActivity(action, details, req) {
    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection.remoteAddress || 'unknown';
    const cleanIP = ip.split(',')[0].trim();
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    let geoInfo = { country: 'Desconocido', city: '', countryCode: '' };
    try {
        geoInfo = await getGeoFromIP(cleanIP);
    } catch (e) {
        console.error('Error obteniendo geo para actividad:', e);
    }
    
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
    
    const activityLogs = getActivityLogs();
    activityLogs.push(entry);
    saveActivityLog(activityLogs);
    console.log(`👤 ACTIVITY: ${action} - ${osInfo.icon} ${osInfo.os} - IP: ${cleanIP} - ${geoInfo.country} - ${JSON.stringify(details)}`);
}

module.exports = {
    getGeoFromIP,
    logAudit,
    logActivity
};
