/**
 * API de Biblia NTV (Bolls.life)
 * Búsqueda y selección de versículos
 */

let bibleBooks = null;

async function loadBibleBooks() {
    if (bibleBooks) return bibleBooks;
    
    try {
        const response = await fetch(`${CONFIG.bibleApiBase}/get-books/NTV/`);
        bibleBooks = await response.json();
        console.log('📚 Libros de la Biblia cargados:', bibleBooks.length);
        return bibleBooks;
    } catch (error) {
        console.error('Error cargando libros:', error);
        return [];
    }
}

// Diccionario de abreviaturas en español
const BIBLE_ABBREVIATIONS = {
    'gn': 'Génesis', 'gen': 'Génesis', 'gén': 'Génesis', 'genesis': 'Génesis',
    'ex': 'Éxodo', 'éx': 'Éxodo', 'exo': 'Éxodo', 'exodo': 'Éxodo',
    'lv': 'Levítico', 'lev': 'Levítico', 'levitico': 'Levítico',
    'nm': 'Números', 'num': 'Números', 'núm': 'Números', 'numeros': 'Números',
    'dt': 'Deuteronomio', 'deu': 'Deuteronomio', 'deut': 'Deuteronomio',
    'jos': 'Josué', 'js': 'Josué', 'josue': 'Josué',
    'jue': 'Jueces', 'jc': 'Jueces', 'jueces': 'Jueces',
    'rt': 'Rut', 'rut': 'Rut',
    '1s': '1 Samuel', '1sam': '1 Samuel', '1 sam': '1 Samuel', '1samuel': '1 Samuel',
    '2s': '2 Samuel', '2sam': '2 Samuel', '2 sam': '2 Samuel', '2samuel': '2 Samuel',
    '1r': '1 Reyes', '1re': '1 Reyes', '1 re': '1 Reyes', '1rey': '1 Reyes', '1reyes': '1 Reyes',
    '2r': '2 Reyes', '2re': '2 Reyes', '2 re': '2 Reyes', '2rey': '2 Reyes', '2reyes': '2 Reyes',
    '1cr': '1 Crónicas', '1cro': '1 Crónicas', '1 cr': '1 Crónicas', '1cronicas': '1 Crónicas',
    '2cr': '2 Crónicas', '2cro': '2 Crónicas', '2 cr': '2 Crónicas', '2cronicas': '2 Crónicas',
    'esd': 'Esdras', 'es': 'Esdras', 'esdras': 'Esdras',
    'neh': 'Nehemías', 'ne': 'Nehemías', 'nehemias': 'Nehemías',
    'est': 'Ester', 'ester': 'Ester',
    'job': 'Job', 'jb': 'Job',
    'sal': 'Salmos', 'slm': 'Salmos', 'sl': 'Salmos', 'ps': 'Salmos', 'salmos': 'Salmos', 'salmo': 'Salmos',
    'pr': 'Proverbios', 'prov': 'Proverbios', 'prv': 'Proverbios', 'proverbios': 'Proverbios',
    'ec': 'Eclesiastés', 'ecl': 'Eclesiastés', 'eclesiastes': 'Eclesiastés',
    'cnt': 'Cantares', 'can': 'Cantares', 'ct': 'Cantares', 'cantar': 'Cantares', 'cantares': 'Cantares',
    'is': 'Isaías', 'isa': 'Isaías', 'isaias': 'Isaías',
    'jr': 'Jeremías', 'jer': 'Jeremías', 'jeremias': 'Jeremías',
    'lm': 'Lamentaciones', 'lam': 'Lamentaciones', 'lamentaciones': 'Lamentaciones',
    'ez': 'Ezequiel', 'eze': 'Ezequiel', 'ezequiel': 'Ezequiel',
    'dn': 'Daniel', 'dan': 'Daniel', 'daniel': 'Daniel',
    'os': 'Oseas', 'ose': 'Oseas', 'oseas': 'Oseas',
    'jl': 'Joel', 'joe': 'Joel', 'joel': 'Joel',
    'am': 'Amós', 'amo': 'Amós', 'amos': 'Amós',
    'ab': 'Abdías', 'abd': 'Abdías', 'abdias': 'Abdías',
    'jon': 'Jonás', 'jns': 'Jonás', 'jonas': 'Jonás',
    'mi': 'Miqueas', 'miq': 'Miqueas', 'mic': 'Miqueas', 'miqueas': 'Miqueas',
    'na': 'Nahúm', 'nah': 'Nahúm', 'nahum': 'Nahúm',
    'hab': 'Habacuc', 'hb': 'Habacuc', 'habacuc': 'Habacuc',
    'sof': 'Sofonías', 'sf': 'Sofonías', 'sofonias': 'Sofonías',
    'hag': 'Hageo', 'hg': 'Hageo', 'hageo': 'Hageo',
    'zac': 'Zacarías', 'zc': 'Zacarías', 'zacarias': 'Zacarías',
    'mal': 'Malaquías', 'ml': 'Malaquías', 'malaquias': 'Malaquías',
    'mt': 'Mateo', 'mat': 'Mateo', 'mateo': 'Mateo',
    'mr': 'Marcos', 'mc': 'Marcos', 'mar': 'Marcos', 'marcos': 'Marcos',
    'lc': 'Lucas', 'luc': 'Lucas', 'lucas': 'Lucas',
    'jn': 'Juan', 'ju': 'Juan', 'juan': 'Juan',
    'hch': 'Hechos', 'hec': 'Hechos', 'hechos': 'Hechos',
    'ro': 'Romanos', 'rom': 'Romanos', 'romanos': 'Romanos',
    '1co': '1 Corintios', '1cor': '1 Corintios', '1 co': '1 Corintios', '1corintios': '1 Corintios',
    '2co': '2 Corintios', '2cor': '2 Corintios', '2 co': '2 Corintios', '2corintios': '2 Corintios',
    'ga': 'Gálatas', 'gal': 'Gálatas', 'gá': 'Gálatas', 'galatas': 'Gálatas',
    'ef': 'Efesios', 'efe': 'Efesios', 'efesios': 'Efesios',
    'fil': 'Filipenses', 'flp': 'Filipenses', 'fp': 'Filipenses', 'filipenses': 'Filipenses',
    'col': 'Colosenses', 'cl': 'Colosenses', 'colosenses': 'Colosenses',
    '1ts': '1 Tesalonicenses', '1tes': '1 Tesalonicenses', '1 ts': '1 Tesalonicenses',
    '2ts': '2 Tesalonicenses', '2tes': '2 Tesalonicenses', '2 ts': '2 Tesalonicenses',
    '1ti': '1 Timoteo', '1tim': '1 Timoteo', '1 ti': '1 Timoteo', '1timoteo': '1 Timoteo',
    '2ti': '2 Timoteo', '2tim': '2 Timoteo', '2 ti': '2 Timoteo', '2timoteo': '2 Timoteo',
    'tit': 'Tito', 'tt': 'Tito', 'tito': 'Tito',
    'flm': 'Filemón', 'film': 'Filemón', 'fm': 'Filemón', 'filemon': 'Filemón',
    'heb': 'Hebreos', 'he': 'Hebreos', 'hebreos': 'Hebreos',
    'stg': 'Santiago', 'sant': 'Santiago', 'sg': 'Santiago', 'santiago': 'Santiago',
    '1p': '1 Pedro', '1pe': '1 Pedro', '1 pe': '1 Pedro', '1ped': '1 Pedro', '1pedro': '1 Pedro',
    '2p': '2 Pedro', '2pe': '2 Pedro', '2 pe': '2 Pedro', '2ped': '2 Pedro', '2pedro': '2 Pedro',
    '1jn': '1 Juan', '1ju': '1 Juan', '1 jn': '1 Juan', '1juan': '1 Juan',
    '2jn': '2 Juan', '2ju': '2 Juan', '2 jn': '2 Juan', '2juan': '2 Juan',
    '3jn': '3 Juan', '3ju': '3 Juan', '3 jn': '3 Juan', '3juan': '3 Juan',
    'jud': 'Judas', 'jds': 'Judas', 'judas': 'Judas',
    'ap': 'Apocalipsis', 'apo': 'Apocalipsis', 'apoc': 'Apocalipsis', 'rev': 'Apocalipsis', 'apocalipsis': 'Apocalipsis'
};

