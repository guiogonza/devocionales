const fs = require('fs');

// ============ PATCH 1: Arreglar admin-panel.html ============
const adminPanelPath = '/app/admin-panel.html';
let adminPanel = fs.readFileSync(adminPanelPath, 'utf8');

// 1. Eliminar tab-config de donde está mal ubicado (antes del back-link)
const tabConfigMatch = adminPanel.match(/<div class="tab-content" id="tab-config">[\s\S]*?<\/div>\s*<a href="\/admin\.html"/);
if (tabConfigMatch) {
    adminPanel = adminPanel.replace(/<div class="tab-content" id="tab-config">[\s\S]*?<\/div>\s*(<a href="\/admin\.html")/, '$1');
    console.log('Tab config eliminado de ubicación incorrecta');
}

// 2. Buscar donde están los otros tab-content y agregar el tab-config ahí
const tabConfigHTML = `
        <!-- Tab: Configuración -->
        <div class="tab-content" id="tab-config">
            <h2 style="margin-bottom: 20px;">⚙️ Configuración del Sistema</h2>
            
            <div class="card" style="background: rgba(255,255,255,0.1); padding: 25px; border-radius: 12px; margin-bottom: 20px;">
                <h3 style="margin-bottom: 20px; color: #fff;">⏱️ Tiempo de Sesión</h3>
                <p style="color: rgba(255,255,255,0.7); margin-bottom: 15px;">
                    Define el tiempo máximo de inactividad antes de que la sesión expire automáticamente.
                </p>
                <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
                    <select id="sessionTimeout" style="padding: 12px 20px; border-radius: 8px; border: none; background: rgba(255,255,255,0.9); font-size: 16px; min-width: 200px;">
                        <option value="5">5 minutos</option>
                        <option value="10">10 minutos</option>
                        <option value="15">15 minutos</option>
                        <option value="30">30 minutos</option>
                        <option value="60">1 hora</option>
                        <option value="120">2 horas</option>
                    </select>
                    <button onclick="saveSessionTimeout()" class="btn btn-primary" style="padding: 12px 25px;">
                        💾 Guardar Configuración
                    </button>
                </div>
                <p id="configStatus" style="margin-top: 15px; color: #10B981; display: none;"></p>
            </div>
        </div>
`;

// Buscar el último tab-content antes del cierre de tabs-container o similar
if (!adminPanel.includes('id="tab-config"')) {
    // Buscar después del tab-devices
    const insertPoint = adminPanel.indexOf('</div>', adminPanel.indexOf('id="tab-devices"'));
    if (insertPoint > -1) {
        // Buscar el cierre correcto del tab-devices
        let closeCount = 0;
        let pos = adminPanel.indexOf('id="tab-devices"');
        while (pos < adminPanel.length) {
            if (adminPanel.substring(pos, pos + 5) === '<div ') closeCount++;
            if (adminPanel.substring(pos, pos + 6) === '</div>') {
                closeCount--;
                if (closeCount <= 0) {
                    adminPanel = adminPanel.substring(0, pos + 6) + tabConfigHTML + adminPanel.substring(pos + 6);
                    console.log('Tab config agregado después de tab-devices');
                    break;
                }
            }
            pos++;
        }
    }
}

// 3. Actualizar las funciones loadSessionTimeout y saveSessionTimeout para usar /api/config
const newFunctions = `
    async function loadSessionTimeout() {
        try {
            const response = await fetch('/api/config');
            const data = await response.json();
            if (data.success && data.config.sessionTimeout) {
                const select = document.getElementById('sessionTimeout');
                if (select) {
                    select.value = data.config.sessionTimeout.toString();
                }
            }
        } catch (error) {
            console.error('Error cargando timeout:', error);
        }
    }

    async function saveSessionTimeout() {
        const select = document.getElementById('sessionTimeout');
        const statusEl = document.getElementById('configStatus');
        if (!select) return;
        
        const timeout = parseInt(select.value);
        
        try {
            const response = await fetch('/api/config', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
                },
                body: JSON.stringify({ sessionTimeout: timeout })
            });
            
            const data = await response.json();
            
            if (data.success) {
                if (statusEl) {
                    statusEl.textContent = '✅ Configuración guardada correctamente';
                    statusEl.style.display = 'block';
                    setTimeout(() => statusEl.style.display = 'none', 3000);
                }
            } else {
                alert('Error: ' + (data.error || 'No se pudo guardar'));
            }
        } catch (error) {
            console.error('Error guardando timeout:', error);
            alert('Error al guardar la configuración');
        }
    }
`;

// Eliminar funciones anteriores si existen
adminPanel = adminPanel.replace(/async function loadSessionTimeout\(\)[\s\S]*?}\s*}/g, '');
adminPanel = adminPanel.replace(/async function saveSessionTimeout\(\)[\s\S]*?}\s*}/g, '');

// Agregar nuevas funciones antes de </script>
const lastScriptClose = adminPanel.lastIndexOf('</script>');
if (lastScriptClose > -1) {
    adminPanel = adminPanel.substring(0, lastScriptClose) + newFunctions + '\n    ' + adminPanel.substring(lastScriptClose);
    console.log('Funciones actualizadas');
}

fs.writeFileSync(adminPanelPath, adminPanel);
console.log('admin-panel.html actualizado');

// ============ PATCH 2: Agregar sessionTimeout al servidor ============
const serverPath = '/app/server.js';
let server = fs.readFileSync(serverPath, 'utf8');

// Verificar si sessionTimeout ya está en appConfig
if (!server.includes('sessionTimeout')) {
    // Agregar a la respuesta GET /api/config
    server = server.replace(
        /gmtOffset: appConfig\.gmtOffset,\s*timezone:/,
        'gmtOffset: appConfig.gmtOffset,\n                sessionTimeout: appConfig.sessionTimeout || 5,\n                timezone:'
    );
    
    // Agregar manejo de sessionTimeout en PUT /api/config
    server = server.replace(
        /const \{ gmtOffset \} = req\.body;/,
        'const { gmtOffset, sessionTimeout } = req.body;'
    );
    
    // Agregar validación y guardado de sessionTimeout
    const putConfigInsert = `
    // Guardar sessionTimeout si viene
    if (sessionTimeout !== undefined) {
        const validTimeouts = [5, 10, 15, 30, 60, 120];
        if (validTimeouts.includes(sessionTimeout)) {
            appConfig.sessionTimeout = sessionTimeout;
        }
    }

`;
    server = server.replace(
        /appConfig\.gmtOffset = gmtOffset;/,
        `appConfig.gmtOffset = gmtOffset;\n${putConfigInsert}`
    );
    
    // Agregar sessionTimeout a la respuesta
    server = server.replace(
        /gmtOffset: appConfig\.gmtOffset,\s*timezone: gmtLabel/,
        'gmtOffset: appConfig.gmtOffset,\n                sessionTimeout: appConfig.sessionTimeout || 5,\n                timezone: gmtLabel'
    );
    
    console.log('server.js actualizado con sessionTimeout');
    fs.writeFileSync(serverPath, server);
} else {
    console.log('sessionTimeout ya existe en server.js');
}

console.log('\\n✅ Patch completo aplicado');
