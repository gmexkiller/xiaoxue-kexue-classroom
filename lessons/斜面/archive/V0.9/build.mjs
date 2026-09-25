import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const lesson = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(lesson, '../..');
const source = path.join(lesson, 'src');
const output = path.join(lesson, 'output', '斜面_胡拉拉课堂版.html');
const script = await esbuild.build({
  entryPoints: [path.join(source, 'main.js')],
  bundle: true,
  minify: true,
  write: false,
  format: 'iife',
  target: 'es2020',
  alias: { three: path.join(root, 'vendor', 'three', 'three.module.js') },
  legalComments: 'none',
});
const html = await readFile(path.join(source, 'index.html'), 'utf8');
const css = await readFile(path.join(source, 'styles.css'), 'utf8');
const license = await readFile(path.join(root, 'vendor', 'three', 'LICENSE.txt'), 'utf8');
const notices = JSON.stringify({ three: { version: '0.186.0', license } }).replaceAll('<', '\\u003c');
const built = html
  .replace('/* BUILD_CSS */', () => css)
  .replace('/* BUILD_JS */', () => script.outputFiles[0].text)
  .replace('</body>', `<script type="application/json" id="third-party-notices">${notices}</script>\n</body>`);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, built, 'utf8');
console.log(`${output} (${(Buffer.byteLength(built) / 1024 / 1024).toFixed(1)} MiB)`);
