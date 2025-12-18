/**
 * Gestión de Imágenes - Admin Panel
 * Selector de tipo (radio) + zona de upload unificada
 */

// Variables globales están en config.js: selectedImageFile, selectedImageType

function initImageUpload() {
    const uploadZone = document.getElementById('imageUploadZone');
    const fileInput = document.getElementById('imageFileInput');
    const uploadBtn = document.getElementById('uploadImageBtn');
    const radioButtons = document.querySelectorAll('input[name="imageType"]');

    if (!uploadZone || !fileInput) {
        console.log('Elementos de imagen no encontrados');
        return;
    }

    // Evento para cambiar tipo de imagen
    radioButtons.forEach(radio => {
        radio.addEventListener('change', (e) => {
            selectedImageType = e.target.value;
            // Actualizar clase visual
            document.querySelectorAll('.image-type-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            e.target.closest('.image-type-option').classList.add('selected');
            
            // Limpiar selección previa
            clearImageSelection();
        });
    });

    // Click en zona de upload
    uploadZone.addEventListener('click', () => {
        fileInput.click();
    });

    // Drag & Drop
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleImageFile(e.dataTransfer.files[0]);
        }
    });

    // Selección de archivo
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleImageFile(e.target.files[0]);
        }
    });

    // Botón de subir
    if (uploadBtn) {
        uploadBtn.addEventListener('click', uploadImage);
    }
}

function handleImageFile(file) {
    // Validar que sea imagen
    if (!file.type.startsWith('image/')) {
        showToast('Solo se permiten archivos de imagen', 'error');
        return;
    }

    // Validar tamaño (5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('La imagen no puede superar 5MB', 'error');
        return;
    }

    selectedImageFile = file;

    // Mostrar preview
    const reader = new FileReader();
    reader.onload = (e) => {
        const previewImg = document.getElementById('imagePreviewImg');
        const previewContainer = document.getElementById('imagePreviewContainer');
        const uploadBtn = document.getElementById('uploadImageBtn');

        if (previewImg) previewImg.src = e.target.result;
        if (previewContainer) previewContainer.style.display = 'block';
        if (uploadBtn) uploadBtn.disabled = false;
    };
    reader.readAsDataURL(file);
}

function clearImageSelection() {
    selectedImageFile = null;
    const previewContainer = document.getElementById('imagePreviewContainer');
    const uploadBtn = document.getElementById('uploadImageBtn');
    const fileInput = document.getElementById('imageFileInput');

    if (previewContainer) previewContainer.style.display = 'none';
    if (uploadBtn) uploadBtn.disabled = true;
    if (fileInput) fileInput.value = '';
}

async function uploadImage() {
    if (!selectedImageFile) {
        showToast('Selecciona un archivo primero', 'error');
        return;
    }

    if (!isAuthenticated) {
        showToast('No autorizado', 'error');
        logout();
        return;
    }

    const uploadBtn = document.getElementById('uploadImageBtn');
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Subiendo...';

    const formData = new FormData();
    formData.append('image', selectedImageFile);
    formData.append('type', selectedImageType);

    try {
        const response = await fetch('/api/images', {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            const typeNames = {
                logo: 'Logo',
                pastores: 'Foto de Pastores'
            };
            showToast(`${typeNames[selectedImageType]} subido correctamente`, 'success');

            // Refrescar preview actual con cache-bust
            const timestamp = Date.now();
            const previewId = selectedImageType === 'logo' ? 'currentLogoPreview' : 'currentPastoresPreview';
            const previewImg = document.getElementById(previewId);
            if (previewImg) {
                const newSrc = selectedImageType === 'logo' 
                    ? `icons/logo.png?t=${timestamp}` 
                    : `icons/pastores.jpg?t=${timestamp}`;
                previewImg.src = newSrc;
                previewImg.style.display = 'block';
            }

            // Limpiar selección
            clearImageSelection();
        } else {
            showToast(data.error || 'Error al subir imagen', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error al subir la imagen', 'error');
    } finally {
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Subir Imagen';
    }
}
