/**
 * Admin - Gestión de Audios Devocionales con Autenticación
 */

// Configuración
const CONFIG = {
    maxFileSize: 50 * 1024 * 1024,
    allowedTypes: ['audio/mpeg', 'audio/mp3'],
    allowedExtensions: ['.mp3'],
    apiEndpoint: '/api/audios',
    bibleApiBase: 'https://bolls.life'
};

// Estado
let selectedFile = null;
let audioFiles = [];
let fileToDelete = null;
let authToken = localStorage.getItem('adminToken') || null;
let selectedVerse = null;  // Versículo seleccionado
let selectedImageFile = null;
let selectedImageType = 'logo';

// ============ API de Biblia NTV (Bolls.life) ============

// Cache de libros de la Biblia
let bibleBooks = null;

// Cargar lista de libros
async function loadBibleBooks() {
    if (bibleBooks) return bibleBooks;
    
    try {
        const response = await fetch(`${CONFIG.bibleApiBase}/get-books/NTV/`);
        bibleBooks = await response.json();
        console.log('📚 Libros de la Biblia cargados:', bibleBooks.length);
        return bibleBooks;
    } catch (error) {
        console.error('Error cargando libros:', error);
        return [];
    }
}

// Diccionario de abreviaturas de libros de la Biblia
const BIBLE_ABBREVIATIONS = {
    // Antiguo Testamento
    'gn': 'Génesis', 'gen': 'Génesis', 'gén': 'Génesis',
    'ex': 'Éxodo', 'éx': 'Éxodo', 'exo': 'Éxodo',
    'lv': 'Levítico', 'lev': 'Levítico',
    'nm': 'Números', 'num': 'Números', 'núm': 'Números',
    'dt': 'Deuteronomio', 'deu': 'Deuteronomio', 'deut': 'Deuteronomio',
    'jos': 'Josué', 'js': 'Josué',
    'jue': 'Jueces', 'jc': 'Jueces',
    'rt': 'Rut', 'rut': 'Rut',
    '1s': '1 Samuel', '1sam': '1 Samuel', '1 sam': '1 Samuel',
    '2s': '2 Samuel', '2sam': '2 Samuel', '2 sam': '2 Samuel',
    '1r': '1 Reyes', '1re': '1 Reyes', '1 re': '1 Reyes', '1rey': '1 Reyes',
    '2r': '2 Reyes', '2re': '2 Reyes', '2 re': '2 Reyes', '2rey': '2 Reyes',
    '1cr': '1 Crónicas', '1cro': '1 Crónicas', '1 cr': '1 Crónicas',
    '2cr': '2 Crónicas', '2cro': '2 Crónicas', '2 cr': '2 Crónicas',
    'esd': 'Esdras', 'es': 'Esdras',
    'neh': 'Nehemías', 'ne': 'Nehemías',
    'est': 'Ester',
    'job': 'Job', 'jb': 'Job',
    'sal': 'Salmos', 'slm': 'Salmos', 'sl': 'Salmos', 'ps': 'Salmos',
    'pr': 'Proverbios', 'prov': 'Proverbios', 'prv': 'Proverbios',
    'ec': 'Eclesiastés', 'ecl': 'Eclesiastés',
    'cnt': 'Cantares', 'can': 'Cantares', 'ct': 'Cantares', 'cantar': 'Cantares',
    'is': 'Isaías', 'isa': 'Isaías',
    'jr': 'Jeremías', 'jer': 'Jeremías',
    'lm': 'Lamentaciones', 'lam': 'Lamentaciones',
    'ez': 'Ezequiel', 'eze': 'Ezequiel',
    'dn': 'Daniel', 'dan': 'Daniel',
    'os': 'Oseas', 'ose': 'Oseas',
    'jl': 'Joel', 'joe': 'Joel',
    'am': 'Amós', 'amo': 'Amós',
    'ab': 'Abdías', 'abd': 'Abdías',
    'jon': 'Jonás', 'jns': 'Jonás',
    'mi': 'Miqueas', 'miq': 'Miqueas', 'mic': 'Miqueas',
    'na': 'Nahúm', 'nah': 'Nahúm',
    'hab': 'Habacuc', 'hb': 'Habacuc',
    'sof': 'Sofonías', 'sf': 'Sofonías',
    'hag': 'Hageo', 'hg': 'Hageo',
    'zac': 'Zacarías', 'zc': 'Zacarías',
    'mal': 'Malaquías', 'ml': 'Malaquías',
    
    // Nuevo Testamento
    'mt': 'Mateo', 'mat': 'Mateo',
    'mr': 'Marcos', 'mc': 'Marcos', 'mar': 'Marcos',
    'lc': 'Lucas', 'luc': 'Lucas',
    'jn': 'Juan', 'ju': 'Juan',
    'hch': 'Hechos', 'hec': 'Hechos', 'hechos': 'Hechos',
    'ro': 'Romanos', 'rom': 'Romanos',
    '1co': '1 Corintios', '1cor': '1 Corintios', '1 co': '1 Corintios',
    '2co': '2 Corintios', '2cor': '2 Corintios', '2 co': '2 Corintios',
    'ga': 'Gálatas', 'gal': 'Gálatas', 'gá': 'Gálatas',
    'ef': 'Efesios', 'efe': 'Efesios',
    'fil': 'Filipenses', 'flp': 'Filipenses', 'fp': 'Filipenses',
    'col': 'Colosenses', 'cl': 'Colosenses',
    '1ts': '1 Tesalonicenses', '1tes': '1 Tesalonicenses', '1 ts': '1 Tesalonicenses',
    '2ts': '2 Tesalonicenses', '2tes': '2 Tesalonicenses', '2 ts': '2 Tesalonicenses',
    '1ti': '1 Timoteo', '1tim': '1 Timoteo', '1 ti': '1 Timoteo',
    '2ti': '2 Timoteo', '2tim': '2 Timoteo', '2 ti': '2 Timoteo',
    'tit': 'Tito', 'tt': 'Tito',
    'flm': 'Filemón', 'film': 'Filemón', 'fm': 'Filemón',
    'heb': 'Hebreos', 'he': 'Hebreos',
    'stg': 'Santiago', 'sant': 'Santiago', 'sg': 'Santiago',
    '1p': '1 Pedro', '1pe': '1 Pedro', '1 pe': '1 Pedro', '1ped': '1 Pedro',
    '2p': '2 Pedro', '2pe': '2 Pedro', '2 pe': '2 Pedro', '2ped': '2 Pedro',
    '1jn': '1 Juan', '1ju': '1 Juan', '1 jn': '1 Juan',
    '2jn': '2 Juan', '2ju': '2 Juan', '2 jn': '2 Juan',
    '3jn': '3 Juan', '3ju': '3 Juan', '3 jn': '3 Juan',
    'jud': 'Judas', 'jds': 'Judas',
    'ap': 'Apocalipsis', 'apo': 'Apocalipsis', 'apoc': 'Apocalipsis', 'rev': 'Apocalipsis'
};

