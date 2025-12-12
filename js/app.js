// Configuración de la aplicación
const APP_CONFIG = {
    audioBasePath: 'audios/',
    audioExtension: '.mp3',
    appUrl: window.location.origin + window.location.pathname
};

const APP_VERSION = '1.0.4'; // Cambia este valor en cada actualización

// Service Worker registration
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(registration => {
            console.log('Service Worker registrado');
            // Iniciar heartbeat si hay suscripción push
            initHeartbeat(registration);
        })
        .catch(err => {
            console.log('Error registrando SW:', err);
        });
}

// Heartbeat para mantener estado online del dispositivo
async function initHeartbeat(registration) {
    try {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            // Enviar heartbeat inicial
            sendHeartbeat(subscription.endpoint);
            
            // Enviar heartbeat cada 2 minutos
            setInterval(() => {
                sendHeartbeat(subscription.endpoint);
            }, 2 * 60 * 1000);
            
            // También enviar cuando la página se hace visible
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    sendHeartbeat(subscription.endpoint);
                    // Actualizar calendario y devocionales al volver a primer plano
                    loadAvailableDates().then(() => {
                        if (availableDates.length > 0) {
                            const latestAvailable = availableDates.sort((a, b) => b.localeCompare(a))[0];
                            loadDevotional(new Date(latestAvailable + 'T12:00:00'));
                        }
                    });
                }
            });
            // Recargar la página al pasar a primer plano
            function setupAutoReloadOnForeground() {
                function reloadIfActive() {
                    if (document.visibilityState === 'visible') {
                        location.reload();
                    }
                }
                document.addEventListener('visibilitychange', reloadIfActive);
                window.addEventListener('focus', reloadIfActive);
                window.addEventListener('pageshow', (event) => {
                    if (event.persisted) {
                        location.reload();
                    }
                });
            }
            setupAutoReloadOnForeground();
        }
    } catch (error) {
        console.log('Error en heartbeat:', error);
    }
}

async function sendHeartbeat(endpoint) {
    try {
        await fetch('/api/notifications/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint })
        });
    } catch (error) {
        // Silenciar errores de heartbeat
    }
}

// Estado de la aplicaci├│n
let currentDate = new Date();
let isPlaying = false;
let serverToday = null; // Fecha del servidor (GMT-0)
let availableDates = []; // Fechas con devocionales disponibles

// Elementos del DOM
const elements = {
    currentDate: document.getElementById('currentDate'),
    devotionalTitle: document.getElementById('devotionalTitle'),
    verseReference: document.getElementById('verseReference'),
    devotionalText: document.getElementById('devotionalText'),
    audioPlayer: document.getElementById('audioPlayer'),
    playButton: document.getElementById('playButton'),
    playIcon: document.getElementById('playIcon'),
    playText: document.getElementById('playText'),
    progressBar: document.getElementById('progressBar'),
    currentTime: document.getElementById('currentTime'),
    duration: document.getElementById('duration'),
    audioError: document.getElementById('audioError'),
    calendarToggle: document.getElementById('calendarToggle'),
    calendarContainer: document.getElementById('calendarContainer'),
    datePicker: document.getElementById('datePicker'),
    shareButton: document.getElementById('shareButton'),
    downloadButton: document.getElementById('downloadButton'),
    downloadIcon: document.getElementById('downloadIcon'),
    downloadText: document.getElementById('downloadText'),
    historyButton: document.getElementById('historyButton'),
    historyModal: document.getElementById('historyModal'),
    closeHistory: document.getElementById('closeHistory'),
    historyList: document.getElementById('historyList')
};

// Datos de devocionales de ejemplo
const devotionalData = {
    default: {
        title: "Encontrando Paz en la Incertidumbre",
        verse: "Filipenses 4:6-7",
        text: "En tiempos de duda y preocupacion, podemos encontrar paz llevando nuestras preocupaciones a Dios en oracion. Este devocional explora como la fe nos ancla en tiempos turbulentos."
    }
};

// Formatear fecha para mostrar
function formatDateDisplay(date) {
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    const formatted = date.toLocaleDateString('es-ES', options);
    return formatted.charAt(0).toLowerCase() + formatted.slice(1);
}

