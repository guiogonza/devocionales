const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const webpush = require('web-push');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ Configuración VAPID para Push Notifications ============
const VAPID_PUBLIC_KEY = 'BDMM2TnLH-5Z3ucGsLZf66-ISqBrDhRdj_z7UkFLIjPfM3pwYqwNvruPuBBTtCD1NARYEEK2dI8lDZLVn3upvd4';
const VAPID_PRIVATE_KEY = 'c3YCxPW4YAMCwh5bF63PNUvUlwv7uGoXhWR25L2PV9g';

webpush.setVapidDetails(
    'mailto:admin@rioiglesia.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

// Directorios
const AUDIOS_DIR = path.join(__dirname, 'audios');
const ICONS_DIR = path.join(__dirname, 'icons');

// ============ Suscripciones Push (persistentes) ============
const SUBSCRIPTIONS_FILE = path.join(__dirname, 'data', 'subscriptions.json');

// Cargar suscripciones desde archivo
function loadSubscriptions() {
    try {
        if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
            const data = fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error al cargar suscripciones:', error);
    }
    return [];
}

// Guardar suscripciones a archivo
function saveSubscriptions() {
    try {
        fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(pushSubscriptions, null, 2), 'utf8');
    } catch (error) {
        console.error('Error al guardar suscripciones:', error);
    }
}

// Almacén de suscripciones (persistentes)
let pushSubscriptions = loadSubscriptions();

// ============ Base de datos de devocionales ============
// Almacena versículos asociados a cada fecha
const DEVOTIONALS_FILE = path.join(__dirname, 'data', 'devotionals.json');

// Asegurar que existe el directorio de datos
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Cargar devocionales desde archivo
function loadDevotionals() {
    try {
        if (fs.existsSync(DEVOTIONALS_FILE)) {
            const data = fs.readFileSync(DEVOTIONALS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error al cargar devocionales:', error);
    }
    return {};
}

// Guardar devocionales a archivo
function saveDevotionals(devotionals) {
    try {
        fs.writeFileSync(DEVOTIONALS_FILE, JSON.stringify(devotionals, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error al guardar devocionales:', error);
        return false;
    }
}

// Base de datos en memoria
let devotionalsDB = loadDevotionals();

// ============ Configuración de Zona Horaria ============
const CONFIG_FILE = path.join(__dirname, 'data', 'config.json');

// Cargar configuración
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error al cargar configuración:', error);
    }
    return { gmtOffset: 0 }; // GMT-0 por defecto
}

// Guardar configuración
function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error al guardar configuración:', error);
        return false;
    }
}

let appConfig = loadConfig();

// ============ Configuración de Admin ============
// En producción, usar variables de entorno y hash seguro
const ADMIN_CREDENTIALS = {
    username: process.env.ADMIN_USER || 'admin',
    password: process.env.ADMIN_PASS || 'rio2024'
};

// Archivo para persistir sesiones
const SESSIONS_FILE = path.join(__dirname, 'data', 'sessions.json');

// Cargar sesiones desde archivo
function loadSessions() {
    try {
        if (fs.existsSync(SESSIONS_FILE)) {
            const data = fs.readFileSync(SESSIONS_FILE, 'utf8');
            const sessions = JSON.parse(data);
            // Filtrar sesiones expiradas (24 horas)
            const validSessions = {};
            const now = Date.now();
            for (const [token, session] of Object.entries(sessions)) {
                if (now - session.createdAt < 24 * 60 * 60 * 1000) {
                    validSessions[token] = session;
                }
            }
            return new Map(Object.entries(validSessions));
        }
    } catch (error) {
        console.error('Error al cargar sesiones:', error);
    }
    return new Map();
}

// Guardar sesiones a archivo
function saveSessions() {
    try {
        const sessionsObj = Object.fromEntries(activeSessions);
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessionsObj, null, 2), 'utf8');
    } catch (error) {
        console.error('Error al guardar sesiones:', error);
    }
}

// Tokens de sesión activos (persistidos)
const activeSessions = loadSessions();

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function validateToken(token) {
    if (!token) return false;
    const session = activeSessions.get(token);
    if (!session) return false;
    // Token válido por 24 horas
    if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
        activeSessions.delete(token);
        saveSessions();
        return false;
    }
    return true;
}

