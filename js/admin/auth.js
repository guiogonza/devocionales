/**
 * Autenticacion del Admin Panel
 * Usa cookies httpOnly para seguridad
 */

// Funcion de compatibilidad - ahora la autenticacion es por cookies
function getAuthToken() {
    // Con cookies httpOnly, el token se envia automaticamente
    // Esta funcion existe por compatibilidad con codigo legacy
    return isAuthenticated ? 'cookie-auth' : null;
}

async function login(username, password) {
    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            isAuthenticated = true;
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
    try {
        const response = await fetch('/api/admin/verify', {
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            if (data.authenticated) {
                isAuthenticated = true;
                showAdminPanel();
            } else {
                isAuthenticated = false;
                showLoginScreen();
            }
        } else {
            isAuthenticated = false;
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

async function logout() {
    try {
        await fetch('/api/admin/logout', {
            method: 'POST',
            credentials: 'include'
        });
    } catch (error) {
        console.error('Error en logout:', error);
    }
    isAuthenticated = false;
    localStorage.removeItem('adminUsername');
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
    loadMaxUpload();
    loadBibleBooks();
    updateHeaderUsername();
    loadAndStartSessionTimer();
    initActivityListeners();
}

// Cargar tiempo de sesion del servidor y arrancar timer
async function loadAndStartSessionTimer() {
    let timeoutMinutes = 20; // Default
    try {
        const response = await fetch('/api/config/session', {
            credentials: 'include'
        });
        if (response.ok) {
            const data = await response.json();
            if (data.sessionTimeoutMinutes) {
                timeoutMinutes = data.sessionTimeoutMinutes;
            }
        }
    } catch (error) {
        console.error('Error cargando config sesion:', error);
    }
    sessionTimeoutMs = timeoutMinutes * 60 * 1000;
    startSessionTimer(sessionTimeoutMs);
}

// Reiniciar timer con actividad del usuario
function initActivityListeners() {
    const events = ['click', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
        document.addEventListener(event, resetSessionTimer, { passive: true });
    });
}

function resetSessionTimer() {
    // Solo reiniciar si hay una sesion activa
    if (sessionInterval && isAuthenticated) {
        startSessionTimer(sessionTimeoutMs);
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

// Helper para hacer peticiones autenticadas (usa cookies automaticamente)
function fetchWithAuth(url, options = {}) {
    return fetch(url, {
        ...options,
        credentials: 'include'
    });
}