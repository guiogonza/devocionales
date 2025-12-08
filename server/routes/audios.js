const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../auth');
const { AUDIOS_DIR } = require('../config');
const { getDevotionals, saveDevotionals } = require('../storage');
const { logAudit, logActivity } = require('../logs');

// ConfiguraciÃ³n de Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, AUDIOS_DIR),
    filename: (req, file, cb) => {
        const tempName = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`;
        cb(null, tempName);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'audio/mpeg' || file.mimetype === 'audio/mp3') {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten archivos MP3'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 20 * 1024 * 1024 }
});

// Helpers
function isValidDate(dateStr) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    return date.getFullYear() === year &&
           date.getMonth() === month - 1 &&
           date.getDate() === day;
}

function getAudiosList() {
    const files = fs.readdirSync(AUDIOS_DIR);
    const audios = [];
    const devotionalsDB = getDevotionals();
    
    files.forEach(file => {
        if (file.endsWith('.mp3')) {
            const filePath = path.join(AUDIOS_DIR, file);
            const stats = fs.statSync(filePath);
            const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})\.mp3$/);
            
            if (dateMatch) {
                const date = dateMatch[1];
                const devotional = devotionalsDB[date];
                
                audios.push({
                    date,
                    filename: file,
                    size: stats.size,
                    uploadedAt: stats.mtime.toISOString(),
                    title: devotional?.title || null,
                    verseReference: devotional?.verseReference || null,
                    verseText: devotional?.verseText || null
                });
            }
        }
    });
    
    audios.sort((a, b) => b.date.localeCompare(a.date));
    return audios;
}

// GET /api/audios
router.get('/', (req, res) => {
    try {
        const audios = getAudiosList();
        res.json({ success: true, data: audios, count: audios.length });
    } catch (error) {
        console.error('Error al listar audios:', error);
        res.status(500).json({ success: false, error: 'Error al obtener la lista de audios' });
    }
});

// GET /api/audios/:date
router.get('/:date', (req, res) => {
    const { date } = req.params;
    
    if (!isValidDate(date)) {
        return res.status(400).json({ success: false, error: 'Formato de fecha invÃ¡lido' });
    }
    
    const filename = `${date}.mp3`;
    const filePath = path.join(AUDIOS_DIR, filename);
    
    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const devotionalsDB = getDevotionals();
        const devotional = devotionalsDB[date];
        
        res.json({
            success: true,
            exists: true,
            data: {
                date,
                filename,
                size: stats.size,
                uploadedAt: stats.mtime.toISOString(),
                title: devotional?.title || null,
                verseReference: devotional?.verseReference || null,
                verseText: devotional?.verseText || null
            }
        });
    } else {
        res.json({ success: true, exists: false });
    }
});

// POST /api/audios
router.post('/', requireAuth, upload.single('audio'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No se recibiÃ³ ningÃºn archivo' });
    }
    
    const { title, verseReference, verseText, replaceExisting } = req.body;
    const originalName = req.file.originalname;
    const dateMatch = originalName.match(/^(\d{4}-\d{2}-\d{2})\.mp3$/);
    
    if (!dateMatch) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ success: false, error: 'El archivo debe tener formato YYYY-MM-DD.mp3' });
    }
    
    const date = dateMatch[1];
    
    if (!isValidDate(date)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ success: false, error: 'Fecha invÃ¡lida en el nombre del archivo' });
    }
    
    // Validar que no sea mÃ¡s de 30 dÃ­as en el futuro
    const today = new Date();
    const audioDate = new Date(date);
    const diffDays = Math.ceil((audioDate - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays > 30) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ success: false, error: 'No se pueden subir audios para mÃ¡s de 30 dÃ­as en el futuro' });
    }
    
    const finalPath = path.join(AUDIOS_DIR, `${date}.mp3`);
    
    // Verificar si ya existe
    if (fs.existsSync(finalPath) && replaceExisting !== 'true') {
        fs.unlinkSync(req.file.path);
        return res.status(409).json({ success: false, error: 'Ya existe un audio para esta fecha' });
    }
    
    // Si existe y replaceExisting es true, eliminar el anterior
    if (fs.existsSync(finalPath)) {
        fs.unlinkSync(finalPath);
    }
    
    // Renombrar archivo
    fs.renameSync(req.file.path, finalPath);
    
    // Guardar metadata
    const devotionalsDB = getDevotionals();
    devotionalsDB[date] = {
        title: title || '',
        verseReference: verseReference || '',
        verseText: verseText || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    saveDevotionals(devotionalsDB);
    
    logAudit('AUDIO_UPLOADED', { date, title, verseReference }, req);
    console.log('âœ… Audio subido:', date);
    
    res.json({
        success: true,
        message: 'Audio subido correctamente',
        data: { date, filename: `${date}.mp3`, title, verseReference }
    });
});

// DELETE /api/audios/:date
router.delete('/:date', requireAuth, (req, res) => {
    const { date } = req.params;
    
    if (!isValidDate(date)) {
        return res.status(400).json({ success: false, error: 'Formato de fecha invÃ¡lido' });
    }
    
    const filePath = path.join(AUDIOS_DIR, `${date}.mp3`);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: 'Audio no encontrado' });
    }
    
    fs.unlinkSync(filePath);
    
    // Eliminar metadata
    const devotionalsDB = getDevotionals();
    if (devotionalsDB[date]) {
        delete devotionalsDB[date];
        saveDevotionals(devotionalsDB);
    }
    
    logAudit('AUDIO_DELETED', { date }, req);
    console.log('ðŸ—‘ï¸ Audio eliminado:', date);
    
    res.json({ success: true, message: 'Audio eliminado correctamente' });
});

// POST /api/track-play
router.post('/track-play', async (req, res) => {
    const { date, title } = req.body;
    
    if (!date) {
        return res.json({ success: false, error: 'Fecha requerida' });
    }
    
    await logActivity('PLAY_DEVOTIONAL', { date, title: title || 'Sin tÃ­tulo' }, req);
    res.json({ success: true });
});

module.exports = router;
module.exports.getAudiosList = getAudiosList;
module.exports.isValidDate = isValidDate;
