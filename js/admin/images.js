/**
 * GestiÃ³n de ImÃ¡genes - Admin Panel
 */

function initImageUpload() {
    const imageUploadZone = document.getElementById('imageUploadZone');
    const imageFileInput = document.getElementById('imageFileInput');
    const imageTypeOptions = document.querySelectorAll('.image-type-option');

    if (imageUploadZone) {
        imageUploadZone.addEventListener('click', () => imageFileInput.click());
    }

    if (imageFileInput) {
        imageFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleImageSelect(e.target.files[0]);
            }
        });
    }

    imageTypeOptions.forEach(option => {
        option.addEventListener('click', () => {
            imageTypeOptions.forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
            selectedImageType = option.querySelector('input').value;
        });
    });

    const uploadImageBtn = document.getElementById('uploadImageBtn');
    if (uploadImageBtn) {
        uploadImageBtn.addEventListener('click', uploadImage);
    }
}

function handleImageSelect(file) {
    if (file.size > 5 * 1024 * 1024) {
        showToast('La imagen no puede superar 5MB', 'error');
        return;
    }

    selectedImageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('imagePreviewImg').src = e.target.result;
        document.getElementById('imagePreviewContainer').style.display = 'block';
        document.getElementById('uploadImageBtn').disabled = false;
    };
    reader.readAsDataURL(file);
}

async function uploadImage() {
    if (!selectedImageFile) return;

    if (!isAuthenticated) { showToast('No autorizado', 'error'); logout(); return; }

    const formData = new FormData();
    formData.append('image', selectedImageFile);
    formData.append('type', selectedImageType);

    const uploadBtn = document.getElementById('uploadImageBtn');
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Subiendo...';

    try {
        const response = await fetch('/api/images', {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            showToast('Imagen subida correctamente', 'success');
            selectedImageFile = null;
            document.getElementById('imagePreviewContainer').style.display = 'none';
            document.getElementById('imageFileInput').value = '';
            
            // Recargar preview
            if (selectedImageType === 'logo') {
                document.getElementById('currentLogoPreview').src = 'icons/icon-192.png?' + Date.now();
            } else {
                document.getElementById('currentPastoresPreview').src = 'icons/pastores.jpg?' + Date.now();
            }
        } else {
            showToast(data.error || 'Error al subir imagen', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error al subir la imagen', 'error');
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Subir Imagen';
    }
}