// Formatear fecha para nombre de archivo (YYYY-MM-DD)
function formatDateForFile(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Formatear tiempo (mm:ss)
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Cargar devocional para una fecha
async function loadDevotional(date) {
    currentDate = date;
    const dateStr = formatDateForFile(date);
    const audioPath = `${APP_CONFIG.audioBasePath}${dateStr}${APP_CONFIG.audioExtension}`;
    
    console.log('­ƒôà Cargando devocional para:', dateStr);
    console.log('­ƒÄÁ Ruta del audio:', audioPath);
    
    // Actualizar fecha en la UI
    elements.currentDate.textContent = formatDateDisplay(date);
    
    // Cargar datos del devocional desde la API
    try {
        const response = await fetch(`/api/devotionals/${dateStr}`);
        const result = await response.json();
        
        if (result.success && result.exists) {
            // Usar datos del servidor
            elements.verseReference.textContent = result.data.verseReference;
            elements.devotionalText.textContent = `"${result.data.verseText}"`;
            elements.devotionalTitle.textContent = result.data.title || 'Palabra del D├¡a';
            console.log('­ƒôû Vers├¡culo cargado:', result.data.verseReference);
        } else {
            // Usar datos por defecto
            const data = devotionalData.default;
            elements.devotionalTitle.textContent = data.title;
            elements.verseReference.textContent = data.verse;
            elements.devotionalText.textContent = data.text;
        }
    } catch (error) {
        console.warn('ÔÜá´©Å Error cargando vers├¡culo, usando default:', error);
        const data = devotionalData.default;
        elements.devotionalTitle.textContent = data.title;
        elements.verseReference.textContent = data.verse;
        elements.devotionalText.textContent = data.text;
    }
    
    // Configurar audio - primero verificar si est├í descargado offline
    console.log('­ƒöä Configurando reproductor de audio...');
    elements.audioError.style.display = 'none';
    resetPlayer();
    
    // Intentar cargar desde IndexedDB primero (offline)
    let audioLoaded = false;
    if (window.OfflineStorage) {
        try {
            const offlineAudio = await OfflineStorage.getAudio(dateStr);
            if (offlineAudio && offlineAudio.blob) {
                console.log('­ƒôª Audio cargado desde almacenamiento offline');
                const blobUrl = URL.createObjectURL(offlineAudio.blob);
                elements.audioPlayer.src = blobUrl;
                audioLoaded = true;
                enablePlayButton();
            }
        } catch (e) {
            console.warn('ÔÜá´©Å Error cargando audio offline:', e);
        }
    }
    
    // Si no est├í descargado, cargar desde servidor
    if (!audioLoaded) {
        elements.audioPlayer.src = audioPath;
        
        // Verificar si el audio existe en el servidor
        fetch(audioPath, { method: 'HEAD' })
            .then(response => {
                if (response.ok) {
                    console.log('Ô£à Audio encontrado:', audioPath);
                    enablePlayButton();
                } else {
                    console.warn('ÔÜá´©Å Audio NO encontrado:', audioPath, 'Status:', response.status);
                    showAudioError();
                }
            })
            .catch(err => {
                console.error('ÔØî Error verificando audio:', err);
                showAudioError();
            });
    }
    
    // Guardar en historial
    saveToHistory(date, elements.devotionalTitle.textContent);
    
    // Actualizar URL con la fecha
    updateURL(dateStr);
    
    // Verificar estado de descarga
    checkDownloadStatus();
}

// Actualizar URL sin recargar la p├ígina
function updateURL(dateStr) {
    const url = new URL(window.location);
    url.searchParams.set('date', dateStr);
    window.history.pushState({}, '', url);
}

// Resetear reproductor
function resetPlayer() {
    isPlaying = false;
    elements.playButton.classList.remove('playing');
    elements.playIcon.textContent = '▶';
    elements.playText.textContent = 'Escuchar';
    elements.progressBar.value = 0;
    elements.currentTime.textContent = '0:00';
    elements.duration.textContent = '0:00';
}

// Reproducir/Pausar audio
function togglePlay() {
    // iOS requiere interacci├│n del usuario para reproducir
    // y necesita que el audio est├® cargado
    
    if (elements.audioPlayer.paused) {
        // En iOS, asegurarse de que el audio est├® listo
        if (elements.audioPlayer.readyState < 2) {
            // Mostrar indicador de carga
            elements.playIcon.textContent = '⏳';
            elements.playText.textContent = 'Cargando...';
            
            // Intentar cargar el audio
            elements.audioPlayer.load();
            
            // Esperar a que est├® listo
            const playWhenReady = () => {
                elements.audioPlayer.play()
                    .then(() => {
                        isPlaying = true;
                        elements.playButton.classList.add('playing');
                        elements.playIcon.textContent = '⏸';
                        elements.playText.textContent = 'Pausar';
                        elements.audioError.style.display = 'none';
                        // Registrar reproducci├│n en el servidor
                        trackPlay();
                    })
                    .catch(error => {
                        console.error('Error al reproducir:', error);
                        showAudioError();
                        resetPlayer();
                    });
                elements.audioPlayer.removeEventListener('canplay', playWhenReady);
            };
            
            elements.audioPlayer.addEventListener('canplay', playWhenReady);
            
            // Timeout por si no carga
            setTimeout(() => {
                if (elements.audioPlayer.readyState < 2) {
                    elements.audioPlayer.removeEventListener('canplay', playWhenReady);
                    showAudioError();
                    resetPlayer();
                }
            }, 10000);
            
            return;
        }
        
        elements.audioPlayer.play()
            .then(() => {
                isPlaying = true;
                elements.playButton.classList.add('playing');
                elements.playIcon.textContent = '⏸';
                elements.playText.textContent = 'Pausar';
                elements.audioError.style.display = 'none';
                // Registrar reproducci├│n en el servidor
                trackPlay();
            })
            .catch(error => {
                console.error('Error al reproducir:', error);
                showAudioError();
            });
    } else {
        elements.audioPlayer.pause();
        isPlaying = false;
        elements.playButton.classList.remove('playing');
        elements.playIcon.textContent = '▶';
        elements.playText.textContent = 'Escuchar';
    }
}

// Mostrar error de audio y deshabilitar bot├│n
function showAudioError() {
    elements.audioError.style.display = 'flex';
    elements.playButton.disabled = true;
    elements.playButton.classList.add('disabled');
    elements.playIcon.textContent = '▶';
    elements.playText.textContent = 'No disponible';
}

// Registrar reproducci├│n en el servidor
let lastTrackedDate = null;
async function trackPlay() {
    const dateStr = formatDateForFile(currentDate);
    
    // Evitar registrar m├║ltiples veces la misma fecha en una sesi├│n
    if (lastTrackedDate === dateStr) return;
    lastTrackedDate = dateStr;
    
    try {
        const title = elements.devotionalTitle?.textContent || 'Sin t├¡tulo';
        await fetch('/api/track-play', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: dateStr, title: title })
        });
        console.log('­ƒôè Reproducci├│n registrada:', dateStr);
    } catch (error) {
        console.error('Error registrando reproducci├│n:', error);
    }
}

