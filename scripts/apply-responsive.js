'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BUNDLE_PATH = path.resolve(__dirname, '../frontend/assets/index-SiniHO1L.js');
let code = fs.readFileSync(BUNDLE_PATH, 'utf8');
console.log('Original bundle size:', code.length);

function replaceUnique(search, replacement, name) {
  const parts = code.split(search);
  if (parts.length === 1) {
    throw new Error(`[${name}] Search string NOT found!`);
  }
  if (parts.length > 2) {
    throw new Error(`[${name}] Search string found MULTIPLE times (${parts.length - 1})!`);
  }
  code = parts.join(replacement);
  console.log(`[${name}] OK`);
}

// 1. Header logo title button: add whitespace-nowrap and responsive sizing
const headerLogoOld = '(0,K.jsx)(`button`,{onClick:()=>n(`dashboard`),className:`text-left group`,children:(0,K.jsx)(`span`,{className:`text-xl font-extrabold tracking-tight text-blue-700 group-hover:text-blue-800 transition-colors`,children:`SỔ CHỦ NHIỆM`})})';
const headerLogoNew = '(0,K.jsx)(`button`,{onClick:()=>n(`dashboard`),className:`text-left group flex-shrink-0 whitespace-nowrap`,children:(0,K.jsx)(`span`,{className:`text-base sm:text-lg md:text-xl font-black tracking-tight text-blue-700 group-hover:text-blue-800 transition-colors whitespace-nowrap`,children:`SỔ CHỦ NHIỆM`})})';
replaceUnique(headerLogoOld, headerLogoNew, '1. Header Logo whitespace-nowrap');

// 2. Header cloud-sync button: shrink-0
const headerSyncOld = '(0,K.jsxs)(`button`,{onClick:()=>n(`cloud-sync`),className:`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${r===`monitor`?`bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100`:`bg-sky-50 text-sky-900 border-sky-200 hover:bg-sky-100`}`,title:`Lưu trữ Đám mây & Chia sẻ: Bấm để xem trạng thái đồng bộ`,children:[(0,K.jsx)(Nt,{className:`w-3.5 h-3.5 ${i===`syncing`?`animate-pulse text-amber-500`:`text-blue-600`}`}),(0,K.jsx)(`span`,{className:`font-bold`,children:r===`monitor`?`⭐️ Lớp trưởng`:`👑 GVCN`}),(0,K.jsx)(`span`,{className:`w-2 h-2 rounded-full ${i===`synced`?`bg-emerald-500`:i===`syncing`?`bg-amber-500 animate-ping`:`bg-slate-300`}`})]}),r===`teacher`?(0,K.jsxs)(`button`,{onClick:()=>o(!0),className:`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 shadow-2xs whitespace-nowrap`,title:`Khóa các nút chức năng và chỉ định quyền nhập dữ liệu cho Lớp trưởng`,children:[(0,K.jsx)(nn,{className:`w-3.5 h-3.5 text-blue-600`}),(0,K.jsx)(`span`,{className:`hidden sm:inline`,children:`Phân quyền Lớp trưởng`}),(0,K.jsx)(`span`,{className:`sm:hidden`,children:`Khóa nút`})]}):(0,K.jsxs)(`button`,{onClick:()=>s(!0),className:`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors border border-amber-300 shadow-2xs whitespace-nowrap`,title:`Nhập mã PIN để mở khóa toàn bộ quyền Giáo viên chủ nhiệm`,children:[(0,K.jsx)(tn,{className:`w-3.5 h-3.5 text-amber-700`}),(0,K.jsx)(`span`,{className:`hidden sm:inline`,children:`Mở khóa quyền GVCN`}),(0,K.jsx)(`span`,{className:`sm:hidden`,children:`Mở khóa`})]})';
const headerSyncNew = '(0,K.jsxs)(`button`,{onClick:()=>n(`cloud-sync`),className:`inline-flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 text-xs font-semibold rounded-lg border transition-all shrink-0 whitespace-nowrap ${r===`monitor`?`bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100`:`bg-sky-50 text-sky-900 border-sky-200 hover:bg-sky-100`}`,title:`Lưu trữ Đám mây & Chia sẻ: Bấm để xem trạng thái đồng bộ`,children:[(0,K.jsx)(Nt,{className:`w-3.5 h-3.5 ${i===`syncing`?`animate-pulse text-amber-500`:`text-blue-600`}`}),(0,K.jsx)(`span`,{className:`font-bold text-[11px] sm:text-xs`,children:r===`monitor`?`⭐️ Lớp trưởng`:`👑 GVCN`}),(0,K.jsx)(`span`,{className:`w-2 h-2 rounded-full ${i===`synced`?`bg-emerald-500`:i===`syncing`?`bg-amber-500 animate-ping`:`bg-slate-300`}`})]}),r===`teacher`?(0,K.jsxs)(`button`,{onClick:()=>o(!0),className:`inline-flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 shadow-2xs whitespace-nowrap shrink-0`,title:`Khóa các nút chức năng và chỉ định quyền nhập dữ liệu cho Lớp trưởng`,children:[(0,K.jsx)(nn,{className:`w-3.5 h-3.5 text-blue-600`}),(0,K.jsx)(`span`,{className:`hidden sm:inline`,children:`Phân quyền Lớp trưởng`}),(0,K.jsx)(`span`,{className:`sm:hidden`,children:`Khóa nút`})]}):(0,K.jsxs)(`button`,{onClick:()=>s(!0),className:`inline-flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors border border-amber-300 shadow-2xs whitespace-nowrap shrink-0`,title:`Nhập mã PIN để mở khóa toàn bộ quyền Giáo viên chủ nhiệm`,children:[(0,K.jsx)(tn,{className:`w-3.5 h-3.5 text-amber-700`}),(0,K.jsx)(`span`,{className:`hidden sm:inline`,children:`Mở khóa quyền GVCN`}),(0,K.jsx)(`span`,{className:`sm:hidden`,children:`Mở khóa`})]})';
replaceUnique(headerSyncOld, headerSyncNew, '2. Header cloud-sync & permission buttons responsive');

