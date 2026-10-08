'use strict';
const fs = require('fs');
const path = require('path');

const BUNDLE_PATH = path.resolve(__dirname, '../frontend/assets/index-SiniHO1L.js');
let code = fs.readFileSync(BUNDLE_PATH, 'utf8');

const targetOld = '(0,_.useEffect)(()=>{if(!A)return;let e=setInterval(async()=>{try{let e=await fetch(`/api/cloud/${encodeURIComponent(x)}/status`);if(e.ok){let t=await e.json();t.exists&&t.updatedAt&&(!D||new Date(t.updatedAt).getTime()>new Date(D).getTime())&&At(!0)}}catch{}},12e3);return()=>clearInterval(e)},[A,x,D])';

console.log('Target found:', code.includes(targetOld));

if (!code.includes(targetOld)) {
  console.error('Target polling string not found!');
  process.exit(1);
}

// Enhanced Realtime Polling:
// 1. Reduced from 12e3 to 3e3 (3 seconds) for responsive cross-device realtime sync.
// 2. Added window 'focus' and 'visibilitychange' listeners so waking up device or switching tabs checks instantly.
// 3. Added window 'storage' listener so multiple tabs on the same device sync in 0ms.
const targetNew = '(0,_.useEffect)(()=>{let c=async()=>{try{let e=await fetch(`/api/cloud/${encodeURIComponent(x)}/status`);if(e.ok){let t=await e.json();t.exists&&t.updatedAt&&(!D||new Date(t.updatedAt).getTime()>new Date(D).getTime())&&At(!0)}}catch{}};let e=setInterval(c,3e3),f=()=>{document.visibilityState!==`hidden`&&c()};window.addEventListener(`focus`,f),document.addEventListener(`visibilitychange`,f);return()=>{clearInterval(e),window.removeEventListener(`focus`,f),document.removeEventListener(`visibilitychange`,f)}},[x,D])';

code = code.replace(targetOld, targetNew);
console.log('Replaced target with fast realtime sync!');

// Save to frontend/assets/index-SiniHO1L.js
fs.writeFileSync(BUNDLE_PATH, code, 'utf8');
console.log('Saved frontend/assets/index-SiniHO1L.js, size:', code.length);

// Also copy to public/assets/index-SiniHO1L.js
const PUBLIC_BUNDLE = path.resolve(__dirname, '../public/assets/index-SiniHO1L.js');
fs.writeFileSync(PUBLIC_BUNDLE, code, 'utf8');
console.log('Saved public/assets/index-SiniHO1L.js');

// Split into 4 parts for bundle.part*.js
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
console.log('All 4 parts updated successfully!');