// Habilitar bot├│n de reproducci├│n
function enablePlayButton() {
    elements.audioError.style.display = 'none';
    elements.playButton.disabled = false;
    elements.playButton.classList.remove('disabled');
    elements.playIcon.textContent = '▶';
    elements.playText.textContent = 'Escuchar';
}

// Actualizar barra de progreso
function updateProgress() {
    const progress = (elements.audioPlayer.currentTime / elements.audioPlayer.duration) * 100;
    elements.progressBar.value = progress || 0;
    elements.currentTime.textContent = formatTime(elements.audioPlayer.currentTime);
}

// Buscar en el audio
function seekAudio(e) {
    const time = (e.target.value / 100) * elements.audioPlayer.duration;
    if (!isNaN(time)) {
        elements.audioPlayer.currentTime = time;
    }
}

// Compartir usando Web Share API nativa con imagen generada
async function shareDevotional() {
    console.log('shareDevotional llamado');
    const dateStr = formatDateForFile(currentDate);
    const shareUrl = `${window.location.origin}/?date=${dateStr}`;
    
    const title = elements.devotionalTitle.textContent || 'Meditación Diaria';
    const verse = elements.verseReference.textContent || '';
    // Obtener el texto del versículo del elemento correcto
    const verseText = elements.devotionalText ? elements.devotionalText.textContent.replace(/^"|"$/g, '') : '';
    const dateFormatted = elements.currentDate.textContent || '';
    
    console.log('Compartir:', { title, verse, shareUrl });
    
    // Texto para compartir - SOLO el link para que aparezca debajo de la imagen
    const shareTextWithImage = shareUrl;
    // Texto completo para cuando no hay imagen
    const shareTextNoImage = `🙏 ${title}\n📖 ${verse}\n\n🎧 Escucha el devocional:\n${shareUrl}`;
    
    // Intentar generar imagen para compartir
    let imageFile = null;
    try {
        if (typeof generateShareImage === 'function') {
            const imageBlob = await generateShareImage(title, verse, verseText, dateFormatted);
            const imageName = `RIO_${dateStr}_devocional.png`;
            imageFile = new File([imageBlob], imageName, { type: 'image/png' });
            console.log('Imagen generada:', imageName);
        }
    } catch (error) {
        console.warn('No se pudo generar la imagen:', error);
    }
    
    // Intento 1: Compartir imagen + link
    if (imageFile && navigator.canShare && navigator.canShare({ files: [imageFile] })) {
        try {
            await navigator.share({
                title: '🙏 Meditación Diaria - RIO Iglesia',
                text: `${title}\n${verse}\n\n${shareUrl}`,
                files: [imageFile]
            });
            console.log('Compartido con imagen');
            return;
        } catch (error) {
            if (error.name === 'AbortError') return;
            console.warn('Error compartiendo con imagen:', error);
        }
    }
    
    // Intento 2: Compartir solo texto + link
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Meditación Diaria - RIO Iglesia',
                text: shareTextNoImage
            });
            console.log('Compartido sin imagen');
            return;
        } catch (error) {
            if (error.name === 'AbortError') return;
            console.warn('Error compartiendo link:', error);
        }
    }
    
    // Fallback: copiar al portapapeles
    fallbackShare(shareTextNoImage);
}

