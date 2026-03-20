import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getFiles(dir, filesList = []) {
  if (!fs.existsSync(dir)) return filesList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getFiles(fullPath, filesList);
    } else {
      if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
        filesList.push(fullPath);
      }
    }
  }
  return filesList;
}

const componentsDir = path.join(__dirname, 'src', 'components');
const files = getFiles(componentsDir);

const replacements = [
  // Backgrounds
  { from: /\bbg-white\b/g, to: 'bg-white/[0.02]' },
  { from: /\bbg-slate-50\b/g, to: 'bg-white/[0.04]' },
  { from: /\bbg-slate-100\b/g, to: 'bg-white/[0.06]' },
  { from: /\bbg-slate-200\b/g, to: 'bg-white/[0.08]' },
  
  // Borders
  { from: /\bborder-slate-50\b/g, to: 'border-white/[0.02]' },
  { from: /\bborder-slate-100\b/g, to: 'border-white/[0.05]' },
  { from: /\bborder-slate-200\b/g, to: 'border-white/[0.08]' },
  { from: /\bborder-slate-300\b/g, to: 'border-white/[0.1]' },
  
  // Text
  { from: /\btext-slate-900\b/g, to: 'text-white' },
  { from: /\btext-slate-800\b/g, to: 'text-white' },
  { from: /\btext-slate-700\b/g, to: 'text-slate-200' },
  { from: /\btext-slate-600\b/g, to: 'text-slate-300' },
  { from: /\btext-slate-500\b/g, to: 'text-slate-400' },
  // 400->500 to keep contrast, but let's just leave 400 as 400 or make it 500
  // Actually text-slate-400 is already light-ish in dark mode, but let's keep it 400.
  
  // Shadows
  { from: /\bshadow-sm\b/g, to: 'shadow-lg shadow-black/20' },
  { from: /\bshadow\b/g, to: 'shadow-xl shadow-black/20' },
  
  // Accent Backgrounds (light -> glass dark mode)
  { from: /\bbg-blue-50\b/g, to: 'bg-blue-500/10' },
  { from: /\bbg-emerald-50\b/g, to: 'bg-emerald-500/10' },
  { from: /\bbg-amber-50\b/g, to: 'bg-amber-500/10' },
  { from: /\bbg-red-50\b/g, to: 'bg-red-500/10' },
  { from: /\bbg-purple-50\b/g, to: 'bg-purple-500/10' },
  { from: /\bbg-violet-50\b/g, to: 'bg-violet-500/10' },
  { from: /\bbg-indigo-50\b/g, to: 'bg-indigo-500/10' },
  { from: /\bbg-cyan-50\b/g, to: 'bg-cyan-500/10' },
  
  // Accent Background Hover
  { from: /\bhover:bg-slate-50\b/g, to: 'hover:bg-white/[0.04]' },
  { from: /\bhover:bg-slate-100\b/g, to: 'hover:bg-white/[0.06]' },
  
  { from: /\btext-blue-600\b/g, to: 'text-blue-400' },
  { from: /\btext-blue-700\b/g, to: 'text-blue-300' },
  { from: /\btext-emerald-600\b/g, to: 'text-emerald-400' },
  { from: /\btext-emerald-700\b/g, to: 'text-emerald-300' },
  { from: /\btext-amber-600\b/g, to: 'text-amber-400' },
  { from: /\btext-amber-700\b/g, to: 'text-amber-300' },
  { from: /\btext-red-500\b/g, to: 'text-red-400' },
  { from: /\btext-red-600\b/g, to: 'text-red-400' },
  { from: /\btext-purple-600\b/g, to: 'text-purple-400' },
  { from: /\btext-violet-600\b/g, to: 'text-violet-400' },
];

let totalChanges = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  
  for (const rule of replacements) {
    content = content.replace(rule.from, rule.to);
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    totalChanges++;
    console.log(`Updated: ${path.relative(__dirname, file)}`);
  }
}

console.log(`Finished converting ${totalChanges} components to dark glassmorphism theme.`);
