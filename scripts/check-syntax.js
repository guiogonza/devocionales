const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const ignoredDirectories = new Set(['.git', 'android', 'node_modules', 'www']);
const files = [];

function collectJavaScriptFiles(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (!ignoredDirectories.has(entry.name)) {
                collectJavaScriptFiles(path.join(directory, entry.name));
            }
            continue;
        }

        if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(path.join(directory, entry.name));
        }
    }
}

collectJavaScriptFiles(rootDir);

for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], {
        encoding: 'utf8'
    });

    if (result.status !== 0) {
        process.stderr.write(result.stderr);
        process.exitCode = 1;
    }
}

if (!process.exitCode) {
    console.log(`Sintaxis válida en ${files.length} archivos JavaScript.`);
}