// Compartir alternativo (copiar al portapapeles)
function fallbackShare(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text)
            .then(() => {
                showToast('¡Enlace copiado al portapapeles!');
            })
            .catch(() => {
                prompt('Copia este texto:', text);
            });
    } else {
        prompt('Copia este texto:', text);
    }
}

// Mostrar mensaje toast
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: #2D3748;
        color: white;
        padding: 12px 24px;
        border-radius: 25px;
        font-size: 14px;
        z-index: 1000;
        animation: fadeInOut 2s ease-in-out;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

// ============ Descargas Offline ============

// Verificar estado de descarga
async function checkDownloadStatus() {
    if (!window.OfflineStorage) return;
    
    const dateStr = formatDateForFile(currentDate);
    const isDownloaded = await OfflineStorage.isDownloaded(dateStr);
    
    if (isDownloaded) {
        elements.downloadIcon.textContent = '✓';
        elements.downloadText.textContent = 'Descargado';
        elements.downloadButton.classList.add('downloaded');
    } else {
        elements.downloadIcon.textContent = '📥';
        elements.downloadText.textContent = 'Descargar';
        elements.downloadButton.classList.remove('downloaded');
    }
}

// Descargar audio para offline
async function downloadAudio() {
    if (!window.OfflineStorage) {
        showToast('Tu navegador no soporta descargas offline');
        return;
    }
    
    const dateStr = formatDateForFile(currentDate);
    
    // Si ya est├í descargado, preguntar si quiere ir a descargas
    const isDownloaded = await OfflineStorage.isDownloaded(dateStr);
    if (isDownloaded) {
        window.location.href = 'downloads.html';
        return;
    }
    
    // Iniciar descarga
    elements.downloadButton.disabled = true;
    elements.downloadIcon.textContent = '⏳';
    elements.downloadText.textContent = 'Descargando...';
    
    try {
        await OfflineStorage.downloadAndSave(dateStr, (progress) => {
            elements.downloadText.textContent = `${progress}%`;
        });
        
        elements.downloadIcon.textContent = '✓';
        elements.downloadText.textContent = 'Descargado';
        elements.downloadButton.classList.add('downloaded');
        showToast('¡Audio descargado para escuchar offline!');
        
    } catch (error) {
        console.error('Error al descargar:', error);
        elements.downloadIcon.textContent = '📥';
        elements.downloadText.textContent = 'Descargar';
        showToast('Error al descargar el audio');
    } finally {
        elements.downloadButton.disabled = false;
    }
}

// Guardar en historial
function saveToHistory(date, title) {
    let history = JSON.parse(localStorage.getItem('devotionalHistory') || '[]');
    const dateStr = formatDateForFile(date);
    
    // Evitar duplicados
    history = history.filter(item => item.date !== dateStr);
    
    // A├▒adir al inicio
    history.unshift({
        date: dateStr,
        title: title,
        displayDate: formatDateDisplay(date)
    });
    
    // Limitar a 30 entradas
    history = history.slice(0, 30);
    
    localStorage.setItem('devotionalHistory', JSON.stringify(history));
}

// Mostrar historial
function showHistory() {
    const history = JSON.parse(localStorage.getItem('devotionalHistory') || '[]');
    
    if (history.length === 0) {
        elements.historyList.innerHTML = '<p style="text-align: center; color: #718096;">No hay historial disponible</p>';
    } else {
        elements.historyList.innerHTML = history.map(item => `
            <div class="history-item" data-date="${item.date}">
                <div class="history-item-date">${item.displayDate}</div>
                <div class="history-item-title">${item.title}</div>
            </div>
        `).join('');
        
        // A├▒adir eventos click
        elements.historyList.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
                const dateStr = item.dataset.date;
                const [year, month, day] = dateStr.split('-').map(Number);
                const date = new Date(year, month - 1, day);
                loadDevotional(date);
                closeHistoryModal();
            });
        });
    }
    
    elements.historyModal.style.display = 'flex';
}

// Cerrar modal de historial
function closeHistoryModal() {
    elements.historyModal.style.display = 'none';
}

// Cambiar fecha desde el calendario
async function onDateChange(e) {
    const selectedDateStr = e.target.value;
    const previousValue = formatDateForFile(currentDate);
    
    // Validar que no sea una fecha futura (seg├║n servidor)
    if (serverToday && selectedDateStr > serverToday) {
        showToast('No puedes seleccionar una fecha futura');
        e.target.value = previousValue;
        return;
    }
    
    // Validar que la fecha tenga devocional disponible
    if (availableDates.length > 0 && !availableDates.includes(selectedDateStr)) {
        showToast('No hay devocional para esta fecha');
        e.target.value = previousValue;
        checkDateAvailability(previousValue);
        return;
    }
    
    // Verificar con el servidor si hay devocional
    try {
        const response = await fetch(`/api/devotionals/${selectedDateStr}`);
        const result = await response.json();
        
        if (!result.success || !result.exists) {
            showToast('No hay devocional para esta fecha');
            e.target.value = previousValue;
            checkDateAvailability(previousValue);
            return;
        }
    } catch (error) {
        console.warn('Error verificando devocional:', error);
    }
    
    const selectedDate = new Date(selectedDateStr + 'T12:00:00');
    checkDateAvailability(selectedDateStr);
    loadDevotional(selectedDate);
    elements.calendarContainer.style.display = 'none';
}

