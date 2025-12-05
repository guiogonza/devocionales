// Configuración de la aplicación
const APP_CONFIG = {
    audioBasePath: 'audios/',
    audioExtension: '.mp3',
    appUrl: window.location.origin + window.location.pathname
};

// Estado de la aplicación
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

// Datos de devocionales de ejemplo (en producción, esto podría venir de un JSON)
const devotionalData = {
    default: {
        title: "Encontrando Paz en la Incertidumbre",
        verse: "Filipenses 4:6-7",
        text: "En tiempos de duda y preocupación, podemos encontrar paz llevando nuestras preocupaciones a Dios en oración. Este devocional explora cómo la fe nos ancla en tiempos turbulentos."
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
    
    console.log('📅 Cargando devocional para:', dateStr);
    console.log('🎵 Ruta del audio:', audioPath);
    
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
            elements.devotionalTitle.textContent = result.data.title || 'Palabra del Día';
            console.log('📖 Versículo cargado:', result.data.verseReference);
        } else {
            // Usar datos por defecto
            const data = devotionalData.default;
            elements.devotionalTitle.textContent = data.title;
            elements.verseReference.textContent = data.verse;
            elements.devotionalText.textContent = data.text;
        }
    } catch (error) {
        console.warn('⚠️ Error cargando versículo, usando default:', error);
        const data = devotionalData.default;
        elements.devotionalTitle.textContent = data.title;
        elements.verseReference.textContent = data.verse;
        elements.devotionalText.textContent = data.text;
    }
    
    // Configurar audio
    console.log('🔄 Configurando reproductor de audio...');
    elements.audioPlayer.src = audioPath;
    elements.audioError.style.display = 'none';
    resetPlayer();
    
    // Verificar si el audio existe
    fetch(audioPath, { method: 'HEAD' })
        .then(response => {
            if (response.ok) {
                console.log('✅ Audio encontrado:', audioPath);
                enablePlayButton();
            } else {
                console.warn('⚠️ Audio NO encontrado:', audioPath, 'Status:', response.status);
                showAudioError();
            }
        })
        .catch(err => {
            console.error('❌ Error verificando audio:', err);
            showAudioError();
        });
    
    // Guardar en historial
    saveToHistory(date, elements.devotionalTitle.textContent);
    
    // Actualizar URL con la fecha
    updateURL(dateStr);
    
    // Verificar estado de descarga
    checkDownloadStatus();
}

