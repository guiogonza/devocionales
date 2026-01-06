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
            renderOSSummary(allDevices);
            populateCountrySelect(allDevices);
            populateOSSelect(allDevices);
            populateDeviceSelect(allDevices);
            return allDevices;
        }
    } catch (error) {
        console.error('Error:', error);
    }
    return [];
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

function renderOSSummary(devices) {
    const container = document.getElementById('osSummary');
    if (!container) return;
    
    // Agrupar por SO
    const byOS = {};
    devices.forEach(d => {
        const os = d.os || 'Desconocido';
        if (!byOS[os]) {
            byOS[os] = { count: 0, online: 0, icon: getOSIcon(os) };
        }
        byOS[os].count++;
        if (d.isOnline) byOS[os].online++;
    });
    
    const sorted = Object.entries(byOS).sort((a, b) => b[1].count - a[1].count);
    
    if (sorted.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">No hay dispositivos registrados</p>';
        return;
    }
    
    container.innerHTML = sorted.map(([os, data]) => {
        return `
            <div style="background: var(--bg-color); padding: 12px 16px; border-radius: 8px; display: flex; align-items: center; gap: 10px; min-width: 140px;">
                <span style="font-size: 24px;">${data.icon}</span>
                <div>
                    <div style="font-weight: 600; color: var(--text-color);">${os}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">
                        ${data.count} dispositivo${data.count !== 1 ? 's' : ''} 
                        <span style="color: #22c55e;">(${data.online} online)</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function getOSIcon(os) {
    const osLower = os.toLowerCase();
    if (osLower.includes('android')) return '🤖';
    if (osLower.includes('ios') || osLower.includes('iphone') || osLower.includes('ipad')) return '🍎';
    if (osLower.includes('windows')) return '🪟';
    if (osLower.includes('mac')) return '🍏';
    if (osLower.includes('linux')) return '🐧';
    if (osLower.includes('chrome')) return '🌐';
    return '📱';
}

function populateOSSelect(devices) {
    const select = document.getElementById('osSelect');
    if (!select) return;
    
    const byOS = {};
    devices.forEach(d => {
        const os = d.os || 'Desconocido';
        if (!byOS[os]) {
            byOS[os] = { count: 0, icon: getOSIcon(os) };
        }
        byOS[os].count++;
    });
    
    const sorted = Object.entries(byOS).sort((a, b) => b[1].count - a[1].count);
    
    select.innerHTML = '<option value="">-- Seleccionar sistema --</option>' + 
        sorted.map(([os, data]) => 
            `<option value="${os}">${data.icon} ${os} (${data.count} dispositivos)</option>`
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
    document.getElementById('osSelector').style.display = target === 'os' ? 'block' : 'none';
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

function updateFilterCount() {
    const target = document.querySelector('input[name="sendTarget"]:checked').value;
    
    if (target === 'country') {
        const country = document.getElementById('countrySelect').value;
        const countSpan = document.getElementById('countryDeviceCount');
        if (!country) {
            countSpan.textContent = '';
        } else {
            const count = allDevices.filter(d => d.country === country).length;
            countSpan.textContent = `${count} dispositivo${count !== 1 ? 's' : ''} en ${country}`;
        }
    } else if (target === 'os') {
        const os = document.getElementById('osSelect').value;
        const countSpan = document.getElementById('osDeviceCount');
        if (!os) {
            countSpan.textContent = '';
        } else {
            const count = allDevices.filter(d => d.os === os).length;
            countSpan.textContent = `${count} dispositivo${count !== 1 ? 's' : ''} con ${os}`;
        }
    }
    
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
    } else if (target === 'os') {
        const os = document.getElementById('osSelect').value;
        if (os) {
            const count = allDevices.filter(d => d.os === os).length;
            countSpan.textContent = `${count} con ${os}`;
        } else {
            countSpan.textContent = 'Selecciona un sistema';
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
    } else if (target === 'os') {
        targetValue = document.getElementById('osSelect').value;
        if (!targetValue) {
            showToast('Selecciona un sistema operativo', 'error');
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

// ==========================================
// GRÁFICAS DE DISPOSITIVOS
// ==========================================

let devicesPerMonthChart = null;
let devicesByCountryChart = null;
let devicesStatusChart = null;
let devicesByOSChart = null;

function initCharts() {
    console.log('initCharts llamado, dispositivos:', allDevices.length);
    
    // Verificar que Chart.js esté disponible
    if (typeof Chart === 'undefined') {
        console.error('Chart.js no está cargado');
        return;
    }
    
    // Verificar elementos del DOM
    const chartElements = [
        'devicesPerMonthChart',
        'devicesByCountryChart', 
        'devicesStatusChart',
        'devicesByOSChart'
    ];
    
    for (const id of chartElements) {
        if (!document.getElementById(id)) {
            console.log('Elemento no encontrado:', id, '- posiblemente no estamos en la sección de notificaciones');
            return;
        }
    }
    
    if (allDevices.length === 0) {
        console.log('No hay dispositivos para mostrar en gráficas');
        return;
    }
    
    // Configurar filtros de fecha (mes actual por defecto)
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    document.getElementById('chartDateStart').value = startDate.toISOString().split('T')[0];
    document.getElementById('chartDateEnd').value = endDate.toISOString().split('T')[0];
    
    // Poblar select de países
    populateChartCountryFilter();
    
    // Renderizar gráficas
    console.log('Renderizando gráficas con', allDevices.length, 'dispositivos');
    renderAllCharts(allDevices);
}

function populateChartCountryFilter() {
    const select = document.getElementById('chartCountryFilter');
    if (!select) return;
    
    const countries = [...new Set(allDevices.map(d => d.country || 'Desconocido'))].sort();
    
    select.innerHTML = '<option value="">Todos los países</option>' + 
        countries.map(c => `<option value="${c}">${c}</option>`).join('');
}

function getFilteredDevices() {
    const startDate = document.getElementById('chartDateStart').value;
    const endDate = document.getElementById('chartDateEnd').value;
    const country = document.getElementById('chartCountryFilter').value;
    
    let filtered = [...allDevices];
    
    if (startDate) {
        const start = new Date(startDate);
        filtered = filtered.filter(d => new Date(d.createdAt) >= start);
    }
    
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filtered = filtered.filter(d => new Date(d.createdAt) <= end);
    }
    
    if (country) {
        filtered = filtered.filter(d => (d.country || 'Desconocido') === country);
    }
    
    return filtered;
}

function applyChartFilters() {
    const filtered = getFilteredDevices();
    renderAllCharts(filtered);
}

function resetChartFilters() {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    document.getElementById('chartDateStart').value = startDate.toISOString().split('T')[0];
    document.getElementById('chartDateEnd').value = endDate.toISOString().split('T')[0];
    document.getElementById('chartCountryFilter').value = '';
    
    renderAllCharts(allDevices);
}

function renderAllCharts(devices) {
    console.log('renderAllCharts:', devices.length, 'dispositivos');
    try {
        renderDevicesPerMonthChart(devices);
        renderDevicesByCountryChart(devices);
        renderDevicesStatusChart(devices);
        renderDevicesByOSChart(devices);
        console.log('Todas las gráficas renderizadas correctamente');
    } catch (error) {
        console.error('Error renderizando gráficas:', error);
    }
}

function renderDevicesPerMonthChart(devices) {
    const ctx = document.getElementById('devicesPerMonthChart');
    if (!ctx) {
        console.log('Canvas devicesPerMonthChart no encontrado');
        return;
    }
    
    // Destruir gráfica anterior si existe
    if (devicesPerMonthChart) {
        devicesPerMonthChart.destroy();
    }
    
    // Agrupar por mes
    const byMonth = {};
    devices.forEach(d => {
        const date = new Date(d.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        byMonth[monthKey] = (byMonth[monthKey] || 0) + 1;
    });
    
    // Ordenar por fecha
    const sortedMonths = Object.keys(byMonth).sort();
    const labels = sortedMonths.map(m => {
        const [year, month] = m.split('-');
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${monthNames[parseInt(month) - 1]} ${year}`;
    });
    const data = sortedMonths.map(m => byMonth[m]);
    
    // Calcular acumulado
    let accumulated = 0;
    const accumulatedData = data.map(v => accumulated += v);
    
    devicesPerMonthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Nuevos por mes',
                    data: data,
                    borderColor: '#7C3AED',
                    backgroundColor: 'rgba(124, 58, 237, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Acumulado',
                    data: accumulatedData,
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: false,
                    tension: 0.4,
                    borderDash: [5, 5]
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function renderDevicesByCountryChart(devices) {
    const ctx = document.getElementById('devicesByCountryChart');
    if (!ctx) return;
    
    if (devicesByCountryChart) {
        devicesByCountryChart.destroy();
    }
    
    // Agrupar por país
    const byCountry = {};
    devices.forEach(d => {
        const country = d.country || 'Desconocido';
        byCountry[country] = (byCountry[country] || 0) + 1;
    });
    
    // Ordenar por cantidad (top 10)
    const sorted = Object.entries(byCountry)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    const labels = sorted.map(([c]) => c);
    const data = sorted.map(([, v]) => v);
    
    // Colores para cada país
    const colors = [
        '#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#3B82F6',
        '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1'
    ];
    
    devicesByCountryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Dispositivos',
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function renderDevicesStatusChart(devices) {
    const ctx = document.getElementById('devicesStatusChart');
    if (!ctx) return;
    
    if (devicesStatusChart) {
        devicesStatusChart.destroy();
    }
    
    const online = devices.filter(d => d.isOnline).length;
    const offline = devices.length - online;
    
    devicesStatusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['En línea', 'Desconectados'],
            datasets: [{
                data: [online, offline],
                backgroundColor: ['#10B981', '#6B7280'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function renderDevicesByOSChart(devices) {
    const ctx = document.getElementById('devicesByOSChart');
    if (!ctx) return;
    
    if (devicesByOSChart) {
        devicesByOSChart.destroy();
    }
    
    // Agrupar por SO
    const byOS = {};
    devices.forEach(d => {
        const os = d.os || 'Desconocido';
        byOS[os] = (byOS[os] || 0) + 1;
    });
    
    const sorted = Object.entries(byOS).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(([os]) => os);
    const data = sorted.map(([, v]) => v);
    
    const colors = ['#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899'];
    
    devicesByOSChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Dispositivos',
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Inicializar cuando se carga la seccion
function initNotificationsSection() {
    loadSubscriberCount();
    loadDevicesList().then(() => {
        initCharts();
    });
    updateSendTarget();
}

// Exponer funciones globalmente para onclick en HTML
window.applyChartFilters = applyChartFilters;
window.resetChartFilters = resetChartFilters;