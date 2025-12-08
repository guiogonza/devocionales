/**
 * Configuración del Sistema - Admin Panel
 */

function initTimezoneConfig() {
    const saveBtn = document.getElementById('saveTimezoneBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveTimezone);
    }
    updateServerTimeDisplay();
    setInterval(updateServerTimeDisplay, 1000);
    
    // Cargar configuración de sesión
    // Session config loads after auth
}

async function loadSessionTimeout() {
    const token = getAuthToken();
    if (!token) return;

    try {
        const response = await fetch('/api/config/session', {
            headers: { 'x-admin-token': getAuthToken() }
        });
        if (response.ok) {
            const data = await response.json();
            const select = document.getElementById('sessionTimeoutSelect');
            if (select && data.sessionTimeoutMinutes) {
                select.value = data.sessionTimeoutMinutes.toString();
            }
        }
    } catch (error) {
        console.error('Error cargando configuración de sesión:', error);
    }
}

async function saveSessionTimeout() {
    const token = getAuthToken();
    if (!token) {
        showToast('No autorizado', 'error');
        return;
    }

    const select = document.getElementById('sessionTimeoutSelect');
    if (!select) return;
    
    const sessionTimeoutMinutes = parseInt(select.value);
    
    try {
        const response = await fetch('/api/config/session', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-token': token
            },
            body: JSON.stringify({ sessionTimeoutMinutes })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Tiempo de sesión guardado: ' + sessionTimeoutMinutes + ' minutos', 'success');
            // Actualizar el timer con el nuevo valor
            sessionTimeoutMs = sessionTimeoutMinutes * 60 * 1000;
            startSessionTimer(sessionTimeoutMs);
        } else {
            showToast(data.error || 'Error al guardar', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error al guardar tiempo de sesión', 'error');
    }
}

async function loadTimezone() {
    try {
        const response = await fetch('/api/server-time', {
            headers: { 'x-admin-token': getAuthToken() }
        });
        if (response.ok) {
            const data = await response.json();
            document.getElementById('gmtSelect').value = data.gmtOffset || '0';
        }
    } catch (error) {
        console.error('Error cargando timezone:', error);
    }
}

async function saveTimezone() {
    const token = getAuthToken();
    if (!token) {
        showToast('No autorizado', 'error');
        return;
    }

    const gmtOffset = document.getElementById('gmtSelect').value;
    
    try {
        const response = await fetch('/api/config', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-token': token
            },
            body: JSON.stringify({ gmtOffset: parseFloat(gmtOffset) })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Zona horaria guardada', 'success');
        } else {
            showToast('Error al guardar', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error al guardar zona horaria', 'error');
    }
}

function updateServerTimeDisplay() {
    const gmtSelect = document.getElementById('gmtSelect');
    if (!gmtSelect) return;
    
    const gmtOffset = parseFloat(gmtSelect.value) || 0;
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const serverTime = new Date(utc + (gmtOffset * 3600000));
    
    const display = document.getElementById('serverTimeDisplay');
    if (display) {
        display.textContent = serverTime.toLocaleString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
}
