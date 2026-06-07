// One-off script: regenerate Android launcher icons from the Fuji Studio brand icon (fsicon.png).
// Run with: node scripts/gen-launcher-icons.cjs
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const RES_DIR = path.join(__dirname, '..', 'dashboard', 'android', 'app', 'src', 'main', 'res');
const SOURCE_ICON = path.join(__dirname, '..', '..', 'fsicon.png');

const BG = '#161925'; // brand dark surface — fills the square corners behind the round icon artwork

function buildCircleMask(size) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="#fff"/></svg>`);
}

const LEGACY_SIZES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const FOREGROUND_SIZES = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

async function run() {
  const sourceBuf = fs.readFileSync(SOURCE_ICON);

  for (const [density, size] of Object.entries(LEGACY_SIZES)) {
    const dir = path.join(RES_DIR, `mipmap-${density}`);
    const icon = await sharp(sourceBuf).resize(size, size).png().toBuffer();

    // Square legacy icon: brand-dark background behind the (circular) artwork
    const square = await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
      .composite([{ input: icon }])
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), square);

    // Round variant — same composition, clipped to a circle
    const round = await sharp(square)
      .composite([{ input: buildCircleMask(size), blend: 'dest-in' }])
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), round);

    console.log(`✓ mipmap-${density}/ic_launcher.png + ic_launcher_round.png (${size}x${size})`);
  }

  for (const [density, size] of Object.entries(FOREGROUND_SIZES)) {
    const dir = path.join(RES_DIR, `mipmap-${density}`);
    // Adaptive icon foreground — transparent canvas, icon scaled to ~65% to stay inside the safe zone
    const artSize = Math.round(size * 0.65);
    const art = await sharp(sourceBuf).resize(artSize, artSize).png().toBuffer();
    const offset = Math.round((size - artSize) / 2);
    const fg = await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: art, left: offset, top: offset }])
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), fg);
    console.log(`✓ mipmap-${density}/ic_launcher_foreground.png (${size}x${size})`);
  }

  // Adaptive icon background colour
  const bgXmlPath = path.join(RES_DIR, 'values', 'ic_launcher_background.xml');
  fs.writeFileSync(bgXmlPath, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`);
  console.log(`✓ values/ic_launcher_background.xml -> ${BG}`);
}

run().then(() => console.log('Done.')).catch(e => { console.error(e); process.exit(1); });