// Middleware de autenticación para rutas admin
function requireAuth(req, res, next) {
    const token = req.headers['x-admin-token'];
    if (!validateToken(token)) {
        return res.status(401).json({ success: false, error: 'No autorizado' });
    }
    next();
}

// Asegurar que existe el directorio de audios
if (!fs.existsSync(AUDIOS_DIR)) {
    fs.mkdirSync(AUDIOS_DIR, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());

// Logger de todas las peticiones
app.use((req, res, next) => {
    console.log(`📨 ${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Middleware para bloquear acceso a audios de fechas futuras
app.use('/audios', (req, res, next) => {
    // Extraer fecha del nombre del archivo (YYYY-MM-DD.mp3)
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

// ============ Streaming de Audio con soporte Range (para iOS) ============
app.get('/audios/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(AUDIOS_DIR, filename);
    
    // Verificar que el archivo existe
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Audio no encontrado' });
    }
    
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    // Headers comunes para iOS
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    if (range) {
        // Streaming con Range (iOS lo necesita)
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;
        
        console.log(`🎵 Streaming ${filename}: bytes ${start}-${end}/${fileSize}`);
        
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        res.setHeader('Content-Length', chunkSize);
        
        const stream = fs.createReadStream(filePath, { start, end });
        stream.pipe(res);
    } else {
        // Descarga completa
        console.log(`🎵 Sirviendo ${filename} completo: ${fileSize} bytes`);
        res.setHeader('Content-Length', fileSize);
        fs.createReadStream(filePath).pipe(res);
    }
});

app.use(express.static(__dirname));

// ============ Iconos PWA ============
const ICON_BASE64 = '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';

app.get('/icons/icon-192.png', (req, res) => {
    const img = Buffer.from(ICON_BASE64, 'base64');
    res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': img.length
    });
    res.end(img);
});

app.get('/icons/icon-512.png', (req, res) => {
    const img = Buffer.from(ICON_BASE64, 'base64');
    res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': img.length
    });
    res.end(img);
});

app.get('/icons/icon-96.png', (req, res) => {
    const img = Buffer.from(ICON_BASE64, 'base64');
    res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': img.length
    });
    res.end(img);
});

// Configuración de Multer para subida de archivos
// Usar nombre temporal y renombrar después de recibir la fecha
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, AUDIOS_DIR);
    },
    filename: (req, file, cb) => {
        // Usar nombre temporal único
        const tempName = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`;
        cb(null, tempName);
    }
});

const fileFilter = (req, file, cb) => {
    // Validar tipo de archivo
    console.log('📋 Tipo de archivo:', file.mimetype);
    if (file.mimetype === 'audio/mpeg' || file.mimetype === 'audio/mp3') {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten archivos MP3'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB máximo
    }
});

// Función para validar formato de fecha
function isValidDate(dateStr) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    return date.getFullYear() === year &&
           date.getMonth() === month - 1 &&
           date.getDate() === day;
}

// Función para obtener lista de audios
function getAudiosList() {
    const files = fs.readdirSync(AUDIOS_DIR);
    const audios = [];
    
    files.forEach(file => {
        if (file.endsWith('.mp3')) {
            const filePath = path.join(AUDIOS_DIR, file);
            const stats = fs.statSync(filePath);
            const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})\.mp3$/);
            
            if (dateMatch) {
                const date = dateMatch[1];
                // Obtener título del devocional si existe
                const devotional = devotionalsDB[date];
                const title = devotional?.title || null;
                
                audios.push({
                    date: date,
                    filename: file,
                    size: stats.size,
                    uploadedAt: stats.mtime.toISOString(),
                    title: title
                });
            }
        }
    });
    
    // Ordenar por fecha descendente
    audios.sort((a, b) => b.date.localeCompare(a.date));
    
    return audios;
}

// ============ API Endpoints ============

// POST /api/admin/login - Iniciar sesión admin
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        const token = generateToken();
        activeSessions.set(token, { createdAt: Date.now() });
        saveSessions();  // Persistir sesión
        console.log('🔐 Admin autenticado correctamente');
        res.json({ success: true, token });
    } else {
        console.log('❌ Intento de login fallido');
        res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
    }
});

// POST /api/admin/logout - Cerrar sesión
app.post('/api/admin/logout', (req, res) => {
    const token = req.headers['x-admin-token'];
    if (token) {
        activeSessions.delete(token);
        saveSessions();  // Persistir cambio
    }
    res.json({ success: true });
});

