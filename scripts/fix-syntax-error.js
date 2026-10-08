'use strict';
const fs = require('fs');
const path = require('path');

const BUNDLE_PATH = path.resolve(__dirname, '../frontend/assets/index-SiniHO1L.js');
let code = fs.readFileSync(BUNDLE_PATH, 'utf8');

const oldSyntax = `}],try{localStorage.removeItem(\`gvcn_360_data_v3\`);localStorage.removeItem(\`gvcn_360_data_v2\`)}catch{}Le=\`gvcn_360_data_v4\`;function Re(){try{let e=localStorage.getItem(Le);`;

const newSyntax = `}],Le=\`gvcn_360_data_v4\`;function Re(){try{localStorage.removeItem(\`gvcn_360_data_v3\`);localStorage.removeItem(\`gvcn_360_data_v2\`)}catch{}try{let e=localStorage.getItem(Le);`;

if (!code.includes(oldSyntax)) {
  console.error('oldSyntax not found!');
  process.exit(1);
}

code = code.replace(oldSyntax, newSyntax);
console.log('Fixed syntax error!');

// Save to frontend/assets/index-SiniHO1L.js
fs.writeFileSync(BUNDLE_PATH, code, 'utf8');
console.log('Saved frontend/assets/index-SiniHO1L.js');

// Also copy to public/assets/index-SiniHO1L.js
const PUBLIC_BUNDLE = path.resolve(__dirname, '../public/assets/index-SiniHO1L.js');
fs.writeFileSync(PUBLIC_BUNDLE, code, 'utf8');
console.log('Saved public/assets/index-SiniHO1L.js');

// Split into 4 parts
const buffer = Buffer.from(code, 'utf8');
const totalLen = buffer.length;
const partSize = Math.ceil(totalLen / 4);

for (let i = 0; i < 4; i++) {
  const start = i * partSize;
  const end = Math.min(start + partSize, totalLen);
  const chunk = buffer.subarray(start, end);
  const fPath = path.resolve(__dirname, `../frontend/assets/bundle.part${i}.js`);
  const pPath = path.resolve(__dirname, `../public/assets/bundle.part${i}.js`);
  fs.writeFileSync(fPath, chunk);
  fs.writeFileSync(pPath, chunk);
}
console.log('All 4 parts updated!');
