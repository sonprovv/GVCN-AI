'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// We re-read git version of index-SiniHO1L.js or reset it first
const BUNDLE_PATH = path.resolve(__dirname, '../frontend/assets/index-SiniHO1L.js');
const { execSync } = require('child_process');
execSync('git checkout -- frontend/assets/index-SiniHO1L.js public/assets/index-SiniHO1L.js');

let code = fs.readFileSync(BUNDLE_PATH, 'utf8');
console.log('Reset bundle to git, size:', code.length);

function replaceUnique(search, replacement, name) {
  const parts = code.split(search);
  if (parts.length === 1) {
    throw new Error(`[${name}] Search string NOT found!`);
  }
  if (parts.length > 2) {
    throw new Error(`[${name}] Search string found multiple times (${parts.length - 1})!`);
  }
  code = parts.join(replacement);
  console.log(`[${name}] OK`);
}

// 1. AppProvider start: declare rRef in the let list, and update rRef.current in useEffect & on render
replaceUnique(
  'nt=({children:e})=>{let[t,n]=(0,_.useState)(`dashboard`),[r,i]=(0,_.useState)(()=>Re()),[a,o]=(0,_.useState)([])',
  'nt=({children:e})=>{let[t,n]=(0,_.useState)(`dashboard`),[r,i]=(0,_.useState)(()=>Re()),rRef=(0,_.useRef)(r),[a,o]=(0,_.useState)([])',
  '1. AppProvider rRef in let declaration'
);

// Update rRef in useEffect and after let declaration
replaceUnique(
  '(0,_.useEffect)(()=>{ze(r)},[r]);',
  '(0,_.useEffect)(()=>{ze(r),rRef.current=r},[r]);rRef.current=r;',
  '1b. rRef.current update'
);

// 2. kt definition: support customData and fallback to rRef.current
const ktOld = 'kt=async e=>{E(`syncing`);try{let t=C===`teacher`?r.settings.teacherName||`GVCN`:`Lớp trưởng (Nguyễn Minh Anh)`,n=e||(C===`teacher`?`GVCN cập nhật dữ liệu lớp`:`Lớp trưởng đồng bộ dữ liệu`),i=await fetch(`/api/cloud/${encodeURIComponent(x)}`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({data:r,role:C,authorName:t,actionSummary:n})});if(!i.ok)throw Error(`Không thể kết nối máy chủ`);let a=await i.json();if(a.success)return E(`synced`),O(a.updatedAt||new Date().toISOString()),a.activityLogs&&N(a.activityLogs),!0;throw Error(a.message||`Lỗi lưu đám mây`)}catch(e){return console.warn(`Lỗi khi lưu lên đám mây:`,e),E(`error`),!1}}';

const ktNew = 'kt=async(e,customData)=>{E(`syncing`);try{let curData=customData||rRef.current||r,t=C===`teacher`?curData?.settings?.teacherName||`GVCN`:`Lớp trưởng (Nguyễn Minh Anh)`,n=e||(C===`teacher`?`GVCN cập nhật dữ liệu lớp`:`Lớp trưởng đồng bộ dữ liệu`),i=await fetch(`/api/cloud/${encodeURIComponent(x)}`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({data:curData,role:C,authorName:t,actionSummary:n})});if(!i.ok)throw Error(`Không thể kết nối máy chủ`);let a=await i.json();if(a.success)return E(`synced`),O(a.updatedAt||new Date().toISOString()),a.activityLogs&&N(a.activityLogs),!0;throw Error(a.message||`Lỗi lưu đám mây`)}catch(e){return console.warn(`Lỗi khi lưu lên đám mây:`,e),E(`error`),!1}}';

replaceUnique(ktOld, ktNew, '2. kt definition with customData and rRef');

// 3. ge definition: importStudents syncs to server immediately
const geOld = 'ge=(e,t,n)=>{i(r=>{let i=[...r.teams];if(n&&n.length>0&&n.forEach(e=>{i.some(t=>t.id===e.id)||i.push(e)}),t===`replace`)return{...r,teams:i,students:e};{let t=r.students.length>0?Math.max(...r.students.map(e=>e.stt)):0,n=e.map((e,n)=>({...e,stt:t+n+1}));return{...r,teams:i,students:[...r.students,...n]}}}),z(`Đã ${t===`replace`?`thay thế và nhập`:`thêm`} thành công ${e.length} học sinh từ file Excel!`,`success`)}';

