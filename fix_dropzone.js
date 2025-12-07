const fs = require('fs');
const path = '/app/admin_sidebar.html';

let content = fs.readFileSync(path, 'utf8');

// Agregar onclick al dropZone
const oldDropZone = 'class="upload-zone" id="dropZone">';
const newDropZone = 'class="upload-zone" id="dropZone" onclick="document.getElementById(\'fileInput\').click()" style="cursor: pointer;">';

content = content.replace(oldDropZone, newDropZone);

// También agregar al imageUploadZone si existe
const oldImageZone = 'class="image-upload-zone" id="imageUploadZone">';
const newImageZone = 'class="image-upload-zone" id="imageUploadZone" onclick="document.getElementById(\'imageFileInput\').click()" style="cursor: pointer;">';

content = content.replace(oldImageZone, newImageZone);

fs.writeFileSync(path, content);
console.log('onclick handlers agregados');
