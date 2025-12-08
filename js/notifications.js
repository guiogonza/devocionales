/**
 * Sistema de Notificaciones Push para Devocionales
 */

class NotificationManager {
    constructor() {
        this.permission = Notification.permission;
        this.vapidPublicKey = null;
    }

    // Verificar si el navegador soporta notificaciones
    isSupported() {
        return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    }

    // Obtener clave VAPID del servidor
    async getVapidKey() {
        if (this.vapidPublicKey) return this.vapidPublicKey;
        
        try {
            const response = await fetch('/api/notifications/vapid-public-key');
            const data = await response.json();
            if (data.success) {
                this.vapidPublicKey = data.publicKey;
                return this.vapidPublicKey;
            }
        } catch (error) {
            console.error('Error obteniendo VAPID key:', error);
        }
        return null;
    }

    // Solicitar permiso para notificaciones
    async requestPermission() {
        if (!this.isSupported()) {
            console.log('Notificaciones no soportadas en este navegador');
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            this.permission = permission;
            
            if (permission === 'granted') {
                console.log('Permiso de notificaciones concedido');
                await this.subscribeUser();
                return true;
            } else {
                console.log('Permiso de notificaciones denegado');
                return false;
            }
        } catch (error) {
            console.error('Error al solicitar permiso:', error);
            return false;
        }
    }

    // Suscribir usuario a notificaciones push
    async subscribeUser() {
        try {
            const registration = await navigator.serviceWorker.ready;
            
            // Obtener clave VAPID del servidor
            const vapidKey = await this.getVapidKey();
            if (!vapidKey) {
                console.error('No se pudo obtener la clave VAPID');
                return null;
            }
            
            // Verificar si ya esta suscrito
            let subscription = await registration.pushManager.getSubscription();
            
            if (!subscription) {
                // Crear nueva suscripcion
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this.urlBase64ToUint8Array(vapidKey)
                });
            }

            // Guardar suscripcion en el servidor
            await this.saveSubscription(subscription);
            
            console.log('Usuario suscrito a notificaciones');
            return subscription;
        } catch (error) {
            console.error('Error al suscribir:', error);
            return null;
        }
    }

    // Guardar suscripcion en el servidor
    async saveSubscription(subscription) {
        try {
            await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(subscription)
            });
        } catch (error) {
            console.error('Error al guardar suscripcion:', error);
        }
    }

    // Mostrar notificacion local
    async showLocalNotification(title, options = {}) {
        if (this.permission !== 'granted') {
            return false;
        }

        const registration = await navigator.serviceWorker.ready;
        
        const defaultOptions = {
            icon: '/icons/logo.png',
            badge: '/icons/logo.png',
            vibrate: [200, 100, 200],
            tag: 'devocional',
            renotify: true,
            requireInteraction: false,
            ...options
        };

        await registration.showNotification(title, defaultOptions);
        return true;
    }

    // Convertir VAPID key
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    // Programar recordatorio diario
    async scheduleDailyReminder(hour = 7, minute = 0) {
        // Guardar preferencia
        localStorage.setItem('reminderTime', JSON.stringify({ hour, minute }));
        
        // Registrar con el servidor para notificaciones programadas
        try {
            await fetch('/api/notifications/schedule', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ hour, minute })
            });
            return true;
        } catch (error) {
            console.error('Error al programar recordatorio:', error);
            return false;
        }
    }
}

// Exportar instancia
const notificationManager = new NotificationManager();

// Inicializar cuando el DOM este listo
document.addEventListener('DOMContentLoaded', () => {
    initBellNotification();
});

// Tambien verificar cuando la pagina vuelve a ser visible
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        updateBellStatus();
    }
});

function initBellNotification() {
    const bell = document.getElementById('notificationBell');
    if (!bell) return;
    
    // Verificar si el navegador soporta notificaciones
    if (!notificationManager.isSupported()) {
        console.log('Notificaciones no soportadas');
        bell.classList.add('denied');
        bell.title = 'Notificaciones no disponibles';
        bell.style.filter = 'grayscale(100%)';
        return;
    }
    
    // Agregar estilos del modal
    addNotifModalStyles();
    
    // Verificar estado actual
    updateBellStatus();
    
    // Manejar clic en la campanita
    bell.addEventListener('click', handleBellClick);
}

function updateBellStatus() {
    const bell = document.getElementById('notificationBell');
    if (!bell) return;
    
    // Limpiar clases anteriores
    bell.classList.remove('active', 'denied', 'inactive');
    
    if (!notificationManager.isSupported()) {
        bell.classList.add('denied');
        bell.title = 'Notificaciones no disponibles en este navegador';
        bell.style.filter = 'grayscale(100%)';
        return;
    }
    
    const permission = Notification.permission;
    
    if (permission === 'granted') {
        bell.classList.add('active');
        bell.title = 'Notificaciones activas';
        bell.style.filter = 'none'; // Amarillo normal
        bell.style.animation = 'none'; // Sin animacion si esta activo
    } else if (permission === 'denied') {
        bell.classList.add('denied');
        bell.title = 'Notificaciones bloqueadas - clic para mas info';
        bell.style.filter = 'grayscale(100%)'; // Gris
        bell.style.animation = 'none';
    } else {
        bell.classList.add('inactive');
        bell.title = 'Clic para activar notificaciones';
        bell.style.filter = 'grayscale(100%)'; // Gris hasta que active
        bell.style.animation = 'bellRing 2s ease-in-out infinite'; // Animacion para llamar atencion
    }
}

