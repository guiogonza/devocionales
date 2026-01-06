import json

# Leer archivo actual
with open('data/devotionals.json', 'r', encoding='utf-8') as f:
    current = json.load(f)

# Leer backup1
with open('/tmp/backup1.json', 'r', encoding='utf-8') as f:
    backup1 = json.load(f)

# Fusionar (current tiene prioridad)
merged = {**backup1, **current}

# Guardar
with open('data/devotionals.json', 'w', encoding='utf-8') as f:
    json.dump(merged, f, indent=2, ensure_ascii=False)

print('Fusionados:', len(merged), 'devocionales')
