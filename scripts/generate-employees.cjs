// Generates src/data/employees.ts from scripts/photo-map.json
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const map = JSON.parse(fs.readFileSync(path.join(__dirname, 'photo-map.json'), 'utf8'));

// Filenames that need a nicer display name than the raw file name
const specials = {
  'IMG_2523 - Kelsey': 'Kelsey',
  'IMG_3635 - Mai Đào': 'Mai Đào',
  'Glosbe - Trần Thị Như Thuyền': 'Glosbe',
  'Handy - Trinh - Thinksmart CSKH': 'Handy',
  'Tracy Imgae - Thuy Trang Nguyen': 'Tracy',
  'Gus (1)': 'Gus',
  'RECON (1)': 'Recon',
};

function titleCase(s) {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function displayName(base) {
  if (specials[base]) return specials[base];
  let n = base.trim().replace(/\s+/g, ' ');
  // "David(1)" -> "David (1)" so duplicates stay distinguishable
  n = n.replace(/\((\d+)\)$/, ' ($1)').replace(/\s+/g, ' ').trim();
  // Normalize ALL-CAPS or all-lowercase file names to Title Case
  if (n === n.toUpperCase() || n === n.toLowerCase()) n = titleCase(n);
  return n;
}

const entries = map
  .map(({ slug, name }) => ({ slug, name: displayName(name) }))
  .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

const lines = entries.map(
  e => `  { id: '${e.slug}', name: ${JSON.stringify(e.name)}, imageUrl: '/employees/thumbs/${e.slug}.jpg' },`
);

const out = `export interface Employee {
  id: string;
  name: string;
  imageUrl: string;
}

// ============================================================
// FILE NÀY ĐƯỢC SINH TỰ ĐỘNG từ ảnh trong public/employees/
// Khi thêm/bớt/đổi ảnh: chạy lại 2 lệnh sau ở thư mục gốc:
//   powershell -ExecutionPolicy Bypass -File scripts/prepare-photos.ps1
//   node scripts/generate-employees.js
// ============================================================
export const employees: Employee[] = [
${lines.join('\n')}
];
`;

fs.writeFileSync(path.join(root, 'src', 'data', 'employees.ts'), out, 'utf8');
console.log(`Wrote ${entries.length} employees to src/data/employees.ts`);
