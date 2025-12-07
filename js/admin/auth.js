/**
 * Autenticación del Admin Panel
 */

async function login(username, password) {
    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            authToken = data.token;
            localStorage.setItem('adminToken', authToken);
            localStorage.setItem('adminUsername', username);
            showAdminPanel();
            updateHeaderUsername();
            return true;
        } else {
            document.getElementById('loginError').classList.add('show');
            return false;
        }
    } catch (error) {
        console.error('Error en login:', error);
        document.getElementById('loginError').classList.add('show');
        return false;
    }
}

async function checkAuth() {
    console.log('Verificando autenticacion...');
    if (!authToken) {
        showLoginScreen();
        return;
    }

    try {
        const response = await fetch('/api/admin/verify', {
            headers: { 'x-admin-token': authToken }
        });

        if (response.ok) {
            showAdminPanel();
        } else {
            localStorage.removeItem('adminToken');
            authToken = null;
            showLoginScreen();
        }
    } catch (error) {
        console.error('Error verificando auth:', error);
        showLoginScreen();
    }
}

function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('appLayout').classList.remove('active');
}

function logout() {
    localStorage.removeItem('adminToken');
    authToken = null;
    showLoginScreen();
    if (sessionInterval) {
        clearInterval(sessionInterval);
        sessionInterval = null;
    }
}

function showAdminPanel() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appLayout').classList.add('active');
    loadAudiosFromServer();
    loadSubscriberCount();
    loadDevicesList();
    loadTimezone();
    loadBibleBooks();
    updateHeaderUsername();
    startSessionTimer(20 * 60 * 1000);
    initActivityListeners();
}

// Reiniciar timer con actividad del usuario
function initActivityListeners() {
    const events = ['click', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
        document.addEventListener(event, resetSessionTimer, { passive: true });
    });
}

function resetSessionTimer() {
    // Solo reiniciar si hay una sesión activa
    if (sessionInterval && authToken) {
        startSessionTimer(20 * 60 * 1000);
    }
}

function startSessionTimer(ms) {
    sessionExpiry = Date.now() + ms;
    if (sessionInterval) clearInterval(sessionInterval);
    
    const updateTimer = () => {
        const remaining = sessionExpiry - Date.now();
        const timerDisplay = document.getElementById('timerDisplay');
        const sessionTimer = document.getElementById('sessionTimer');
        
        if (remaining <= 0) {
            clearInterval(sessionInterval);
            alert('Sesion expirada. Por favor, inicie sesion de nuevo.');
            logout();
            return;
        }
        
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        
        if (timerDisplay) {
            timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // Cambiar color si queda poco tiempo
        if (sessionTimer) {
            if (remaining < 60000) {
                sessionTimer.style.background = 'rgba(239, 68, 68, 0.3)';
                sessionTimer.style.color = '#ff6b6b';
            } else if (remaining < 120000) {
                sessionTimer.style.background = 'rgba(245, 158, 11, 0.3)';
                sessionTimer.style.color = '#fbbf24';
            } else {
                sessionTimer.style.background = 'rgba(255,255,255,0.1)';
                sessionTimer.style.color = '#fff';
            }
        }
    };
    
    updateTimer();
    sessionInterval = setInterval(updateTimer, 1000);
}

function getAuthToken() {
    if (!authToken) {
        authToken = localStorage.getItem('adminToken');
    }
    return authToken;
}