// GET /api/admin/verify - Verificar si está autenticado
app.get('/api/admin/verify', (req, res) => {
    const token = req.headers['x-admin-token'];
    res.json({ success: true, authenticated: validateToken(token) });
});

// GET /api/audios - Listar todos los audios (público)
app.get('/api/audios', (req, res) => {
    try {
        const audios = getAudiosList();
        res.json({
            success: true,
            data: audios,
            count: audios.length
        });
    } catch (error) {
        console.error('Error al listar audios:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener la lista de audios'
        });
    }
});

// GET /api/audios/:date - Verificar si existe un audio para una fecha
app.get('/api/audios/:date', (req, res) => {
    const { date } = req.params;
    
    if (!isValidDate(date)) {
        return res.status(400).json({
            success: false,
            error: 'Formato de fecha inválido'
        });
    }
    
    // Bloquear acceso a fechas futuras
    if (isFutureDate(date)) {
        return res.json({
            success: true,
            exists: false,
            restricted: true
        });
    }
    
    const filePath = path.join(AUDIOS_DIR, `${date}.mp3`);
    const exists = fs.existsSync(filePath);
    
    if (exists) {
        const stats = fs.statSync(filePath);
        res.json({
            success: true,
            exists: true,
            data: {
                date: date,
                filename: `${date}.mp3`,
                size: stats.size,
                uploadedAt: stats.mtime.toISOString()
            }
        });
    } else {
        res.json({
            success: true,
            exists: false
        });
    }
});

// POST /api/audios - Subir un nuevo audio (requiere autenticación)
app.post('/api/audios', requireAuth, (req, res) => {
    console.log('📥 Recibiendo petición de subida de audio...');
    
    upload.single('audio')(req, res, (err) => {
        console.log('📦 Procesando archivo...');
        
        if (err) {
            console.error('❌ Error en multer:', err);
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({
                        success: false,
                        error: 'El archivo excede el tamaño máximo de 50MB'
                    });
                }
            }
            return res.status(400).json({
                success: false,
                error: err.message || 'Error al procesar el archivo'
            });
        }
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No se proporcionó ningún archivo'
            });
        }
        
        const date = req.body.date;
        console.log('📅 Fecha recibida:', date);
        console.log('📁 Archivo temporal:', req.file.filename);
        
        // Validar fecha
        if (!date || !isValidDate(date)) {
            // Eliminar archivo temporal
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                error: 'Fecha inválida. Usa el formato YYYY-MM-DD'
            });
        }
        
        // Validar que no sea fecha futura
        const selectedDate = new Date(date);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        
        if (selectedDate > today) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                error: 'No se pueden subir audios para fechas futuras'
            });
        }
        
        // Renombrar archivo temporal al nombre final
        const finalPath = path.join(AUDIOS_DIR, `${date}.mp3`);
        
        try {
            // Si ya existe, eliminarlo primero (sobrescribir)
            if (fs.existsSync(finalPath)) {
                fs.unlinkSync(finalPath);
            }
            
            // Copiar archivo temporal al destino final (más confiable que renameSync en Docker)
            fs.copyFileSync(req.file.path, finalPath);
            
            // Eliminar archivo temporal
            fs.unlinkSync(req.file.path);
            
            console.log('✅ Archivo guardado como:', `${date}.mp3`);
            
            const stats = fs.statSync(finalPath);
            
            res.status(201).json({
                success: true,
                message: 'Audio subido correctamente',
                data: {
                    date: date,
                    filename: `${date}.mp3`,
                    size: stats.size,
                    uploadedAt: new Date().toISOString()
                }
            });
        } catch (renameError) {
            console.error('❌ Error al renombrar archivo:', renameError);
            // Limpiar archivo temporal si existe
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(500).json({
                success: false,
                error: 'Error al guardar el archivo'
            });
        }
    });
});

// DELETE /api/audios/:date - Eliminar un audio y su devocional (requiere autenticación)
app.delete('/api/audios/:date', requireAuth, (req, res) => {
    const { date } = req.params;
    
    if (!isValidDate(date)) {
        return res.status(400).json({
            success: false,
            error: 'Formato de fecha inválido'
        });
    }
    
    const filePath = path.join(AUDIOS_DIR, `${date}.mp3`);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({
            success: false,
            error: 'No existe un audio para esa fecha'
        });
    }
    
    try {
        // Eliminar archivo de audio
        fs.unlinkSync(filePath);
        
        // Eliminar también el devocional asociado (título, versículo, etc.)
        if (devotionalsDB[date]) {
            delete devotionalsDB[date];
            saveDevotionals(devotionalsDB);
            console.log('🗑️ Devocional eliminado para:', date);
        }
        
        res.json({
            success: true,
            message: 'Audio y devocional eliminados correctamente',
            date: date
        });
    } catch (error) {
        console.error('Error al eliminar audio:', error);
        res.status(500).json({
            success: false,
            error: 'Error al eliminar el archivo'
        });
    }
});

