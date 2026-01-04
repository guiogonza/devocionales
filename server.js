const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
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
const publicRoutes = require('./server/routes/public');
const imagesRoutes = require('./server/routes/images');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware basico - Limite 50MB (el control real lo hace Multer dinamicamente)
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());

// Parser JSON solo para rutas que NO son upload de archivos
app.use((req, res, next) => {
    // Excluir /api/audios POST (uploads multipart/form-data)
    if (req.path === '/api/audios' && req.method === 'POST') {
        return next();
    }
    express.json({ limit: '50mb' })(req, res, next);
});

app.use((req, res, next) => {
    if (req.path === '/api/audios' && req.method === 'POST') {
        return next();
    }
    express.urlencoded({ limit: '50mb', extended: true })(req, res, next);
});

// ============ Headers de Seguridad ============
app.use((req, res, next) => {
    res.removeHeader('X-Powered-By');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // NUNCA cachear sw.js - crítico para actualizaciones
    if (req.url === '/sw.js') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    
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
// Ruta para iconos - sirve tanto PWA como custom (logo, pastores)
app.get('/icons/:icon', (req, res) => {
    const iconName = req.params.icon;
    const iconPath = path.join(ICONS_DIR, iconName);
    
    // Primero intentar servir desde el directorio de iconos
    if (fs.existsSync(iconPath)) {
        const ext = path.extname(iconName).toLowerCase();
        const mimeTypes = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webp': 'image/webp'
        };
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        
        // Logo, pastores e iconos PWA editables: no cachear
        const noCacheIcons = ['logo.png', 'pastores.jpg', 'icon-192.png', 'icon-512.png'];
        if (noCacheIcons.includes(iconName)) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('ETag', Date.now().toString()); // ETag único para cada request
        } else {
            res.setHeader('Cache-Control', 'public, max-age=3600');
        }
        return fs.createReadStream(iconPath).pipe(res);
    }
    
    // Fallback: si no existe el archivo y es icono PWA, servir desde base64
    const pwaIcons = ['icon-192.png', 'icon-512.png', 'icon-96.png'];
    if (pwaIcons.includes(iconName)) {
        const img = Buffer.from(ICON_BASE64, 'base64');
        res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': img.length });
        return res.end(img);
    }
    
    res.status(404).json({ error: 'Icono no encontrado' });
});

// Archivos estáticos
app.use(express.static(__dirname));

// ============ Rutas API ============
app.use('/api/admin', adminRoutes);
app.use('/api/audios', audiosRoutes);
app.use('/api/config', configRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/images', imagesRoutes);
app.use('/api', publicRoutes); // Rutas públicas (server-time, available-dates, devotionals, track-play)

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
