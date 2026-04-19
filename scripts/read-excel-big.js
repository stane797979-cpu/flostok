const XLSX = require('c:/Claude_Project/node_modules/xlsx');
const wb = XLSX.readFile('C:/Users/나/Desktop/발주솔루션/PSI_260206.xlsx');

// PSI_메인 (102행 x 104열) - 헤더 구조 파악
console.log('=== PSI_메인 (헤더 구조) ===');
const psi = wb.Sheets['PSI_메인'];
const psiData = XLSX.utils.sheet_to_json(psi, { header: 1, defval: '' });
for (let i = 0; i < Math.min(5, psiData.length); i++) {
  const parts = [];
  psiData[i].forEach((c, j) => {
    if (c !== '' && c !== null && c !== undefined) {
      parts.push('[' + j + ']' + c);
    }
  });
  if (parts.length > 0) console.log('R' + (i + 1) + ': ' + parts.slice(0, 40).join(' | '));
}
// 데이터 행 1개 샘플
if (psiData.length > 5) {
  const parts = [];
  psiData[5].forEach((c, j) => {
    if (c !== '' && c !== null && c !== undefined) {
      parts.push('[' + j + ']' + c);
    }
  });
  console.log('R6(샘플): ' + parts.slice(0, 40).join(' | '));
}

console.log('\n=== ABC-XYZ분석 (헤더 구조) ===');
const abc = wb.Sheets['ABC-XYZ분석 (2)'];
const abcData = XLSX.utils.sheet_to_json(abc, { header: 1, defval: '' });
for (let i = 0; i < Math.min(5, abcData.length); i++) {
  const parts = [];
  abcData[i].forEach((c, j) => {
    if (c !== '' && c !== null && c !== undefined) {
      parts.push('[' + j + ']' + c);
    }
  });
  if (parts.length > 0) console.log('R' + (i + 1) + ': ' + parts.slice(0, 40).join(' | '));
}

console.log('\n=== 회전율관리 (헤더 구조) ===');
const turn = wb.Sheets['회전율관리'];
const turnData = XLSX.utils.sheet_to_json(turn, { header: 1, defval: '' });
for (let i = 0; i < Math.min(10, turnData.length); i++) {
  const parts = [];
  turnData[i].forEach((c, j) => {
    if (c !== '' && c !== null && c !== undefined) {
      parts.push('[' + j + ']' + c);
    }
  });
  if (parts.length > 0) console.log('R' + (i + 1) + ': ' + parts.join(' | '));
}

// 재고 시트 - 헤더만
console.log('\n=== 재고 (헤더) ===');
const inv = wb.Sheets['재고'];
const invData = XLSX.utils.sheet_to_json(inv, { header: 1, defval: '' });
for (let i = 0; i < Math.min(3, invData.length); i++) {
  const parts = [];
  invData[i].forEach((c, j) => {
    if (c !== '' && c !== null && c !== undefined) {
      parts.push('[' + j + ']' + c);
    }
  });
  if (parts.length > 0) console.log('R' + (i + 1) + ': ' + parts.slice(0, 20).join(' | '));
}

// 입항스케줄 - 헤더만
console.log('\n=== 입항스케줄 (헤더) ===');
const ship = wb.Sheets['입항스케줄'];
const shipData = XLSX.utils.sheet_to_json(ship, { header: 1, defval: '' });
for (let i = 0; i < Math.min(3, shipData.length); i++) {
  const parts = [];
  shipData[i].forEach((c, j) => {
    if (c !== '' && c !== null && c !== undefined) {
      parts.push('[' + j + ']' + c);
    }
  });
  if (parts.length > 0) console.log('R' + (i + 1) + ': ' + parts.slice(0, 25).join(' | '));
}

// 대시보드 전체
console.log('\n=== 대시보드 (전체) ===');
const dash = wb.Sheets['대시보드'];
const dashData = XLSX.utils.sheet_to_json(dash, { header: 1, defval: '' });
for (let i = 0; i < dashData.length; i++) {
  const parts = [];
  dashData[i].forEach((c, j) => {
    if (c !== '' && c !== null && c !== undefined) {
      parts.push('[' + j + ']' + c);
    }
  });
  if (parts.length > 0) console.log('R' + (i + 1) + ': ' + parts.join(' | '));
}