// 3. Header action buttons: hide on mobile to fit screen comfortably
const headerActionsOld = '(0,K.jsxs)(`button`,{onClick:()=>a(!0),className:`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors border border-amber-300 shadow-2xs whitespace-nowrap`,title:`Bảo vệ bản quyền ứng dụng và cơ sở dữ liệu lớp học`,children:[(0,K.jsx)(Dn,{className:`w-3.5 h-3.5 text-amber-600`}),(0,K.jsx)(`span`,{className:`hidden sm:inline`,children:`Bảo vệ bản quyền`}),(0,K.jsx)(`span`,{className:`sm:hidden`,children:`Bản quyền`})]}),(0,K.jsxs)(`button`,{onClick:()=>n(`attendance`),className:`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200/60`,children:[(0,K.jsx)(jn,{className:`w-3.5 h-3.5`}),(0,K.jsx)(`span`,{children:`Điểm danh`})]}),(0,K.jsxs)(`button`,{onClick:()=>n(`discipline`),className:`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-200/60`,title:`Theo dõi nề nếp (Đồng phục, dép lê, thẻ học sinh, điện thoại, ATGT...)`,children:[(0,K.jsx)(En,{className:`w-3.5 h-3.5 text-rose-600`}),(0,K.jsx)(`span`,{children:`Nề nếp`})]}),(0,K.jsxs)(`button`,{onClick:()=>n(`weekly-summary`),className:`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors whitespace-nowrap`,children:[(0,K.jsx)(gn,{className:`w-3.5 h-3.5`}),(0,K.jsx)(`span`,{className:`hidden sm:inline`,children:`Tiết sinh hoạt`})]}),(0,K.jsxs)(`button`,{onClick:()=>n(`ai-assistant`),className:`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors border border-purple-200/60`,title:`Trợ lý A.I GVCN`,children:[(0,K.jsx)(An,{className:`w-3.5 h-3.5`}),(0,K.jsx)(`span`,{className:`hidden md:inline`,children:`Trợ lý A.I`})]})';
const headerActionsNew = '(0,K.jsxs)(`button`,{onClick:()=>a(!0),className:`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors border border-amber-300 shadow-2xs whitespace-nowrap shrink-0`,title:`Bảo vệ bản quyền ứng dụng và cơ sở dữ liệu lớp học`,children:[(0,K.jsx)(Dn,{className:`w-3.5 h-3.5 text-amber-600`}),(0,K.jsx)(`span`,{className:`hidden sm:inline`,children:`Bảo vệ bản quyền`}),(0,K.jsx)(`span`,{className:`sm:hidden`,children:`Bản quyền`})]}),(0,K.jsxs)(`button`,{onClick:()=>n(`attendance`),className:`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200/60 whitespace-nowrap shrink-0`,children:[(0,K.jsx)(jn,{className:`w-3.5 h-3.5`}),(0,K.jsx)(`span`,{children:`Điểm danh`})]}),(0,K.jsxs)(`button`,{onClick:()=>n(`discipline`),className:`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-200/60 whitespace-nowrap shrink-0`,title:`Theo dõi nề nếp (Đồng phục, dép lê, thẻ học sinh, điện thoại, ATGT...)`,children:[(0,K.jsx)(En,{className:`w-3.5 h-3.5 text-rose-600`}),(0,K.jsx)(`span`,{children:`Nề nếp`})]}),(0,K.jsxs)(`button`,{onClick:()=>n(`weekly-summary`),className:`hidden lg:inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0`,children:[(0,K.jsx)(gn,{className:`w-3.5 h-3.5`}),(0,K.jsx)(`span`,{children:`Tiết sinh hoạt`})]}),(0,K.jsxs)(`button`,{onClick:()=>n(`ai-assistant`),className:`hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors border border-purple-200/60 whitespace-nowrap shrink-0`,title:`Trợ lý A.I GVCN`,children:[(0,K.jsx)(An,{className:`w-3.5 h-3.5`}),(0,K.jsx)(`span`,{className:`hidden md:inline`,children:`Trợ lý A.I`})]})';
replaceUnique(headerActionsOld, headerActionsNew, '3. Header Action buttons responsive visibility');