// Función para expandir abreviaturas
function expandAbbreviation(input) {
    const normalized = input.toLowerCase().trim();
    return BIBLE_ABBREVIATIONS[normalized] || input;
}

// Buscar libro por nombre o abreviatura
async function findBookByName(query) {
    const books = await loadBibleBooks();
    const searchTerm = expandAbbreviation(query).toLowerCase();
    
    // Buscar coincidencia exacta primero
    let book = books.find(b => b.name.toLowerCase() === searchTerm);
    if (book) return book;
    
    // Buscar por inicio del nombre
    book = books.find(b => b.name.toLowerCase().startsWith(searchTerm));
    if (book) return book;
    
    // Buscar por contenido
    book = books.find(b => b.name.toLowerCase().includes(searchTerm));
    return book;
}

// Buscar versículos en la API
async function searchBibleAPI(query) {
    if (!query || query.length < 2) return [];
    
    try {
        // Intentar parsear como referencia completa (ej: "Juan 3:16" o "jn 3:16")
        const refMatch = query.match(/^(\d?\s*[a-záéíóúñ]+)\s+(\d+):?(\d*)/i);
        
        if (refMatch) {
            // Es una referencia bíblica con capítulo
            let bookName = refMatch[1].trim();
            const chapter = parseInt(refMatch[2]);
            const verse = refMatch[3] ? parseInt(refMatch[3]) : null;
            
            // Expandir abreviatura si existe
            bookName = expandAbbreviation(bookName);
            
            // Buscar el libro
            const book = await findBookByName(bookName);
            
            if (book) {
                if (verse) {
                    // Obtener versículo específico
                    const verseData = await fetchVerse(book.bookid, chapter, verse);
                    if (verseData) {
                        return [{
                            reference: `${book.name} ${chapter}:${verse}`,
                            text: cleanVerseText(verseData.text),
                            book: book.name,
                            chapter,
                            verse
                        }];
                    }
                } else {
                    // Obtener capítulo completo y devolver primeros versículos
                    const chapterData = await fetchChapter(book.bookid, chapter);
                    return chapterData.slice(0, 8).map(v => ({
                        reference: `${book.name} ${chapter}:${v.verse}`,
                        text: cleanVerseText(v.text),
                        book: book.name,
                        chapter,
                        verse: v.verse
                    }));
                }
            }
        }
        
        // Si no tiene número, buscar primero como nombre de libro
        const bookOnly = query.trim();
        const book = await findBookByName(bookOnly);
        
        if (book) {
            // Mostrar los primeros versículos del capítulo 1
            const chapterData = await fetchChapter(book.bookid, 1);
            return chapterData.slice(0, 8).map(v => ({
                reference: `${book.name} 1:${v.verse}`,
                text: cleanVerseText(v.text),
                book: book.name,
                chapter: 1,
                verse: v.verse,
                isBookSuggestion: true // Indicador de que es sugerencia de libro
            }));
        }
        
        // Solo si no es un libro, buscar por texto (mínimo 4 caracteres)
        if (query.length >= 4) {
            const searchUrl = `${CONFIG.bibleApiBase}/v2/find/NTV?search=${encodeURIComponent(query)}&limit=10`;
            const response = await fetch(searchUrl);
            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
                const books = await loadBibleBooks();
                return data.results.map(r => {
                    const foundBook = books.find(b => b.bookid === r.book);
                    const bookName = foundBook ? foundBook.name : `Libro ${r.book}`;
                    return {
                        reference: `${bookName} ${r.chapter}:${r.verse}`,
                        text: cleanVerseText(r.text),
                        book: bookName,
                        chapter: r.chapter,
                        verse: r.verse
                    };
                });
            }
        }
        
        return [];
    } catch (error) {
        console.error('Error buscando en API:', error);
        return [];
    }
}

// Obtener un versículo específico (obtenemos el capítulo y filtramos)
async function fetchVerse(bookId, chapter, verse) {
    try {
        const chapterData = await fetchChapter(bookId, chapter);
        const verseData = chapterData.find(v => v.verse === verse);
        return verseData || null;
    } catch (error) {
        console.error('Error obteniendo versículo:', error);
        return null;
    }
}

