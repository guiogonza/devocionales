const fs = require('fs');
const path = '/app/admin-panel.html';

let content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

// Encontrar y eliminar el código corrupto entre líneas 1340-1365
// Buscar el patrón corrupto
const corruptPattern = /\s*\/\/ Configuración - Session Timeout\s*\);\s*const data = await response\.json\(\);[\s\S]*?refreshSession\(\);\s*\}/;

if (corruptPattern.test(content)) {
    content = content.replace(corruptPattern, '');
    console.log('Código corrupto eliminado');
}

// También eliminar cualquier código duplicado de funciones
// Buscar funciones duplicadas de loadSessionTimeout y saveSessionTimeout
const funcMatches = content.match(/async function loadSessionTimeout\(\)/g);
if (funcMatches && funcMatches.length > 1) {
    // Eliminar todas las instancias excepto la última
    let count = 0;
    content = content.replace(/async function loadSessionTimeout\(\)[\s\S]*?^\s*\}/gm, (match) => {
        count++;
        if (count < funcMatches.length) {
            return ''; // Eliminar las primeras
        }
        return match; // Mantener la última
    });
    console.log('Funciones duplicadas de loadSessionTimeout eliminadas');
}

const saveFuncMatches = content.match(/async function saveSessionTimeout\(\)/g);
if (saveFuncMatches && saveFuncMatches.length > 1) {
    let count = 0;
    content = content.replace(/async function saveSessionTimeout\(\)[\s\S]*?^\s*\}/gm, (match) => {
        count++;
        if (count < saveFuncMatches.length) {
            return '';
        }
        return match;
    });
    console.log('Funciones duplicadas de saveSessionTimeout eliminadas');
}

// Limpiar líneas vacías múltiples
content = content.replace(/\n{4,}/g, '\n\n\n');

fs.writeFileSync(path, content);
console.log('Archivo reparado');

// Verificar sintaxis básica - contar llaves
const openBraces = (content.match(/\{/g) || []).length;
const closeBraces = (content.match(/\}/g) || []).length;
console.log(`Llaves abiertas: ${openBraces}, cerradas: ${closeBraces}`);
if (openBraces !== closeBraces) {
    console.log('⚠️ ADVERTENCIA: Llaves desbalanceadas');
}