// Actualizar URL sin recargar la página
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
    // iOS requiere interacción del usuario para reproducir
    // y necesita que el audio esté cargado
    
    if (elements.audioPlayer.paused) {
        // En iOS, asegurarse de que el audio esté listo
        if (elements.audioPlayer.readyState < 2) {
            // Mostrar indicador de carga
            elements.playIcon.textContent = '⏳';
            elements.playText.textContent = 'Cargando...';
            
            // Intentar cargar el audio
            elements.audioPlayer.load();
            
            // Esperar a que esté listo
            const playWhenReady = () => {
                elements.audioPlayer.play()
                    .then(() => {
                        isPlaying = true;
                        elements.playButton.classList.add('playing');
                        elements.playIcon.textContent = '⏸';
                        elements.playText.textContent = 'Pausar';
                        elements.audioError.style.display = 'none';
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

// Mostrar error de audio y deshabilitar botón
function showAudioError() {
    elements.audioError.style.display = 'flex';
    elements.playButton.disabled = true;
    elements.playButton.classList.add('disabled');
    elements.playIcon.textContent = '▶';
    elements.playText.textContent = 'No disponible';
}

// Habilitar botón de reproducción
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

// Compartir usando Web Share API nativa
async function shareDevotional() {
    const dateStr = formatDateForFile(currentDate);
    const shareUrl = `${window.location.origin}/?date=${dateStr}`;
    const shareData = {
        title: 'Meditación Diaria - RIO Iglesia',
        text: `🙏 ${elements.devotionalTitle.textContent}\n📖 ${elements.verseReference.textContent}\n\nEscucha el devocional de hoy:`,
        url: shareUrl
    };
    
    // Usar Web Share API nativa si está disponible
    if (navigator.share) {
        try {
            await navigator.share(shareData);
            console.log('✅ Compartido exitosamente');
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error al compartir:', error);
            }
        }
    } else {
        // Fallback para navegadores sin Web Share API
        fallbackShare(shareUrl);
    }
}

// Compartir alternativo (copiar al portapapeles)
function fallbackShare(url) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(url)
            .then(() => {
                showToast('¡Enlace copiado al portapapeles!');
            })
            .catch(() => {
                prompt('Copia este enlace:', url);
            });
    } else {
        prompt('Copia este enlace:', url);
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
    
    // Si ya está descargado, preguntar si quiere ir a descargas
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
    
    // Añadir al inicio
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
        
        // Añadir eventos click
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
    
    // Validar que no sea una fecha futura (según servidor)
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
    
    // Si es fecha futura, mostrar que no está disponible
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
    
    // Primer día del mes y cantidad de días
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Fecha actual seleccionada
    const selectedDateStr = formatDateForFile(currentDate);
    
    // Fecha de hoy según servidor
    const todayStr = serverToday || formatDateForFile(new Date());
    const todayDate = new Date(todayStr + 'T12:00:00');
    
    // Generar días
    let html = '';
    
    // Espacios vacíos antes del primer día
    for (let i = 0; i < firstDay; i++) {
        html += '<button class="calendar-day empty"></button>';
    }
    
    // Días del mes
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
    
    // Event listeners para los días
    daysContainer.querySelectorAll('.calendar-day:not(.disabled):not(.empty)').forEach(btn => {
        btn.addEventListener('click', () => selectCalendarDate(btn.dataset.date));
    });
    
    // Navegación: siempre permitir ir hacia atrás, no permitir ir al futuro
    if (prevBtn) {
        prevBtn.disabled = false; // Siempre permitir navegar hacia atrás
    }
    
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
        console.log('✅ Audio cargado correctamente. Duración:', elements.audioPlayer.duration, 'segundos');
        elements.duration.textContent = formatTime(elements.audioPlayer.duration);
    });
    elements.audioPlayer.addEventListener('ended', () => {
        console.log('🏁 Audio terminado');
        resetPlayer();
    });
    elements.audioPlayer.addEventListener('error', (e) => {
        const error = elements.audioPlayer.error;
        console.error('❌ Error de audio:', {
            code: error?.code,
            message: error?.message,
            src: elements.audioPlayer.src,
            networkState: elements.audioPlayer.networkState,
            readyState: elements.audioPlayer.readyState
        });
        showAudioError();
    });
    elements.audioPlayer.addEventListener('loadstart', () => {
        console.log('🔄 Iniciando carga de audio...');
    });
    elements.audioPlayer.addEventListener('canplay', () => {
        console.log('▶️ Audio listo para reproducir');
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

// Configurar fecha máxima del calendario (basada en servidor GMT-0)
async function setupDatePicker() {
    try {
        // Obtener fecha del servidor
        const response = await fetch('/api/server-time');
        const data = await response.json();
        
        if (data.success) {
            serverToday = data.today;
            console.log('📅 Fecha del servidor (GMT-0):', serverToday);
        } else {
            // Fallback a fecha local si falla
            serverToday = formatDateForFile(new Date());
        }
    } catch (error) {
        console.warn('⚠️ Error obteniendo fecha del servidor, usando local:', error);
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
            console.log('📅 Fechas disponibles:', availableDates.length);
            
            // Actualizar indicador de disponibilidad
            updateAvailabilityHint();
        }
    } catch (error) {
        console.warn('⚠️ Error cargando fechas disponibles:', error);
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
        availabilityDiv.innerHTML = `<span style="color: #718096; font-size: 11px;">📅 Disponibles: ${formatDateShort(firstDate)} - ${formatDateShort(lastDate)} (${availableDates.length} días)</span>`;
    }
}

// Formatear fecha corta
function formatDateShort(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}`;
}

// Inicializar aplicación
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
        console.log('⚠️ Fecha de URL es futura, usando fecha del servidor');
        initialDate = new Date(serverToday + 'T12:00:00');
        initialDateStr = formatDateForFile(initialDate);
    }
    
    // Si la fecha no tiene audio disponible, usar la más reciente disponible
    if (availableDates.length > 0 && !availableDates.includes(initialDateStr)) {
        console.log('⚠️ Fecha de URL no tiene audio, usando fecha más reciente disponible');
        const latestAvailable = availableDates.sort((a, b) => b.localeCompare(a))[0];
        initialDate = new Date(latestAvailable + 'T12:00:00');
        // Actualizar URL
        const url = new URL(window.location);
        url.searchParams.set('date', latestAvailable);
        window.history.replaceState({}, '', url);
    }
    
    loadDevotional(initialDate);
    
    // Solicitar permiso de notificaciones después de 2 segundos
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
    
    // Si ya tiene permiso, suscribir silenciosamente
    if (Notification.permission === 'granted') {
        await subscribeToNotifications();
        return;
    }
    
    // Si está denegado, no preguntar
    if (Notification.permission === 'denied') {
        console.log('Notificaciones denegadas previamente');
        return;
    }
    
    // Mostrar banner personalizado para pedir permiso
    showNotificationBanner();
}

// Mostrar banner para solicitar notificaciones
function showNotificationBanner() {
    // Verificar si ya se mostró
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
            <span style="font-size: 24px;">🔔</span>
            <div>
                <strong>¿Activar notificaciones?</strong>
                <p style="margin: 4px 0 0; font-size: 14px; opacity: 0.9;">Recibe recordatorios diarios del devocional</p>
            </div>
        </div>
        <div style="display: flex; gap: 10px;">
            <button id="notifAccept" style="flex: 1; background: white; color: #2D6A4F; border: none; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer;">
                Sí, activar
            </button>
            <button id="notifDismiss" style="flex: 1; background: rgba(255,255,255,0.2); color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer;">
                Ahora no
            </button>
        </div>
    `;
    
    document.body.appendChild(banner);
    
    document.getElementById('notifAccept').addEventListener('click', async () => {
        banner.remove();
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            await subscribeToNotifications();
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
        
        // Verificar si ya está suscrito
        let subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
            // Crear nueva suscripción
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: vapidKey
            });
        }
        
        // Guardar suscripción en el servidor
        await fetch('/api/notifications/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription)
        });
        
        console.log('✅ Suscrito a notificaciones push');
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
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Mostrar banner de instalación personalizado
    showInstallBanner();
});

