const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Configuración
const { AUDIOS_DIR, ICONS_DIR } = require('./server/config');
const { getDevotionals, getConfig } = require('./server/storage');
const { logActivity } = require('./server/logs');

// Rutas
const adminRoutes = require('./server/routes/admin');
const audiosRoutes = require('./server/routes/audios');
const configRoutes = require('./server/routes/config');
const notificationsRoutes = require('./server/routes/notifications');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware básico
app.use(cors());
app.use(express.json());

// ============ Headers de Seguridad ============
app.use((req, res, next) => {
    res.removeHeader('X-Powered-By');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    if (req.url.startsWith('/admin')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
    }
    
    next();
});

// Logger de peticiones
app.use((req, res, next) => {
    console.log(`📡 ${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Bloquear acceso a audios futuros
app.use('/audios', (req, res, next) => {
    const match = req.url.match(/(\d{4}-\d{2}-\d{2})\.mp3/);
    if (match) {
        const dateStr = match[1];
        const today = new Date().toISOString().split('T')[0];
        
        if (dateStr > today) {
            console.log(`🚫 Bloqueado acceso a audio futuro: ${dateStr}`);
            return res.status(403).json({
                success: false,
                error: 'Este contenido aún no está disponible'
            });
        }
    }
    next();
});

// ============ Streaming de Audio (iOS compatible) ============
app.get('/audios/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(AUDIOS_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Audio no encontrado' });
    }
    
    // Registrar reproducción
    const range = req.headers.range;
    if (!range || range.startsWith('bytes=0-')) {
        const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
        const devotionalDate = dateMatch ? dateMatch[1] : filename;
        const devotionalsDB = getDevotionals();
        const devotionalInfo = devotionalsDB[devotionalDate] || {};
        logActivity('PLAY_DEVOTIONAL', {
            date: devotionalDate,
            title: devotionalInfo.title || 'Sin título',
            filename
        }, req);
    }
    
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;
        
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        res.setHeader('Content-Length', chunkSize);
        
        fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
        res.setHeader('Content-Length', fileSize);
        fs.createReadStream(filePath).pipe(res);
    }
});

// ============ Iconos PWA ============
const ICON_BASE64 = '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';

app.get('/icons/icon-192.png', (req, res) => {
    const img = Buffer.from(ICON_BASE64, 'base64');
    res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': img.length });
    res.end(img);
});

app.get('/icons/icon-512.png', (req, res) => {
    const img = Buffer.from(ICON_BASE64, 'base64');
    res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': img.length });
    res.end(img);
});

app.get('/icons/icon-96.png', (req, res) => {
    const img = Buffer.from(ICON_BASE64, 'base64');
    res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': img.length });
    res.end(img);
});

// Archivos estáticos
app.use(express.static(__dirname));

// ============ Rutas API ============
app.use('/api/admin', adminRoutes);
app.use('/api/audios', audiosRoutes);
app.use('/api/config', configRoutes);
app.use('/api/notifications', notificationsRoutes);

// Rutas adicionales de config en raíz
app.get('/api/server-time', (req, res) => configRoutes.handle ? configRoutes.handle(req, res) : res.redirect('/api/config/server-time'));
app.get('/api/available-dates', (req, res) => {
    const { getTodayGMT } = require('./server/routes/config');
    const fs = require('fs');
    
    try {
        const files = fs.readdirSync(AUDIOS_DIR);
        const today = getTodayGMT();
        
        const availableDates = files
            .filter(file => {
                const match = file.match(/^(\d{4}-\d{2}-\d{2})\.mp3$/);
                if (!match) return false;
                return match[1] <= today;
            })
            .map(file => file.match(/^(\d{4}-\d{2}-\d{2})\.mp3$/)[1])
            .sort((a, b) => b.localeCompare(a));
        
        res.json({ success: true, dates: availableDates, count: availableDates.length, today });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});

// Rutas de devotionals en raíz
app.get('/api/devotionals', (req, res) => {
    const devotionalsDB = getDevotionals();
    const devotionals = Object.entries(devotionalsDB).map(([date, data]) => ({
        date,
        ...data
    })).sort((a, b) => b.date.localeCompare(a.date));
    
    res.json({ success: true, data: devotionals, count: devotionals.length });
});

app.get('/api/devotionals/:date', (req, res) => {
    const { date } = req.params;
    const devotionalsDB = getDevotionals();
    const devotional = devotionalsDB[date];
    
    if (devotional) {
        res.json({
            success: true,
            data: { date, ...devotional }
        });
    } else {
        res.json({ success: true, data: null });
    }
});

// POST /api/track-play
app.post('/api/track-play', async (req, res) => {
    const { date, title } = req.body;
    if (!date) return res.json({ success: false, error: 'Fecha requerida' });
    await logActivity('PLAY_DEVOTIONAL', { date, title: title || 'Sin título' }, req);
    res.json({ success: true });
});

// Manejo de errores
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    const config = getConfig();
    const gmtOffset = config.gmtOffset || 0;
    const now = new Date();
    const localTime = new Date(now.getTime() + (gmtOffset * 60 * 60 * 1000));
    const todayStr = localTime.toISOString().split('T')[0];
    
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🎵 Servidor de Devocionales iniciado                       ║
║                                                              ║
║   📌 Local:    http://localhost:${PORT}                         ║
║   📁 Audios:   ${AUDIOS_DIR}
║                                                              ║
║   Endpoints disponibles:                                     ║
║   GET    /api/audios        - Listar audios                  ║
║   GET    /api/audios/:date  - Verificar audio por fecha      ║
║   POST   /api/audios        - Subir audio                    ║
║   DELETE /api/audios/:date  - Eliminar audio                 ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

📅 Servidor iniciado. Fecha local (GMT${gmtOffset >= 0 ? '+' : ''}${gmtOffset}): ${todayStr}
    `);
});
