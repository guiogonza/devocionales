const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../auth');
const { ICONS_DIR } = require('../config');
const { logAudit } = require('../logs');

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
router.post('/', requireAuth, (req, res) => {
    console.log('📷 Recibiendo petición de subida de imagen...');
    
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
        
        const imageType = req.body.type; // 'logo', 'icon' o 'pastores'
        console.log('🖼️ Tipo de imagen:', imageType);
        
        if (!['logo', 'icon', 'pastores'].includes(imageType)) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                error: 'Tipo de imagen inválido. Debe ser "logo", "icon" o "pastores"'
            });
        }
        
        try {
            // Para iconos, guardar como icon-192.png e icon-512.png
            if (imageType === 'icon') {
                const icon192Path = path.join(ICONS_DIR, 'icon-192.png');
                const icon512Path = path.join(ICONS_DIR, 'icon-512.png');
                
                // Backup de iconos anteriores si existen
                if (fs.existsSync(icon192Path)) {
                    const backup192 = path.join(ICONS_DIR, `icon-192_backup_${Date.now()}.png`);
                    fs.copyFileSync(icon192Path, backup192);
                    fs.unlinkSync(icon192Path);
                }
                if (fs.existsSync(icon512Path)) {
                    const backup512 = path.join(ICONS_DIR, `icon-512_backup_${Date.now()}.png`);
                    fs.copyFileSync(icon512Path, backup512);
                    fs.unlinkSync(icon512Path);
                }
                
                // Copiar archivo a ambos destinos
                fs.copyFileSync(req.file.path, icon192Path);
                fs.copyFileSync(req.file.path, icon512Path);
                fs.unlinkSync(req.file.path);
                
                console.log('✅ Iconos guardados: icon-192.png, icon-512.png');
                logAudit('IMAGE_UPLOADED', { type: 'icon', filenames: ['icon-192.png', 'icon-512.png'] }, req);
                
                return res.status(201).json({
                    success: true,
                    message: 'Iconos de la app actualizados correctamente',
                    data: {
                        type: 'icon',
                        filenames: ['icon-192.png', 'icon-512.png'],
                        updatedAt: new Date().toISOString()
                    }
                });
            }
            
            // Para logo y pastores
            const ext = imageType === 'logo' ? '.png' : '.jpg';
            const finalName = imageType === 'logo' ? 'logo.png' : 'pastores.jpg';
            const finalPath = path.join(ICONS_DIR, finalName);
        
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
            logAudit('IMAGE_UPLOADED', { type: imageType, filename: finalName }, req);
            
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

// GET /api/images - Listar imágenes disponibles
router.get('/', requireAuth, (req, res) => {
    try {
        const images = [];
        const logoPath = path.join(ICONS_DIR, 'logo.png');
        const pastoresPath = path.join(ICONS_DIR, 'pastores.jpg');
        
        if (fs.existsSync(logoPath)) {
            const stats = fs.statSync(logoPath);
            images.push({
                type: 'logo',
                filename: 'logo.png',
                path: '/icons/logo.png',
                size: stats.size,
                updatedAt: stats.mtime.toISOString()
            });
        }
        
        if (fs.existsSync(pastoresPath)) {
            const stats = fs.statSync(pastoresPath);
            images.push({
                type: 'pastores',
                filename: 'pastores.jpg',
                path: '/icons/pastores.jpg',
                size: stats.size,
                updatedAt: stats.mtime.toISOString()
            });
        }
        
        res.json({ success: true, data: images });
    } catch (error) {
        console.error('Error listando imágenes:', error);
        res.status(500).json({ success: false, error: 'Error al listar imágenes' });
    }
});

module.exports = router;
