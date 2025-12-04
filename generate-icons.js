const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateIcons() {
    const svgPath = path.join(__dirname, 'icons', 'icon.svg');
    const svgBuffer = fs.readFileSync(svgPath);
    
    // Generar diferentes tamaños
    const sizes = [192, 512];
    
    for (const size of sizes) {
        const outputPath = path.join(__dirname, 'icons', `icon-${size}.png`);
        await sharp(svgBuffer)
            .resize(size, size)
            .png()
            .toFile(outputPath);
        console.log(`✅ Generado: icon-${size}.png`);
    }
    
    // También generar logo.png (192x192 por defecto)
    const logoPath = path.join(__dirname, 'icons', 'logo.png');
    await sharp(svgBuffer)
        .resize(192, 192)
        .png()
        .toFile(logoPath);
    console.log('✅ Generado: logo.png');
    
    console.log('\n🎉 Todos los íconos generados correctamente!');
}

generateIcons().catch(console.error);
