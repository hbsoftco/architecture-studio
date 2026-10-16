import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../dist/', import.meta.url).pathname;
const licenseRoot = join(root, 'licenses');
mkdirSync(licenseRoot, { recursive: true });
for (const name of ['bpmn-js', 'dmn-js', 'mermaid', 'jszip', 'vazirmatn', 'dompurify', 'ajv', 'daisyui']) {
  const packageRoot = new URL(`../node_modules/${name}/`, import.meta.url).pathname;
  const license = ['LICENSE', 'LICENSE.md', 'LICENSE.markdown', 'LICENSE.txt', 'OFL.txt'].map(file => join(packageRoot, file)).find(existsSync);
  if (license) copyFileSync(license, join(licenseRoot, `${name}.txt`));
}
function files(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(path, entry.name)) : [join(path, entry.name)]);
}
const assets = files(root).map(path => '/' + relative(root, path).replaceAll('\\', '/')).filter(path => path !== '/sw.js');
const serviceWorker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
writeFileSync(join(root, 'sw.js'), serviceWorker.replace("['/','/index.html','/manifest.webmanifest','/icon.svg']", JSON.stringify(assets)));
console.log(`Offline cache includes ${assets.length} release files.`);
