const fs = require('fs');
const path = '/app/admin_sidebar.html';

let content = fs.readFileSync(path, 'utf8');

// CSS para el header superior
const headerCSS = `
        /* Header Superior */
        .top-header {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 70px;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 25px;
            z-index: 1001;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }

        .top-header-title {
            display: flex;
            align-items: center;
            gap: 12px;
            color: #fff;
            font-size: 1.3rem;
            font-weight: 600;
        }

        .top-header-title .icon {
            font-size: 1.5rem;
        }

        .top-header-right {
            display: flex;
            align-items: center;
            gap: 20px;
        }

        .user-info {
            color: rgba(255,255,255,0.9);
            font-size: 14px;
            text-align: right;
        }

        .user-info .username {
            font-weight: 600;
        }

        .header-timer {
            background: rgba(255,255,255,0.15);
            padding: 8px 15px;
            border-radius: 20px;
            color: #fff;
            font-size: 14px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .header-timer.warning {
            background: rgba(245, 158, 11, 0.3);
            color: #fbbf24;
        }

        .header-timer.danger {
            background: rgba(239, 68, 68, 0.3);
            color: #ff6b6b;
        }

        .btn-logout {
            background: linear-gradient(135deg, #10B981 0%, #059669 100%);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.3s;
        }

        .btn-logout:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
        }

        /* Ajustar el contenido para el header */
        .app-container {
            padding-top: 70px;
        }

        .sidebar {
            top: 70px;
            height: calc(100vh - 70px);
        }

        @media (max-width: 1024px) {
            .top-header {
                padding: 0 15px;
            }
            .top-header-title {
                font-size: 1rem;
            }
            .user-info {
                display: none;
            }
        }
`;

// Agregar CSS antes de </style>
const styleClose = content.lastIndexOf('</style>');
if (styleClose > -1) {
    content = content.substring(0, styleClose) + headerCSS + '\n    ' + content.substring(styleClose);
    console.log('CSS agregado');
}

// HTML del header
const headerHTML = `
    <!-- Top Header -->
    <header class="top-header" id="topHeader" style="display: none;">
        <div class="top-header-title">
            <span class="icon">🛡️</span>
            <span>Panel de Administración</span>
        </div>
        <div class="top-header-right">
            <div class="user-info">
                <div>Usuario:</div>
                <div class="username" id="headerUsername">admin</div>
            </div>
            <div class="header-timer" id="headerTimer">
                <span>⏱️</span>
                <span id="headerTimerDisplay">5:00</span>
            </div>
            <button class="btn-logout" onclick="logout()">Cerrar Sesión</button>
        </div>
    </header>

`;

// Agregar HTML después de <body>
content = content.replace(/<body>/, '<body>' + headerHTML);
console.log('HTML del header agregado');

// Actualizar la función startSessionTimer para actualizar ambos timers
const oldTimerUpdate = `if (timerDisplay) {
            timerDisplay.textContent = \`\${minutes}:\${seconds.toString().padStart(2, '0')}\`;
        }`;

const newTimerUpdate = `if (timerDisplay) {
            timerDisplay.textContent = \`\${minutes}:\${seconds.toString().padStart(2, '0')}\`;
        }
        
        // Actualizar también el timer del header
        const headerTimerDisplay = document.getElementById('headerTimerDisplay');
        const headerTimer = document.getElementById('headerTimer');
        if (headerTimerDisplay) {
            headerTimerDisplay.textContent = \`\${minutes}:\${seconds.toString().padStart(2, '0')}\`;
        }
        if (headerTimer) {
            headerTimer.classList.remove('warning', 'danger');
            if (remaining < 60000) {
                headerTimer.classList.add('danger');
            } else if (remaining < 120000) {
                headerTimer.classList.add('warning');
            }
        }`;

// Buscar en auth.js
const authPath = '/app/js/admin/auth.js';
let authContent = fs.readFileSync(authPath, 'utf8');
if (authContent.includes(oldTimerUpdate)) {
    authContent = authContent.replace(oldTimerUpdate, newTimerUpdate);
    fs.writeFileSync(authPath, authContent);
    console.log('auth.js actualizado con header timer');
}

// Actualizar showAdminPanel para mostrar el header y actualizar username
const oldShowAdmin = 'function showAdminPanel(username) {';
const newShowAdmin = `function showAdminPanel(username) {
    // Mostrar header superior
    const topHeader = document.getElementById('topHeader');
    if (topHeader) topHeader.style.display = 'flex';
    
    // Actualizar nombre de usuario en header
    const headerUsername = document.getElementById('headerUsername');
    if (headerUsername) headerUsername.textContent = username || 'admin';
`;

if (authContent.includes(oldShowAdmin) && !authContent.includes('topHeader')) {
    authContent = authContent.replace(oldShowAdmin, newShowAdmin);
    fs.writeFileSync(authPath, authContent);
    console.log('showAdminPanel actualizado');
}

// Ocultar header en logout
let authContent2 = fs.readFileSync(authPath, 'utf8');
const oldLogout = 'function logout() {';
const newLogout = `function logout() {
    // Ocultar header superior
    const topHeader = document.getElementById('topHeader');
    if (topHeader) topHeader.style.display = 'none';
`;

if (authContent2.includes(oldLogout) && !authContent2.includes("topHeader.style.display = 'none'")) {
    authContent2 = authContent2.replace(oldLogout, newLogout);
    fs.writeFileSync(authPath, authContent2);
    console.log('logout actualizado para ocultar header');
}

fs.writeFileSync(path, content);
console.log('\\n✅ Header superior agregado correctamente');
