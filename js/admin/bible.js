/**
 * Selector jerarquico de Biblia NTV (Bolls.life)
 * Libro -> Capitulo -> Versiculo
 */

let bibleBooks = null;
let currentSelectedBook = null;
let currentSelectedChapter = null;

async function loadBibleBooks() {
    if (bibleBooks) return bibleBooks;
    
    try {
        const response = await fetch(`${CONFIG.bibleApiBase}/get-books/NTV/`);
        bibleBooks = await response.json();
        console.log('Libros de la Biblia cargados:', bibleBooks.length);
        return bibleBooks;
    } catch (error) {
        console.error('Error cargando libros:', error);
        return [];
    }
}

async function fetchChapter(bookId, chapter) {
    try {
        const url = `${CONFIG.bibleApiBase}/get-chapter/NTV/${bookId}/${chapter}/`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Error obteniendo capitulo:', error);
        return [];
    }
}

function cleanVerseText(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// ============ MODAL DE SELECCION ============

function createBibleSelectorModal() {
    if (document.getElementById('bibleSelectorModal')) return;
    
    const modal = document.createElement('div');
    modal.id = 'bibleSelectorModal';
    modal.className = 'bible-selector-modal';
    modal.innerHTML = `
        <div class="bible-selector-content">
            <div class="bible-selector-header">
                <h3 id="bibleSelectorTitle">Seleccionar Libro</h3>
                <button class="bible-selector-close" onclick="closeBibleSelector()">&times;</button>
            </div>
            <div class="bible-selector-breadcrumb" id="bibleBreadcrumb">
                <span class="breadcrumb-item active">Libro</span>
            </div>
            <div class="bible-selector-search">
                <input type="text" id="bibleSearchInput" placeholder="Buscar libro..." autocomplete="off">
            </div>
            <div class="bible-selector-body" id="bibleSelectorBody">
                <!-- Contenido dinamico -->
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Agregar estilos
    addBibleSelectorStyles();
    
    // Event listener para busqueda
    document.getElementById('bibleSearchInput').addEventListener('input', filterBibleList);
}

function addBibleSelectorStyles() {
    if (document.getElementById('bibleSelectorStyles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'bibleSelectorStyles';
    styles.textContent = `
        .bible-selector-modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 10000;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .bible-selector-modal.show {
            display: flex;
        }
        .bible-selector-content {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border-radius: 16px;
            width: 100%;
            max-width: 500px;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            border: 1px solid rgba(255,255,255,0.1);
        }
        .bible-selector-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .bible-selector-header h3 {
            margin: 0;
            color: #fff;
            font-size: 1.3rem;
        }
        .bible-selector-close {
            background: none;
            border: none;
            color: rgba(255,255,255,0.6);
            font-size: 28px;
            cursor: pointer;
            padding: 0;
            line-height: 1;
        }
        .bible-selector-close:hover {
            color: #fff;
        }
        .bible-selector-breadcrumb {
            display: flex;
            gap: 8px;
            padding: 12px 20px;
            background: rgba(0,0,0,0.2);
            flex-wrap: wrap;
        }
        .breadcrumb-item {
            color: rgba(255,255,255,0.5);
            font-size: 13px;
            cursor: pointer;
            padding: 4px 10px;
            border-radius: 15px;
            background: rgba(255,255,255,0.05);
            transition: all 0.2s;
        }
        .breadcrumb-item:hover {
            background: rgba(255,255,255,0.1);
            color: #fff;
        }
        .breadcrumb-item.active {
            background: var(--primary-color, #4CAF50);
            color: #fff;
            cursor: default;
        }
        .breadcrumb-separator {
            color: rgba(255,255,255,0.3);
            align-self: center;
        }
        .bible-selector-search {
            padding: 15px 20px;
        }
        .bible-selector-search input {
            width: 100%;
            padding: 12px 16px;
            border: none;
            border-radius: 10px;
            background: rgba(255,255,255,0.1);
            color: #fff;
            font-size: 15px;
        }
        .bible-selector-search input::placeholder {
            color: rgba(255,255,255,0.4);
        }
        .bible-selector-search input:focus {
            outline: 2px solid var(--primary-color, #4CAF50);
            background: rgba(255,255,255,0.15);
        }
        .bible-selector-body {
            flex: 1;
            overflow-y: auto;
            padding: 10px 20px 20px;
        }
        .bible-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
            gap: 10px;
        }
        .bible-grid.chapters {
            grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
        }
        .bible-grid.verses {
            grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
        }
        .bible-item {
            padding: 12px 8px;
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 10px;
            color: #fff;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s;
            font-size: 13px;
        }
        .bible-item:hover {
            background: rgba(76, 175, 80, 0.3);
            border-color: var(--primary-color, #4CAF50);
            transform: translateY(-2px);
        }
        .bible-item.book {
            font-weight: 500;
        }
        .bible-item.chapter, .bible-item.verse {
            font-weight: 600;
            font-size: 15px;
        }
        .bible-section-title {
            color: rgba(255,255,255,0.6);
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin: 15px 0 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .bible-section-title:first-child {
            margin-top: 0;
        }
        .verse-preview-box {
            background: rgba(76, 175, 80, 0.15);
            border: 1px solid rgba(76, 175, 80, 0.3);
            border-radius: 12px;
            padding: 15px;
            margin-top: 15px;
        }
        .verse-preview-box .ref {
            color: var(--primary-color, #4CAF50);
            font-weight: 600;
            margin-bottom: 8px;
        }
        .verse-preview-box .text {
            color: rgba(255,255,255,0.9);
            font-style: italic;
            line-height: 1.5;
        }
        .verse-preview-box .actions {
            display: flex;
            gap: 10px;
            margin-top: 15px;
        }
        .verse-preview-box .btn {
            flex: 1;
            padding: 10px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s;
        }
        .verse-preview-box .btn-confirm {
            background: var(--primary-color, #4CAF50);
            color: #fff;
        }
        .verse-preview-box .btn-confirm:hover {
            filter: brightness(1.1);
        }
        .verse-preview-box .btn-cancel {
            background: rgba(255,255,255,0.1);
            color: #fff;
        }
        .verse-preview-box .btn-cancel:hover {
            background: rgba(255,255,255,0.2);
        }
        .loading-spinner {
            text-align: center;
            padding: 40px;
            color: rgba(255,255,255,0.6);
        }
    `;
    document.head.appendChild(styles);
}

// ============ NAVEGACION ============

async function openBibleSelector(targetInputId = 'verseInput') {
    createBibleSelectorModal();
    
    window.bibleTargetInput = targetInputId;
    currentSelectedBook = null;
    currentSelectedChapter = null;
    
    const modal = document.getElementById('bibleSelectorModal');
    modal.classList.add('show');
    
    await showBooks();
    document.getElementById('bibleSearchInput').focus();
}

function closeBibleSelector() {
    const modal = document.getElementById('bibleSelectorModal');
    modal.classList.remove('show');
    currentSelectedBook = null;
    currentSelectedChapter = null;
}

async function showBooks() {
    const body = document.getElementById('bibleSelectorBody');
    const searchInput = document.getElementById('bibleSearchInput');
    
    document.getElementById('bibleSelectorTitle').textContent = 'Seleccionar Libro';
    searchInput.placeholder = 'Buscar libro...';
    searchInput.value = '';
    
    updateBreadcrumb('book');
    
    body.innerHTML = '<div class="loading-spinner">Cargando libros...</div>';
    
    const books = await loadBibleBooks();
    
    // Separar AT y NT
    const oldTestament = books.filter(b => b.bookid <= 39);
    const newTestament = books.filter(b => b.bookid > 39);
    
    let html = '<div class="bible-section-title">Antiguo Testamento</div>';
    html += '<div class="bible-grid" id="booksGrid">';
    html += oldTestament.map(b => `
        <div class="bible-item book" data-bookid="${b.bookid}" data-name="${b.name}" data-chapters="${b.chapters}" onclick="selectBook(${b.bookid}, '${b.name.replace(/'/g, "\\'")}', ${b.chapters})">
            ${b.name}
        </div>
    `).join('');
    html += '</div>';
    
    html += '<div class="bible-section-title">Nuevo Testamento</div>';
    html += '<div class="bible-grid">';
    html += newTestament.map(b => `
        <div class="bible-item book" data-bookid="${b.bookid}" data-name="${b.name}" data-chapters="${b.chapters}" onclick="selectBook(${b.bookid}, '${b.name.replace(/'/g, "\\'")}', ${b.chapters})">
            ${b.name}
        </div>
    `).join('');
    html += '</div>';
    
    body.innerHTML = html;
}

function selectBook(bookId, bookName, chapters) {
    currentSelectedBook = { id: bookId, name: bookName, chapters: chapters };
    showChapters(bookId, bookName, chapters);
}

function showChapters(bookId, bookName, numChapters) {
    const body = document.getElementById('bibleSelectorBody');
    const searchInput = document.getElementById('bibleSearchInput');
    
    document.getElementById('bibleSelectorTitle').textContent = bookName;
    searchInput.placeholder = 'Buscar capitulo...';
    searchInput.value = '';
    
    updateBreadcrumb('chapter', bookName);
    
    let html = '<div class="bible-grid chapters">';
    for (let i = 1; i <= numChapters; i++) {
        html += `<div class="bible-item chapter" onclick="selectChapter(${i})">${i}</div>`;
    }
    html += '</div>';
    
    body.innerHTML = html;
}

async function selectChapter(chapter) {
    currentSelectedChapter = chapter;
    await showVerses(currentSelectedBook.id, currentSelectedBook.name, chapter);
}

async function showVerses(bookId, bookName, chapter) {
    const body = document.getElementById('bibleSelectorBody');
    const searchInput = document.getElementById('bibleSearchInput');
    
    document.getElementById('bibleSelectorTitle').textContent = `${bookName} ${chapter}`;
    searchInput.placeholder = 'Buscar versiculo...';
    searchInput.value = '';
    
    updateBreadcrumb('verse', bookName, chapter);
    
    body.innerHTML = '<div class="loading-spinner">Cargando versiculos...</div>';
    
    const verses = await fetchChapter(bookId, chapter);
    
    let html = '<div class="bible-grid verses">';
    verses.forEach(v => {
        html += `<div class="bible-item verse" onclick="selectVerse(${v.verse}, '${encodeURIComponent(v.text)}')">${v.verse}</div>`;
    });
    html += '</div>';
    
    body.innerHTML = html;
}

async function selectVerse(verseNum, encodedText) {
    const text = cleanVerseText(decodeURIComponent(encodedText));
    const reference = `${currentSelectedBook.name} ${currentSelectedChapter}:${verseNum}`;
    
    // Mostrar preview antes de confirmar
    showVersePreview(reference, text);
}

function showVersePreview(reference, text) {
    const body = document.getElementById('bibleSelectorBody');
    
    body.innerHTML = `
        <div class="verse-preview-box">
            <div class="ref">${reference}</div>
            <div class="text">"${text}"</div>
            <div class="actions">
                <button class="btn btn-cancel" onclick="goBackToVerses()">Cambiar</button>
                <button class="btn btn-confirm" onclick="confirmVerseSelection('${reference.replace(/'/g, "\\'")}', '${encodeURIComponent(text)}')">Seleccionar</button>
            </div>
        </div>
    `;
}

function goBackToVerses() {
    showVerses(currentSelectedBook.id, currentSelectedBook.name, currentSelectedChapter);
}

function confirmVerseSelection(reference, encodedText) {
    const text = decodeURIComponent(encodedText);
    const targetInputId = window.bibleTargetInput || 'verseInput';
    
    // Actualizar variables globales
    selectedVerse = reference;
    selectedVerseText = text;
    
    // Actualizar input
    const input = document.getElementById(targetInputId);
    if (input) input.value = reference;
    
    // Mostrar preview
    let previewId, previewRefId, previewTextId;
    if (targetInputId === 'verseInput') {
        previewId = 'versePreview';
        previewRefId = 'versePreviewRef';
        previewTextId = 'versePreviewText';
    } else if (targetInputId === 'editVerseInput') {
        previewId = 'editVersePreview';
        previewRefId = 'editVersePreviewRef';
        previewTextId = 'editVersePreviewText';
    }
    
    if (previewId) {
        const preview = document.getElementById(previewId);
        const refEl = document.getElementById(previewRefId);
        const textEl = document.getElementById(previewTextId);
        
        if (refEl) refEl.textContent = reference;
        if (textEl) textEl.textContent = text;
        if (preview) preview.classList.add('show');
    }
    
    closeBibleSelector();
    
    // Validar formulario si existe
    if (typeof validateUploadForm === 'function') {
        validateUploadForm();
    }
}

function updateBreadcrumb(level, bookName = null, chapter = null) {
    const breadcrumb = document.getElementById('bibleBreadcrumb');
    
    let html = '';
    
    if (level === 'book') {
        html = '<span class="breadcrumb-item active">Libro</span>';
    } else if (level === 'chapter') {
        html = `
            <span class="breadcrumb-item" onclick="showBooks()">Libro</span>
            <span class="breadcrumb-separator"></span>
            <span class="breadcrumb-item active">${bookName}</span>
        `;
    } else if (level === 'verse') {
        html = `
            <span class="breadcrumb-item" onclick="showBooks()">Libro</span>
            <span class="breadcrumb-separator"></span>
            <span class="breadcrumb-item" onclick="showChapters(${currentSelectedBook.id}, '${bookName.replace(/'/g, "\\'")}', ${currentSelectedBook.chapters})">${bookName}</span>
            <span class="breadcrumb-separator"></span>
            <span class="breadcrumb-item active">Cap. ${chapter}</span>
        `;
    }
    
    breadcrumb.innerHTML = html;
}

function filterBibleList() {
    const searchInput = document.getElementById('bibleSearchInput');
    const query = searchInput.value.toLowerCase().trim();
    
    const items = document.querySelectorAll('#bibleSelectorBody .bible-item');
    
    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        const name = item.dataset.name?.toLowerCase() || '';
        
        if (query === '' || text.includes(query) || name.includes(query)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

// ============ INICIALIZACION ============

function initVerseSearch() {
    const verseInput = document.getElementById('verseInput');
    if (verseInput) {
        verseInput.addEventListener('click', () => openBibleSelector('verseInput'));
        verseInput.addEventListener('focus', () => openBibleSelector('verseInput'));
        verseInput.setAttribute('readonly', 'readonly');
        verseInput.style.cursor = 'pointer';
    }
    
    const editVerseInput = document.getElementById('editVerseInput');
    if (editVerseInput) {
        editVerseInput.addEventListener('click', () => openBibleSelector('editVerseInput'));
        editVerseInput.addEventListener('focus', () => openBibleSelector('editVerseInput'));
        editVerseInput.setAttribute('readonly', 'readonly');
        editVerseInput.style.cursor = 'pointer';
    }
}

function clearVerseSelection() {
    selectedVerse = null;
    selectedVerseText = null;
    
    const input = document.getElementById('verseInput');
    const preview = document.getElementById('versePreview');
    
    if (input) input.value = '';
    if (preview) preview.classList.remove('show');
    
    if (typeof validateUploadForm === 'function') {
        validateUploadForm();
    }
}