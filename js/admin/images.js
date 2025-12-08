/**
 * Gestión de Imágenes - Admin Panel
 * 3 campos separados: Logo, Icono, Pastores
 */

// Archivos seleccionados para cada tipo
let selectedFiles = {
    logo: null,
    icon: null,
    pastores: null
};

function initImageUpload() {
    // Configurar cada input de archivo
    setupImageInput('logo', 'logoFileInput', 'logoFileName', 'logoPreviewContainer', 'logoPreviewImg', 'uploadLogoBtn');
    setupImageInput('icon', 'iconFileInput', 'iconFileName', 'iconPreviewContainer', 'iconPreviewImg', 'uploadIconBtn');
    setupImageInput('pastores', 'pastoresFileInput', 'pastoresFileName', 'pastoresPreviewContainer', 'pastoresPreviewImg', 'uploadPastoresBtn');
}

function setupImageInput(type, inputId, fileNameId, previewContainerId, previewImgId, uploadBtnId) {
    const fileInput = document.getElementById(inputId);
    
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleImageSelect(type, e.target.files[0], fileNameId, previewContainerId, previewImgId, uploadBtnId);
            }
        });
    }
}

function handleImageSelect(type, file, fileNameId, previewContainerId, previewImgId, uploadBtnId) {
    // Validar tamaño (5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('La imagen no puede superar 5MB', 'error');
        return;
    }

    // Validar formato para iconos (solo PNG)
    if (type === 'icon' && !file.type.includes('png')) {
        showToast('El icono debe ser formato PNG', 'error');
        return;
    }

    // Guardar archivo seleccionado
    selectedFiles[type] = file;

    // Mostrar nombre final al que será guardado
    const finalNames = {
        logo: 'logo.png',
        icon: 'icon-192.png / icon-512.png',
        pastores: 'pastores.jpg'
    };
    document.getElementById(fileNameId).textContent = `${file.name} → ${finalNames[type]}`;

    // Mostrar preview
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById(previewImgId).src = e.target.result;
        document.getElementById(previewContainerId).style.display = 'block';
        document.getElementById(uploadBtnId).disabled = false;
    };
    reader.readAsDataURL(file);
}

async function uploadSpecificImage(type) {
    const file = selectedFiles[type];
    if (!file) {
        showToast('Selecciona un archivo primero', 'error');
        return;
    }

    if (!isAuthenticated) { 
        showToast('No autorizado', 'error'); 
        logout(); 
        return; 
    }

    // Elementos según el tipo
    const elements = {
        logo: {
            btn: 'uploadLogoBtn',
            preview: 'logoPreviewContainer',
            input: 'logoFileInput',
            fileName: 'logoFileName',
            currentImg: 'currentLogoImg'
        },
        icon: {
            btn: 'uploadIconBtn',
            preview: 'iconPreviewContainer',
            input: 'iconFileInput',
            fileName: 'iconFileName',
            currentImg: 'currentIconImg'
        },
        pastores: {
            btn: 'uploadPastoresBtn',
            preview: 'pastoresPreviewContainer',
            input: 'pastoresFileInput',
            fileName: 'pastoresFileName',
            currentImg: 'currentPastoresImg'
        }
    };

    const elem = elements[type];
    const uploadBtn = document.getElementById(elem.btn);

    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Subiendo...';

    const formData = new FormData();
    formData.append('image', file);
    formData.append('type', type);

    try {
        const response = await fetch('/api/images', {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            showToast(`${type === 'logo' ? 'Logo' : type === 'icon' ? 'Icono' : 'Foto'} subido correctamente`, 'success');
            
            // Limpiar selección
            selectedFiles[type] = null;
            document.getElementById(elem.preview).style.display = 'none';
            document.getElementById(elem.input).value = '';
            document.getElementById(elem.fileName).textContent = 'Ningun archivo seleccionado';
            
            // Refrescar imagen actual con cache-bust
            const timestamp = Date.now();
            if (type === 'logo') {
                document.getElementById(elem.currentImg).src = 'icons/logo.png?' + timestamp;
            } else if (type === 'icon') {
                document.getElementById(elem.currentImg).src = 'icons/icon-192.png?' + timestamp;
            } else {
                document.getElementById(elem.currentImg).src = 'icons/pastores.jpg?' + timestamp;
            }
        } else {
            showToast(data.error || 'Error al subir imagen', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error al subir la imagen', 'error');
    } finally {
        uploadBtn.disabled = true;  // Se deshabilita hasta seleccionar nuevo archivo
        uploadBtn.textContent = type === 'logo' ? 'Subir Logo' : type === 'icon' ? 'Subir Icono' : 'Subir Foto';
    }
}
