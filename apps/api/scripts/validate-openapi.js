// Quick syntactic validation of docs/openapi.yaml: parses YAML and confirms
// every $ref points at a defined component. Run with `node apps/api/scripts/validate-openapi.js`.
const fs = require('fs');
const path = require('path');
const yaml = require('yamljs');
const file = path.resolve(__dirname, '../../../docs/openapi.yaml');
let doc;
try {
  doc = yaml.load(file);
} catch (e) {
  console.error('YAML parse error:', e.message);
  process.exit(1);
}
const paths = Object.keys(doc.paths || {});
const schemas = Object.keys(doc.components?.schemas || {});
console.log('YAML valid.');
console.log('Paths:', paths.length);
console.log('Schemas:', schemas.length);
const text = fs.readFileSync(file, 'utf8');
const re = /\$ref:\s*['"]#\/components\/schemas\/(\w+)['"]/g;
const refs = new Set();
let m;
while ((m = re.exec(text)) !== null) refs.add(m[1]);
const missing = [...refs].filter((r) => !schemas.includes(r));
if (missing.length) {
  console.error('Broken refs:', missing);
  process.exit(2);
}
console.log('All', refs.size, 'distinct $refs resolve.');
