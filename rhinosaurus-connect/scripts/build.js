import esbuild from 'esbuild';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'dist');
const watch = process.argv.includes('--watch');

const staticFiles = [
  'popup/popup.html',
  'popup/popup.css',
  'options/options.html',
  'content/corner-popup.css',
];

const staticDirs = [
  'assets',
];

function copyStatic() {
  for (const file of staticFiles) {
    const src = resolve(ROOT, file);
    const dest = resolve(DIST, file);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest);
  }
  for (const dir of staticDirs) {
    cpSync(resolve(ROOT, dir), resolve(DIST, dir), { recursive: true });
  }

  const manifest = JSON.parse(readFileSync(resolve(ROOT, 'manifest.json'), 'utf-8'));
  delete manifest.background.type;
  mkdirSync(DIST, { recursive: true });
  writeFileSync(resolve(DIST, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

async function build() {
  copyStatic();

  const sharedOptions = {
    outbase: ROOT,
    outdir: DIST,
    bundle: true,
    target: ['chrome120'],
    minify: !watch,
    sourcemap: watch ? 'inline' : false,
  };

  const ctx = await esbuild.context({
    ...sharedOptions,
    entryPoints: [
      resolve(ROOT, 'background/service-worker.js'),
      resolve(ROOT, 'popup/popup.js'),
      resolve(ROOT, 'content/content.js'),
      resolve(ROOT, 'content/spotify-content.js'),
      resolve(ROOT, 'options/options.js'),
    ],
    format: 'iife',
  });

  if (watch) {
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    console.log('Build complete → dist/');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
