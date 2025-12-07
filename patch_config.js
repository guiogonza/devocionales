const fs = require('fs');

let content = fs.readFileSync('/app/admin-panel.html', 'utf8');

// Agregar funciones de configuración si no existen
if (!content.includes('function saveSessionTimeout')) {
    const configFunctions = `
        // Configuración - Session Timeout
        async function loadSessionTimeout() {
            try {
                const response = await fetch('/api/config/session-timeout', {
                    headers: { 'X-Admin-Token': authToken }
                });
                const data = await response.json();
                if (data.success && document.getElementById('sessionTimeout')) {
                    document.getElementById('sessionTimeout').value = data.timeout;
                }
            } catch (error) {
                console.error('Error cargando timeout:', error);
            }
        }

        async function saveSessionTimeout() {
            const timeoutEl = document.getElementById('sessionTimeout');
            const statusEl = document.getElementById('configStatus');
            if (!timeoutEl) return;
            
            const timeout = timeoutEl.value;
            
            try {
                const response = await fetch('/api/config/session-timeout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Admin-Token': authToken
                    },
                    body: JSON.stringify({ timeout: parseInt(timeout) })
                });
                
                const data = await response.json();
                
                if (statusEl) {
                    if (data.success) {
                        statusEl.textContent = '✅ Configuración guardada correctamente';
                        statusEl.style.color = '#10B981';
                        statusEl.style.display = 'block';
                        setTimeout(() => statusEl.style.display = 'none', 3000);
                    } else {
                        statusEl.textContent = '❌ ' + (data.error || 'Error al guardar');
                        statusEl.style.color = '#EF4444';
                        statusEl.style.display = 'block';
                    }
                } else {
                    alert(data.success ? 'Configuración guardada' : 'Error: ' + data.error);
                }
            } catch (error) {
                console.error('Error:', error);
                if (statusEl) {
                    statusEl.textContent = '❌ Error de conexión';
                    statusEl.style.color = '#EF4444';
                    statusEl.style.display = 'block';
                }
            }
            
            refreshSession();
        }
    </script>`;
    
    // Buscar el cierre del script y reemplazarlo
    content = content.replace(/(\s*)<\/script>\s*<\/body>/i, configFunctions + '\n</body>');
}

// Agregar carga de config cuando se muestra el tab
if (!content.includes("tabName === 'config'")) {
    content = content.replace(
        "if (tabName === 'activity') {",
        "if (tabName === 'config') {\n                loadSessionTimeout();\n            }\n\n            if (tabName === 'activity') {"
    );
}

fs.writeFileSync('/app/admin-panel.html', content, 'utf8');
console.log('Funciones de configuración agregadas correctamente');