// Obtener un capítulo completo
async function fetchChapter(bookId, chapter) {
    try {
        const url = `${CONFIG.bibleApiBase}/get-chapter/NTV/${bookId}/${chapter}/`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error obteniendo capítulo:', error);
        return [];
    }
}

// Limpiar texto HTML de versículos
function cleanVerseText(html) {
    if (!html) return '';
    return html
        .replace(/<[^>]*>/g, '')  // Eliminar tags HTML
        .replace(/\s+/g, ' ')      // Normalizar espacios
        .trim();
}

// ============ Autenticación ============

async function checkAuth() {
    console.log('🔐 Verificando autenticación...');
    console.log('🔑 Token en localStorage:', authToken ? 'presente' : 'ausente');
    
    if (!authToken) {
        showLoginScreen();
        return false;
    }
    
    try {
        const response = await fetch('/api/admin/verify', {
            headers: { 'X-Admin-Token': authToken }
        });
        const result = await response.json();
        
        console.log('🔐 Resultado verificación:', result);
        
        if (result.authenticated) {
            showAdminPanel();
            return true;
        } else {
            console.log('⚠️ Token inválido, limpiando...');
            localStorage.removeItem('adminToken');
            authToken = null;
            showLoginScreen();
            return false;
        }
    } catch (error) {
        console.error('Error verificando auth:', error);
        showLoginScreen();
        return false;
    }
}

function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('adminPanel').style.display = 'none';
}

function showAdminPanel() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    loadAudiosFromServer();
    loadSubscriberCount();
    loadDevicesList();
}

async function login(username, password) {
    const loginBtn = document.getElementById('loginBtn');
    const loginError = document.getElementById('loginError');
    
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="loading"></span>';
    loginError.style.display = 'none';
    
    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const result = await response.json();
        
        if (result.success) {
            authToken = result.token;
            localStorage.setItem('adminToken', authToken);
            showAdminPanel();
        } else {
            loginError.textContent = result.error || 'Credenciales incorrectas';
            loginError.style.display = 'block';
        }
    } catch (error) {
        console.error('Error en login:', error);
        loginError.textContent = 'Error de conexión';
        loginError.style.display = 'block';
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Iniciar Sesión';
    }
}

async function logout() {
    try {
        await fetch('/api/admin/logout', {
            method: 'POST',
            headers: { 'X-Admin-Token': authToken }
        });
    } catch (error) {
        console.error('Error en logout:', error);
    }
    
    localStorage.removeItem('adminToken');
    authToken = null;
    showLoginScreen();
}

// Elementos del DOM
let elements = {};

function initElements() {
    elements = {
        uploadZone: document.getElementById('uploadZone'),
        fileInput: document.getElementById('fileInput'),
        filePreview: document.getElementById('filePreview'),
        fileName: document.getElementById('fileName'),
        fileSize: document.getElementById('fileSize'),
        audioDate: document.getElementById('audioDate'),
        validationMessage: document.getElementById('validationMessage'),
        uploadBtn: document.getElementById('uploadBtn'),
        audioList: document.getElementById('audioList'),
        audioCount: document.getElementById('audioCount'),
        emptyState: document.getElementById('emptyState'),
        deleteModal: document.getElementById('deleteModal'),
        deleteFileName: document.getElementById('deleteFileName'),
        cancelDelete: document.getElementById('cancelDelete'),
        confirmDelete: document.getElementById('confirmDelete'),
        toast: document.getElementById('toast')
    };
}

// ============ Utilidades ============

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDateDisplay(dateStr) {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(year, month - 1, day);
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    return date.toLocaleDateString('es-ES', options);
}

function isValidDateFormat(dateStr) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    return date.getFullYear() === year &&
           date.getMonth() === month - 1 &&
           date.getDate() === day;
}

