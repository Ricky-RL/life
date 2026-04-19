import esbuild from 'esbuild';
import { cpSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'dist');
const watch = process.argv.includes('--watch');

const entryPoints = [
  'background/service-worker.js',
  'popup/popup.js',
  'content/content.js',
  'options/options.js',
];

const staticFiles = [
  'manifest.json',
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
}

async function build() {
  copyStatic();

  const ctx = await esbuild.context({
    entryPoints: entryPoints.map(e => resolve(ROOT, e)),
    outbase: ROOT,
    outdir: DIST,
    bundle: true,
    format: 'esm',
    target: ['chrome120'],
    minify: !watch,
    sourcemap: watch ? 'inline' : false,
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
