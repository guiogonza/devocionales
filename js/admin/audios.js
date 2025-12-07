/**
 * Gestión de Audios - Admin Panel
 */

let isEditMode = false;
let editingDate = null;

async function loadAudiosFromServer() {
    try {
        const response = await fetch(CONFIG.apiEndpoint, {
            headers: { 'x-admin-token': getAuthToken() }
        });

        if (response.ok) {
            const result = await response.json();
            audioFiles = result.data || result || [];
            renderAudioList();
            document.getElementById('audioCountBadge').textContent = audioFiles.length;
            calculateStorageFromAudios();
        }
    } catch (error) {
        console.error('Error cargando audios:', error);
        audioFiles = [];
    }
}

function renderAudioList() {
    const container = document.getElementById('audioList');
    
    if (!audioFiles || audioFiles.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No hay audios cargados</p>';
        return;
    }

    const sorted = [...audioFiles].sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = sorted.map(audio => {
        const verseText = audio.verseText ? audio.verseText.substring(0, 120) + (audio.verseText.length > 120 ? '...' : '') : '';
        return `
        <div class="audio-item" data-date="${audio.date}" style="cursor: pointer;" onclick="loadAudioForEdit('${audio.date}')">
            <div class="audio-date">${formatDate(audio.date)}</div>
            <div class="audio-info">
                <div class="audio-title">${audio.title || 'Sin titulo'}</div>
                <div class="audio-verse">${audio.verseReference || 'Sin versiculo'}</div>
                ${verseText ? `<div class="audio-verse-text">${verseText}</div>` : ''}
                <div class="audio-meta">${formatFileSize(audio.size || 0)}</div>
            </div>
            <div class="audio-actions">
                <button class="action-btn edit" onclick="event.stopPropagation(); loadAudioForEdit('${audio.date}')" title="Editar">&#9998;</button>
                <button class="action-btn delete" onclick="event.stopPropagation(); showDeleteModal('${audio.date}')" title="Eliminar">&#128465;</button>
            </div>
        </div>
    `}).join('');
}

// Cargar audio para editar en el formulario principal
function loadAudioForEdit(date) {
    const audio = audioFiles.find(a => a.date === date);
    if (!audio) return;
    
    isEditMode = true;
    editingDate = date;
    
    // Llenar los campos del formulario
    document.getElementById('audioDate').value = audio.date;
    document.getElementById('audioDate').disabled = true; // No se puede cambiar la fecha en edición
    document.getElementById('devotionalTitle').value = audio.title || '';
    document.getElementById('verseInput').value = audio.verseReference || '';
    
    // Guardar versículo seleccionado
    selectedVerse = audio.verseReference || null;
    selectedVerseText = audio.verseText || null;

    // Mostrar preview del versículo si existe
    const versePreview = document.getElementById('versePreview');
    if (audio.verseReference && versePreview) {
        const refEl = document.getElementById('versePreviewRef');
        const textEl = document.getElementById('versePreviewText');
        if (refEl) refEl.textContent = audio.verseReference;
        if (textEl) textEl.textContent = audio.verseText || '';
        versePreview.classList.add('show');
    }

    // Ocultar zona de archivo y preview (no se puede editar el archivo)
    document.getElementById('filePreview').classList.remove('show');
    const dropZone = document.getElementById('dropZone');
    if (dropZone) dropZone.style.display = 'none';
    selectedFile = null;
    
    // Ocultar validaciones de subida
    const validationMsg = document.getElementById('uploadValidation');
    if (validationMsg) validationMsg.style.display = 'none';
    
    // Cambiar botón a modo edición
    const uploadBtn = document.getElementById('uploadBtn');
    uploadBtn.textContent = 'Actualizar';
    uploadBtn.disabled = false;
    
    // Mostrar botón cancelar
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) cancelBtn.style.display = 'block';
    
    // Scroll al inicio de la página
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    showToast('Editando: ' + (audio.title || date), 'success');
}

