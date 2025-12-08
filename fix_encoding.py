#!/usr/bin/env python3

with open('admin-panel.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Reemplazos de caracteres y emojis mal codificados
replacements = {
    # Caracteres españoles
    '├│': 'ó',
    '├▒': 'ñ', 
    '├¡': 'í',
    '├║': 'ú',
    '├í': 'á',
    '├®': 'é',
    '├¿': '¿',
    # Emojis comunes
    '­ƒøí´©Å': '🛠️',
    '­ƒôï': '📋',
    '­ƒæü´©Å': '👁️',
    '­ƒæÑ': '👤',
    '­ƒöæ': '🔐',
    '­ƒô▒': '📱',
    '­ƒöì': '🔍',
    '­ƒöÉ': '🔒',
    '­ƒÜ¬': '🚪',
    '­ƒæñ': '👑',
    '­ƒùæ´©Å': '🖊️',
    '­ƒÄÁ': '🎁',
    '­ƒÄë': '🎉',
    '­ƒöù': '🔙',
    '­ƒöÄ': '🔄',
    # Emojis adicionales (UTF-8 mal interpretado)
    'ÔåÉ': '⬅️',
    'ÔÅ▒´©Å': '⏱️',
    'Ô£û': '🗑️',
    'Ô£à': '✅',
    'ÔØî': '❌',
    'Ô£Å´©Å': '✏️',
    'ÔØô': '❔',
    'ÔûÂ´©Å': '▶️',
    'ÔÜá': '⚠️',
    'Ô£ö': '✔️',
}

for old, new in replacements.items():
    content = content.replace(old, new)

with open('admin-panel.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done - Fixed encoding and emojis')