function showToast(message, type = 'info') {
    elements.toast.textContent = message;
    elements.toast.className = 'toast ' + type;
    elements.toast.classList.add('show');
    
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

// ============ Validaciones ============

function validateFile(file) {
    if (!CONFIG.allowedTypes.includes(file.type)) {
        return { valid: false, error: 'Solo se permiten archivos MP3' };
    }
    
    const extension = '.' + file.name.split('.').pop().toLowerCase();
    if (!CONFIG.allowedExtensions.includes(extension)) {
        return { valid: false, error: 'La extensión del archivo debe ser .mp3' };
    }
    
    if (file.size > CONFIG.maxFileSize) {
        return { valid: false, error: `El archivo excede el tamaño máximo de ${formatFileSize(CONFIG.maxFileSize)}` };
    }
    
    return { valid: true };
}

function validateDate(dateStr) {
    if (!isValidDateFormat(dateStr)) {
        return { valid: false, error: 'Formato de fecha inválido. Usa YYYY-MM-DD' };
    }
    
    const selectedDate = new Date(dateStr);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    if (selectedDate > today) {
        return { valid: false, error: 'No se pueden subir audios para fechas futuras' };
    }
    
    if (audioFiles.some(audio => audio.date === dateStr)) {
        return { valid: false, error: `Ya existe un audio para la fecha ${dateStr}` };
    }
    
    return { valid: true };
}

function updateValidationUI(result) {
    const msg = elements.validationMessage;
    
    if (result.valid) {
        msg.textContent = '✓ Fecha válida y disponible';
        msg.className = 'validation-message success';
        elements.audioDate.classList.remove('error');
        elements.uploadBtn.disabled = false;
    } else {
        msg.textContent = '✗ ' + result.error;
        msg.className = 'validation-message error';
        elements.audioDate.classList.add('error');
        elements.uploadBtn.disabled = true;
    }
}

// ============ Gestión de Archivos ============

function handleFileSelect(file) {
    const validation = validateFile(file);
    
    if (!validation.valid) {
        elements.uploadZone.classList.add('error');
        showToast(validation.error, 'error');
        setTimeout(() => elements.uploadZone.classList.remove('error'), 2000);
        return;
    }
    
    // Validar nombre del archivo
    const fileNameValidation = validateFileName(file.name);
    if (!fileNameValidation.valid) {
        elements.uploadZone.classList.add('error');
        showToast(fileNameValidation.error, 'error');
        setTimeout(() => elements.uploadZone.classList.remove('error'), 2000);
        return;
    }
    
    selectedFile = file;
    elements.uploadZone.classList.remove('error');
    
    elements.fileName.textContent = file.name;
    elements.fileSize.textContent = formatFileSize(file.size);
    elements.filePreview.classList.add('show');
    
    // Si el archivo tiene fecha válida, auto-seleccionar esa fecha
    if (fileNameValidation.date) {
        elements.audioDate.value = fileNameValidation.date;
        validateDateField();
    }
    
    // Verificar si el nombre del archivo tiene una fecha diferente
    checkFileDateMismatch(file.name);
    
    // Validar estado completo del formulario
    validateUploadForm();
}

// Validar que el nombre del archivo tenga formato YYYY-MM-DD
function validateFileName(fileName) {
    // Extraer fecha del nombre del archivo
    const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})/);
    
    if (!dateMatch) {
        return { 
            valid: false, 
            error: 'El archivo debe tener formato YYYY-MM-DD.mp3 (ej: 2025-12-05.mp3)' 
        };
    }
    
    const fileDate = dateMatch[1];
    
    // Verificar que sea una fecha válida
    if (!isValidDateFormat(fileDate)) {
        return { 
            valid: false, 
            error: 'La fecha en el nombre del archivo no es válida' 
        };
    }
    
    return { valid: true, date: fileDate };
}

// Verificar si el nombre del archivo tiene una fecha diferente a la seleccionada
function checkFileDateMismatch(fileName) {
    const selectedDate = elements.audioDate.value;
    if (!selectedDate) return;
    
    // Buscar fecha en el nombre del archivo (formato YYYY-MM-DD)
    const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})/);
    
    // Crear o obtener el elemento de advertencia
    let warningDiv = document.getElementById('fileDateWarning');
    if (!warningDiv) {
        warningDiv = document.createElement('div');
        warningDiv.id = 'fileDateWarning';
        elements.filePreview.appendChild(warningDiv);
    }
    
    if (dateMatch && dateMatch[1] !== selectedDate) {
        const fileDate = dateMatch[1];
        warningDiv.innerHTML = `
            <strong>❌ Error:</strong> El archivo es para <strong>${fileDate}</strong> pero la fecha seleccionada es <strong>${selectedDate}</strong>.<br>
            <small>La fecha del archivo debe coincidir con la fecha seleccionada. Cambia la fecha o selecciona otro archivo.</small>
        `;
        warningDiv.style.cssText = 'margin-top: 10px; padding: 10px; background: #FEE2E2; border: 1px solid #EF4444; border-radius: 8px; font-size: 13px; color: #B91C1C; display: block;';
        elements.uploadBtn.disabled = true;
    } else if (dateMatch && dateMatch[1] === selectedDate) {
        warningDiv.innerHTML = `
            <strong>✅ Correcto:</strong> La fecha del archivo coincide con la fecha seleccionada.
        `;
        warningDiv.style.cssText = 'margin-top: 10px; padding: 10px; background: #D1FAE5; border: 1px solid #10B981; border-radius: 8px; font-size: 13px; color: #065F46; display: block;';
        // No deshabilitar aquí, dejar que validateUploadForm lo maneje
    } else {
        warningDiv.style.display = 'none';
    }
}

async function uploadFile() {
    if (!selectedFile) {
        showToast('Debes seleccionar un archivo de audio', 'error');
        return;
    }
    
    if (!selectedVerse) {
        showToast('Debes seleccionar un versículo antes de subir', 'error');
        return;
    }
    
    const date = elements.audioDate.value;
    const title = document.getElementById('devotionalTitle').value.trim();
    
    if (!title) {
        showToast('Debes ingresar un título para el devocional', 'error');
        return;
    }
    
    const dateValidation = validateDate(date);
    
    if (!dateValidation.valid) {
        showToast(dateValidation.error, 'error');
        return;
    }
    
    elements.uploadBtn.disabled = true;
    elements.uploadBtn.innerHTML = '<span class="loading"></span> Subiendo...';
    
    try {
        // 1. Guardar versículo y título primero
        const devResponse = await fetch('/api/devotionals', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Token': authToken
            },
            body: JSON.stringify({
                date: date,
                title: title,
                verseReference: selectedVerse.reference,
                verseText: selectedVerse.text
            })
        });
        
        const devResult = await devResponse.json();
        if (!devResult.success) {
            throw new Error(devResult.error || 'Error al guardar versículo');
        }
        
        // 2. Subir audio
        const formData = new FormData();
        formData.append('audio', selectedFile);
        formData.append('date', date);
        
        const response = await fetch(CONFIG.apiEndpoint, {
            method: 'POST',
            headers: { 'X-Admin-Token': authToken },
            body: formData
        });
        
        const result = await response.json();
        
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Error al subir el archivo');
        }
        
        await loadAudiosFromServer();
        renderAudioList();
        resetUploadForm();
        showToast('Devocional subido correctamente con versículo', 'success');
        
    } catch (error) {
        console.error('Error al subir:', error);
        showToast(error.message || 'Error al subir el archivo', 'error');
    } finally {
        elements.uploadBtn.disabled = false;
        elements.uploadBtn.textContent = 'Subir Devocional';
    }
}

