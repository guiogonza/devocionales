/**
 * Notificaciones Push - Admin Panel
 */

async function loadSubscriberCount() {
    try {
        const response = await fetch('/api/notifications/count', {
            headers: { 'x-admin-token': getAuthToken() }
        });
        if (response.ok) {
            const data = await response.json();
            document.getElementById('subscriberCount').textContent = `${data.count || 0} suscriptores`;
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

async function loadDevicesList() {
    try {
        const response = await fetch('/api/notifications/devices', {
            headers: { 'x-admin-token': getAuthToken() }
        });
        if (response.ok) {
            const data = await response.json();
            renderDevicesList(data.devices || []);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

function renderDevicesList(devices) {
    const container = document.getElementById('devicesList');
    if (!container) return;
    
    if (!devices || devices.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">No hay dispositivos registrados</p>';
        return;
    }

    container.innerHTML = devices.map(device => `
        <div class="device-item">
            <span class="device-icon">&#128241;</span>
            <div class="device-info">
                <div class="device-name">${device.userAgent || 'Dispositivo desconocido'}</div>
                <div class="device-date">Registrado: ${new Date(device.createdAt).toLocaleDateString('es-ES')}</div>
            </div>
        </div>
    `).join('');
}

async function sendNotification() {
    const token = getAuthToken();
    if (!token) {
        showToast('No autorizado', 'error');
        return;
    }

    const title = document.getElementById('notifTitle').value;
    const body = document.getElementById('notifBody').value;

    if (!title || !body) {
        showToast('Completa todos los campos', 'error');
        return;
    }

    try {
        const response = await fetch('/api/notifications/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-token': token
            },
            body: JSON.stringify({ title, body })
        });

        const data = await response.json();

        if (data.success) {
            showToast(`Notificación enviada a ${data.sent || 0} dispositivos`, 'success');
            document.getElementById('notifTitle').value = '';
            document.getElementById('notifBody').value = '';
        } else {
            showToast(data.error || 'Error al enviar', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error al enviar notificación', 'error');
    }
}