function showInstallBanner() {
    // Verificar si ya se mostró el banner
    if (localStorage.getItem('installBannerDismissed')) return;
    
    const banner = document.createElement('div');
    banner.className = 'install-banner';
    banner.innerHTML = `
        <p>Instala esta app para acceder sin conexión</p>
        <button class="install-btn" id="installBtn">Instalar</button>
        <button class="dismiss-btn" id="dismissBtn">&times;</button>
    `;
    document.body.appendChild(banner);
    
    document.getElementById('installBtn').addEventListener('click', async () => {
        banner.remove();
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log('Instalación:', outcome);
            deferredPrompt = null;
        }
    });
    
    document.getElementById('dismissBtn').addEventListener('click', () => {
        banner.remove();
        localStorage.setItem('installBannerDismissed', 'true');
    });
}

// Detectar si está instalada como PWA
window.addEventListener('appinstalled', () => {
    console.log('App instalada correctamente');
    deferredPrompt = null;
});

// Detectar iOS y mostrar banner de instalación
function checkiOSInstallPrompt() {
    // Detectar si es iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    // Detectar si es Safari
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    // Detectar si ya está instalada como PWA
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    
    // Si es iOS Safari y no está instalada
    if (isIOS && isSafari && !isStandalone) {
        // Verificar si el usuario ya cerró el banner
        const dismissed = localStorage.getItem('iosInstallBannerDismissed');
        const dismissedTime = dismissed ? parseInt(dismissed) : 0;
        const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
        
        // Mostrar banner si nunca se cerró o pasaron más de 7 días
        if (!dismissed || daysSinceDismissed > 7) {
            setTimeout(() => {
                const banner = document.getElementById('iosInstallBanner');
                if (banner) {
                    banner.style.display = 'block';
                }
            }, 2000); // Mostrar después de 2 segundos
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