function resetUploadForm() {
    selectedFile = null;
    selectedVerse = null;
    elements.fileInput.value = '';
    elements.filePreview.classList.remove('show');
    elements.audioDate.value = '';
    elements.validationMessage.className = 'validation-message';
    elements.audioDate.classList.remove('error');
    elements.uploadBtn.disabled = true;
    
    // Limpiar campos de versículo
    const verseSearch = document.getElementById('verseSearch');
    const versePreview = document.getElementById('versePreview');
    const verseWarning = document.getElementById('verseWarning');
    if (verseSearch) verseSearch.value = '';
    if (versePreview) versePreview.classList.remove('show');
    if (verseWarning) verseWarning.classList.remove('hidden');
}

// Validar formulario completo (fecha + versículo + archivo + coincidencia de fechas)
function validateUploadForm() {
    const date = elements.audioDate.value;
    const dateValidation = validateDate(date);
    const hasVerse = selectedVerse !== null;
    const hasFile = selectedFile !== null;
    const title = document.getElementById('devotionalTitle').value.trim();
    const hasTitle = title.length > 0;
    
    // Verificar que la fecha del archivo coincida con la fecha seleccionada
    let datesMatch = true;
    if (hasFile && date) {
        const dateMatch = selectedFile.name.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch && dateMatch[1] !== date) {
            datesMatch = false;
        }
    }
    
    // Actualizar UI de fecha
    updateValidationUI(dateValidation);
    
    // Actualizar warning de versículo
    const verseWarning = document.getElementById('verseWarning');
    if (verseWarning) {
        if (hasVerse) {
            verseWarning.classList.add('hidden');
        } else {
            verseWarning.classList.remove('hidden');
        }
    }
    
    // Habilitar botón solo si todo está completo y las fechas coinciden
    const canUpload = dateValidation.valid && hasVerse && hasFile && hasTitle && datesMatch;
    elements.uploadBtn.disabled = !canUpload;
    
    return canUpload;
}

// ============ Lista de Audios ============

function renderAudioList() {
    if (audioFiles.length === 0) {
        elements.audioList.innerHTML = `
            <li class="empty-state">
                <div class="empty-state-icon">📭</div>
                <p>No hay audios cargados</p>
            </li>
        `;
        elements.audioCount.textContent = '0 audios';
        return;
    }
    
    elements.audioCount.textContent = `${audioFiles.length} audio${audioFiles.length !== 1 ? 's' : ''}`;
    
    elements.audioList.innerHTML = audioFiles.map(audio => `
        <li class="audio-item" data-date="${audio.date}">
            <div class="audio-item-info">
                <span class="audio-item-icon">🎵</span>
                <div class="audio-item-details">
                    <div class="audio-item-name">${audio.title || audio.filename}</div>
                    <div class="audio-item-date">${formatDateDisplay(audio.date)}${audio.title ? ` • ${audio.filename}` : ''}</div>
                </div>
            </div>
            <span class="audio-item-size">${formatFileSize(audio.size)}</span>
            <button class="delete-btn" onclick="showDeleteModal('${audio.date}')">
                Eliminar
            </button>
        </li>
    `).join('');
}

// ============ Eliminar Audio ============

function showDeleteModal(date) {
    fileToDelete = date;
    const audio = audioFiles.find(a => a.date === date);
    elements.deleteFileName.textContent = audio ? audio.filename : date;
    elements.deleteModal.classList.add('show');
}

function hideDeleteModal() {
    elements.deleteModal.classList.remove('show');
    fileToDelete = null;
}