const geNew = 'ge=(e,t,n)=>{let cur=rRef.current||r,newTeams=[...cur.teams];n&&n.length>0&&n.forEach(e=>{newTeams.some(t=>t.id===e.id)||newTeams.push(e)});let newStudents=t===`replace`?e:(()=>{let t=cur.students.length>0?Math.max(...cur.students.map(e=>e.stt)):0,n=e.map((e,n)=>({...e,stt:t+n+1}));return[...cur.students,...n]})();let nextState={...cur,teams:newTeams,students:newStudents,settings:{...(cur.settings||{}),studentCount:newStudents.length}};rRef.current=nextState;ze(nextState);i(nextState);z(`Đã ${t===`replace`?`thay thế và nhập`:`thêm`} thành công ${e.length} học sinh từ file Excel! Đang đồng bộ lên máy chủ...`,`success`);kt(`Nhập ${e.length} học sinh từ file Excel (${t===`replace`?`Thay thế toàn bộ`:`Thêm vào danh sách`})`,nextState)}';

replaceUnique(geOld, geNew, '3. ge importStudents immediate cloud sync');

// 4. le definition: addStudent
const leOld = 'le=e=>{let t=`hs-${Date.now().toString().slice(-4)}`,n={...e,id:t,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};i(e=>({...e,students:[...e.students,n]})),z(`Đã thêm học sinh ${n.fullName}.`)}';

const leNew = 'le=e=>{let cur=rRef.current||r,t=`hs-${Date.now().toString().slice(-4)}`,n={...e,id:t,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()},nextState={...cur,students:[...cur.students,n],settings:{...(cur.settings||{}),studentCount:cur.students.length+1}};rRef.current=nextState;ze(nextState);i(nextState);z(`Đã thêm học sinh ${n.fullName}.`);kt(`Thêm học sinh: ${n.fullName}`,nextState)}';

replaceUnique(leOld, leNew, '4. le addStudent cloud sync');

// 5. _e definition: updateStudent
const _eOld = '_e=(e,t)=>{i(n=>({...n,students:n.students.map(n=>n.id===e?{...n,...t,updatedAt:new Date().toISOString()}:n)})),z(`Đã cập nhật thông tin học sinh.`)}';

const _eNew = '_e=(e,t)=>{let cur=rRef.current||r,nextState={...cur,students:cur.students.map(n=>n.id===e?{...n,...t,updatedAt:new Date().toISOString()}:n)};rRef.current=nextState;ze(nextState);i(nextState);z(`Đã cập nhật thông tin học sinh.`);kt(`Cập nhật thông tin học sinh`,nextState)}';

replaceUnique(_eOld, _eNew, '5. _e updateStudent cloud sync');

// 6. ve definition: deleteStudent
const veOld = 've=e=>{let t=r.students.find(t=>t.id===e);i(t=>({...t,students:t.students.filter(t=>t.id!==e),competition:t.competition.filter(t=>t.studentId!==e),badgeAwards:t.badgeAwards.filter(t=>t.studentId!==e)})),z(`Đã xóa học sinh ${t?t.fullName:``}.`,`info`)}';

const veNew = 've=e=>{let cur=rRef.current||r,t=cur.students.find(t=>t.id===e),nextState={...cur,students:cur.students.filter(t=>t.id!==e),competition:cur.competition.filter(t=>t.studentId!==e),badgeAwards:cur.badgeAwards.filter(t=>t.studentId!==e),settings:{...(cur.settings||{}),studentCount:Math.max(0,cur.students.length-1)}};rRef.current=nextState;ze(nextState);i(nextState);z(`Đã xóa học sinh ${t?t.fullName:``}.`,`info`);kt(`Xóa học sinh: ${t?t.fullName:e}`,nextState)}';

replaceUnique(veOld, veNew, '6. ve deleteStudent cloud sync');

// 7. ye definition: renumberStudents
const yeOld = 'ye=()=>{i(e=>{let t=e.students.map((e,t)=>({...e,stt:t+1,updatedAt:new Date().toISOString()}));return{...e,students:t}}),z(`Đã đánh số thứ tự từ 1 đến ${r.students.length} thành công.`,`success`)}';

