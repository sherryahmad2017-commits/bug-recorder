// Generates the toolbar/store icon set from a simple vector mark (rounded
// square + dot, matching the dashboard's brand mark) so the extension has a
// real, valid icon set to ship with. Swap public/icons/*.png for real
// branding before a public Chrome Web Store listing — see extension/README.md.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'icons');

const SIZES = [16, 32, 48, 128];
const BRAND = '#5865f2';

function svgFor(size) {
  const radius = size * 0.22;
  const dotRadius = size * 0.16;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${radius}" fill="${BRAND}" />
    <circle cx="${size / 2}" cy="${size / 2}" r="${dotRadius}" fill="#ffffff" />
  </svg>`;
}

await mkdir(outDir, { recursive: true });

for (const size of SIZES) {
  const png = await sharp(Buffer.from(svgFor(size))).png().toBuffer();
  await writeFile(join(outDir, `icon-${size}.png`), png);
  console.log(`Wrote public/icons/icon-${size}.png`);
}