async function deleteAudio() {
    if (!fileToDelete) return;
    
    // Verificar que tenemos token
    if (!authToken) {
        showToast('Sesión expirada. Por favor inicia sesión de nuevo.', 'error');
        logout();
        return;
    }
    
    elements.confirmDelete.disabled = true;
    elements.confirmDelete.innerHTML = '<span class="loading"></span>';
    
    try {
        console.log('🗑️ Eliminando audio:', fileToDelete);
        console.log('🔑 Token:', authToken ? 'presente' : 'ausente');
        
        const response = await fetch(`${CONFIG.apiEndpoint}/${fileToDelete}`, {
            method: 'DELETE',
            headers: { 
                'X-Admin-Token': authToken,
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (!response.ok || !result.success) {
            if (response.status === 401) {
                showToast('Sesión expirada. Por favor inicia sesión de nuevo.', 'error');
                logout();
                return;
            }
            throw new Error(result.error || 'Error al eliminar el archivo');
        }
        
        await loadAudiosFromServer();
        renderAudioList();
        hideDeleteModal();
        showToast('Audio eliminado correctamente', 'success');
        
    } catch (error) {
        console.error('Error al eliminar:', error);
        showToast(error.message || 'Error al eliminar el archivo', 'error');
    } finally {
        elements.confirmDelete.disabled = false;
        elements.confirmDelete.textContent = 'Eliminar';
    }
}

async function loadAudiosFromServer() {
    try {
        const response = await fetch(CONFIG.apiEndpoint);
        const result = await response.json();
        
        if (result.success) {
            audioFiles = result.data;
            renderAudioList();
        }
    } catch (error) {
        console.error('Error al cargar audios del servidor:', error);
    }
}

// ============ Eventos ============

function initializeEvents() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        login(username, password);
    });
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // Upload zone
    elements.uploadZone.addEventListener('click', () => {
        elements.fileInput.click();
    });
    
    elements.fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });
    
    // Drag and Drop
    elements.uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.uploadZone.classList.add('dragover');
    });
    
    elements.uploadZone.addEventListener('dragleave', () => {
        elements.uploadZone.classList.remove('dragover');
    });
    
    elements.uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.uploadZone.classList.remove('dragover');
        
        if (e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });
    
    // Date change
    elements.audioDate.addEventListener('change', (e) => {
        validateUploadForm();
        // Verificar si hay archivo seleccionado y mostrar advertencia si la fecha no coincide
        if (selectedFile) {
            checkFileDateMismatch(selectedFile.name);
        }
    });
    
    // Upload button
    elements.uploadBtn.addEventListener('click', uploadFile);
    
    // Delete modal
    elements.cancelDelete.addEventListener('click', hideDeleteModal);
    elements.confirmDelete.addEventListener('click', deleteAudio);
    
    elements.deleteModal.addEventListener('click', (e) => {
        if (e.target === elements.deleteModal) {
            hideDeleteModal();
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideDeleteModal();
            // También cerrar sugerencias de versículos
            const suggestions = document.getElementById('verseSuggestions');
            if (suggestions) suggestions.classList.remove('show');
        }
    });
    
    // Set max date
    const today = new Date().toISOString().split('T')[0];
    elements.audioDate.max = today;
    elements.audioDate.value = today;  // Fecha por defecto: hoy
    
    // ============ Verse Autocomplete ============
    initVerseAutocomplete();
}

// Inicializar autocompletado de versículos
function initVerseAutocomplete() {
    const verseSearch = document.getElementById('verseSearch');
    const suggestions = document.getElementById('verseSuggestions');
    const preview = document.getElementById('versePreview');
    const previewRef = document.getElementById('versePreviewRef');
    const previewText = document.getElementById('versePreviewText');
    
    if (!verseSearch) return;
    
    let debounceTimer = null;
    let currentResults = [];
    
    // Buscar mientras escribe
    verseSearch.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        clearTimeout(debounceTimer);
        
        if (query.length < 3) {
            suggestions.classList.remove('show');
            return;
        }
        
        // Mostrar indicador de carga
        suggestions.innerHTML = '<div class="verse-loading"><div class="spinner"></div>Buscando en la Biblia NTV...</div>';
        suggestions.classList.add('show');
        
        debounceTimer = setTimeout(async () => {
            const results = await searchBibleAPI(query);
            currentResults = results;
            
            if (results.length === 0) {
                suggestions.innerHTML = '<div class="verse-suggestion" style="color: #718096; cursor: default;">No se encontraron versículos. Prueba con "Juan 3:16" o "amor"</div>';
            } else {
                suggestions.innerHTML = results.map((v, i) => `
                    <div class="verse-suggestion" data-index="${i}">
                        <div class="verse-suggestion-ref">${v.reference}</div>
                        <div class="verse-suggestion-text">${v.text}</div>
                    </div>
                `).join('');
                
                // Event listeners para selección
                suggestions.querySelectorAll('.verse-suggestion[data-index]').forEach((el) => {
                    const idx = parseInt(el.dataset.index);
                    el.addEventListener('click', () => {
                        selectVerse(currentResults[idx]);
                    });
                });
            }
            
            suggestions.classList.add('show');
        }, 400);  // Debounce más largo para la API
    });
    
    // Cerrar sugerencias al hacer click fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.verse-input-wrapper')) {
            suggestions.classList.remove('show');
        }
    });
    
    // Navegación con teclado
    verseSearch.addEventListener('keydown', (e) => {
        const items = suggestions.querySelectorAll('.verse-suggestion[data-index]');
        const current = suggestions.querySelector('.verse-suggestion.active');
        let index = -1;
        
        if (current) {
            index = parseInt(current.dataset.index);
        }
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (current) current.classList.remove('active');
            const next = index + 1 < items.length ? items[index + 1] : items[0];
            if (next) {
                next.classList.add('active');
                next.scrollIntoView({ block: 'nearest' });
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (current) current.classList.remove('active');
            const prev = index > 0 ? items[index - 1] : items[items.length - 1];
            if (prev) {
                prev.classList.add('active');
                prev.scrollIntoView({ block: 'nearest' });
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const active = suggestions.querySelector('.verse-suggestion.active');
            if (active && active.dataset.index) {
                selectVerse(currentResults[parseInt(active.dataset.index)]);
            }
        }
    });
    
    // Pre-cargar libros de la Biblia
    loadBibleBooks();
}

// Seleccionar un versículo
function selectVerse(verse) {
    selectedVerse = verse;
    
    const verseSearch = document.getElementById('verseSearch');
    const suggestions = document.getElementById('verseSuggestions');
    const preview = document.getElementById('versePreview');
    const previewRef = document.getElementById('versePreviewRef');
    const previewText = document.getElementById('versePreviewText');
    
    verseSearch.value = verse.reference;
    suggestions.classList.remove('show');
    
    previewRef.textContent = verse.reference;
    previewText.textContent = `"${verse.text}"`;
    preview.classList.add('show');
    
    // Validar formulario completo
    validateUploadForm();
    
    showToast('Versículo seleccionado: ' + verse.reference, 'success');
}

// ============ Notificaciones ============