// ============ API de Imágenes ============

// Configuración de Multer para imágenes
const imageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, ICONS_DIR);
    },
    filename: (req, file, cb) => {
        const tempName = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`;
        cb(null, tempName);
    }
});

const imageFilter = (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten archivos PNG, JPG o WEBP'), false);
    }
};

const uploadImage = multer({
    storage: imageStorage,
    fileFilter: imageFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB máximo
    }
});

// POST /api/images - Subir imagen (logo o pastores)
app.post('/api/images', requireAuth, (req, res) => {
    console.log('📸 Recibiendo petición de subida de imagen...');
    
    uploadImage.single('image')(req, res, (err) => {
        if (err) {
            console.error('❌ Error en multer:', err);
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({
                        success: false,
                        error: 'La imagen excede el tamaño máximo de 5MB'
                    });
                }
            }
            return res.status(400).json({
                success: false,
                error: err.message || 'Error al procesar la imagen'
            });
        }
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No se proporcionó ninguna imagen'
            });
        }
        
        const imageType = req.body.type; // 'logo' o 'pastores'
        console.log('🖼️ Tipo de imagen:', imageType);
        
        if (!['logo', 'pastores'].includes(imageType)) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                error: 'Tipo de imagen inválido. Debe ser "logo" o "pastores"'
            });
        }
        
        // Determinar extensión y nombre final
        const ext = imageType === 'logo' ? '.png' : '.jpg';
        const finalName = imageType === 'logo' ? 'logo.png' : 'pastores.jpg';
        const finalPath = path.join(ICONS_DIR, finalName);
        
        try {
            // Hacer backup del archivo anterior si existe
            if (fs.existsSync(finalPath)) {
                const backupPath = path.join(ICONS_DIR, `${imageType}_backup_${Date.now()}${ext}`);
                fs.copyFileSync(finalPath, backupPath);
                fs.unlinkSync(finalPath);
            }
            
            // Copiar archivo temporal al destino final
            fs.copyFileSync(req.file.path, finalPath);
            fs.unlinkSync(req.file.path);
            
            console.log('✅ Imagen guardada como:', finalName);
            
            res.status(201).json({
                success: true,
                message: `${imageType === 'logo' ? 'Logo' : 'Imagen de pastores'} actualizado correctamente`,
                data: {
                    type: imageType,
                    filename: finalName,
                    path: `/icons/${finalName}`,
                    updatedAt: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('❌ Error al guardar imagen:', error);
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(500).json({
                success: false,
                error: 'Error al guardar la imagen'
            });
        }
    });
});

// ============ API de Devocionales (Versículos) ============

// Función para obtener la fecha actual según el GMT configurado (formato YYYY-MM-DD)
function getTodayGMT() {
    const now = new Date();
    // Aplicar el offset de GMT configurado
    const offsetMs = appConfig.gmtOffset * 60 * 60 * 1000;
    const adjustedTime = new Date(now.getTime() + offsetMs);
    return adjustedTime.toISOString().split('T')[0];
}

// Función para verificar si una fecha es futura respecto al GMT configurado
function isFutureDate(dateStr) {
    const today = getTodayGMT();
    return dateStr > today;
}

// GET /api/server-time - Obtener hora del servidor según GMT configurado
app.get('/api/server-time', (req, res) => {
    const now = new Date();
    const offsetMs = appConfig.gmtOffset * 60 * 60 * 1000;
    const adjustedTime = new Date(now.getTime() + offsetMs);
    
    const gmtLabel = appConfig.gmtOffset >= 0 ? `GMT+${appConfig.gmtOffset}` : `GMT${appConfig.gmtOffset}`;
    
    res.json({
        success: true,
        serverTime: adjustedTime.toISOString(),
        today: getTodayGMT(),
        timezone: gmtLabel,
        gmtOffset: appConfig.gmtOffset
    });
});

// GET /api/config - Obtener configuración actual (público)
app.get('/api/config', (req, res) => {
    res.json({
        success: true,
        config: {
            gmtOffset: appConfig.gmtOffset,
            timezone: appConfig.gmtOffset >= 0 ? `GMT+${appConfig.gmtOffset}` : `GMT${appConfig.gmtOffset}`
        }
    });
});

// PUT /api/config - Actualizar configuración (requiere auth)
app.put('/api/config', requireAuth, (req, res) => {
    const { gmtOffset } = req.body;
    
    if (typeof gmtOffset !== 'number' || gmtOffset < -12 || gmtOffset > 14) {
        return res.status(400).json({
            success: false,
            error: 'GMT offset debe ser un número entre -12 y +14'
        });
    }
    
    appConfig.gmtOffset = gmtOffset;
    
    if (saveConfig(appConfig)) {
        const gmtLabel = gmtOffset >= 0 ? `GMT+${gmtOffset}` : `GMT${gmtOffset}`;
        console.log(`⏰ Zona horaria actualizada a: ${gmtLabel}`);
        res.json({
            success: true,
            message: `Zona horaria actualizada a ${gmtLabel}`,
            config: {
                gmtOffset: appConfig.gmtOffset,
                timezone: gmtLabel
            }
        });
    } else {
        res.status(500).json({
            success: false,
            error: 'Error al guardar la configuración'
        });
    }
});

// GET /api/available-dates - Obtener fechas con devocionales disponibles (hasta hoy)
app.get('/api/available-dates', (req, res) => {
    try {
        const today = getTodayGMT();
        // Filtrar solo fechas que no sean futuras Y que tengan audio
        const availableDates = Object.keys(devotionalsDB)
            .filter(date => date <= today)
            .sort((a, b) => b.localeCompare(a)); // Más reciente primero
        
        res.json({
            success: true,
            dates: availableDates,
            today: today,
            count: availableDates.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener fechas' });
    }
});

// GET /api/devotionals/:date - Obtener devocional por fecha (público, con restricción de fecha futura)
app.get('/api/devotionals/:date', (req, res) => {
    const { date } = req.params;
    
    if (!isValidDate(date)) {
        return res.status(400).json({
            success: false,
            error: 'Formato de fecha inválido'
        });
    }
    
    // Bloquear acceso a fechas futuras (basado en GMT-0)
    if (isFutureDate(date)) {
        return res.json({
            success: true,
            exists: false,
            restricted: true,
            message: 'Este devocional aún no está disponible'
        });
    }
    
    const devotional = devotionalsDB[date];
    
    if (devotional) {
        res.json({
            success: true,
            exists: true,
            data: {
                date: date,
                title: devotional.title || '',
                verseReference: devotional.verseReference,
                verseText: devotional.verseText,
                updatedAt: devotional.updatedAt
            }
        });
    } else {
        res.json({
            success: true,
            exists: false
        });
    }
});

// GET /api/devotionals - Listar todos los devocionales (público)
app.get('/api/devotionals', (req, res) => {
    try {
        const devotionals = Object.entries(devotionalsDB).map(([date, data]) => ({
            date,
            title: data.title || '',
            verseReference: data.verseReference,
            verseText: data.verseText,
            updatedAt: data.updatedAt
        })).sort((a, b) => b.date.localeCompare(a.date));
        
        res.json({
            success: true,
            data: devotionals,
            count: devotionals.length
        });
    } catch (error) {
        console.error('Error al listar devocionales:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener la lista de devocionales'
        });
    }
});

// GET /api/devotionals/dates - Obtener solo las fechas disponibles (para calendario)
app.get('/api/devotionals/dates', (req, res) => {
    try {
        const dates = Object.keys(devotionalsDB);
        res.json({
            success: true,
            dates: dates
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener fechas' });
    }
});

// POST /api/devotionals - Guardar/actualizar devocional (requiere autenticación)
app.post('/api/devotionals', requireAuth, (req, res) => {
    const { date, verseReference, verseText } = req.body;
    
    console.log('📖 Guardando devocional:', { date, verseReference });
    
    if (!date || !isValidDate(date)) {
        return res.status(400).json({
            success: false,
            error: 'Fecha inválida. Usa el formato YYYY-MM-DD'
        });
    }
    
    if (!verseReference || !verseText) {
        return res.status(400).json({
            success: false,
            error: 'Se requiere referencia y texto del versículo'
        });
    }
    
    // Guardar en memoria
    const title = req.body.title || '';
    devotionalsDB[date] = {
        title: title.trim(),
        verseReference: verseReference.trim(),
        verseText: verseText.trim(),
        updatedAt: new Date().toISOString()
    };
    
    // Persistir a archivo
    if (saveDevotionals(devotionalsDB)) {
        console.log('✅ Devocional guardado para:', date);
        res.status(201).json({
            success: true,
            message: 'Devocional guardado correctamente',
            data: {
                date,
                verseReference: devotionalsDB[date].verseReference,
                verseText: devotionalsDB[date].verseText,
                updatedAt: devotionalsDB[date].updatedAt
            }
        });
    } else {
        res.status(500).json({
            success: false,
            error: 'Error al guardar el devocional'
        });
    }
});

// DELETE /api/devotionals/:date - Eliminar devocional (requiere autenticación)
app.delete('/api/devotionals/:date', requireAuth, (req, res) => {
    const { date } = req.params;
    
    if (!isValidDate(date)) {
        return res.status(400).json({
            success: false,
            error: 'Formato de fecha inválido'
        });
    }
    
    if (!devotionalsDB[date]) {
        return res.status(404).json({
            success: false,
            error: 'No existe un devocional para esa fecha'
        });
    }
    
    delete devotionalsDB[date];
    
    if (saveDevotionals(devotionalsDB)) {
        console.log('🗑️ Devocional eliminado para:', date);
        res.json({
            success: true,
            message: 'Devocional eliminado correctamente',
            date: date
        });
    } else {
        res.status(500).json({
            success: false,
            error: 'Error al eliminar el devocional'
        });
    }
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
    });
});

// ============ Notificaciones Push ============

// GET /api/notifications/vapid-public-key - Obtener clave pública VAPID
app.get('/api/notifications/vapid-public-key', (req, res) => {
    res.json({ 
        success: true, 
        publicKey: VAPID_PUBLIC_KEY 
    });
});

// Función para obtener IP del cliente
function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
           req.headers['x-real-ip'] || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress ||
           'unknown';
}

// Función para obtener info de geolocalización (usando API gratuita)
async function getGeoInfo(ip) {
    try {
        // Ignorar IPs locales
        if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip === 'unknown') {
            return { country: 'Local', city: 'Local', countryCode: 'LO' };
        }
        
        const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,regionName`);
        const data = await response.json();
        
        if (data.status === 'success') {
            return {
                country: data.country || 'Desconocido',
                city: data.city || '',
                region: data.regionName || '',
                countryCode: data.countryCode || ''
            };
        }
    } catch (error) {
        console.error('Error obteniendo geolocalización:', error.message);
    }
    return { country: 'Desconocido', city: '', countryCode: '' };
}

