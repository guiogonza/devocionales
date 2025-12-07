/**
 * Inicialización y Event Listeners - Admin Panel
 */

// ============ Sidebar Navigation ============

function initSidebarNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-section]');
    const mobileToggle = document.getElementById('mobileToggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            document.querySelectorAll('.content-section').forEach(sec => {
                sec.classList.remove('active');
            });
            document.getElementById(`section-${section}`).classList.add('active');

            if (window.innerWidth <= 1024) {
                sidebar.classList.remove('open');
                sidebarBackdrop.classList.remove('show');
            }
        });
    });

    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            sidebarBackdrop.classList.toggle('show');
        });
    }

    if (sidebarBackdrop) {
        sidebarBackdrop.addEventListener('click', () => {
            sidebar.classList.remove('open');
            sidebarBackdrop.classList.remove('show');
        });
    }
}

// ============ Event Listeners ============

function initializeEvents() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('usernameInput').value;
            const password = document.getElementById('passwordInput').value;
            login(username, password);
        });
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // Audio upload zone
    const dropZone = document.getElementById('audioUploadZone');
    const fileInput = document.getElementById('fileInput');
    const removeFileBtn = document.getElementById('removeFileBtn');

    console.log('DropZone encontrado:', !!dropZone);
    console.log('FileInput encontrado:', !!fileInput);

    if (dropZone && fileInput) {
        dropZone.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
            }
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                handleFileSelect(e.dataTransfer.files[0]);
            }
        });
    }

    // Remove file button
    if (removeFileBtn) {
        removeFileBtn.addEventListener('click', removeSelectedFile);
    }

    // Form validation
    const audioDate = document.getElementById('audioDate');
    const devotionalTitle = document.getElementById('devotionalTitle');
    
    if (audioDate) {
        audioDate.addEventListener('change', validateUploadForm);
    }
    if (devotionalTitle) {
        devotionalTitle.addEventListener('input', validateUploadForm);
    }

    // Upload button
    const uploadBtn = document.getElementById('uploadBtn');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', uploadFile);
    }

    // Delete modal
    const cancelDelete = document.getElementById('cancelDelete');
    const confirmDelete = document.getElementById('confirmDelete');
    if (cancelDelete) cancelDelete.addEventListener('click', hideDeleteModal);
    if (confirmDelete) confirmDelete.addEventListener('click', deleteAudio);

    // Edit modal
    const cancelEdit = document.getElementById('cancelEdit');
    const confirmEdit = document.getElementById('confirmEdit');
    if (cancelEdit) cancelEdit.addEventListener('click', hideEditModal);
    if (confirmEdit) confirmEdit.addEventListener('click', saveEdit);

    // Close modals on backdrop click
    const deleteModal = document.getElementById('deleteModal');
    const editModal = document.getElementById('editModal');
    
    if (deleteModal) {
        deleteModal.addEventListener('click', (e) => {
            if (e.target.id === 'deleteModal') hideDeleteModal();
        });
    }
    
    if (editModal) {
        editModal.addEventListener('click', (e) => {
            if (e.target.id === 'editModal') hideEditModal();
        });
    }

    // Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideDeleteModal();
            hideEditModal();
        }
    });

    // Notifications
    const sendNotifBtn = document.getElementById('sendNotifBtn');
    if (sendNotifBtn) {
        sendNotifBtn.addEventListener('click', sendNotification);
    }
}

// ============ Header Clock ============

function initHeaderClock() {
    function updateClock() {
        const clockEl = document.getElementById('headerClock');
        if (clockEl) {
            const now = new Date();
            clockEl.textContent = now.toLocaleTimeString('es-ES', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
            });
        }
    }
    updateClock();
    setInterval(updateClock, 1000);
}

function updateHeaderUsername() {
    const usernameEl = document.getElementById('headerUsername');
    if (usernameEl) {
        const username = localStorage.getItem('adminUsername') || 'Admin';
        usernameEl.textContent = username;
    }
}

// ============ Initialization ============

document.addEventListener('DOMContentLoaded', () => {
    initSidebarNavigation();
    initializeEvents();
    initImageUpload();
    initTimezoneConfig();
    initVerseSearch();
    initHeaderClock();
    checkAuth();
});

// Expose global functions for onclick handlers
window.showDeleteModal = showDeleteModal;
window.showEditModal = showEditModal;
