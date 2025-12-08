/**
 * Notificaciones Push - Admin Panel
 */

let countriesData = [];
let allDevices = [];

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
            allDevices = data.devices || [];
            renderDevicesList(allDevices, data.online || 0, data.total || 0);
            renderCountrySummary(allDevices);
            populateCountrySelect(allDevices);
            populateDeviceSelect(allDevices);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

function renderCountrySummary(devices) {
    const container = document.getElementById('countrySummary');
    if (!container) return;
    
    // Agrupar por pais
    const byCountry = {};
    devices.forEach(d => {
        const country = d.country || 'Desconocido';
        const code = d.countryCode || '??';
        if (!byCountry[country]) {
            byCountry[country] = { count: 0, code: code, online: 0 };
        }
        byCountry[country].count++;
        if (d.isOnline) byCountry[country].online++;
    });
    
    // Ordenar por cantidad
    const sorted = Object.entries(byCountry).sort((a, b) => b[1].count - a[1].count);
    
    if (sorted.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">No hay dispositivos registrados</p>';
        return;
    }
    
    container.innerHTML = sorted.map(([country, data]) => {
        const flag = data.code !== '??' ? 
            `<img src="https://flagcdn.com/24x18/${data.code.toLowerCase()}.png" alt="${country}" style="vertical-align: middle; margin-right: 8px;">` : '🌐 ';
        return `
            <div style="background: var(--bg-color); padding: 12px 16px; border-radius: 8px; display: flex; align-items: center; gap: 10px; min-width: 150px;">
                ${flag}
                <div>
                    <div style="font-weight: 600; color: var(--text-color);">${country}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">
                        ${data.count} dispositivo${data.count !== 1 ? 's' : ''} 
                        <span style="color: #22c55e;">(${data.online} online)</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function populateCountrySelect(devices) {
    const select = document.getElementById('countrySelect');
    if (!select) return;
    
    const byCountry = {};
    devices.forEach(d => {
        const country = d.country || 'Desconocido';
        const code = d.countryCode || '??';
        if (!byCountry[country]) {
            byCountry[country] = { count: 0, code: code };
        }
        byCountry[country].count++;
    });
    
    countriesData = Object.entries(byCountry).sort((a, b) => b[1].count - a[1].count);
    
    select.innerHTML = '<option value="">-- Seleccionar pais --</option>' + 
        countriesData.map(([country, data]) => 
            `<option value="${country}">${country} (${data.count} dispositivos)</option>`
        ).join('');
}

function populateDeviceSelect(devices) {
    const select = document.getElementById('deviceSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Seleccionar dispositivo --</option>' + 
        devices.map(d => {
            const flag = d.countryCode !== '??' ? `${d.countryCode} ` : '';
            const online = d.isOnline ? '🟢' : '⚪';
            return `<option value="${d.id}">${online} ${d.os} ${d.osVersion} - ${flag}${d.country || 'Desconocido'}</option>`;
        }).join('');
}

function updateSendTarget() {
    const target = document.querySelector('input[name="sendTarget"]:checked').value;
    
    document.getElementById('countrySelector').style.display = target === 'country' ? 'block' : 'none';
    document.getElementById('deviceSelector').style.display = target === 'device' ? 'block' : 'none';
    
    // Actualizar estilos de opciones
    document.querySelectorAll('.send-target-option').forEach(opt => {
        const radio = opt.querySelector('input[type="radio"]');
        if (radio.checked) {
            opt.style.borderColor = 'var(--primary-color)';
            opt.style.background = 'rgba(124, 58, 237, 0.1)';
        } else {
            opt.style.borderColor = 'var(--border-color)';
            opt.style.background = 'transparent';
        }
    });
    
    // Actualizar contador
    updateSubscriberCountDisplay();
}

function updateCountryCount() {
    const country = document.getElementById('countrySelect').value;
    const countSpan = document.getElementById('countryDeviceCount');
    
    if (!country) {
        countSpan.textContent = '';
        return;
    }
    
    const count = allDevices.filter(d => d.country === country).length;
    countSpan.textContent = `${count} dispositivo${count !== 1 ? 's' : ''} en ${country}`;
    updateSubscriberCountDisplay();
}

function updateSubscriberCountDisplay() {
    const target = document.querySelector('input[name="sendTarget"]:checked').value;
    const countSpan = document.getElementById('subscriberCount');
    
    if (target === 'all') {
        countSpan.textContent = `${allDevices.length} suscriptores`;
    } else if (target === 'country') {
        const country = document.getElementById('countrySelect').value;
        if (country) {
            const count = allDevices.filter(d => d.country === country).length;
            countSpan.textContent = `${count} en ${country}`;
        } else {
            countSpan.textContent = 'Selecciona un pais';
        }
    } else if (target === 'device') {
        const deviceId = document.getElementById('deviceSelect').value;
        countSpan.textContent = deviceId ? '1 dispositivo' : 'Selecciona un dispositivo';
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
                <div style="display: flex; gap: 8px;">
                    <button onclick="sendToDevice('${device.id}')" class="btn-send-device" title="Enviar notificacion a este dispositivo" style="background: var(--primary-color); color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">
                        Enviar
                    </button>
                    <button onclick="deleteDevice('${device.id}')" class="btn-delete-device" title="Eliminar dispositivo">
                        Eliminar
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

async function sendToDevice(deviceId) {
    const title = prompt('Titulo de la notificacion:', 'Mensaje para ti');
    if (!title) return;
    
    const body = prompt('Mensaje:', 'Tienes un nuevo mensaje!');
    if (!body) return;
    
    await sendNotificationWithTarget('device', deviceId, title, body);
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
    const target = document.querySelector('input[name="sendTarget"]:checked').value;

    if (!title || !body) {
        showToast('Completa todos los campos', 'error');
        return;
    }
    
    let targetValue = null;
    if (target === 'country') {
        targetValue = document.getElementById('countrySelect').value;
        if (!targetValue) {
            showToast('Selecciona un pais', 'error');
            return;
        }
    } else if (target === 'device') {
        targetValue = document.getElementById('deviceSelect').value;
        if (!targetValue) {
            showToast('Selecciona un dispositivo', 'error');
            return;
        }
    }

    await sendNotificationWithTarget(target, targetValue, title, body);
}

async function sendNotificationWithTarget(target, targetValue, title, body) {
    try {
        const response = await fetch('/api/notifications/send', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, body, target, targetValue })
        });

        const data = await response.json();

        if (data.success) {
            showToast(`Notificacion enviada a ${data.sent || 0} dispositivo${data.sent !== 1 ? 's' : ''}`, 'success');
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

// Inicializar cuando se carga la seccion
function initNotificationsSection() {
    loadSubscriberCount();
    loadDevicesList();
    updateSendTarget();
}