// 4. Quick Access Title & Lock Button row: wrap nicely on mobile
const quickAccessOld = '(0,K.jsxs)(`div`,{className:`flex items-center justify-between mb-2.5 px-0.5`,children:[(0,K.jsxs)(`div`,{className:`flex items-center gap-2`,children:[(0,K.jsx)(`span`,{className:`text-xs font-bold text-slate-500 uppercase tracking-wider`,children:`Truy cập nhanh`})';
const quickAccessNew = '(0,K.jsxs)(`div`,{className:`flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5 px-0.5`,children:[(0,K.jsxs)(`div`,{className:`flex items-center gap-2 flex-wrap`,children:[(0,K.jsx)(`span`,{className:`text-xs font-bold text-slate-500 uppercase tracking-wider`,children:`Truy cập nhanh`})';
replaceUnique(quickAccessOld, quickAccessNew, '4. Quick Access Title & Lock Button responsive wrap');

// 5a. App Shell main padding & setTab
const appShellStartOld = 'bw=()=>{let{currentTab:e,settings:t,userRole:n,isConductModalOpen:r,setIsConductModalOpen:i,conductModalMonth:a,isCopyrightModalOpen:o,setIsCopyrightModalOpen:s}=rt(),[c,l]=(0,_.useState)(!1);return(0,K.jsxs)(`div`,{className:`min-h-screen bg-slate-50 flex`,children:[(0,K.jsx)(Yn,{isOpen:c,onClose:()=>l(!1)}),(0,K.jsxs)(`div`,{className:`flex-1 flex flex-col min-w-0 min-h-screen`,children:[(0,K.jsx)(Jn,{onToggleSidebar:()=>l(!c)}),(0,K.jsx)(`main`,{className:`flex-1 p-4 md:p-6 lg:p-8 max-w-(--breakpoint-2xl) w-full mx-auto`';
const appShellStartNew = 'bw=()=>{let{currentTab:e,setCurrentTab:setTab,settings:t,userRole:n,isConductModalOpen:r,setIsConductModalOpen:i,conductModalMonth:a,isCopyrightModalOpen:o,setIsCopyrightModalOpen:s}=rt(),[c,l]=(0,_.useState)(!1);return(0,K.jsxs)(`div`,{className:`min-h-screen bg-slate-50 flex overflow-x-hidden`,children:[(0,K.jsx)(Yn,{isOpen:c,onClose:()=>l(!1)}),(0,K.jsxs)(`div`,{className:`flex-1 flex flex-col min-w-0 min-h-screen`,children:[(0,K.jsx)(Jn,{onToggleSidebar:()=>l(!c)}),(0,K.jsx)(`main`,{className:`flex-1 p-3 sm:p-4 md:p-6 lg:p-8 max-w-(--breakpoint-2xl) w-full mx-auto pb-24 md:pb-8`';
replaceUnique(appShellStartOld, appShellStartNew, '5a. App Shell main padding & setTab');

