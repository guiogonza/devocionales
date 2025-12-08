// ============ Parseo de User Agent ============

function detectOS(userAgent) {
    if (!userAgent) return { os: 'Desconocido', icon: '❓' };
    
    const ua = userAgent.toLowerCase();
    
    if (ua.includes('iphone')) return { os: 'iOS (iPhone)', icon: '📱' };
    if (ua.includes('ipad')) return { os: 'iOS (iPad)', icon: '📱' };
    if (ua.includes('ipod')) return { os: 'iOS (iPod)', icon: '📱' };
    if (ua.includes('mac os') || ua.includes('macintosh')) return { os: 'macOS', icon: '🖥️' };
    if (ua.includes('android')) {
        if (ua.includes('mobile')) return { os: 'Android (Móvil)', icon: '📱' };
        return { os: 'Android (Tablet)', icon: '📱' };
    }
    if (ua.includes('windows phone')) return { os: 'Windows Phone', icon: '📱' };
    if (ua.includes('windows')) return { os: 'Windows', icon: '💻' };
    if (ua.includes('linux')) return { os: 'Linux', icon: '🐧' };
    if (ua.includes('cros')) return { os: 'Chrome OS', icon: '💻' };
    
    return { os: 'Desconocido', icon: '❓' };
}

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

module.exports = {
    detectOS,
    parseUserAgent
};