// Verificar disponibilidad de una fecha
async function checkDateAvailability(dateStr) {
    const availabilityDiv = document.getElementById('dateAvailability');
    if (!availabilityDiv) return;
    
    // Si es fecha futura, mostrar que no est├í disponible
    if (serverToday && dateStr > serverToday) {
        availabilityDiv.innerHTML = '<span style="color: #DC2626;">🔒 Fecha futura - no disponible</span>';
        return;
    }
    
    try {
        const response = await fetch(`/api/devotionals/${dateStr}`);
        const result = await response.json();
        
        if (result.restricted) {
            availabilityDiv.innerHTML = '<span style="color: #DC2626;">🔒 Aún no disponible</span>';
        } else if (result.success && result.exists) {
            availabilityDiv.innerHTML = '<span style="color: #2D6A4F;">✅ Devocional disponible</span>';
        } else {
            availabilityDiv.innerHTML = '<span style="color: #D97706;">⚠️ Sin devocional</span>';
        }
    } catch (error) {
        availabilityDiv.innerHTML = '';
    }
}

// ============ Calendario Personalizado ============
let calendarCurrentMonth = new Date();

function initCustomCalendar() {
    const prevBtn = document.getElementById('prevMonth');
    const nextBtn = document.getElementById('nextMonth');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            calendarCurrentMonth.setMonth(calendarCurrentMonth.getMonth() - 1);
            renderCalendar();
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            calendarCurrentMonth.setMonth(calendarCurrentMonth.getMonth() + 1);
            renderCalendar();
        });
    }
    
    // Establecer mes actual basado en la fecha seleccionada
    calendarCurrentMonth = new Date(currentDate);
}

function renderCalendar() {
    const monthLabel = document.getElementById('calendarMonth');
    const daysContainer = document.getElementById('calendarDays');
    const prevBtn = document.getElementById('prevMonth');
    const nextBtn = document.getElementById('nextMonth');
    
    if (!monthLabel || !daysContainer) return;
    
    const year = calendarCurrentMonth.getFullYear();
    const month = calendarCurrentMonth.getMonth();
    
    // Nombre del mes
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    monthLabel.textContent = `${monthNames[month]} ${year}`;
    
    // Primer d├¡a del mes y cantidad de d├¡as
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Fecha actual seleccionada
    const selectedDateStr = formatDateForFile(currentDate);
    
    // Fecha de hoy seg├║n servidor
    const todayStr = serverToday || formatDateForFile(new Date());
    const todayDate = new Date(todayStr + 'T12:00:00');
    
    // Generar d├¡as
    let html = '';
    
    // Espacios vac├¡os antes del primer d├¡a
    for (let i = 0; i < firstDay; i++) {
        html += '<button class="calendar-day empty"></button>';
    }
    
    // D├¡as del mes
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dateObj = new Date(year, month, day);
        
        let classes = ['calendar-day'];
        let disabled = false;
        
        // Es fecha futura?
        if (dateStr > todayStr) {
            classes.push('future', 'disabled');
            disabled = true;
        }
        // Tiene devocional disponible?
        else if (availableDates.includes(dateStr)) {
            classes.push('available');
        }
        // No tiene devocional (pasado sin audio)
        else {
            classes.push('disabled');
            disabled = true;
        }
        
        // Es la fecha seleccionada?
        if (dateStr === selectedDateStr) {
            classes.push('selected');
        }
        
        // Es hoy?
        if (dateStr === todayStr) {
            classes.push('today');
        }
        
        html += `<button class="${classes.join(' ')}" data-date="${dateStr}" ${disabled ? 'disabled' : ''}>${day}</button>`;
    }
    
    daysContainer.innerHTML = html;
    
    // Event listeners para los d├¡as
    daysContainer.querySelectorAll('.calendar-day:not(.disabled):not(.empty)').forEach(btn => {
        btn.addEventListener('click', () => selectCalendarDate(btn.dataset.date));
    });
    
    // Navegaci├│n: siempre permitir ir hacia atr├ís, no permitir ir al futuro
    if (prevBtn) {
        prevBtn.disabled = false; // Siempre permitir navegar hacia atr├ís
    if (nextBtn) {
        const nextMonth = new Date(year, month + 1, 1);
        nextBtn.disabled = nextMonth > todayDate;
    }
}

function selectCalendarDate(dateStr) {
    // Verificar si hay devocional
    if (!availableDates.includes(dateStr)) {
        showToast('No hay devocional para esta fecha');
        return;
    }
    
    const selectedDate = new Date(dateStr + 'T12:00:00');
    loadDevotional(selectedDate);
    elements.calendarContainer.style.display = 'none';
    
    // Actualizar calendario
    calendarCurrentMonth = new Date(selectedDate);
    renderCalendar();
}