// POST /api/notifications/subscribe - Suscribir a notificaciones
app.post('/api/notifications/subscribe', async (req, res) => {
    const subscription = req.body;
    const userAgent = req.headers['user-agent'] || '';
    const clientIP = getClientIP(req);
    
    // Evitar duplicados
    const existingIndex = pushSubscriptions.findIndex(
        sub => sub.endpoint === subscription.endpoint
    );
    
    if (existingIndex === -1) {
        // Nueva suscripción - obtener geolocalización
        const geoInfo = await getGeoInfo(clientIP);
        
        // Agregar metadata
        subscription.id = Date.now().toString();
        subscription.userAgent = userAgent;
        subscription.createdAt = new Date().toISOString();
        subscription.ip = clientIP;
        subscription.location = geoInfo;
        
        pushSubscriptions.push(subscription);
        saveSubscriptions();
        console.log(`✅ Nueva suscripción push agregada desde ${geoInfo.country}. Total:`, pushSubscriptions.length);
    } else {
        // Actualizar información de ubicación si cambió
        const geoInfo = await getGeoInfo(clientIP);
        pushSubscriptions[existingIndex].ip = clientIP;
        pushSubscriptions[existingIndex].location = geoInfo;
        pushSubscriptions[existingIndex].lastSeen = new Date().toISOString();
        saveSubscriptions();
        console.log('ℹ️ Suscripción actualizada. Total:', pushSubscriptions.length);
    }
    
    res.json({ success: true, message: 'Suscrito correctamente' });
});

