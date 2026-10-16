import Ajv2020 from 'ajv/dist/2020.js';
import standaloneCode from 'ajv/dist/standalone/index.js';
import { readFile, mkdir, writeFile } from 'node:fs/promises';

const schema = JSON.parse(await readFile(new URL('../schemas/project.schema.json', import.meta.url), 'utf8'));
const ajv = new Ajv2020({ strict: false, code: { source: true, esm: true } });
const validator = ajv.compile(schema);
const source = standaloneCode(ajv, validator).replace(/const (\w+) = require\("([^"]+)"\)\.default;/g, (_, name, path) => `import ${name}Module from '${path}.js'; const ${name} = typeof ${name}Module === 'function' ? ${name}Module : ${name}Module.default;`);
await mkdir(new URL('../src/generated/', import.meta.url), { recursive: true });
await writeFile(new URL('../src/generated/project-validator.js', import.meta.url), source);
console.log('Generated CSP-compatible project schema validator.');
