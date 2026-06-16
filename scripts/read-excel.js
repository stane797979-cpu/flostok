const XLSX = require('c:/Claude_Project/node_modules/xlsx');
const wb = XLSX.readFile('C:/Users/나/Desktop/발주솔루션/PSI_260206.xlsx');

const smallSheets = [
  'Index', '대시보드', '안전재고', '재고분석', '공급물량',
  '발주리스트', '통합지표', '실출고율', '결품관리',
  '납기준수관리', '수요변동성관리'
];

smallSheets.forEach(name => {
  const ws = wb.Sheets[name];
  if (!ws) return;
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  console.log('\n=== ' + name + ' (' + data.length + '행) ===');
  const maxRows = Math.min(15, data.length);
  for (let i = 0; i < maxRows; i++) {
    const parts = [];
    data[i].forEach((c, j) => {
      if (c !== '' && c !== null && c !== undefined) {
        parts.push('[' + j + ']' + c);
      }
    });
    if (parts.length > 0) {
      console.log('R' + (i + 1) + ': ' + parts.join(' | '));
    }
  }
  console.log('---');
});