// Al abrir el calendario
function toggleCalendar() {
    const isVisible = elements.calendarContainer.style.display === 'block';
    elements.calendarContainer.style.display = isVisible ? 'none' : 'block';
    
    if (!isVisible) {
        calendarCurrentMonth = new Date(currentDate);
        renderCalendar();
    }
}

// Obtener fecha de la URL
function getDateFromURL() {
    const params = new URLSearchParams(window.location.search);
    const dateStr = params.get('date');
    if (dateStr) {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
    }
    return new Date();
}

// Inicializar eventos
function initializeEvents() {
    // Reproductor
    elements.playButton.addEventListener('click', togglePlay);
    elements.progressBar.addEventListener('input', seekAudio);
    
    // Audio events
    elements.audioPlayer.addEventListener('timeupdate', updateProgress);
    elements.audioPlayer.addEventListener('loadedmetadata', () => {
        console.log('Ô£à Audio cargado correctamente. Duraci├│n:', elements.audioPlayer.duration, 'segundos');
        elements.duration.textContent = formatTime(elements.audioPlayer.duration);
    });
    elements.audioPlayer.addEventListener('ended', () => {
        console.log('­ƒÅü Audio terminado');
        resetPlayer();
    });
    elements.audioPlayer.addEventListener('error', (e) => {
        const error = elements.audioPlayer.error;
        console.error('ÔØî Error de audio:', {
            code: error?.code,
            message: error?.message,
            src: elements.audioPlayer.src,
            networkState: elements.audioPlayer.networkState,
            readyState: elements.audioPlayer.readyState
        });
        showAudioError();
    });
    elements.audioPlayer.addEventListener('loadstart', () => {
        console.log('­ƒöä Iniciando carga de audio...');
    });
    elements.audioPlayer.addEventListener('canplay', () => {
        console.log('ÔûÂ´©Å Audio listo para reproducir');
        enablePlayButton();
    });
    
    // Calendario
    elements.calendarToggle.addEventListener('click', toggleCalendar);
    
    // Inicializar calendario personalizado
    initCustomCalendar();
    
    // Compartir
    elements.shareButton.addEventListener('click', shareDevotional);
    
    // Descargar
    elements.downloadButton.addEventListener('click', downloadAudio);
    
    // Historial
    elements.historyButton.addEventListener('click', showHistory);
    elements.closeHistory.addEventListener('click', closeHistoryModal);
    elements.historyModal.addEventListener('click', (e) => {
        if (e.target === elements.historyModal) {
            closeHistoryModal();
        }
    });
}

// Configurar fecha m├íxima del calendario (basada en servidor GMT-0)
async function setupDatePicker() {
    try {
        // Obtener fecha del servidor
        const response = await fetch('/api/server-time');
        const data = await response.json();
        
        if (data.success) {
            serverToday = data.today;
            console.log('­ƒôà Fecha del servidor (GMT-0):', serverToday);
        } else {
            // Fallback a fecha local si falla
            serverToday = formatDateForFile(new Date());
        }
    } catch (error) {
        console.warn('ÔÜá´©Å Error obteniendo fecha del servidor, usando local:', error);
        serverToday = formatDateForFile(new Date());
    }
    
    // Cargar fechas disponibles
    await loadAvailableDates();
}

// Cargar fechas que tienen devocionales disponibles
async function loadAvailableDates() {
    try {
        const response = await fetch('/api/available-dates');
        const data = await response.json();
        
        if (data.success) {
            availableDates = data.dates;
            console.log('­ƒôà Fechas disponibles:', availableDates.length);
            
            // Actualizar indicador de disponibilidad
            updateAvailabilityHint();
        }
    } catch (error) {
        console.warn('ÔÜá´©Å Error cargando fechas disponibles:', error);
    }
}

// Actualizar indicador de fechas disponibles
function updateAvailabilityHint() {
    const availabilityDiv = document.getElementById('dateAvailability');
    if (!availabilityDiv) return;
    
    if (availableDates.length > 0) {
        const sortedDates = [...availableDates].sort();
        const firstDate = sortedDates[0];
        const lastDate = sortedDates[sortedDates.length - 1];
        availabilityDiv.innerHTML = `<span style="color: #718096; font-size: 11px;">­ƒôà Disponibles: ${formatDateShort(firstDate)} - ${formatDateShort(lastDate)} (${availableDates.length} d├¡as)</span>`;
    }
}

