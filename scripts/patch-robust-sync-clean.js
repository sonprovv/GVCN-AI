'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BUNDLE_PATH = path.resolve(__dirname, '../frontend/assets/index-SiniHO1L.js');
let code = fs.readFileSync(BUNDLE_PATH, 'utf8');
console.log('Original bundle size:', code.length);

// 1. makeGe function string
function makeGe() {
  return [
    "ge=async(e,t,n)=>{",
    "  try{",
    "    console.log('[GVCN-Import] importStudents called:',{count:e?e.length:0,mode:t});",
    "    let cur=rRef.current||r||{},",
    "      teamsList=Array.isArray(cur.teams)&&cur.teams.length>0?[...cur.teams]:[",
    "        {id:'team-1',name:'Tổ 1',color:'blue',directPoints:0,createdAt:'2026-09-01'},",
    "        {id:'team-2',name:'Tổ 2',color:'emerald',directPoints:0,createdAt:'2026-09-01'},",
    "        {id:'team-3',name:'Tổ 3',color:'amber',directPoints:0,createdAt:'2026-09-01'},",
    "        {id:'team-4',name:'Tổ 4',color:'purple',directPoints:0,createdAt:'2026-09-01'}",
    "      ];",
    "    if(n&&Array.isArray(n)&&n.length>0){",
    "      n.forEach(team=>{teamsList.some(item=>item.id===team.id)||teamsList.push(team)});",
    "    }",
    "    let curStudents=Array.isArray(cur.students)?cur.students:[];",
    "    let newStudents=t==='replace'?(Array.isArray(e)?e:[]):(()=>{",
    "      let maxStt=curStudents.length>0?Math.max(...curStudents.map(s=>Number(s.stt)||0)):0;",
    "      return [...curStudents,...(Array.isArray(e)?e:[]).map(function(s,idx){return Object.assign({},s,{stt:maxStt+idx+1})})];",
    "    })();",
    "    let nextState=Object.assign({},cur,{",
    "      teams:teamsList,",
    "      students:newStudents,",
    "      attendance:Array.isArray(cur.attendance)?cur.attendance:[],",
    "      competition:Array.isArray(cur.competition)?cur.competition:[],",
    "      tasks:Array.isArray(cur.tasks)?cur.tasks:[],",
    "      duty:Array.isArray(cur.duty)?cur.duty:[],",
    "      activities:Array.isArray(cur.activities)?cur.activities:[],",
    "      badgeAwards:Array.isArray(cur.badgeAwards)?cur.badgeAwards:[],",
    "      criteria:Array.isArray(cur.criteria)?cur.criteria:[],",
    "      settings:Object.assign({},cur.settings||{},{studentCount:newStudents.length})",
    "    });",
    "    rRef.current=nextState;",
    "    ze(nextState);",
    "    i(nextState);",
    "    let modeName=t==='replace'?'thay thế và nhập':'thêm';",
    "    z('Đã '+modeName+' thành công '+newStudents.length+' học sinh từ file Excel! Đang đồng bộ lên máy chủ...','success');",
    "    console.log('[GVCN-Import] Triggering saveToCloud POST...');",
    "    await kt('Nhập '+newStudents.length+' học sinh từ file Excel ('+(t==='replace'?'Thay thế toàn bộ':'Thêm vào danh sách')+')',nextState);",
    "  }catch(err){",
    "    console.error('[GVCN-Import] Lỗi khi nhập học sinh:',err);",
    "    z('Có lỗi khi nhập học sinh: '+err.message,'error');",
    "  }",
    "}"
  ].join('\n');
}

// 2. makeKt function string
function makeKt() {
  return [
    "kt=async(e,customData)=>{",
    "  E('syncing');",
    "  try{",
    "    let curData=customData||rRef.current||r||{},",
    "      roomCode=(x&&String(x).trim())||'12A5',",
    "      t=C==='teacher'?(curData?.settings?.teacherName||'GVCN'):'Lớp trưởng (Nguyễn Minh Anh)',",
    "      n=e||(C==='teacher'?'GVCN cập nhật dữ liệu lớp':'Lớp trưởng đồng bộ dữ liệu');",
    "    console.log('[GVCN-kt] POST /api/cloud/'+roomCode,{action:n,studentCount:curData?.students?.length});",
    "    let i=await fetch('/api/cloud/'+encodeURIComponent(roomCode),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:curData,role:C,authorName:t,actionSummary:n})});",
    "    if(!i.ok)throw Error('Không thể kết nối máy chủ (HTTP '+i.status+')');",
    "    let a=await i.json();",
    "    if(a.success){",
    "      console.log('[GVCN-kt] Cloud save success:',a);",
    "      E('synced');",
    "      O(a.updatedAt||new Date().toISOString());",
    "      a.activityLogs&&N(a.activityLogs);",
    "      return !0;",
    "    }",
    "    throw Error(a.message||'Lỗi lưu đám mây');",
    "  }catch(err){",
    "    console.error('[GVCN-kt] Lỗi khi lưu lên đám mây:',err);",
    "    E('error');",
    "    return !1;",
    "  }",
    "}"
  ].join('\n');
}

