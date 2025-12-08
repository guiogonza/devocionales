/**
 * Configuracion del Sistema - Admin Panel
 */

function initTimezoneConfig() {
    const saveBtn = document.getElementById('saveTimezoneBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveTimezone);
    }
    updateServerTimeDisplay();
    setInterval(updateServerTimeDisplay, 1000);
}

async function saveSessionTimeout() {
    if (!isAuthenticated) { showToast('No autorizado', 'error'); return; }

    const select = document.getElementById('sessionTimeoutSelect');
    if (!select) return;
    
    const sessionTimeoutMinutes = parseInt(select.value);
    
    try {
        const response = await fetch('/api/config/session', {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionTimeoutMinutes })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Tiempo de sesion guardado: ' + sessionTimeoutMinutes + ' minutos', 'success');
            sessionTimeoutMs = sessionTimeoutMinutes * 60 * 1000;
            startSessionTimer(sessionTimeoutMs);
        } else {
            showToast(data.error || 'Error al guardar', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error al guardar tiempo de sesion', 'error');
    }
}

async function loadTimezone() {
    try {
        const response = await fetch('/api/server-time', {
            credentials: 'include'
        });
        if (response.ok) {
            const data = await response.json();
            document.getElementById('gmtSelect').value = data.gmtOffset || '0';
            // Cargar limite de subida
            if (data.maxUploadMB) {
                const uploadSelect = document.getElementById('maxUploadSelect');
                if (uploadSelect) uploadSelect.value = data.maxUploadMB.toString();
            }
        }
    } catch (error) {
        console.error('Error cargando timezone:', error);
    }
}

async function saveTimezone() {
    if (!isAuthenticated) { showToast('No autorizado', 'error'); return; }

    const gmtOffset = document.getElementById('gmtSelect').value;
    
    try {
        const response = await fetch('/api/config', {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
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

async function saveMaxUpload() {
    if (!isAuthenticated) { showToast('No autorizado', 'error'); return; }

    const maxUploadMB = parseInt(document.getElementById('maxUploadSelect').value);
    
    try {
        const response = await fetch('/api/config', {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ maxUploadMB })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Limite de subida guardado: ' + maxUploadMB + ' MB', 'success');
            // Actualizar texto en UI
            const hint = document.querySelector('.upload-hint');
            if (hint) hint.textContent = 'Maximo ' + maxUploadMB + 'MB por archivo';
        } else {
            showToast(data.error || 'Error al guardar', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error al guardar limite', 'error');
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