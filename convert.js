const sharp = require('sharp');
const fs = require('fs');

async function convert() {
    const inputSvg = fs.readFileSync('./app-logo.svg');
    await sharp(inputSvg)
        .resize(1024, 1024)
        .png()
        .toFile('./app-icon.png');

    // Also create a smaller 256x256 one for favicon to be safe
    await sharp(inputSvg)
        .resize(256, 256)
        .png()
        .toFile('./favicon.png');

    console.log('Successfully generated PNGs');
}

convert().catch(console.error);
