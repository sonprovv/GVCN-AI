'use strict';
const fs = require('fs');
const path = require('path');

const BUNDLE_PATH = path.resolve(__dirname, '../frontend/assets/index-SiniHO1L.js');
let code = fs.readFileSync(BUNDLE_PATH, 'utf8');
console.log('Original bundle size:', code.length);

// 1. Find and remove Button 1: "Điền đủ 46 học sinh (STT 1-46)"
const idx1 = code.indexOf('Điền đủ 46 học sinh');
if (idx1 === -1) {
  console.log('Button 1 not found (maybe already removed)');
} else {
  const start1 = code.lastIndexOf('(0,K.jsxs)(`button`,{onClick:d,', idx1);
  const end1 = code.indexOf(')]}),', idx1) + 5;
  if (start1 === -1 || end1 === 4) {
    throw new Error('Failed to find boundaries for Button 1');
  }
  const btn1Code = code.slice(start1, end1);
  console.log('Found Button 1:', btn1Code.length, 'chars');
  code = code.replace(btn1Code, '');
  console.log('Button 1 removed successfully.');
}

// 2. Find and remove Button 2: "Điền 46 học sinh mẫu"
const idx2 = code.indexOf('Điền 46 học sinh mẫu');
if (idx2 === -1) {
  console.log('Button 2 not found (maybe already removed)');
} else {
  const start2 = code.lastIndexOf(',(0,K.jsxs)(`button`,{type:`button`,onClick:d,', idx2);
  const end2 = code.indexOf(')]})', idx2) + 4;
  if (start2 === -1 || end2 === 3) {
    throw new Error('Failed to find boundaries for Button 2');
  }
  const btn2Code = code.slice(start2, end2);
  console.log('Found Button 2:', btn2Code.length, 'chars');
  code = code.replace(btn2Code, '');
  console.log('Button 2 removed successfully.');
}

// 3. Update empty state description text if present
const oldText = 'Bạn có thể nhập danh sách từ file mẫu Excel đúng hàng đúng cột, điền nhanh 46 em mẫu hoặc thêm thủ công.';
const newText = 'Bạn có thể nhập danh sách từ file mẫu Excel đúng hàng đúng cột hoặc thêm thủ công.';
if (code.includes(oldText)) {
  code = code.replace(oldText, newText);
  console.log('Updated empty state text.');
}

// Save to frontend/assets/index-SiniHO1L.js
fs.writeFileSync(BUNDLE_PATH, code, 'utf8');
console.log('Saved frontend/assets/index-SiniHO1L.js, new size:', code.length);

// Also copy to public/assets/index-SiniHO1L.js
const PUBLIC_BUNDLE = path.resolve(__dirname, '../public/assets/index-SiniHO1L.js');
fs.writeFileSync(PUBLIC_BUNDLE, code, 'utf8');
console.log('Saved public/assets/index-SiniHO1L.js');

// Split into 4 parts for frontend/assets/bundle.part*.js and public/assets/bundle.part*.js
const buffer = Buffer.from(code, 'utf8');
const totalLen = buffer.length;
const partSize = Math.ceil(totalLen / 4);
console.log(`Splitting ${totalLen} bytes into 4 parts of ~${partSize} bytes each...`);

for (let i = 0; i < 4; i++) {
  const start = i * partSize;
  const end = Math.min(start + partSize, totalLen);
  const chunk = buffer.subarray(start, end);
  const fPath = path.resolve(__dirname, `../frontend/assets/bundle.part${i}.js`);
  const pPath = path.resolve(__dirname, `../public/assets/bundle.part${i}.js`);
  fs.writeFileSync(fPath, chunk);
  fs.writeFileSync(pPath, chunk);
  console.log(`Part ${i}: ${chunk.length} bytes written`);
}

console.log('>>> REMOVED 46 BUTTONS AND UPDATED ALL BUNDLES SUCCESSFULLY! <<<');
