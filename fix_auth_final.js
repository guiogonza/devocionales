const fs = require('fs');
const authPath = '/app/js/admin/auth.js';

let content = fs.readFileSync(authPath, 'utf8');

// Reemplazar la función showAdminPanel completa
const oldFunc = `function showAdminPanel() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appLayout').classList.add('active');
    loadAudiosFromServer();
    loadSubscriberCount();
    loadDevicesList();
    loadTimezone();
    loadBibleBooks();
    startSessionTimer(5 * 60 * 1000);
}`;

const newFunc = `function showAdminPanel(username) {
    // Mostrar header superior
    const topHeader = document.getElementById('topHeader');
    if (topHeader) topHeader.style.display = 'flex';
    
    // Actualizar nombre de usuario
    const headerUsername = document.getElementById('headerUsername');
    if (headerUsername) headerUsername.textContent = username || localStorage.getItem('adminUsername') || 'admin';
    
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appLayout').classList.add('active');
    loadAudiosFromServer();
    loadSubscriberCount();
    loadDevicesList();
    loadTimezone();
    loadBibleBooks();
    startSessionTimer(5 * 60 * 1000);
}`;

content = content.replace(oldFunc, newFunc);

// Actualizar llamadas a showAdminPanel
content = content.replace(/showAdminPanel\(\);/g, "showAdminPanel();");

// Guardar username en login
if (!content.includes("adminUsername")) {
    content = content.replace(
        "localStorage.setItem('adminToken', token);",
        "localStorage.setItem('adminToken', token);\n            localStorage.setItem('adminUsername', username);"
    );
}

fs.writeFileSync(authPath, content);
console.log('auth.js actualizado correctamente');
