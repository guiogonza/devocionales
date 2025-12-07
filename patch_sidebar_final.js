const fs = require('fs');
const path = '/app/admin_sidebar.html';

let content = fs.readFileSync(path, 'utf8');

// 1. Agregar evento click al dropZone y llamar startSessionTimer
// Buscar donde se llama initApp o al final del script
const initCode = `
    // Click en dropZone para abrir selector de archivos
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    if (dropZone && fileInput) {
        dropZone.addEventListener('click', function() {
            if (!window.isEditMode) {
                fileInput.click();
            }
        });
        // Drag and drop
        dropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            dropZone.style.borderColor = '#6c5ce7';
            dropZone.style.background = 'rgba(108, 92, 231, 0.1)';
        });
        dropZone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            dropZone.style.borderColor = '';
            dropZone.style.background = '';
        });
        dropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            dropZone.style.borderColor = '';
            dropZone.style.background = '';
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type === 'audio/mpeg') {
                fileInput.files = e.dataTransfer.files;
                fileInput.dispatchEvent(new Event('change'));
            }
        });
    }

    // Iniciar timer de sesión
    if (typeof startSessionTimer === 'function') {
        startSessionTimer();
    }
`;

// Buscar el cierre del DOMContentLoaded o initApp
if (content.includes('initApp()')) {
    // Agregar después de initApp()
    content = content.replace(
        /initApp\(\);/,
        `initApp();${initCode}`
    );
    console.log('Código agregado después de initApp()');
} else if (content.includes('DOMContentLoaded')) {
    // Buscar el final del evento DOMContentLoaded
    const domPattern = /(document\.addEventListener\(['"]DOMContentLoaded['"],\s*(?:async\s*)?\(?(?:\s*\)\s*=>|function\s*\(\))\s*\{[\s\S]*?)(}\s*\);?\s*<\/script>)/;
    if (domPattern.test(content)) {
        content = content.replace(domPattern, `$1${initCode}\n    $2`);
        console.log('Código agregado en DOMContentLoaded');
    }
}

// Verificar si ya existe el código
if (!content.includes("dropZone.addEventListener('click'")) {
    // Buscar antes del </script> final
    const lastScriptClose = content.lastIndexOf('</script>');
    if (lastScriptClose > -1) {
        // Buscar el cierre de función antes del </script>
        const beforeScript = content.substring(0, lastScriptClose);
        const lastBrace = beforeScript.lastIndexOf('});');
        if (lastBrace > -1) {
            content = beforeScript.substring(0, lastBrace) + 
                      initCode + '\n    ' + 
                      beforeScript.substring(lastBrace) + 
                      content.substring(lastScriptClose);
            console.log('Código insertado antes del cierre del script');
        }
    }
}

fs.writeFileSync(path, content);
console.log('Patch aplicado correctamente');