// Formatear fecha corta
function formatDateShort(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}`;
}

// Inicializar aplicaci├│n
async function initApp() {
    initializeEvents();
    
    // Configurar fecha del servidor primero
    await setupDatePicker();
    
    // Inicializar almacenamiento offline
    if (window.OfflineStorage) {
        OfflineStorage.init();
    }
    
    // Cargar devocional (desde URL o fecha actual basada en servidor)
    let initialDate = getDateFromURL();
    let initialDateStr = formatDateForFile(initialDate);
    
    // Si la fecha de la URL es futura, usar la fecha del servidor
    if (serverToday && initialDateStr > serverToday) {
        console.log('ÔÜá´©Å Fecha de URL es futura, usando fecha del servidor');
        initialDate = new Date(serverToday + 'T12:00:00');
        initialDateStr = formatDateForFile(initialDate);
    }
    
    // Si la fecha no tiene audio disponible, usar la m├ís reciente disponible
    if (availableDates.length > 0 && !availableDates.includes(initialDateStr)) {
        console.log('ÔÜá´©Å Fecha de URL no tiene audio, usando fecha m├ís reciente disponible');
        const latestAvailable = availableDates.sort((a, b) => b.localeCompare(a))[0];
        initialDate = new Date(latestAvailable + 'T12:00:00');
        // Actualizar URL
        const url = new URL(window.location);
        url.searchParams.set('date', latestAvailable);
        window.history.replaceState({}, '', url);
    }
    
    loadDevotional(initialDate);
    
    // Solicitar permiso de notificaciones despu├®s de 2 segundos
    setTimeout(() => {
        requestNotificationPermission();
    }, 2000);
}

// Solicitar permiso de notificaciones
async function requestNotificationPermission() {
    // Verificar si el navegador soporta notificaciones
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Notificaciones push no soportadas');
        return;
    }
    
    // Si ya tiene permiso, verificar si la suscripci├│n existe en el servidor
    if (Notification.permission === 'granted') {
        const subscriptionExists = await checkSubscriptionOnServer();
        if (subscriptionExists) {
            // Suscripci├│n existe, actualizar silenciosamente
            await subscribeToNotifications();
        } else {
            // Suscripci├│n fue eliminada del servidor, re-suscribir
            console.log('­ƒöö Suscripci├│n no encontrada en servidor, re-suscribiendo...');
            localStorage.removeItem('notifBannerDismissed'); // Permitir mostrar banner de nuevo
            await subscribeToNotifications();
        }
        return;
    }
    
    // Si est├í denegado, no preguntar
    if (Notification.permission === 'denied') {
        console.log('Notificaciones denegadas previamente');
        return;
    }
    
    // Mostrar banner personalizado para pedir permiso
    showNotificationBanner();
}

// Verificar si la suscripci├│n existe en el servidor
async function checkSubscriptionOnServer() {
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
            return false;
        }
        
        const response = await fetch('/api/notifications/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: subscription.endpoint })
        });
        
        const data = await response.json();
        return data.exists === true;
    } catch (error) {
        console.error('Error verificando suscripci├│n:', error);
        return true; // Asumir que existe si hay error
    }
}

// Mostrar banner para solicitar notificaciones
function showNotificationBanner() {
    // Verificar si ya se mostr├│
    if (localStorage.getItem('notifBannerDismissed')) return;
    
    const banner = document.createElement('div');
    banner.id = 'notifBanner';
    banner.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        right: 20px;
        background: linear-gradient(135deg, #2D6A4F, #40916C);
        color: white;
        padding: 16px 20px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 12px;
        animation: slideUp 0.3s ease;
    `;
    banner.innerHTML = `
        <style>
            @keyframes slideUp {
                from { transform: translateY(100px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        </style>
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 24px;">­ƒöö</span>
            <div>
                <strong>┬┐Activar notificaciones?</strong>
                <p style="margin: 4px 0 0; font-size: 14px; opacity: 0.9;">Recibe recordatorios diarios del devocional</p>
            </div>
        </div>
        <div style="display: flex; gap: 10px;">
            <button id="notifAccept" style="flex: 1; background: white; color: #2D6A4F; border: none; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer;">
                S├¡, activar
            </button>
            <button id="notifDismiss" style="flex: 1; background: rgba(255,255,255,0.2); color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer;">
                Ahora no
            </button>
        </div>
    `;
    
    document.body.appendChild(banner);
    
    document.getElementById('notifAccept').addEventListener('click', async () => {
        banner.remove();
        if (Notification.permission === 'denied') {
            showToast('Has bloqueado las notificaciones. Para activarlas, ve a la configuración de tu navegador y permite notificaciones para este sitio.');
            return;
        }
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            await subscribeToNotifications();
        } else if (permission === 'denied') {
            showToast('Has bloqueado las notificaciones. Para activarlas, ve a la configuración de tu navegador y permite notificaciones para este sitio.');
        }
    });
    
    document.getElementById('notifDismiss').addEventListener('click', () => {
        banner.remove();
        localStorage.setItem('notifBannerDismissed', 'true');
    });
}

