/**
 * Generador de imagen para compartir devocionales
 * Crea una imagen con Canvas que incluye titulo, versiculo y logo
 */

// Funcion para dividir texto en lineas
function wrapText(ctx, text, maxWidth, fontSize) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    words.forEach(word => {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    });
    
    if (currentLine) {
        lines.push(currentLine);
    }
    
    return lines;
}

// Generar imagen para compartir con titulo y versiculo
async function generateShareImage(title, verse, verseText, dateFormatted) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Dimensiones de la imagen (formato cuadrado para redes sociales)
        canvas.width = 1080;
        canvas.height = 1080;
        
        // Fondo con gradiente
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#1B4332');
        gradient.addColorStop(0.5, '#2D6A4F');
        gradient.addColorStop(1, '#40916C');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Patron decorativo sutil
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        for (let i = 0; i < 20; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const size = Math.random() * 100 + 50;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Borde decorativo
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 3;
        ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);
        
        // Funcion auxiliar para renderizar el contenido
        function renderContent(logoLoaded, logo) {
            ctx.textAlign = 'center';
            ctx.fillStyle = 'white';
            
            let startY = 150;
            
            if (logoLoaded && logo) {
                const logoSize = 150;
                const logoX = (canvas.width - logoSize) / 2;
                const logoY = 80;
                ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
                startY = logoY + logoSize + 60;
            }
            
            ctx.font = '300 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillText('MEDITACION DIARIA', canvas.width / 2, startY);
            
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(canvas.width / 2 - 100, startY + 25);
            ctx.lineTo(canvas.width / 2 + 100, startY + 25);
            ctx.stroke();
            
            ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillStyle = 'white';
            const titleLines = wrapText(ctx, title, canvas.width - 160, 48);
            let titleY = startY + 120;
            titleLines.forEach(line => {
                ctx.fillText(line, canvas.width / 2, titleY);
                titleY += 60;
            });
            
            ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillStyle = '#95D5B2';
            ctx.fillText(verse, canvas.width / 2, titleY + 40);
            
            if (verseText && verseText.trim()) {
                ctx.font = 'italic 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                const verseLines = wrapText(ctx, '"' + verseText + '"', canvas.width - 200, 28);
                let verseY = titleY + 120;
                verseLines.slice(0, 4).forEach(line => {
                    ctx.fillText(line, canvas.width / 2, verseY);
                    verseY += 40;
                });
            }
            
            ctx.font = '300 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.fillText(dateFormatted, canvas.width / 2, canvas.height - 120);
            
            ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.fillText('RIO Iglesia Cristiana', canvas.width / 2, canvas.height - 70);
            
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('No se pudo generar la imagen'));
                }
            }, 'image/png', 0.95);
        }
        
        const logo = new Image();
        logo.crossOrigin = 'anonymous';
        logo.src = '/icons/logo.png';
        
        logo.onload = () => {
            renderContent(true, logo);
        };
        
        logo.onerror = () => {
            renderContent(false, null);
        };
        
        setTimeout(() => {
            if (!logo.complete) {
                renderContent(false, null);
            }
        }, 3000);
    });
}

window.generateShareImage = generateShareImage;
window.wrapText = wrapText;