// POST /api/notifications/schedule - Programar recordatorio
app.post('/api/notifications/schedule', (req, res) => {
    const { hour, minute } = req.body;
    console.log(`Recordatorio programado para las ${hour}:${minute}`);
    res.json({ success: true, message: 'Recordatorio programado' });
});

// POST /api/notifications/send - Enviar notificación a todos (para admin)
app.post('/api/notifications/send', async (req, res) => {
    const { title, body } = req.body;
    
    if (!title) {
        return res.status(400).json({ success: false, error: 'Título requerido' });
    }
    
    console.log(`📤 Enviando notificación: "${title}" a ${pushSubscriptions.length} suscriptores`);
    
    const payload = JSON.stringify({
        title: title,
        body: body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-96.png',
        data: {
            url: '/'
        }
    });
    
    let successCount = 0;
    let failCount = 0;
    const failedSubscriptions = [];
    
    // Enviar a todos los suscriptores
    const sendPromises = pushSubscriptions.map(async (subscription, index) => {
        try {
            await webpush.sendNotification(subscription, payload);
            successCount++;
            console.log(`✅ Notificación enviada a dispositivo ${index + 1}`);
        } catch (error) {
            failCount++;
            console.error(`❌ Error enviando a dispositivo ${index + 1}:`, error.message);
            // Si el error es 410 (Gone) o 404, el suscriptor ya no existe
            if (error.statusCode === 410 || error.statusCode === 404) {
                failedSubscriptions.push(subscription.endpoint);
            }
        }
    });
    
    await Promise.all(sendPromises);
    
    // Limpiar suscripciones inválidas
    if (failedSubscriptions.length > 0) {
        pushSubscriptions = pushSubscriptions.filter(
            sub => !failedSubscriptions.includes(sub.endpoint)
        );
        saveSubscriptions();
        console.log(`🧹 Eliminadas ${failedSubscriptions.length} suscripciones inválidas`);
    }
    
    res.json({ 
        success: true, 
        message: `Notificación enviada a ${successCount} dispositivos${failCount > 0 ? `, ${failCount} fallidos` : ''}` 
    });
});

