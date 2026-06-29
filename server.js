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
app.disable('x-powered-by');

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

    if (!/^\d{4}-\d{2}-\d{2}\.mp3$/.test(filename)) {
        return res.status(400).json({ error: 'Nombre de audio no válido' });
    }

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
        const requestedEnd = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const end = Math.min(requestedEnd, fileSize - 1);

        if (!range.startsWith('bytes=') ||
            !Number.isInteger(start) ||
            !Number.isInteger(requestedEnd) ||
            start < 0 ||
            start >= fileSize ||
            end < start) {
            res.setHeader('Content-Range', `bytes */${fileSize}`);
            return res.status(416).end();
        }

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
    
    res.status(404).json({ error: 'Icono no encontrado' });
});

// Servir APK con MIME type correcto
app.get('/apk/:filename', (req, res) => {
    const filename = path.basename(req.params.filename);
    if (!filename.endsWith('.apk')) return res.status(400).json({ error: 'Archivo no válido' });
    const apkPath = path.join(__dirname, 'apk', filename);
    if (!fs.existsSync(apkPath)) return res.status(404).json({ error: 'APK no encontrado' });
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    fs.createReadStream(apkPath).pipe(res);
});

// Ruta corta para compartir la descarga de Android
app.get('/app', (req, res) => {
    res.redirect(302, '/descargar-app.html');
});

// Info del APK (versión, tamaño, fecha)
app.get('/api/apk-info', (req, res) => {
    const metadataPath = path.join(__dirname, 'apk', 'version.json');
    let metadata = {
        version: '1.1.6',
        versionCode: 6,
        file: 'spiritfly.apk',
        minAndroid: '7.0',
        notes: ''
    };

    if (fs.existsSync(metadataPath)) {
        try {
            metadata = { ...metadata, ...JSON.parse(fs.readFileSync(metadataPath, 'utf8')) };
        } catch (error) {
            console.warn('No se pudo leer apk/version.json:', error.message);
        }
    }

    const apkFile = path.basename(metadata.file || 'spiritfly.apk');
    const apkPath = path.join(__dirname, 'apk', apkFile);
    if (!fs.existsSync(apkPath)) return res.status(404).json({ error: 'APK no disponible' });
    const stat = fs.statSync(apkPath);
    const sizeMB = (stat.size / (1024 * 1024)).toFixed(1);
    const updated = stat.mtime.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    res.json({
        ...metadata,
        file: apkFile,
        url: `/apk/${apkFile}`,
        pageUrl: '/descargar-app.html',
        shortUrl: '/app',
        size: `${sizeMB} MB`,
        sizeBytes: stat.size,
        updated
    });
});

// Impedir que el servidor estático publique código, secretos y datos internos.
const privatePrefixes = [
    '/.claude/',
    '/.git/',
    '/.github/',
    '/android/',
    '/data/',
    '/node_modules/',
    '/server/'
];
const privateRootFiles = new Set([
    '/.dockerignore',
    '/.env',
    '/.gitignore',
    '/build-apk.ps1',
    '/capacitor.config.ts',
    '/docker-compose.yml',
    '/Dockerfile',
    '/merge_devotionals.py',
    '/nginx_riofy.conf',
    '/package-lock.json',
    '/package.json',
    '/README.md',
    '/server.js',
    '/spiritfly_nginx.conf'
]);

app.use((req, res, next) => {
    const requestPath = req.path;
    const isPrivate = privateRootFiles.has(requestPath) ||
        privatePrefixes.some(prefix => requestPath.startsWith(prefix));

    if (isPrivate) {
        return res.status(404).end();
    }

    next();
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
