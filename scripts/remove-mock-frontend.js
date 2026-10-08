'use strict';
const fs = require('fs');
const path = require('path');

const BUNDLE_PATH = path.resolve(__dirname, '../frontend/assets/index-SiniHO1L.js');
let code = fs.readFileSync(BUNDLE_PATH, 'utf8');

// 1. Replace BLOCK 1 (Le and Re)
const i1 = code.indexOf('Le=`gvcn_360_data_v3`;');
const end1 = code.indexOf('function ze(', i1);
if (i1 === -1 || end1 === -1) {
  throw new Error('Block 1 (Le and Re) not found!');
}
const block1Old = code.slice(i1, end1);

const block1New = `try{localStorage.removeItem(\`gvcn_360_data_v3\`);localStorage.removeItem(\`gvcn_360_data_v2\`)}catch{}Le=\`gvcn_360_data_v4\`;function Re(){try{let e=localStorage.getItem(Le);if(!e)return Be();let t=JSON.parse(e);if(!t||typeof t!==\`object\`)return Be();if(!Array.isArray(t.students))t.students=[];t.students=t.students.map((e,t)=>({...e,stt:t+1}));(!t.disciplineCriteria||!Array.isArray(t.disciplineCriteria)||t.disciplineCriteria.length===0)&&(t.disciplineCriteria=[..._e]);(!t.academicCriteria||!Array.isArray(t.academicCriteria)||t.academicCriteria.length===0)&&(t.academicCriteria=[...ye]);t.disciplineRecords=Array.isArray(t.disciplineRecords)?t.disciplineRecords:[];t.academicRecords=Array.isArray(t.academicRecords)?t.academicRecords:[];t.attendance=Array.isArray(t.attendance)?t.attendance:[];t.competition=Array.isArray(t.competition)?t.competition:[];t.duty=Array.isArray(t.duty)?t.duty:[];return t}catch{return Be()}}`;

code = code.replace(block1Old, block1New);
console.log('Block 1 replaced successfully.');

// 2. Replace BLOCK 2 (Be)
const i2 = code.indexOf('function Be(){');
const end2 = code.indexOf('function Ve(', i2);
if (i2 === -1 || end2 === -1) {
  throw new Error('Block 2 (Be) not found!');
}
const block2Old = code.slice(i2, end2);

const block2New = `function Be(){return{version:\`2.0\`,timestamp:new Date().toISOString(),settings:{...Ce,className:\`12A5\`,schoolName:\`THPT VŨ TIÊN\`,academicYear:\`2026-2027\`,teacherName:\`GVCN Vũ Tiến\`,monitorStudentName:\`Phạm Thị Như Quỳnh\`,studentCount:46},teams:[...we],students:[],attendance:[],criteria:[...Se],competition:[],badgeAwards:[],activities:[],tasks:[],duty:[],classTables:[],teacherNotes:[],parentComms:[],disciplineCriteria:[..._e],disciplineRecords:[],academicCriteria:[...ye],academicRecords:[],monthlyConduct:[]}}`;

code = code.replace(block2Old, block2New);
console.log('Block 2 replaced successfully.');

// 3. Replace BLOCK 3 (At)
const i3 = code.indexOf('At=async(e=!1)=>{');
const end3 = code.indexOf('return(0,_.useEffect)(()=>{At(!0)', i3);
if (i3 === -1 || end3 === -1) {
  throw new Error('Block 3 (At) not found!');
}
const block3Old = code.slice(i3, end3);

const block3New = `At=async(e=!1)=>{e||E(\`syncing\`);try{let t=await fetch(\`/api/cloud/\${encodeURIComponent(x)}\`);if(t.status===404){E(\`synced\`);return!1}if(!t.ok)throw Error(\`Không thể tải dữ liệu đám mây\`);let n=await t.json();if(n.success&&n.data){return i(n.data),ze(n.data),N(n.activityLogs||[]),O(n.metadata?.updatedAt||new Date().toISOString()),E(\`synced\`),e||z(\`Đã đồng bộ dữ liệu lớp \${x} từ máy chủ!\`,\`success\`),!0}throw Error(n.message||\`Lỗi đọc đám mây\`)}catch{return e||(E(\`error\`),z(\`Chưa thể kết nối tới đám mây. Vui lòng kiểm tra lại mạng.\`,\`error\`)),!1}};`;

code = code.replace(block3Old, block3New);
console.log('Block 3 replaced successfully.');

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
