# Utilizar Node.js como servidor para la PWA con API
FROM node:20-alpine

# Crear directorio de trabajo
WORKDIR /app

# Copiar package.json primero para cachear dependencias
COPY package.json ./

# Instalar dependencias
RUN npm install --production

# Copiar el resto de archivos
COPY . .

# Crear directorios para datos persistentes
# Los audios y data se montarán como volúmenes externos
RUN mkdir -p /app/data /app/audios /app/icons

# Exponer puerto 3000
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Comando por defecto
CMD ["node", "server.js"]