function handleBellClick() {
    const permission = Notification.permission;
    
    if (permission === 'granted') {
        showNotificationPopup('Notificaciones Activas', 'Ya tienes las notificaciones activadas. Recibiras avisos cuando haya nuevos devocionales.', 'success');
        return;
    }
    
    if (permission === 'denied') {
        showNotificationPopup('Notificaciones Bloqueadas', 'Has bloqueado las notificaciones. Para activarlas, ve a la configuracion de tu navegador y permite notificaciones para este sitio.', 'error');
        return;
    }
    
    // Mostrar popup de confirmacion para activar
    showActivationPopup();
}

function addNotifModalStyles() {
    if (document.getElementById('notifModalStyles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'notifModalStyles';
    styles.textContent = `
        .notif-modal-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            padding: 20px;
        }
        .notif-modal-content {
            background: white;
            border-radius: 16px;
            padding: 24px;
            max-width: 320px;
            text-align: center;
            animation: notifSlideIn 0.3s ease;
        }
        @keyframes notifSlideIn {
            from { transform: translateY(-20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        .notif-modal-icon { font-size: 48px; margin-bottom: 12px; }
        .notif-modal-content h3 { margin: 0 0 8px 0; color: #1A202C; }
        .notif-modal-content p { margin: 0 0 20px 0; color: #718096; font-size: 14px; }
        .notif-modal-buttons { display: flex; gap: 12px; }
        .notif-btn-cancel, .notif-btn-confirm {
            flex: 1; padding: 12px 16px; border-radius: 8px;
            font-size: 14px; font-weight: 600; cursor: pointer; border: none;
        }
        .notif-btn-cancel { background: #E2E8F0; color: #4A5568; }
        .notif-btn-confirm { background: #2D6A4F; color: white; }
        .notif-result-modal {
            background: white; border-radius: 16px; padding: 24px;
            max-width: 320px; text-align: center;
        }
        .notif-result-modal.success { border-top: 4px solid #2D6A4F; }
        .notif-result-modal.error { border-top: 4px solid #E53E3E; }
    `;
    document.head.appendChild(styles);
}

function showActivationPopup() {
    const modal = document.createElement('div');
    modal.id = 'notifModal';
    modal.innerHTML = `
        <div class="notif-modal-overlay">
            <div class="notif-modal-content">
                <div class="notif-modal-icon">🔔</div>
                <h3>Activar Recordatorios?</h3>
                <p>Recibiras una notificacion cada vez que haya un nuevo devocional disponible.</p>
                <div class="notif-modal-buttons">
                    <button class="notif-btn-cancel" onclick="closeNotifModal()">Ahora no</button>
                    <button class="notif-btn-confirm" onclick="activateNotifications()">Si, activar</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function closeNotifModal() {
    const modal = document.getElementById('notifModal');
    if (modal) modal.remove();
}

async function activateNotifications() {
    closeNotifModal();
    
    try {
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            // Intentar suscribir
            try {
                await notificationManager.subscribeUser();
            } catch (e) {
                console.log('Error al suscribir (puede requerir HTTPS):', e);
            }
            
            updateBellStatus();
            showNotificationPopup('Listo!', 'Las notificaciones estan activadas. Te avisaremos cuando haya nuevos devocionales.', 'success');
            
            // Mostrar notificacion de prueba
            notificationManager.showLocalNotification('Recordatorios Activados!', {
                body: 'Recibiras notificaciones de nuevos devocionales.',
                icon: '/icons/logo.png'
            });
        } else {
            updateBellStatus();
            showNotificationPopup('Permiso Denegado', 'No podras recibir notificaciones. Puedes cambiar esto en la configuracion del navegador.', 'error');
        }
    } catch (error) {
        console.error('Error al activar notificaciones:', error);
        updateBellStatus();
        showNotificationPopup('Error', 'Ocurrio un error al activar las notificaciones.', 'error');
    }
}

function showNotificationPopup(title, message, type) {
    const modal = document.createElement('div');
    modal.id = 'notifResultModal';
    modal.innerHTML = `
        <div class="notif-modal-overlay" onclick="this.parentElement.remove()">
            <div class="notif-result-modal ${type}" onclick="event.stopPropagation()">
                <div class="notif-modal-icon">${type === 'success' ? '✅' : '❌'}</div>
                <h3>${title}</h3>
                <p style="color:#718096;font-size:14px;margin:0 0 16px 0;">${message}</p>
                <button class="notif-btn-confirm" onclick="document.getElementById('notifResultModal').remove()">Entendido</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Exponer funciones globales
window.closeNotifModal = closeNotifModal;
window.activateNotifications = activateNotifications;