function handleFileSelect(file) {
    // Si estamos en modo edición y seleccionamos archivo, salir del modo edición
    if (isEditMode) {
        resetUploadForm();
    }
    
    const validation = validateFile(file);
    if (!validation.valid) {
        showToast(validation.error, 'error');
        return;
    }

    selectedFile = file;
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = formatFileSize(file.size);
    document.getElementById('filePreview').classList.add('show');
    
    // Mostrar zona de drop si estaba oculta
    const dropZone = document.getElementById('dropZone');
    if (dropZone) dropZone.style.display = 'block';
    
    // Solo extraer fecha si el nombre tiene formato exacto YYYY-MM-DD.mp3
    const validNamePattern = /^(\d{4}-\d{2}-\d{2})\.mp3$/i;
    const dateMatch = file.name.match(validNamePattern);
    if (dateMatch) {
        document.getElementById('audioDate').value = dateMatch[1];
    } else {
        document.getElementById('audioDate').value = '';
    }
    
    validateUploadForm();
}

function validateFile(file) {
    if (!CONFIG.allowedTypes.includes(file.type)) {
        return { valid: false, error: 'Solo se permiten archivos MP3' };
    }

    const extension = '.' + file.name.split('.').pop().toLowerCase();
    if (!CONFIG.allowedExtensions.includes(extension)) {
        return { valid: false, error: 'La extension del archivo debe ser .mp3' };
    }

    if (file.size > CONFIG.maxFileSize) {
        return { valid: false, error: `El archivo excede el tamaño máximo de ${formatFileSize(CONFIG.maxFileSize)}` };
    }

    return { valid: true };
}

function validateUploadForm() {
    // No validar en modo edición
    if (isEditMode) return;
    
    const date = document.getElementById('audioDate').value;
    const title = document.getElementById('devotionalTitle').value;
    const hasFile = selectedFile !== null;
    const hasVerse = selectedVerse !== null;
    
    const uploadBtn = document.getElementById('uploadBtn');
    const validationMsg = document.getElementById('uploadValidation');
    
    let errors = [];
    
    if (!hasFile) errors.push('Selecciona un archivo MP3');
    if (!date) errors.push('Selecciona una fecha');
    if (!title) errors.push('Ingresa un título');
    if (!hasVerse) errors.push('Selecciona un versículo');
    
    // Validar que no exista audio en esa fecha (solo en modo subida)
    if (date && !isEditMode && audioFiles.some(a => a.date === date)) {
        errors.push('Ya existe un audio para esta fecha');
    }
    
    // Validar que el nombre del archivo sea exactamente YYYY-MM-DD.mp3
    if (hasFile) {
        const expectedName = `${date}.mp3`;
        const fileName = selectedFile.name.toLowerCase();
        
        // El archivo debe llamarse exactamente FECHA.mp3
        if (date && fileName !== expectedName.toLowerCase()) {
            errors.push(`El archivo debe llamarse "${expectedName}" (actual: "${selectedFile.name}")`);
        }
        
        // Validar que el nombre tenga formato de fecha válido
        const validNamePattern = /^\d{4}-\d{2}-\d{2}\.mp3$/i;
        if (!validNamePattern.test(selectedFile.name)) {
            errors.push('El archivo debe tener formato YYYY-MM-DD.mp3 (ej: 2025-12-07.mp3)');
        }
    }
    
    if (validationMsg) {
        if (errors.length > 0) {
            validationMsg.innerHTML = errors.map(e => `<div class="validation-error">${e}</div>`).join('');
            validationMsg.style.display = 'block';
        } else {
            validationMsg.innerHTML = '<div class="validation-success">Todo listo para subir</div>';
            validationMsg.style.display = 'block';
        }
    }
    
    uploadBtn.disabled = errors.length > 0;
}

async function checkDateAvailability(date) {
    return !audioFiles.some(a => a.date === date);
}

