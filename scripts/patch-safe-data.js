'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BUNDLE_PATH = path.resolve(__dirname, '../frontend/assets/index-SiniHO1L.js');
let code = fs.readFileSync(BUNDLE_PATH, 'utf8');
console.log('Original bundle size:', code.length);

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

// 1. At: merge n.data with Be() defaults so no property is ever undefined
const atOld = 'if(n.success&&n.data){return i(n.data),ze(n.data),N(n.activityLogs||[]),O(n.metadata?.updatedAt||new Date().toISOString()),E(`synced`),e||z(`Đã đồng bộ dữ liệu lớp ${x} từ máy chủ!`,`success`),!0}';

const atNew = 'if(n.success&&n.data){let def=Be(),d={...def,...n.data,settings:{...(def.settings||{}),...(n.data.settings||{})},teams:Array.isArray(n.data.teams)&&n.data.teams.length>0?n.data.teams:def.teams,students:Array.isArray(n.data.students)?n.data.students:[],attendance:Array.isArray(n.data.attendance)?n.data.attendance:[],competition:Array.isArray(n.data.competition)?n.data.competition:[],tasks:Array.isArray(n.data.tasks)?n.data.tasks:[],duty:Array.isArray(n.data.duty)?n.data.duty:[],activities:Array.isArray(n.data.activities)?n.data.activities:[],badgeAwards:Array.isArray(n.data.badgeAwards)?n.data.badgeAwards:[],criteria:Array.isArray(n.data.criteria)?n.data.criteria:def.criteria,disciplineCriteria:Array.isArray(n.data.disciplineCriteria)?n.data.disciplineCriteria:def.disciplineCriteria,disciplineRecords:Array.isArray(n.data.disciplineRecords)?n.data.disciplineRecords:[],academicCriteria:Array.isArray(n.data.academicCriteria)?n.data.academicCriteria:def.academicCriteria,academicRecords:Array.isArray(n.data.academicRecords)?n.data.academicRecords:[]};rRef.current=d;return i(d),ze(d),N(n.activityLogs||[]),O(n.metadata?.updatedAt||new Date().toISOString()),E(`synced`),e||z(`Đã đồng bộ dữ liệu lớp ${x} từ máy chủ!`,`success`),!0}';

replaceUnique(atOld, atNew, '1. At merge with Be() defaults');

// 2. Safe useMemo B: (r.students||[]), (r.competition||[])
const memoBOld = 'B=(0,_.useMemo)(()=>{let e=new Map;return r.students.forEach(t=>{e.set(t.id,t.initialPoints||0)}),r.competition.forEach(t=>{if(t.studentId){let n=e.get(t.studentId)||0;e.set(t.studentId,n+t.points)}}),e},[r.students,r.competition])';

const memoBNew = 'B=(0,_.useMemo)(()=>{let e=new Map,stds=r.students||[],comp=r.competition||[];return stds.forEach(t=>{e.set(t.id,t.initialPoints||0)}),comp.forEach(t=>{if(t.studentId){let n=e.get(t.studentId)||0;e.set(t.studentId,n+t.points)}}),e},[r.students,r.competition])';

replaceUnique(memoBOld, memoBNew, '2. memoB safe array access');

// 3. Safe useMemo ne: (r.teams||[]), (r.students||[]), (r.competition||[])
const memoNeOld = 'ne=(0,_.useMemo)(()=>{let e=new Map;return r.teams.forEach(t=>{e.set(t.id,t.directPoints||0)}),r.students.forEach(t=>{let n=B.get(t.id)||0,r=e.get(t.teamId)||0;e.set(t.teamId,r+n)}),r.competition.forEach(t=>{if(t.teamId&&!t.studentId){let n=e.get(t.teamId)||0;e.set(t.teamId,n+t.points)}}),e},[r.teams,r.students,B,r.competition])';

const memoNeNew = 'ne=(0,_.useMemo)(()=>{let e=new Map,teams=r.teams||[],stds=r.students||[],comp=r.competition||[];return teams.forEach(t=>{e.set(t.id,t.directPoints||0)}),stds.forEach(t=>{let n=B.get(t.id)||0,r=e.get(t.teamId)||0;e.set(t.teamId,r+n)}),comp.forEach(t=>{if(t.teamId&&!t.studentId){let n=e.get(t.teamId)||0;e.set(t.teamId,n+t.points)}}),e},[r.teams,r.students,B,r.competition])';

replaceUnique(memoNeOld, memoNeNew, '3. memoNe safe array access');