async function loadSubscriberCount() {
    try {
        const response = await fetch('/api/notifications/count');
        const result = await response.json();
        if (result.success) {
            document.getElementById('subscriberCount').textContent = `${result.count} suscriptor${result.count !== 1 ? 'es' : ''}`;
        }
    } catch (error) {
        console.error('Error al cargar suscriptores:', error);
    }
}

async function loadDevicesList() {
    try {
        const response = await fetch('/api/notifications/devices');
        const result = await response.json();
        const container = document.getElementById('devicesList');
        
        if (result.success && result.devices && result.devices.length > 0) {
            container.innerHTML = result.devices.map((device, index) => {
                // Detectar tipo de dispositivo desde userAgent
                const ua = device.userAgent || '';
                let deviceIcon = '📱';
                let deviceName = 'Dispositivo';
                
                if (ua.includes('Windows')) {
                    deviceIcon = '💻';
                    deviceName = 'Windows';
                } else if (ua.includes('Macintosh') || ua.includes('Mac OS')) {
                    deviceIcon = '🖥️';
                    deviceName = 'macOS';
                } else if (ua.includes('iPhone')) {
                    deviceIcon = '📱';
                    deviceName = 'iPhone';
                } else if (ua.includes('iPad')) {
                    deviceIcon = '📱';
                    deviceName = 'iPad';
                } else if (ua.includes('Android')) {
                    deviceIcon = '📱';
                    deviceName = 'Android';
                } else if (ua.includes('Linux')) {
                    deviceIcon = '🐧';
                    deviceName = 'Linux';
                }
                
                // Información de ubicación
                const location = device.location || {};
                const locationText = location.country ? 
                    `${location.city ? location.city + ', ' : ''}${location.country}` : 
                    '';
                const flagEmoji = getCountryFlag(location.countryCode);
                
                return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: var(--background); border-radius: 8px; margin-bottom: 6px;">
                    <div style="flex: 1;">
                        <div style="font-size: 14px; font-weight: 500;">
                            ${deviceIcon} ${deviceName}
                            ${locationText ? `<span style="margin-left: 8px; font-weight: normal; color: var(--text-secondary);">${flagEmoji} ${locationText}</span>` : ''}
                        </div>
                        <div style="font-size: 12px; color: var(--text-secondary);">Registrado: ${new Date(device.createdAt).toLocaleDateString('es-ES')}</div>
                    </div>
                    <button onclick="removeDevice('${device.id}')" style="background: none; border: none; color: #e53e3e; cursor: pointer; font-size: 18px;" title="Eliminar">🗑️</button>
                </div>
            `}).join('');
        } else {
            container.innerHTML = '<p style="color: var(--text-secondary); font-size: 14px; text-align: center;">No hay dispositivos registrados</p>';
        }
    } catch (error) {
        console.error('Error al cargar dispositivos:', error);
        document.getElementById('devicesList').innerHTML = '<p style="color: var(--text-secondary); font-size: 14px;">Error al cargar dispositivos</p>';
    }
}

// Función para obtener emoji de bandera del país
function getCountryFlag(countryCode) {
    if (!countryCode || countryCode.length !== 2) return '🌍';
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
}

async function removeDevice(deviceId) {
    if (!confirm('¿Eliminar este dispositivo de las notificaciones?')) return;
    
    try {
        const response = await fetch(`/api/notifications/device/${deviceId}`, { method: 'DELETE' });
        const result = await response.json();
        if (result.success) {
            showToast('Dispositivo eliminado', 'success');
            loadDevicesList();
            loadSubscriberCount();
        } else {
            showToast('Error al eliminar', 'error');
        }
    } catch (error) {
        showToast('Error al eliminar dispositivo', 'error');
    }
}

async function sendNotification() {
    const title = document.getElementById('notifTitle').value.trim();
    const body = document.getElementById('notifBody').value.trim();
    
    if (!title) {
        showToast('El título es requerido', 'error');
        return;
    }
    
    const btn = document.getElementById('sendNotifBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span> Enviando...';
    
    try {
        const response = await fetch('/api/notifications/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Token': authToken
            },
            body: JSON.stringify({ title, body })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast(result.message, 'success');
            document.getElementById('notifTitle').value = '';
            document.getElementById('notifBody').value = '';
        } else {
            showToast(result.error || 'Error al enviar', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error al enviar notificación', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '📤 Enviar Notificación';
    }
}

// ============ Inicialización ============

document.addEventListener('DOMContentLoaded', () => {
    initElements();
    initializeEvents();
    initImageUpload();
    initTimezoneConfig();
    
    // Verificar autenticación al cargar
    checkAuth();
    
    // Botón de notificaciones
    const sendBtn = document.getElementById('sendNotifBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendNotification);
    }
});

// ============ Configuración de Zona Horaria ============

async function initTimezoneConfig() {
    const gmtSelect = document.getElementById('gmtSelect');
    const saveBtn = document.getElementById('saveTimezoneBtn');
    const serverTimeDisplay = document.getElementById('serverTimeDisplay');
    
    if (!gmtSelect) return;
    
    // Cargar configuración actual
    await loadCurrentTimezone();
    
    // Actualizar hora cada segundo
    updateServerTime();
    setInterval(updateServerTime, 1000);
    
    // Evento de guardar
    saveBtn.addEventListener('click', saveTimezone);
}

async function loadCurrentTimezone() {
    try {
        const response = await fetch('/api/config');
        const data = await response.json();
        
        if (data.success) {
            const gmtSelect = document.getElementById('gmtSelect');
            gmtSelect.value = data.config.gmtOffset.toString();
            console.log('⏰ Zona horaria cargada:', data.config.timezone);
        }
    } catch (error) {
        console.error('Error cargando zona horaria:', error);
    }
}

async function updateServerTime() {
    const serverTimeDisplay = document.getElementById('serverTimeDisplay');
    if (!serverTimeDisplay) return;
    
    try {
        const response = await fetch('/api/server-time');
        const data = await response.json();
        
        if (data.success) {
            const date = new Date(data.serverTime);
            const options = { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            };
            serverTimeDisplay.innerHTML = `
                <strong>${date.toLocaleDateString('es-ES', options)}</strong>
                <br><small style="color: var(--text-secondary);">${data.timezone} • Fecha activa: ${data.today}</small>
            `;
        }
    } catch (error) {
        serverTimeDisplay.textContent = 'Error al obtener hora';
    }
}

async function saveTimezone() {
    const gmtSelect = document.getElementById('gmtSelect');
    const saveBtn = document.getElementById('saveTimezoneBtn');
    const gmtOffset = parseFloat(gmtSelect.value);
    
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Guardando...';
    
    try {
        const response = await fetch('/api/config', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Token': authToken
            },
            body: JSON.stringify({ gmtOffset })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`Zona horaria actualizada a ${data.config.timezone}`, 'success');
            updateServerTime();
        } else {
            showToast(data.error || 'Error al guardar', 'error');
        }
    } catch (error) {
        showToast('Error de conexión', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Guardar';
    }
}

// ============ Subida de Imágenes ============

function initImageUpload() {
    const imageUploadZone = document.getElementById('imageUploadZone');
    const imageFileInput = document.getElementById('imageFileInput');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const imagePreviewImg = document.getElementById('imagePreviewImg');
    const uploadImageBtn = document.getElementById('uploadImageBtn');
    const optionLogo = document.getElementById('optionLogo');
    const optionPastores = document.getElementById('optionPastores');
    
    if (!imageUploadZone) return;
    
    // Selección de tipo de imagen
    optionLogo.addEventListener('click', () => {
        optionLogo.classList.add('selected');
        optionPastores.classList.remove('selected');
        selectedImageType = 'logo';
    });
    
    optionPastores.addEventListener('click', () => {
        optionPastores.classList.add('selected');
        optionLogo.classList.remove('selected');
        selectedImageType = 'pastores';
    });
    
    // Click en zona de subida
    imageUploadZone.addEventListener('click', () => {
        imageFileInput.click();
    });
    
    // Selección de archivo
    imageFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleImageSelect(e.target.files[0]);
        }
    });
    
    // Drag and Drop
    imageUploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        imageUploadZone.style.borderColor = 'var(--primary-color)';
        imageUploadZone.style.background = '#E8F5E9';
    });
    
    imageUploadZone.addEventListener('dragleave', () => {
        imageUploadZone.style.borderColor = '';
        imageUploadZone.style.background = '';
    });
    
    imageUploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        imageUploadZone.style.borderColor = '';
        imageUploadZone.style.background = '';
        
        if (e.dataTransfer.files.length > 0) {
            handleImageSelect(e.dataTransfer.files[0]);
        }
    });
    
    // Botón de subida
    uploadImageBtn.addEventListener('click', uploadImage);
}

function handleImageSelect(file) {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    if (!allowedTypes.includes(file.type)) {
        showToast('Solo se permiten imágenes PNG, JPG o WEBP', 'error');
        return;
    }
    
    if (file.size > maxSize) {
        showToast('La imagen excede el tamaño máximo de 5MB', 'error');
        return;
    }
    
    selectedImageFile = file;
    
    // Mostrar preview
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('imagePreviewImg').src = e.target.result;
        document.getElementById('imagePreviewContainer').classList.add('show');
        document.getElementById('uploadImageBtn').disabled = false;
    };
    reader.readAsDataURL(file);
}

async function uploadImage() {
    if (!selectedImageFile) return;
    
    // Verificar que tenemos token
    if (!authToken) {
        showToast('Sesión expirada. Por favor inicia sesión de nuevo.', 'error');
        logout();
        return;
    }
    
    const uploadBtn = document.getElementById('uploadImageBtn');
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span class="loading"></span> Subiendo...';
    
    try {
        const formData = new FormData();
        formData.append('image', selectedImageFile);
        formData.append('type', selectedImageType);
        
        const response = await fetch('/api/images', {
            method: 'POST',
            headers: { 'X-Admin-Token': authToken },
            body: formData
        });
        
        const result = await response.json();
        
        if (response.status === 401) {
            showToast('Sesión expirada. Por favor inicia sesión de nuevo.', 'error');
            logout();
            return;
        }
        
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Error al subir la imagen');
        }
        
        // Actualizar preview de imagen actual
        const timestamp = Date.now();
        if (selectedImageType === 'logo') {
            document.getElementById('currentLogo').src = `icons/logo.png?t=${timestamp}`;
        } else {
            const pastoresImg = document.getElementById('currentPastores');
            pastoresImg.src = `icons/pastores.jpg?t=${timestamp}`;
            pastoresImg.style.display = 'block';
        }
        
        // Limpiar formulario
        selectedImageFile = null;
        document.getElementById('imageFileInput').value = '';
        document.getElementById('imagePreviewContainer').classList.remove('show');
        
        showToast(result.message, 'success');
        
    } catch (error) {
        console.error('Error al subir imagen:', error);
        showToast(error.message || 'Error al subir la imagen', 'error');
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Subir Imagen';
    }
}

// Exponer funciones globales
window.showDeleteModal = showDeleteModal;