async function uploadFile() {
    const token = getAuthToken();
    if (!token) {
        showToast('No autorizado. Inicia sesión de nuevo.', 'error');
        logout();
        return;
    }

    const date = document.getElementById('audioDate').value;
    const title = document.getElementById('devotionalTitle').value;
    
    if (!selectedVerse || !selectedVerseText) {
        showToast('Debes seleccionar un versículo', 'error');
        return;
    }

    const uploadBtn = document.getElementById('uploadBtn');
    
    // Si estamos en modo edición
    if (isEditMode && editingDate) {
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Guardando...';
        
        try {
            const response = await fetch(`/api/devotionals/${editingDate}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-token': token
                },
                body: JSON.stringify({ 
                    title, 
                    verseReference: selectedVerse,
                    verseText: selectedVerseText
                })
            });

            const data = await response.json();

            if (data.success) {
                showToast('Devocional actualizado correctamente', 'success');
                resetUploadForm();
                loadAudiosFromServer();
            } else {
                showToast(data.error || 'Error al actualizar', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('Error al guardar cambios', 'error');
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Subir Audio';
            isEditMode = false;
            editingDate = null;
        }
        return;
    }
    
    // Modo subida normal
    if (!selectedFile) {
        showToast('Debes seleccionar un archivo', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('audio', selectedFile);
    formData.append('date', date);
    formData.append('title', title);
    formData.append('verseReference', selectedVerse);
    formData.append('verseText', selectedVerseText);

    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Subiendo...';

    try {
        const response = await fetch(CONFIG.apiEndpoint, {
            method: 'POST',
            headers: { 'x-admin-token': token },
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            showToast('Audio subido correctamente', 'success');
            resetUploadForm();
            loadAudiosFromServer();
        } else {
            showToast(data.error || 'Error al subir el audio', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error al subir el archivo', 'error');
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Subir Audio';
    }
}

function resetUploadForm() {
    selectedFile = null;
    selectedVerse = null;
    selectedVerseText = null;
    isEditMode = false;
    editingDate = null;
    
    document.getElementById('fileInput').value = '';
    document.getElementById('audioDate').value = '';
    document.getElementById('audioDate').disabled = false; // Habilitar fecha
    document.getElementById('devotionalTitle').value = '';
    document.getElementById('verseInput').value = '';
    document.getElementById('filePreview').classList.remove('show');
    document.getElementById('versePreview').classList.remove('show');
    
    // Mostrar zona de archivo
    const dropZone = document.getElementById('dropZone');
    if (dropZone) dropZone.style.display = 'block';
    
    const uploadBtn = document.getElementById('uploadBtn');
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Subir Audio';
    
    // Ocultar botón cancelar
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) cancelBtn.style.display = 'none';
    
    const validationMsg = document.getElementById('uploadValidation');
    if (validationMsg) validationMsg.style.display = 'none';
}

function removeSelectedFile() {
    selectedFile = null;
    document.getElementById('fileInput').value = '';
    document.getElementById('filePreview').classList.remove('show');
    document.getElementById('audioDate').value = '';
    validateUploadForm();
}

// ============ Delete Modal ============

function showDeleteModal(date) {
    fileToDelete = date;
    const audio = audioFiles.find(a => a.date === date);
    document.getElementById('deleteFileName').textContent = audio ? `${audio.title} (${formatDate(date)})` : date;
    document.getElementById('deleteModal').classList.add('show');
}

function hideDeleteModal() {
    fileToDelete = null;
    document.getElementById('deleteModal').classList.remove('show');
}

async function deleteAudio() {
    if (!fileToDelete) return;

    const token = getAuthToken();
    if (!token) {
        showToast('No autorizado. Inicia sesión de nuevo.', 'error');
        logout();
        return;
    }

    console.log('Eliminando audio:', fileToDelete);

    try {
        const response = await fetch(`${CONFIG.apiEndpoint}/${fileToDelete}`, {
            method: 'DELETE',
            headers: { 'x-admin-token': token }
        });

        console.log('Response status:', response.status);

        if (response.status === 401) {
            showToast('Sesión expirada. Inicia sesión de nuevo.', 'error');
            logout();
            return;
        }

        const data = await response.json();

        if (data.success) {
            showToast('Audio eliminado correctamente', 'success');
            loadAudiosFromServer();
        } else {
            showToast(data.error || 'Error al eliminar', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error al eliminar el archivo', 'error');
    } finally {
        hideDeleteModal();
    }
}

// ============ Edit Modal ============

let editSelectedVerse = null;
let editSelectedVerseText = null;

function showEditModal(date) {
    console.log('showEditModal llamado con fecha:', date);
    fileToEdit = date;
    const audio = audioFiles.find(a => a.date === date);
    
    document.getElementById('editModalDateText').textContent = `Fecha: ${formatDate(date)}`;
    document.getElementById('editTitle').value = audio ? (audio.title || '') : '';
    
    const verseInput = document.getElementById('editVerseInput');
    verseInput.value = audio ? (audio.verseReference || '') : '';
    verseInput.dataset.initialized = 'false'; // Reset para permitir nueva búsqueda
    
    document.getElementById('editVerseText').value = audio ? (audio.verseText || '') : '';
    
    editSelectedVerse = audio ? (audio.verseReference || null) : null;
    editSelectedVerseText = audio ? (audio.verseText || null) : null;
    
    // Limpiar campo de audio
    const audioFileInput = document.getElementById('editAudioFile');
    const audioPreview = document.getElementById('editAudioPreview');
    if (audioFileInput) audioFileInput.value = '';
    if (audioPreview) audioPreview.style.display = 'none';
    
    document.getElementById('editModal').classList.add('show');
    
    // Inicializar búsqueda después de un pequeño delay
    setTimeout(() => initEditVerseSearch(), 100);
    
    // Inicializar listener para preview del archivo de audio
    initEditAudioFileListener();
}

function initEditVerseSearch() {
    const verseInput = document.getElementById('editVerseInput');
    const verseSuggestions = document.getElementById('editVerseSuggestions');
    
    if (!verseInput || !verseSuggestions) {
        console.error('No se encontró editVerseInput o editVerseSuggestions');
        return;
    }
    
    // Si ya está inicializado, no hacer nada
    if (verseInput._searchInitialized) return;
    verseInput._searchInitialized = true;
    
    let searchTimeout = null;
    
    // Al hacer clic en el input, seleccionar todo el texto
    verseInput.addEventListener('click', function() {
        this.select();
    });
    
    // Al hacer doble clic, limpiar para nueva búsqueda
    verseInput.addEventListener('dblclick', function() {
        this.value = '';
        this.focus();
        verseSuggestions.innerHTML = '';
        verseSuggestions.classList.remove('show');
    });
    
    verseInput.addEventListener('input', function(e) {
        const query = e.target.value.trim();
        
        if (searchTimeout) clearTimeout(searchTimeout);
        
        if (query.length < 2) {
            verseSuggestions.innerHTML = '';
            verseSuggestions.classList.remove('show');
            return;
        }
        
        searchTimeout = setTimeout(async () => {
            verseSuggestions.innerHTML = '<div class="verse-loading">Buscando...</div>';
            verseSuggestions.classList.add('show');
            
            const results = await searchBibleAPI(query);
            
            if (results.length === 0) {
                verseSuggestions.innerHTML = '<div class="verse-no-results">No se encontraron resultados</div>';
                return;
            }
            
            verseSuggestions.innerHTML = results.map(r => `
                <div class="verse-suggestion" data-ref="${r.reference}" data-text="${encodeURIComponent(r.text)}">
                    <div class="verse-suggestion-ref">${r.reference}</div>
                    <div class="verse-suggestion-text">${r.text.substring(0, 100)}${r.text.length > 100 ? '...' : ''}</div>
                </div>
            `).join('');
            
            verseSuggestions.querySelectorAll('.verse-suggestion').forEach(el => {
                el.addEventListener('click', () => {
                    selectEditVerse(el.dataset.ref, decodeURIComponent(el.dataset.text));
                });
            });
        }, 300);
    });
    
    console.log('initEditVerseSearch inicializado correctamente');
}

function clearEditVerse() {
    console.log('clearEditVerse llamado');
    editSelectedVerse = null;
    editSelectedVerseText = null;
    
    const verseInput = document.getElementById('editVerseInput');
    const verseText = document.getElementById('editVerseText');
    const verseSuggestions = document.getElementById('editVerseSuggestions');
    
    if (verseInput) {
        verseInput.value = '';
        verseInput.focus();
    }
    if (verseText) verseText.value = '';
    if (verseSuggestions) {
        verseSuggestions.innerHTML = '';
        verseSuggestions.classList.remove('show');
    }
}

function selectEditVerse(reference, text) {
    editSelectedVerse = reference;
    editSelectedVerseText = text;
    
    document.getElementById('editVerseInput').value = reference;
    document.getElementById('editVerseText').value = text;
    document.getElementById('editVerseSuggestions').classList.remove('show');
}

function hideEditModal() {
    fileToEdit = null;
    editSelectedVerse = null;
    editSelectedVerseText = null;
    document.getElementById('editModal').classList.remove('show');
    const suggestions = document.getElementById('editVerseSuggestions');
    if (suggestions) suggestions.classList.remove('show');
}

async function saveEdit() {
    if (!fileToEdit) return;

    const token = getAuthToken();
    if (!token) {
        showToast('No autorizado', 'error');
        logout();
        return;
    }

    const title = document.getElementById('editTitle').value.trim();
    const verseInput = document.getElementById('editVerseInput');
    const verse = verseInput ? verseInput.value.trim() : '';
    const verseText = document.getElementById('editVerseText').value.trim();
    const audioFileInput = document.getElementById('editAudioFile');
    const newAudioFile = audioFileInput ? audioFileInput.files[0] : null;

    // Validar campos obligatorios
    if (!title) {
        showToast('El titulo es obligatorio', 'error');
        return;
    }
    
    if (!verse || !verseText) {
        showToast('Debes seleccionar un versiculo', 'error');
        return;
    }

    // Si hay un nuevo archivo de audio, validar el nombre
    if (newAudioFile) {
        const expectedFileName = `${fileToEdit}.mp3`;
        if (newAudioFile.name !== expectedFileName) {
            showToast(`El archivo debe llamarse exactamente: ${expectedFileName}`, 'error');
            return;
        }
    }

    try {
        // Si hay nuevo archivo de audio, usar FormData para subir
        if (newAudioFile) {
            const formData = new FormData();
            formData.append('audio', newAudioFile);
            formData.append('title', title);
            formData.append('verseReference', verse);
            formData.append('verseText', verseText);
            formData.append('replaceExisting', 'true');

            const uploadResponse = await fetch('/api/audios/upload', {
                method: 'POST',
                headers: {
                    'x-admin-token': token
                },
                body: formData
            });

            const uploadData = await uploadResponse.json();

            if (uploadData.success) {
                showToast('Devocional y audio actualizados', 'success');
                loadAudiosFromServer();
            } else {
                showToast(uploadData.error || 'Error al actualizar', 'error');
            }
        } else {
            // Solo actualizar metadatos, sin nuevo archivo
            const response = await fetch(`/api/devotionals/${fileToEdit}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-token': token
                },
                body: JSON.stringify({ 
                    title, 
                    verseReference: verse,
                    verseText
                })
            });

            const data = await response.json();

            if (data.success) {
                showToast('Devocional actualizado', 'success');
                loadAudiosFromServer();
            } else {
                showToast(data.error || 'Error al actualizar', 'error');
            }
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error al guardar cambios', 'error');
    } finally {
        hideEditModal();
    }
}