// 4. Safe useMemo ie: (r.attendance||[]), (r.students||[])
const memoIeOld = 'ie=(0,_.useMemo)(()=>{let e=new Map,t=r.attendance.length;return r.students.forEach(n=>{let i=0,a=0,o=0,s=0,c=0;r.attendance.forEach(e=>{let t=e.statuses[n.id];t===`present`?i++:t===`late`?o++:t===`excused`?(s++,a++):t===`absent`?(c++,a++):i++});let l=Math.max(t,1),u=i+o+s*.5,d=t>0?Math.round(u/l*100):100;e.set(n.id,{studentId:n.id,totalDays:l,presentDays:i,absentDays:a,lateDays:o,excusedDays:s,unexcusedDays:c,rate:Math.min(100,Math.max(0,d))})}),e},[r.students,r.attendance])';

const memoIeNew = 'ie=(0,_.useMemo)(()=>{let e=new Map,att=r.attendance||[],stds=r.students||[],t=att.length;return stds.forEach(n=>{let i=0,a=0,o=0,s=0,c=0;att.forEach(e=>{let t=e?.statuses?.[n.id];t===`present`?i++:t===`late`?o++:t===`excused`?(s++,a++):t===`absent`?(c++,a++):i++});let l=Math.max(t,1),u=i+o+s*.5,d=t>0?Math.round(u/l*100):100;e.set(n.id,{studentId:n.id,totalDays:l,presentDays:i,absentDays:a,lateDays:o,excusedDays:s,unexcusedDays:c,rate:Math.min(100,Math.max(0,d))})}),e},[r.students,r.attendance])';

replaceUnique(memoIeOld, memoIeNew, '4. memoIe safe array access');

// 5. Safe useMemo ae: (r.attendance||[]), (r.students||[])
const memoAeOld = 'ae=(0,_.useMemo)(()=>{let e=P(),t=new Date().getDay()===0,n=r.attendance.find(t=>t.date===e),i=0,a=0,o=0,s=0,c=0;return n&&n.statuses&&Object.keys(n.statuses).length>0?r.students.forEach(e=>{let t=n.statuses[e.id];t===`present`?i++:t===`absent`?a++:t===`late`?o++:t===`excused`?s++:c++}):c=r.students.length,{present:i,absent:a,late:o,excused:s,unmarked:c,isSunday:t,hasRecorded:!!(n&&Object.keys(n.statuses||{}).length>0),total:r.students.length}},[r.attendance,r.students])';

const memoAeNew = 'ae=(0,_.useMemo)(()=>{let e=P(),t=new Date().getDay()===0,att=r.attendance||[],stds=r.students||[],n=att.find(t=>t.date===e),i=0,a=0,o=0,s=0,c=0;return n&&n.statuses&&Object.keys(n.statuses).length>0?stds.forEach(e=>{let t=n.statuses[e.id];t===`present`?i++:t===`absent`?a++:t===`late`?o++:t===`excused`?s++:c++}):c=stds.length,{present:i,absent:a,late:o,excused:s,unmarked:c,isSunday:t,hasRecorded:!!(n&&Object.keys(n.statuses||{}).length>0),total:stds.length}},[r.attendance,r.students])';

replaceUnique(memoAeOld, memoAeNew, '5. memoAe safe array access');

// 6. Safe useMemo leadingTeam: (r.teams||[])
const memoLeadOld = '(0,_.useMemo)(()=>{if(r.teams.length===0)return null;let e=r.teams[0],t=ne.get(e.id)||0;return r.teams.forEach(n=>{let r=ne.get(n.id)||0;r>t&&(t=r,e=n)}),{team:e,points:t}},[r.teams,ne])';

const memoLeadNew = '(0,_.useMemo)(()=>{let teams=r.teams||[];if(teams.length===0)return null;let e=teams[0],t=ne.get(e.id)||0;return teams.forEach(n=>{let r=ne.get(n.id)||0;r>t&&(t=r,e=n)}),{team:e,points:t}},[r.teams,ne])';

replaceUnique(memoLeadOld, memoLeadNew, '6. memoLeadingTeam safe array access');

// Validate script syntax with vm.Script
console.log('Validating bundle syntax with vm.Script...');
try {
  new vm.Script(code);
  console.log('>>> SYNTAX IS 100% VALID! <<<');
} catch (err) {
  console.error('>>> SYNTAX ERROR:', err.message);
  process.exit(1);
}

// Write to frontend/assets/index-SiniHO1L.js
fs.writeFileSync(BUNDLE_PATH, code, 'utf8');
console.log('Saved frontend/assets/index-SiniHO1L.js, size:', code.length);

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

console.log('>>> ALL SAFE GUARDS APPLIED SUCCESSFULLY! <<<');