// GET /api/notifications/count - Contar suscriptores
app.get('/api/notifications/count', (req, res) => {
    res.json({ 
        success: true, 
        count: pushSubscriptions.length 
    });
});

// GET /api/notifications/devices - Listar dispositivos registrados
app.get('/api/notifications/devices', (req, res) => {
    const devices = pushSubscriptions.map((sub, index) => {
        // Extraer info del user agent si existe
        let userAgent = 'Dispositivo desconocido';
        if (sub.userAgent) {
            if (sub.userAgent.includes('Android')) userAgent = '📱 Android';
            else if (sub.userAgent.includes('iPhone') || sub.userAgent.includes('iPad')) userAgent = '🍎 iOS';
            else if (sub.userAgent.includes('Windows')) userAgent = '💻 Windows';
            else if (sub.userAgent.includes('Mac')) userAgent = '💻 macOS';
            else if (sub.userAgent.includes('Linux')) userAgent = '🐧 Linux';
            else userAgent = '🌐 Navegador';
        }
        
        return {
            id: sub.id || index.toString(),
            userAgent: userAgent,
            createdAt: sub.createdAt || new Date().toISOString()
        };
    });
    
    res.json({ success: true, devices });
});

// DELETE /api/notifications/device/:id - Eliminar dispositivo
app.delete('/api/notifications/device/:id', (req, res) => {
    const { id } = req.params;
    const index = pushSubscriptions.findIndex((sub, idx) => (sub.id || idx.toString()) === id);
    
    if (index !== -1) {
        pushSubscriptions.splice(index, 1);
        saveSubscriptions();
        res.json({ success: true, message: 'Dispositivo eliminado' });
    } else {
        res.status(404).json({ success: false, error: 'Dispositivo no encontrado' });
    }
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🎵 Servidor de Devocionales iniciado                    ║
║                                                            ║
║   📍 Local:    http://localhost:${PORT}                      ║
║   📱 Red:      http://192.168.40.9:${PORT}                   ║
║   📂 Audios:   ${AUDIOS_DIR}
║                                                            ║
║   Endpoints disponibles:                                   ║
║   GET    /api/audios        - Listar audios               ║
║   GET    /api/audios/:date  - Verificar audio por fecha   ║
║   POST   /api/audios        - Subir audio                 ║
║   DELETE /api/audios/:date  - Eliminar audio              ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
});