function expandAbbreviation(input) {
    const normalized = input.toLowerCase().trim();
    return BIBLE_ABBREVIATIONS[normalized] || input;
}

async function findBookByName(query) {
    const books = await loadBibleBooks();
    const searchTerm = expandAbbreviation(query).toLowerCase();
    
    let book = books.find(b => b.name.toLowerCase() === searchTerm);
    if (book) return book;
    
    book = books.find(b => b.name.toLowerCase().startsWith(searchTerm));
    if (book) return book;
    
    book = books.find(b => b.name.toLowerCase().includes(searchTerm));
    return book;
}

async function searchBibleAPI(query) {
    if (!query || query.length < 2) return [];
    
    try {
        // Buscar por referencia (ej: "Juan 3:16")
        const refMatch = query.match(/^(\d?\s*[a-záéíóúñ]+)\s+(\d+):?(\d*)/i);
        
        if (refMatch) {
            let bookName = refMatch[1].trim();
            const chapter = parseInt(refMatch[2]);
            const verse = refMatch[3] ? parseInt(refMatch[3]) : null;
            
            bookName = expandAbbreviation(bookName);
            const book = await findBookByName(bookName);
            
            if (book) {
                if (verse) {
                    // Versículo específico
                    const verseData = await fetchVerse(book.bookid, chapter, verse);
                    if (verseData) {
                        return [{
                            reference: `${book.name} ${chapter}:${verse}`,
                            text: cleanVerseText(verseData.text),
                            book: book.name,
                            chapter,
                            verse
                        }];
                    }
                } else {
                    // Solo capítulo - mostrar primeros versículos
                    const chapterData = await fetchChapter(book.bookid, chapter);
                    return chapterData.slice(0, 10).map(v => ({
                        reference: `${book.name} ${chapter}:${v.verse}`,
                        text: cleanVerseText(v.text),
                        book: book.name,
                        chapter,
                        verse: v.verse
                    }));
                }
            }
        }
        
        // Solo nombre de libro
        const book = await findBookByName(query.trim());
        if (book) {
            const chapterData = await fetchChapter(book.bookid, 1);
            return chapterData.slice(0, 8).map(v => ({
                reference: `${book.name} 1:${v.verse}`,
                text: cleanVerseText(v.text),
                book: book.name,
                chapter: 1,
                verse: v.verse,
                isBookSuggestion: true
            }));
        }
        
        return [];
    } catch (error) {
        console.error('Error buscando en API:', error);
        return [];
    }
}