const yeNew = 'ye=()=>{let cur=rRef.current||r,nextState={...cur,students:cur.students.map((e,t)=>({...e,stt:t+1,updatedAt:new Date().toISOString()}))};rRef.current=nextState;ze(nextState);i(nextState);z(`Đã đánh số thứ tự từ 1 đến ${nextState.students.length} thành công.`,`success`);kt(`Đánh lại số thứ tự từ 1 đến ${nextState.students.length}`,nextState)}';

replaceUnique(yeOld, yeNew, '7. ye renumberStudents cloud sync');

// 8. xe definition: clearAllStudents
const xeOld = 'xe=()=>{i(e=>({...e,students:[],competition:e.competition.filter(e=>!e.studentId),badgeAwards:[],classTables:(e.classTables||[]).map(e=>({...e,studentIds:[],leaderId:void 0}))})),z(`Đã xóa toàn bộ danh sách học sinh thành công.`,`info`)}';

const xeNew = 'xe=()=>{let cur=rRef.current||r,nextState={...cur,students:[],competition:cur.competition.filter(e=>!e.studentId),badgeAwards:[],classTables:(cur.classTables||[]).map(e=>({...e,studentIds:[],leaderId:void 0})),settings:{...(cur.settings||{}),studentCount:0}};rRef.current=nextState;ze(nextState);i(nextState);z(`Đã xóa toàn bộ danh sách học sinh thành công.`,`info`);kt(`Xóa toàn bộ danh sách học sinh`,nextState)}';

replaceUnique(xeOld, xeNew, '8. xe clearAllStudents cloud sync');

// 9. dt saveDailyDiscipline: pass fresh nextState
const dtSyncOld = 'A&&kt(`Cập nhật nề nếp ${sessName} ngày ${_} (${g} vi phạm)`)';
const dtSyncNew = '(rRef.current={...rRef.current||r,disciplineRecords:p,competition:m},A&&kt(`Cập nhật nề nếp ${sessName} ngày ${_} (${g} vi phạm)`,rRef.current))';
if (code.includes(dtSyncOld)) {
  replaceUnique(dtSyncOld, dtSyncNew, '9. dt pass fresh state to kt');
}

// 10. ht saveDailyAcademic: pass fresh nextState
const htSyncOld = 'A&&kt(`Cập nhật học tập môn ${u} (${sessName}) ngày ${y}`)';
const htSyncNew = '(rRef.current={...rRef.current||r,academicRecords:g,competition:_},A&&kt(`Cập nhật học tập môn ${u} (${sessName}) ngày ${y}`,rRef.current))';
if (code.includes(htSyncOld)) {
  replaceUnique(htSyncOld, htSyncNew, '10. ht pass fresh state to kt');
}

// Verify syntax with vm.Script BEFORE saving
console.log('Testing script syntax with vm.Script...');
try {
  new vm.Script(code);
  console.log('>>> SYNTAX IS 100% VALID! <<<');
} catch (err) {
  console.error('>>> SYNTAX ERROR:', err.message);
  process.exit(1);
}

// Write to frontend/assets/index-SiniHO1L.js
fs.writeFileSync(BUNDLE_PATH, code, 'utf8');
console.log('Saved frontend/assets/index-SiniHO1L.js, new size:', code.length);

// Write to public/assets/index-SiniHO1L.js
const PUBLIC_BUNDLE = path.resolve(__dirname, '../public/assets/index-SiniHO1L.js');
fs.writeFileSync(PUBLIC_BUNDLE, code, 'utf8');
console.log('Saved public/assets/index-SiniHO1L.js');

// Split into bundle.part0..3.js
const buffer = Buffer.from(code, 'utf8');
const totalLen = buffer.length;
const partSize = Math.ceil(totalLen / 4);
console.log(`Splitting ${totalLen} bytes into 4 parts...`);
for (let i = 0; i < 4; i++) {
  const start = i * partSize;
  const end = Math.min(start + partSize, totalLen);
  const chunk = buffer.subarray(start, end);
  fs.writeFileSync(path.resolve(__dirname, `../frontend/assets/bundle.part${i}.js`), chunk);
  fs.writeFileSync(path.resolve(__dirname, `../public/assets/bundle.part${i}.js`), chunk);
  console.log(`Part ${i}: ${chunk.length} bytes`);
}

console.log('>>> ALL PATCHES APPLIED & VALIDATED SUCCESSFULLY! <<<');
