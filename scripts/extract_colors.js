const fs = require('fs');
const PNG = require('pngjs').PNG;
const path = require('path');

const PIECES = ['I', 'O', 'T', 'L', 'J', 'S', 'Z'];
const SAMPLE_DIR = path.join(__dirname, '..', 'color_sample');

function extractDominantColor(pngPath) {
    const data = fs.readFileSync(pngPath);
    const png = PNG.sync.read(data);

    const startX = Math.floor(png.width * 0.25);
    const endX = Math.floor(png.width * 0.75);
    const startY = Math.floor(png.height * 0.25);
    const endY = Math.floor(png.height * 0.75);

    let totalR = 0, totalG = 0, totalB = 0, count = 0;

    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const idx = (png.width * y + x) * 4;
            if (png.data[idx + 3] > 128) {
                totalR += png.data[idx];
                totalG += png.data[idx + 1];
                totalB += png.data[idx + 2];
                count++;
            }
        }
    }

    return {
        r: Math.round(totalR / count),
        g: Math.round(totalG / count),
        b: Math.round(totalB / count),
    };
}

console.log('Extracted colors from color_sample/:\n');

for (const piece of PIECES) {
    const pngPath = path.join(SAMPLE_DIR, `${piece}.png`);
    if (fs.existsSync(pngPath)) {
        const color = extractDominantColor(pngPath);
        console.log(`[Piece.${piece}]: { r: ${color.r}, g: ${color.g}, b: ${color.b} },`);
    } else {
        console.log(`[Piece.${piece}]: File not found`);
    }
}
