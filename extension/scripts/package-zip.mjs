// Zips dist/ into the exact archive format the Chrome Web Store developer
// dashboard accepts for upload (a zip of the built extension's root, with
// manifest.json at the top level of the archive — not inside a subfolder).
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';
import pkg from '../package.json' with { type: 'json' };

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const distDir = join(root, 'dist');
const releaseDir = join(root, 'release');

if (!existsSync(distDir)) {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

await mkdir(releaseDir, { recursive: true });
const outPath = join(releaseDir, `reproflow-extension-v${pkg.version}.zip`);

const output = createWriteStream(outPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`Packaged ${archive.pointer()} bytes.`);
  console.log(`\nUpload this file to the Chrome Web Store developer dashboard:\n  ${outPath}`);
});

archive.on('warning', (err) => {
  throw err;
});
archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);
archive.directory(distDir, false);
await archive.finalize();
