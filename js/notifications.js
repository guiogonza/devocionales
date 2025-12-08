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
            
            // Verificar si ya estÃ¡ suscrito
            let subscription = await registration.pushManager.getSubscription();
            
            if (!subscription) {
                // Crear nueva suscripciÃ³n
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this.urlBase64ToUint8Array(vapidKey)
                });
            }

            // Guardar suscripciÃ³n en el servidor
            await this.saveSubscription(subscription);
            
            console.log('Usuario suscrito a notificaciones');
            return subscription;
        } catch (error) {
            console.error('Error al suscribir:', error);
            return null;
        }
    }

    // Guardar suscripciÃ³n en el servidor
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
            console.error('Error al guardar suscripciÃ³n:', error);
        }
    }

    // Mostrar notificaciÃ³n local
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

// Inicializar cuando el DOM estÃ© listo
document.addEventListener('DOMContentLoaded', () => {
    const bell = document.getElementById('notificationBell');
    
    
    
    // Verificar si el navegador soporta notificaciones
    if (!notificationManager.isSupported()) {
        console.log('Notificaciones no soportadas');
        bell.querySelector('#notifBtnText').textContent = 'No disponible';
        notifBtn.style.background = '#718096';
        notifBtn.disabled = true;
        notifBtn.title = 'Las notificaciones requieren HTTPS';
        return;
    }
    
    // Agregar estilos del modal
    addNotifModalStyles();
    
    // Verificar estado actual del permiso
    updateNotificationButton();
    
    // Manejar clic
    notifBtn.addEventListener('click', async () => {
        if (Notification.permission === 'granted') {
            showNotificationPopup('âœ… Notificaciones Activas', 'Ya tienes las notificaciones activadas. RecibirÃ¡s avisos cuando haya nuevos devocionales.', 'success');
            return;
        }
        
        if (Notification.permission === 'denied') {
            showNotificationPopup('âŒ Notificaciones Bloqueadas', 'Has bloqueado las notificaciones. Para activarlas, ve a la configuraciÃ³n de tu navegador.', 'error');
            return;
        }
        
        // Mostrar popup de confirmaciÃ³n
        showActivationPopup();
    });
});

function updateNotificationButton() {
    const bell = document.getElementById('notificationBell');
    
    
    const textSpan = bell.querySelector('#notifBtnText');
    
    if (Notification.permission === 'granted') {
        textSpan.textContent = 'âœ“ Activos';
        notifBtn.style.background = '#2D6A4F';
        notifBtn.classList.add('active');
    } else if (Notification.permission === 'denied') {
        textSpan.textContent = 'Bloqueados';
        notifBtn.style.background = '#718096';
    } else {
        textSpan.textContent = 'Activar Recordatorios';
        notifBtn.style.background = '#B8860B';
    }
    notifBtn.disabled = false;
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
                <div class="notif-modal-icon">ðŸ””</div>
                <h3>Â¿Activar Recordatorios?</h3>
                <p>RecibirÃ¡s una notificaciÃ³n cada vez que haya un nuevo devocional disponible.</p>
                <div class="notif-modal-buttons">
                    <button class="notif-btn-cancel" onclick="closeNotifModal()">Ahora no</button>
                    <button class="notif-btn-confirm" onclick="activateNotifications()">SÃ­, activar</button>
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
            
            updateNotificationButton();
            showNotificationPopup('âœ… Â¡Listo!', 'Las notificaciones estÃ¡n activadas. Te avisaremos cuando haya nuevos devocionales.', 'success');
            
            // Mostrar notificaciÃ³n de prueba
            notificationManager.showLocalNotification('Â¡Recordatorios Activados!', {
                body: 'RecibirÃ¡s notificaciones de nuevos devocionales.',
                icon: '/icons/logo.png'
            });
        } else {
            updateNotificationButton();
            showNotificationPopup('âŒ Permiso Denegado', 'No podrÃ¡s recibir notificaciones. Puedes cambiar esto en la configuraciÃ³n del navegador.', 'error');
        }
    } catch (error) {
        console.error('Error al activar notificaciones:', error);
        updateNotificationButton();
        showNotificationPopup('âš ï¸ Error', 'OcurriÃ³ un error al activar las notificaciones.', 'error');
    }
}

function showNotificationPopup(title, message, type) {
    const modal = document.createElement('div');
    modal.id = 'notifResultModal';
    modal.innerHTML = `
        <div class="notif-modal-overlay" onclick="this.parentElement.remove()">
            <div class="notif-result-modal ${type}" onclick="event.stopPropagation()">
                <div class="notif-modal-icon">${type === 'success' ? 'âœ…' : 'âŒ'}</div>
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