// 5b. App Shell footer end: inject Mobile Bottom Navigation Bar
const footerEndOld = '(0,K.jsx)(`footer`,{className:`py-4 px-6 border-t border-slate-200 text-center text-xs text-slate-500 bg-white`,children:(0,K.jsxs)(`div`,{className:`flex flex-col sm:flex-row items-center justify-between gap-3 max-w-(--breakpoint-2xl) mx-auto`,children:[(0,K.jsxs)(`div`,{className:`flex items-center gap-2`,children:[(0,K.jsx)(`span`,{className:`font-bold text-slate-800`,children:`Sổ Chủ Nhiệm Số`}),` – Trợ lý cho Giáo viên Chủ nhiệm`,(0,K.jsx)(`span`,{className:`hidden md:inline text-slate-300`,children:`·`}),(0,K.jsxs)(`span`,{className:`hidden md:inline text-slate-500 font-medium`,children:[`Lớp `,t.className,` – `,t.schoolName]})]}),(0,K.jsxs)(`div`,{className:`flex items-center gap-3`,children:[(0,K.jsxs)(`button`,{onClick:()=>s(!0),className:`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg shadow-2xs transition-colors`,title:`Bấm để xem và quản lý bảo vệ bản quyền phần mềm`,children:[(0,K.jsx)(Dn,{className:`w-4 h-4 text-amber-600`}),(0,K.jsx)(`span`,{children:`Bảo vệ bản quyền © 2026`})]}),(0,K.jsxs)(`div`,{className:`flex items-center gap-2 text-slate-400`,children:[(0,K.jsx)(`span`,{className:`font-semibold text-slate-700`,children:t.teacherName}),(0,K.jsx)(`span`,{children:`·`}),(0,K.jsxs)(`span`,{children:[`Năm học `,t.academicYear]})]})]})]})})]}),(0,K.jsx)(Xn,{})';

const mobileNavInject = `,(0,K.jsxs)(\`nav\`,{className:\`mobile-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 py-1.5 px-2 flex items-center justify-around shadow-lg\`,children:[
  (0,K.jsxs)(\`button\`,{type:\`button\`,onClick:()=>setTab(\`dashboard\`),className:\`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all \${e===\`dashboard\`?\`text-blue-700 font-bold bg-blue-50/90 shadow-2xs\`:\`text-slate-500 hover:text-slate-800\`}\`,children:[(0,K.jsx)(Xt,{className:\`w-5 h-5\`}),(0,K.jsx)(\`span\`,{className:\`text-[10px] mt-0.5 tracking-tight font-semibold\`,children:\`Tổng quan\`})]}),
  (0,K.jsxs)(\`button\`,{type:\`button\`,onClick:()=>setTab(\`attendance\`),className:\`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all \${e===\`attendance\`?\`text-blue-700 font-bold bg-blue-50/90 shadow-2xs\`:\`text-slate-500 hover:text-slate-800\`}\`,children:[(0,K.jsx)(vt,{className:\`w-5 h-5\`}),(0,K.jsx)(\`span\`,{className:\`text-[10px] mt-0.5 tracking-tight font-semibold\`,children:\`Điểm danh\`})]}),
  (0,K.jsxs)(\`button\`,{type:\`button\`,onClick:()=>setTab(\`discipline\`),className:\`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all \${e===\`discipline\`?\`text-blue-700 font-bold bg-blue-50/90 shadow-2xs\`:\`text-slate-500 hover:text-slate-800\`}\`,children:[(0,K.jsx)(En,{className:\`w-5 h-5\`}),(0,K.jsx)(\`span\`,{className:\`text-[10px] mt-0.5 tracking-tight font-semibold\`,children:\`Nề nếp\`})]}),
  (0,K.jsxs)(\`button\`,{type:\`button\`,onClick:()=>setTab(\`students\`),className:\`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all \${e===\`students\`?\`text-blue-700 font-bold bg-blue-50/90 shadow-2xs\`:\`text-slate-500 hover:text-slate-800\`}\`,children:[(0,K.jsx)(Kn,{className:\`w-5 h-5\`}),(0,K.jsx)(\`span\`,{className:\`text-[10px] mt-0.5 tracking-tight font-semibold\`,children:\`Học sinh\`})]}),
  (0,K.jsxs)(\`button\`,{type:\`button\`,onClick:()=>l(!0),className:\`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-slate-500 hover:text-slate-800 transition-all\`,children:[(0,K.jsx)(on,{className:\`w-5 h-5\`}),(0,K.jsx)(\`span\`,{className:\`text-[10px] mt-0.5 tracking-tight font-semibold\`,children:\`Menu\`})]})
]})`;

const footerEndNew = footerEndOld.replace(']})})]}),(0,K.jsx)(Xn,{})', `]})})]})${mobileNavInject},(0,K.jsx)(Xn,{})`);
replaceUnique(footerEndOld, footerEndNew, '5b. App Shell footer end with Mobile Bottom Nav');

// Validate syntax
console.log('Validating patched bundle syntax with node -c...');
const testPath = path.resolve(__dirname, '../frontend/assets/test-responsive-bundle.mjs');
fs.writeFileSync(testPath, code, 'utf8');
execSync(`node -c "${testPath}"`);
console.log('ALL SYNTAX CHECKS PASSED PERFECTLY!');
fs.unlinkSync(testPath);

// Write to frontend/assets/index-SiniHO1L.js
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

console.log('SUCCESSFULLY COMPLETED RESPONSIVE BUNDLE UPDATE!');
