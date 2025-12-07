/**
 * Configuración global del Admin Panel
 */

const CONFIG = {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedTypes: ['audio/mpeg', 'audio/mp3'],
    allowedExtensions: ['.mp3'],
    apiEndpoint: '/api/audios',
    bibleApiBase: 'https://bolls.life',
    storageLimitMB: 1024 // 1GB
};

// Estado global
let selectedFile = null;
let audioFiles = [];
let fileToDelete = null;
let fileToEdit = null;
let authToken = localStorage.getItem('adminToken') || null;
let selectedVerse = null;
let selectedVerseText = null;
let selectedImageFile = null;
let selectedImageType = 'logo';
let sessionExpiry = null;
let sessionInterval = null;
let sessionTimeoutMs = 20 * 60 * 1000; // Default 20 minutos
