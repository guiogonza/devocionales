# Copilot Instructions - Meditación Diaria PWA

## Visión General de la Arquitectura

Esta es una **PWA de devocionales cristianos** con un servidor Node.js/Express que maneja audios MP3 diarios, push notifications y un panel de administración completo.

### Estructura de Capas
```
Frontend PWA          → js/app.js (reproductor), js/admin/*.js (panel admin)
Servidor Express      → server.js (entry point), server/routes/*.js (API REST)
Almacenamiento        → server/storage.js (JSON files en /data)
Archivos estáticos    → /audios (MP3), /icons (imágenes PWA)
```

## Convenciones de Código

### Nomenclatura de Audios
Los archivos de audio **DEBEN** nombrarse con formato fecha: `YYYY-MM-DD.mp3` (ej: `2025-12-18.mp3`). El sistema valida esto en [server/routes/audios.js](server/routes/audios.js) con la función `isValidDate()`.

### Estructura de Respuestas API
Todas las respuestas siguen este patrón:
```javascript
// Éxito
{ success: true, data: {...}, count?: number }

// Error  
{ success: false, error: 'Mensaje descriptivo' }
```

### Almacenamiento JSON
Los datos se persisten en archivos JSON en `/data`. Usa las funciones de [server/storage.js](server/storage.js):
- `loadJSON(file, defaultValue)` / `saveJSON(file, data)` - Operaciones genéricas
- `getDevotionals()` / `saveDevotionals()` - Metadatos de devocionales (título, versículo)
- `getConfig()` / `saveConfig()` - Configuración global (gmtOffset, maxUploadMB)

### Autenticación Admin
Sistema basado en cookies con tokens. Ver [server/auth.js](server/auth.js):
- Middleware `requireAuth` para rutas protegidas
- Rate limiting por IP con bloqueo temporal/permanente
- Cookie `adminToken` con opciones seguras (httpOnly, sameSite)

## Flujos Críticos

### Subida de Audio
1. Frontend: [js/admin/audios.js](js/admin/audios.js) → `uploadAudio()`
2. Backend: POST `/api/audios` → Multer con límite dinámico desde config
3. Validación: Solo MP3, fecha válida, sin duplicados (excepto con `replaceExisting`)
4. Metadata: Se guarda en `devotionals.json` con título/versículo opcional

### Streaming de Audio (iOS Compatible)
El servidor maneja `Range` headers para streaming en [server.js](server.js#L78-L127). **Importante**: Los audios de fechas futuras están bloqueados a nivel de middleware.

### Service Worker
[sw.js](sw.js) implementa:
- Cache con versionado (`CACHE_NAME = 'devocionales-v34'`)
- **API nunca se cachea** - Siempre va a red
- Imágenes dinámicas (logo, pastores) no se cachean

## Comandos de Desarrollo

```bash
npm install          # Instalar dependencias
npm start           # Iniciar servidor (puerto 3000)
docker-compose up -d # Producción con Docker
```

**Volúmenes Docker persistentes**: `/audios`, `/data`, `/icons`

## Panel de Administración

Módulos en [js/admin/](js/admin/):
| Archivo | Función |
|---------|---------|
| `auth.js` | Login/logout, verificación de sesión |
| `audios.js` | Subir/eliminar/listar audios |
| `bible.js` | Búsqueda de versículos bíblicos |
| `images.js` | Cambiar logo y foto de pastores |
| `notifications.js` | Push notifications (VAPID) |
| `settings.js` | Zona horaria, límite upload, usuarios |

## Patrones Importantes

### Zona Horaria Configurable
El sistema usa `gmtOffset` en config para calcular "hoy" del lado del servidor. Ver [server/storage.js](server/storage.js#L71) - `getConfig().gmtOffset`.

### Logs de Auditoría
Usar funciones de [server/logs.js](server/logs.js):
- `logAudit(action, details, req)` - Acciones admin (LOGIN, UPLOAD, DELETE)
- `logActivity(action, details, req)` - Actividad pública (PLAY_DEVOTIONAL)

### Seguridad
- Headers de seguridad en middleware de [server.js](server.js#L42-L54)
- Rutas admin con `Cache-Control: no-store`
- IPs bloqueables permanentemente vía panel admin