// Suscribir a notificaciones push
async function subscribeToNotifications() {
    try {
        const registration = await navigator.serviceWorker.ready;
        
        // Obtener clave VAPID del servidor
        const response = await fetch('/api/notifications/vapid-public-key');
        const data = await response.json();
        if (!data.success) {
            console.error('No se pudo obtener la clave VAPID');
            return;
        }
        
        // Convertir clave a Uint8Array
        const vapidKey = urlBase64ToUint8Array(data.publicKey);
        
        // Verificar si ya est├í suscrito
        let subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
            // Crear nueva suscripci├│n
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: vapidKey
            });
        }
        
        // Guardar suscripci├│n en el servidor
        await fetch('/api/notifications/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription)
        });
        
        console.log('Ô£à Suscrito a notificaciones push');
    } catch (error) {
        console.error('Error al suscribir:', error);
    }
}

// Convertir base64 a Uint8Array
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Esperar a que el DOM esté listo
document.addEventListener('DOMContentLoaded', initApp);

// Manejar instalación de PWA
// Manejar instalación de PWA
let deferredPrompt = null;

// Verificar si la app ya está instalada
function isAppInstalled() {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.navigator.standalone === true) return true;
    if (localStorage.getItem('appInstalled') === 'true') return true;
    return false;
}

window.addEventListener('beforeinstallprompt', (e) => {
    // Guardar el evento PRIMERO antes de preventDefault
    deferredPrompt = e;
    console.log('beforeinstallprompt fired, evento guardado');
    
    // Prevenir el mini-infobar de Chrome
    e.preventDefault();

    if (isAppInstalled()) {
        console.log('App ya instalada, no mostrar banner');
        return;
    }

    showInstallBanner();
});

function showInstallBanner() {
    if (isAppInstalled()) return;
    if (localStorage.getItem('installBannerDismissed')) return;
    if (document.querySelector('.install-banner')) return;

    const banner = document.createElement('div');
    banner.className = 'install-banner';

    const p = document.createElement('p');
    p.textContent = 'Instala esta app para acceder sin conexión';

    const installBtn = document.createElement('button');
    installBtn.className = 'install-btn';
    installBtn.id = 'installBtn';
    installBtn.textContent = 'Instalar';

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'dismiss-btn';
    dismissBtn.id = 'dismissBtn';
    dismissBtn.innerHTML = '';

    banner.appendChild(p);
    banner.appendChild(installBtn);
    banner.appendChild(dismissBtn);
    document.body.appendChild(banner);

    installBtn.addEventListener('click', async () => {
        console.log('Install button clicked');
        console.log('deferredPrompt disponible:', !!deferredPrompt);
        
        if (deferredPrompt) {
            try {
                // Mostrar el prompt de instalación
                await deferredPrompt.prompt();
                
                // Esperar la respuesta del usuario
                const choiceResult = await deferredPrompt.userChoice;
                console.log('Usuario eligió:', choiceResult.outcome);
                
                if (choiceResult.outcome === 'accepted') {
                    console.log('Usuario aceptó instalar');
                    localStorage.setItem('appInstalled', 'true');
                } else {
                    console.log('Usuario rechazó instalar');
                }
            } catch (err) {
                console.error('Error al mostrar prompt:', err);
            }
            
            // Limpiar después de usar
            deferredPrompt = null;
        } else {
            console.log('No hay prompt disponible - usar método alternativo');
            alert('Para instalar, usa el menú del navegador o la flecha en la barra de direcciones');
        }
        
        banner.remove();
    });

    dismissBtn.addEventListener('click', () => {
        banner.remove();
        localStorage.setItem('installBannerDismissed', 'true');
    });
}

window.addEventListener('appinstalled', () => {
    console.log('App instalada correctamente');
    localStorage.setItem('appInstalled', 'true');
    deferredPrompt = null;
    const banner = document.querySelector('.install-banner');
    if (banner) banner.remove();
});
function checkiOSInstallPrompt() {
    // Detectar si es iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    // Detectar si es Safari
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    // Detectar si ya est├í instalada como PWA
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    
    // Si es iOS Safari y no est├í instalada
    if (isIOS && isSafari && !isStandalone) {
        // Verificar si el usuario ya cerr├│ el banner
        const dismissed = localStorage.getItem('iosInstallBannerDismissed');
        const dismissedTime = dismissed ? parseInt(dismissed) : 0;
        const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
        
        // Mostrar banner si nunca se cerr├│ o pasaron m├ís de 7 d├¡as
        if (!dismissed || daysSinceDismissed > 7) {
            setTimeout(() => {
                const banner = document.getElementById('iosInstallBanner');
                if (banner) {
                    banner.style.display = 'block';
                }
            }, 2000); // Mostrar despu├®s de 2 segundos
        }
    }
}

// Cerrar banner de iOS
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('iosInstallClose');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            const banner = document.getElementById('iosInstallBanner');
            if (banner) {
                banner.style.display = 'none';
                localStorage.setItem('iosInstallBannerDismissed', Date.now().toString());
            }
        });
    }
    
    checkiOSInstallPrompt();
});


}