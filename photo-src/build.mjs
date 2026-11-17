// Builds ../vPhoto.html: bundles src/*.js (+ three.js) into one inline script,
// so the photoreal planner stays a single offline-capable HTML file like the classic one.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const res = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  minify: true,
  target: ['es2020'],
  write: false,
  legalComments: 'none',
  banner: { js: '/* ASP Studio Photo — built from photo-src/ (three.js r160, MIT license, https://threejs.org) */' }
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = readFileSync('template.html', 'utf8').replace('/*__BUNDLE__*/', () => js);
writeFileSync('../vPhoto.html', html);
console.log('vPhoto.html written:', (html.length / 1024).toFixed(0), 'KB');
