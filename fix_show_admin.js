const fs = require('fs');
const authPath = '/app/js/admin/auth.js';

let content = fs.readFileSync(authPath, 'utf8');

// Actualizar showAdminPanel para mostrar el header
const oldShowAdmin = `function showAdminPanel() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appLayout').classList.add('active');`;

const newShowAdmin = `function showAdminPanel(username) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appLayout').classList.add('active');
    
    // Mostrar header superior
    const topHeader = document.getElementById('topHeader');
    if (topHeader) topHeader.style.display = 'flex';
    
    // Actualizar nombre de usuario
    const headerUsername = document.getElementById('headerUsername');
    if (headerUsername) headerUsername.textContent = username || 'admin';`;

if (content.includes(oldShowAdmin)) {
    content = content.replace(oldShowAdmin, newShowAdmin);
    console.log('showAdminPanel actualizado con header');
}

// Actualizar las llamadas a showAdminPanel para pasar el username
// Buscar en login success
content = content.replace(
    /showAdminPanel\(\);/g,
    "showAdminPanel(localStorage.getItem('adminUsername') || 'admin');"
);
console.log('Llamadas a showAdminPanel actualizadas');

// Guardar username en localStorage después de login exitoso
const loginSuccess = `localStorage.setItem('adminToken', token);`;
const loginSuccessNew = `localStorage.setItem('adminToken', token);
            localStorage.setItem('adminUsername', username);`;

if (content.includes(loginSuccess) && !content.includes("localStorage.setItem('adminUsername'")) {
    content = content.replace(loginSuccess, loginSuccessNew);
    console.log('Guardando username en localStorage');
}

fs.writeFileSync(authPath, content);
console.log('\\n✅ auth.js actualizado');
