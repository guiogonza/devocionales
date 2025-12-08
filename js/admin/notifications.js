/**
 * Notificaciones Push - Admin Panel
 */

async function loadSubscriberCount() {
    try {
        const response = await fetch('/api/notifications/count', {
            credentials: 'include'
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
            credentials: 'include'
        });
        if (response.ok) {
            const data = await response.json();
            renderDevicesList(data.devices || [], data.online || 0, data.total || 0);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

function renderDevicesList(devices, online, total) {
    const container = document.getElementById('devicesList');
    if (!container) return;
    
    if (!devices || devices.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">No hay dispositivos registrados</p>';
        return;
    }

    let html = `
        <div style="display: flex; gap: 15px; margin-bottom: 15px; flex-wrap: wrap;">
            <div style="background: var(--primary-color); padding: 10px 15px; border-radius: 8px; color: white;">
                <strong>${total}</strong> dispositivos
            </div>
            <div style="background: #22c55e; padding: 10px 15px; border-radius: 8px; color: white;">
                <strong>${online}</strong> en linea
            </div>
        </div>
    `;

    html += devices.map(device => {
        const countryFlag = device.countryCode !== '??' ? 
            `<img src="https://flagcdn.com/16x12/${device.countryCode.toLowerCase()}.png" alt="${device.country}" style="vertical-align: middle; margin-right: 5px;">` : '';
        
        const onlineIndicator = device.isOnline ? 
            '<span style="display: inline-block; width: 8px; height: 8px; background: #22c55e; border-radius: 50%; margin-right: 5px;"></span>' :
            '<span style="display: inline-block; width: 8px; height: 8px; background: #6b7280; border-radius: 50%; margin-right: 5px;"></span>';
        
        return `
            <div class="device-item" style="display: flex; align-items: center; padding: 12px; background: var(--bg-color); border-radius: 8px; margin-bottom: 10px;">
                <span style="font-size: 24px; margin-right: 12px;">${device.icon}</span>
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: var(--text-color);">
                        ${onlineIndicator}${device.os} ${device.osVersion}
                        <span style="font-weight: 400; color: var(--text-secondary); font-size: 12px;">(${device.browser})</span>
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                        ${countryFlag}${device.country}${device.city ? ', ' + device.city : ''}
                    </div>
                    <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
                        ${device.lastSeenText} - Registrado: ${new Date(device.createdAt).toLocaleDateString('es-ES')}
                    </div>
                </div>
                <button onclick="deleteDevice('${device.id}')" class="btn-delete-device" title="Eliminar dispositivo">
                    Eliminar
                </button>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

async function deleteDevice(deviceId) {
    if (!confirm('Eliminar este dispositivo?')) return;
    
    try {
        const response = await fetch(`/api/notifications/device/${deviceId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (response.ok) {
            showToast('Dispositivo eliminado', 'success');
            loadDevicesList();
            loadSubscriberCount();
        } else {
            showToast('Error al eliminar', 'error');
        }
    } catch (error) {
        showToast('Error al eliminar', 'error');
    }
}

async function sendNotification() {
    if (!isAuthenticated) { showToast('No autorizado', 'error'); return; }

    const title = document.getElementById('notifTitle').value;
    const body = document.getElementById('notifBody').value;

    if (!title || !body) {
        showToast('Completa todos los campos', 'error');
        return;
    }

    try {
        const response = await fetch('/api/notifications/send', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, body })
        });

        const data = await response.json();

        if (data.success) {
            showToast(`Notificacion enviada a ${data.sent || 0} dispositivos`, 'success');
            document.getElementById('notifTitle').value = '';
            document.getElementById('notifBody').value = '';
        } else {
            showToast(data.error || 'Error al enviar', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error al enviar notificacion', 'error');
    }
}