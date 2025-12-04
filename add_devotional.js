const fs = require('fs');
const path = '/app/data/devotionals.json';

let db = {};
try {
    db = JSON.parse(fs.readFileSync(path, 'utf8'));
} catch(e) {
    db = {};
}

db['2025-12-04'] = {
    title: 'Confiando en las Promesas de Dios',
    verseReference: 'Jeremías 29:11',
    verseText: 'Porque yo sé los planes que tengo para ustedes —dice el Señor—. Son planes para lo bueno y no para lo malo, para darles un futuro y una esperanza.',
    updatedAt: new Date().toISOString()
};

fs.writeFileSync(path, JSON.stringify(db, null, 2));
console.log('Devocional agregado exitosamente');
console.log(JSON.stringify(db['2025-12-04'], null, 2));
