const fs = require('fs');
const path = '/app/js/admin/init.js';

let content = fs.readFileSync(path, 'utf8');

// Agregar logs de debug
const oldCode = `    if (dropZone && fileInput) {
        dropZone.addEventListener('click', () => fileInput.click());`;

const newCode = `    console.log('dropZone:', dropZone);
    console.log('fileInput:', fileInput);
    
    if (dropZone && fileInput) {
        console.log('Agregando eventos a dropZone y fileInput');
        dropZone.addEventListener('click', () => {
            console.log('Click en dropZone');
            fileInput.click();
        });`;

content = content.replace(oldCode, newCode);

// También agregar log en el change
const oldChange = `        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
            }
        });`;

const newChange = `        fileInput.addEventListener('change', (e) => {
            console.log('Archivo seleccionado:', e.target.files);
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
            }
        });`;

content = content.replace(oldChange, newChange);

fs.writeFileSync(path, content);
console.log('Debug logs agregados a init.js');