// 3. makeD function string (modal PC submit)
function makeD() {
  return [
    "D=async()=>{",
    "  if(!g||!g.success||!g.students||g.students.length===0){",
    "    o('Không có dữ liệu học sinh để nhập.','error');",
    "    return;",
    "  }",
    "  try{",
    "    console.log('[GVCN-Modal] Calling importStudents...',{count:g.students.length,mode:y});",
    "    await a(g.students,y,g.newTeams);",
    "  }catch(err){",
    "    console.error('[GVCN-Modal] Error in D:',err);",
    "    o('Lỗi khi nhập: '+err.message,'error');",
    "  }",
    "  O();",
    "}"
  ].join('\n');
}

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

// 1. Replace ge
const geIdx = code.indexOf('ge=(e,t,n)=>{');
const geEndIdx = code.indexOf(',_e=(e,t)=>{', geIdx);
if (geIdx === -1 || geEndIdx === -1) throw new Error('ge boundary not found!');
const geSnippet = code.slice(geIdx, geEndIdx);
replaceUnique(geSnippet, makeGe(), '1. Bulletproof ge');

// 2. Replace kt
const ktIdx = code.indexOf('kt=async(e,customData)=>{');
const ktEndIdx = code.indexOf(',At=async(e=!1)=>{', ktIdx);
if (ktIdx === -1 || ktEndIdx === -1) throw new Error('kt boundary not found!');
const ktSnippet = code.slice(ktIdx, ktEndIdx);
replaceUnique(ktSnippet, makeKt(), '2. Bulletproof kt');

// 3. Replace D in PC modal
const pcStart = code.indexOf('var PC=');
const dStart = code.indexOf('D=()=>{if(!g||!g.success||g.students.length===0){', pcStart);
const dEnd = code.indexOf(',O=()=>{d(null),', dStart);
if (dStart === -1 || dEnd === -1) throw new Error('D boundary not found in PC!');
const dSnippet = code.slice(dStart, dEnd);
replaceUnique(dSnippet, makeD(), '3. Bulletproof D in PC modal');

// 4. Guard jC (teams list)
const jcSearch = 'let o=new Map;t.forEach(e=>{o.set(e.name.trim().toLowerCase(),e.id)';
const jcReplace = 'let o=new Map;(Array.isArray(t)?t:[]).forEach(e=>{if(!e||!e.name)return;o.set(e.name.trim().toLowerCase(),e.id)';
replaceUnique(jcSearch, jcReplace, '4. Guard jC teams list');

// 5. Validate bundle syntax
console.log('Validating bundle syntax with vm.Script...');
try {
  new vm.Script(code);
  console.log('>>> SYNTAX IS 100% VALID! ZERO ERRORS! <<<');
} catch (err) {
  console.error('>>> SYNTAX ERROR:', err.message);
  process.exit(1);
}

// 6. Write bundle to frontend/assets/index-SiniHO1L.js
fs.writeFileSync(BUNDLE_PATH, code, 'utf8');
console.log('Saved frontend/assets/index-SiniHO1L.js, size:', code.length);

// 7. Write bundle to public/assets/index-SiniHO1L.js
const PUBLIC_BUNDLE = path.resolve(__dirname, '../public/assets/index-SiniHO1L.js');
fs.writeFileSync(PUBLIC_BUNDLE, code, 'utf8');
console.log('Saved public/assets/index-SiniHO1L.js');

// 8. Split into 4 parts
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

// 9. Update cache busting in frontend/index.html and public/index.html
const CACHE_VERSION = '20261009_v4';
['../frontend/index.html', '../public/index.html'].forEach(relPath => {
  const htmlPath = path.resolve(__dirname, relPath);
  let html = fs.readFileSync(htmlPath, 'utf8');
  html = html.replace(
    /\/assets\/index-SiniHO1L\.js(\?v=[^"']*)?/g,
    `/assets/index-SiniHO1L.js?v=${CACHE_VERSION}`
  );
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`Updated cache-buster in ${relPath}`);
});

console.log('>>> ALL ROBUST SYNC PATCHES APPLIED & VALIDATED SUCCESSFULLY! <<<');