// Funcion para limpiar el audio seleccionado en edicion
function clearEditAudio() {
    const audioFileInput = document.getElementById('editAudioFile');
    const audioPreview = document.getElementById('editAudioPreview');
    
    if (audioFileInput) {
        audioFileInput.value = '';
    }
    if (audioPreview) {
        audioPreview.style.display = 'none';
    }
}

// Funcion para inicializar el listener del archivo de audio en edicion
function initEditAudioFileListener() {
    const audioFileInput = document.getElementById('editAudioFile');
    const audioPreview = document.getElementById('editAudioPreview');
    const audioFileName = document.getElementById('editAudioFileName');
    
    if (!audioFileInput || audioFileInput._listenerInitialized) return;
    audioFileInput._listenerInitialized = true;
    
    audioFileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        
        if (file) {
            // Mostrar preview
            if (audioFileName) audioFileName.textContent = file.name;
            if (audioPreview) audioPreview.style.display = 'block';
            
            // Validar nombre del archivo
            const expectedFileName = `${fileToEdit}.mp3`;
            if (file.name !== expectedFileName) {
                showToast(`Advertencia: El archivo debe llamarse ${expectedFileName}`, 'warning');
            }
        } else {
            if (audioPreview) audioPreview.style.display = 'none';
        }
    });
}

// ============ Storage ============

function calculateStorageFromAudios() {
    if (!audioFiles || audioFiles.length === 0) {
        updateStorageDisplay(0, CONFIG.storageLimitMB);
        return;
    }
    
    let totalBytes = 0;
    audioFiles.forEach(audio => {
        totalBytes += audio.size || 0;
    });
    
    const usedMB = totalBytes / (1024 * 1024);
    updateStorageDisplay(usedMB, CONFIG.storageLimitMB);
}

function updateStorageDisplay(usedMB, limitMB) {
    const percent = Math.round((usedMB / limitMB) * 100);
    
    document.getElementById('storagePercent').textContent = `${percent}%`;
    document.getElementById('storageBarFill').style.width = `${Math.min(percent, 100)}%`;
    document.getElementById('storageDetails').textContent = `${usedMB.toFixed(1)} MB de ${limitMB} MB`;

    const fill = document.getElementById('storageBarFill');
    if (percent > 90) {
        fill.style.background = 'var(--danger-color)';
    } else if (percent > 70) {
        fill.style.background = 'var(--warning-color)';
    } else {
        fill.style.background = 'var(--primary-light)';
    }
}
