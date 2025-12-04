/**
 * Gestión de almacenamiento offline para audios
 * Usa IndexedDB para guardar los archivos de audio localmente
 */

const OfflineStorage = {
    DB_NAME: 'DevotionalsDB',
    DB_VERSION: 1,
    STORE_NAME: 'audios',
    db: null,

    // Inicializar IndexedDB
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'date' });
                    store.createIndex('downloadedAt', 'downloadedAt', { unique: false });
                }
            };
        });
    },

    // Guardar audio
    async saveAudio(date, audioBlob, metadata = {}) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);

            const audioData = {
                date: date,
                blob: audioBlob,
                size: audioBlob.size,
                downloadedAt: new Date().toISOString(),
                ...metadata
            };

            const request = store.put(audioData);
            request.onsuccess = () => resolve(audioData);
            request.onerror = () => reject(request.error);
        });
    },

    // Obtener audio
    async getAudio(date) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.get(date);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    },

    // Listar todos los audios descargados
    async getAllAudios() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const audios = request.result.sort((a, b) => b.date.localeCompare(a.date));
                resolve(audios);
            };
            request.onerror = () => reject(request.error);
        });
    },

    // Eliminar audio
    async deleteAudio(date) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.delete(date);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    },

    // Verificar si un audio está descargado
    async isDownloaded(date) {
        const audio = await this.getAudio(date);
        return audio !== null;
    },

    // Obtener tamaño total de almacenamiento usado
    async getStorageUsed() {
        const audios = await this.getAllAudios();
        return audios.reduce((total, audio) => total + (audio.size || 0), 0);
    },

    // Descargar audio desde servidor y guardar
    async downloadAndSave(date, onProgress = null) {
        const url = `/audios/${date}.mp3`;
        
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('Audio no encontrado');
            }

            const contentLength = response.headers.get('content-length');
            const total = parseInt(contentLength, 10);
            let loaded = 0;

            const reader = response.body.getReader();
            const chunks = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                chunks.push(value);
                loaded += value.length;

                if (onProgress && total) {
                    onProgress(Math.round((loaded / total) * 100));
                }
            }

            const blob = new Blob(chunks, { type: 'audio/mpeg' });
            await this.saveAudio(date, blob);
            
            return true;
        } catch (error) {
            console.error('Error al descargar audio:', error);
            throw error;
        }
    },

    // Crear URL temporal para reproducir audio offline
    createObjectURL(blob) {
        return URL.createObjectURL(blob);
    },

    // Liberar URL temporal
    revokeObjectURL(url) {
        URL.revokeObjectURL(url);
    }
};

// Exportar para uso global
window.OfflineStorage = OfflineStorage;