async function fetchVerse(bookId, chapter, verse) {
    try {
        const chapterData = await fetchChapter(bookId, chapter);
        const verseData = chapterData.find(v => v.verse === verse);
        return verseData || null;
    } catch (error) {
        console.error('Error obteniendo versículo:', error);
        return null;
    }
}

async function fetchChapter(bookId, chapter) {
    try {
        const url = `${CONFIG.bibleApiBase}/get-chapter/NTV/${bookId}/${chapter}/`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error obteniendo capítulo:', error);
        return [];
    }
}

function cleanVerseText(html) {
    if (!html) return '';
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Inicializar búsqueda de versículos
function initVerseSearch() {
    const verseInput = document.getElementById('verseInput');
    const verseSuggestions = document.getElementById('verseSuggestions');
    
    if (!verseInput || !verseSuggestions) return;
    
    let searchTimeout = null;
    
    verseInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        if (searchTimeout) clearTimeout(searchTimeout);
        
        if (query.length < 2) {
            verseSuggestions.innerHTML = '';
            verseSuggestions.classList.remove('show');
            return;
        }
        
        searchTimeout = setTimeout(async () => {
            verseSuggestions.innerHTML = '<div class="verse-loading">Buscando...</div>';
            verseSuggestions.classList.add('show');
            
            const results = await searchBibleAPI(query);
            
            if (results.length === 0) {
                verseSuggestions.innerHTML = '<div class="verse-no-results">No se encontraron resultados</div>';
                return;
            }
            
            verseSuggestions.innerHTML = results.map(r => `
                <div class="verse-suggestion" data-ref="${r.reference}" data-text="${encodeURIComponent(r.text)}">
                    <div class="verse-suggestion-ref">${r.reference}</div>
                    <div class="verse-suggestion-text">${r.text.substring(0, 100)}${r.text.length > 100 ? '...' : ''}</div>
                </div>
            `).join('');
            
            // Agregar eventos de click
            verseSuggestions.querySelectorAll('.verse-suggestion').forEach(el => {
                el.addEventListener('click', () => {
                    selectVerse(el.dataset.ref, decodeURIComponent(el.dataset.text));
                });
            });
        }, 300);
    });
    
    // Cerrar sugerencias al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.verse-input-container')) {
            verseSuggestions.classList.remove('show');
        }
    });
}

function selectVerse(reference, text) {
    selectedVerse = reference;
    selectedVerseText = text;
    
    document.getElementById('verseInput').value = reference;
    document.getElementById('verseSuggestions').classList.remove('show');
    
    // Mostrar preview
    const preview = document.getElementById('versePreview');
    document.getElementById('versePreviewRef').textContent = reference;
    document.getElementById('versePreviewText').textContent = text;
    preview.classList.add('show');
    
    validateUploadForm();
}

function clearVerseSelection() {
    selectedVerse = null;
    selectedVerseText = null;
    document.getElementById('verseInput').value = '';
    document.getElementById('versePreview').classList.remove('show');
    validateUploadForm();
}
