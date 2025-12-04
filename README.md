# Meditación Diaria - PWA de Devocionales

Aplicación web progresiva (PWA) para escuchar devocionales diarios con audio.

## Características

- 📱 **Instalable** en Android e iOS como aplicación nativa
- 🎵 **Reproductor de audio** integrado con controles de reproducción
- 📅 **Calendario** para seleccionar devocionales de fechas anteriores
- 📤 **Compartir** vía WhatsApp y otras apps
- 💾 **Funciona offline** gracias al Service Worker
- 📜 **Historial** de devocionales escuchados
- ⚙️ **Panel de administración** para gestionar audios

## Estructura del Proyecto

```
app_devocionales/
├── index.html          # Página principal (reproductor)
├── admin.html          # Panel de administración de audios
├── manifest.json       # Configuración de PWA
├── sw.js              # Service Worker
├── server.js          # Servidor Node.js con API
├── package.json       # Dependencias de Node.js
├── css/
│   └── styles.css     # Estilos del reproductor
├── js/
│   ├── app.js         # Lógica del reproductor
│   └── admin.js       # Lógica del panel de admin
├── icons/             # Iconos de la PWA
├── audios/            # Carpeta para archivos MP3
├── Dockerfile         # Configuración Docker
├── docker-compose.yml # Orquestación Docker
└── nginx.conf         # Configuración nginx (alternativa)
```

## Panel de Administración

El panel de administración (`/admin.html`) permite:

- ✅ **Subir audios** con validación de formato MP3
- ✅ **Validar nombres** con formato de fecha YYYY-MM-DD
- ✅ **Prevenir duplicados** - no permite subir si ya existe audio para esa fecha
- ✅ **Eliminar audios** con confirmación
- ✅ **Ver lista** de todos los audios disponibles

### Validaciones

1. **Formato de archivo**: Solo acepta archivos `.mp3`
2. **Tamaño máximo**: 50MB por archivo
3. **Formato de fecha**: YYYY-MM-DD (ej: 2025-11-28)
4. **Sin duplicados**: No permite subir si ya existe audio para esa fecha
5. **Sin fechas futuras**: No permite subir para fechas que aún no han llegado

## Instalación Local (Desarrollo)

### Opción 1: Con Node.js

```bash
# Instalar dependencias
npm install

# Iniciar servidor
npm start
```

La aplicación estará en http://localhost:3000

### Opción 2: Solo archivos estáticos (sin API)

Edita `js/admin.js` y cambia `useApi: true` a `useApi: false`

```bash
# Con Python
python -m http.server 8080

# Con npx
npx http-server -p 8080
```

## Despliegue con Docker

### Construir y ejecutar

```bash
# Construir la imagen
docker-compose build

# Iniciar el contenedor
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener
docker-compose down
```

La aplicación estará disponible en:
- **Reproductor**: http://localhost:3000
- **Admin**: http://localhost:3000/admin.html

### Script de inicio rápido (Windows)

Ejecuta `start.bat` para construir e iniciar automáticamente.

## API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/audios` | Listar todos los audios |
| GET | `/api/audios/:date` | Verificar audio por fecha |
| POST | `/api/audios` | Subir nuevo audio |
| DELETE | `/api/audios/:date` | Eliminar audio |

### Ejemplo: Subir audio con curl

```bash
curl -X POST http://localhost:3000/api/audios \
  -F "audio=@mi-audio.mp3" \
  -F "date=2025-11-28"
```

## Generar Iconos PNG

1. Abre `create-icons.html` en un navegador
2. Haz clic en los enlaces para descargar cada icono
3. Guarda los archivos en la carpeta `icons/`

## Personalización

### Cambiar colores

Edita las variables CSS en `css/styles.css`:

```css
:root {
    --primary-color: #4A90D9;
    --primary-dark: #3A7BC8;
    --secondary-color: #8B5CF6;
}
```

### Agregar metadatos de devocionales

En `js/app.js`, puedes agregar información específica para cada fecha:

```javascript
const devotionalData = {
    '2025-11-28': {
        title: "Título del devocional",
        verse: "Versículo bíblico",
        text: "Descripción del devocional..."
    }
};
```

## Notas Técnicas

- Los archivos de audio pueden pesar hasta 50MB cada uno
- El Service Worker cachea los audios para reproducción offline
- La app utiliza la API Web Share para compartir nativo en móviles
- Compatible con Chrome, Firefox, Safari y Edge modernos

## Requisitos del Servidor (Producción)

- Soporte para HTTPS (requerido para PWA)
- Node.js 18+ o Docker
- Almacenamiento suficiente para los audios

## Licencia

Proyecto de uso libre para fines religiosos y educativos.
