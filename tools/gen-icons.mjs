// ساخت sharepoint/KBAssets/js/kb-icons.js از آیکن‌های Lucide (مجوز ISC).
// فقط وقتی آیکن جدیدی لازم شد اجرا شود؛ خروجی در مخزن ذخیره شده و برای استقرار به Node نیازی نیست.
//   npm i --no-save lucide-static@0.460.0 && node tools/gen-icons.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.env.LUCIDE_DIR || join(ROOT, 'node_modules/lucide-static/icons');

// نام در سامانه → نام(های) Lucide
const ICONS = {
  home: 'house', search: 'search', x: 'x', menu: 'menu',
  'chevron-left': 'chevron-left', 'chevron-right': 'chevron-right', 'chevron-down': 'chevron-down', 'chevron-up': 'chevron-up',
  'arrow-left': 'arrow-left', 'arrow-right': 'arrow-right', 'arrow-up-right': 'arrow-up-right',
  heart: 'heart', bookmark: 'bookmark', 'bookmark-check': 'bookmark-check', share: 'share-2', link: 'link', unlink: 'unlink', copy: 'copy',
  printer: 'printer', mail: 'mail', eye: 'eye', 'eye-off': 'eye-off', clock: 'clock', calendar: 'calendar', 'calendar-clock': 'calendar-clock',
  user: 'user', users: 'users', 'user-circle': 'circle-user', 'log-in': 'log-in', 'log-out': 'log-out', lock: 'lock', unlock: 'lock-open', globe: 'globe',
  message: 'message-circle', messages: 'messages-square', send: 'send', reply: 'reply', trash: 'trash-2', pencil: 'pencil', plus: 'plus', check: 'check',
  'check-check': 'check-check', 'x-circle': 'circle-x', alert: 'triangle-alert', info: 'info', loader: 'loader-circle',
  'file-text': 'file-text', file: 'file', 'file-audio': 'file-audio', 'file-video': 'file-video', 'file-image': 'file-image',
  'file-archive': 'file-archive', 'file-sheet': 'file-spreadsheet', 'file-code': 'file-code', 'file-plus': 'file-plus', paperclip: 'paperclip',
  download: 'download', upload: 'upload', 'cloud-upload': 'cloud-upload', image: 'image', images: 'images', video: 'video', play: 'play',
  'play-circle': 'circle-play', pause: 'pause', headphones: 'headphones', mic: 'mic', 'book-open': 'book-open', chart: 'chart-column',
  'chart-pie': 'chart-pie', newspaper: 'newspaper', help: 'circle-help', dashboard: 'layout-dashboard', folder: 'folder', 'folder-open': 'folder-open',
  'folder-plus': 'folder-plus', tags: 'tags', tag: 'tag', settings: 'settings', history: 'history', 'shield-check': 'shield-check', star: 'star',
  sparkles: 'sparkles', trending: 'trending-up', flame: 'flame', grid: 'layout-grid', list: 'list', filter: 'filter', sliders: 'sliders-horizontal',
  refresh: 'refresh-cw', external: 'external-link', more: 'ellipsis', 'more-v': 'ellipsis-vertical', save: 'save',
  bold: 'bold', italic: 'italic', underline: 'underline', strike: 'strikethrough', h2: 'heading-2', h3: 'heading-3', ul: 'list', ol: 'list-ordered',
  quote: 'quote', code: 'code', table: 'table', 'align-right': 'align-right', 'align-center': 'align-center', 'align-left': 'align-left',
  'align-justify': 'align-justify', minus: 'minus', undo: 'undo-2', redo: 'redo-2', eraser: 'eraser', maximize: 'maximize-2', minimize: 'minimize-2',
  lightbulb: 'lightbulb', graduation: 'graduation-cap', briefcase: 'briefcase', cpu: 'cpu', monitor: 'monitor', database: 'database',
  building: 'building-2', leaf: 'leaf', handshake: 'handshake', scale: 'scale', megaphone: 'megaphone', target: 'target', rocket: 'rocket',
  award: 'award', zap: 'zap', wrench: 'wrench', puzzle: 'puzzle', layers: 'layers', compass: 'compass', archive: 'archive',
  'archive-restore': 'archive-restore', 'thumbs-up': 'thumbs-up', activity: 'activity', inbox: 'inbox', 'badge-check': 'badge-check',
  'list-checks': 'list-checks', type: 'type', 'shield': 'shield', 'heart-pulse': 'heart-pulse', 'hard-hat': 'hard-hat', factory: 'factory',
  'hand-coins': 'hand-coins', landmark: 'landmark', 'git-branch': 'git-branch', 'circle-dot': 'circle-dot', 'panel-right': 'panel-right',
  'square-pen': 'square-pen', 'text-size': 'a-large-small', hash: 'hash', 'volume': 'volume-2', 'library': 'library-big', 'mouse-pointer': 'mouse-pointer-click'
};

const out = {};
const missing = [];
for (const [name, lucide] of Object.entries(ICONS)) {
  const file = join(SRC, `${lucide}.svg`);
  if (!existsSync(file)) { missing.push(`${name} → ${lucide}`); continue; }
  const svg = readFileSync(file, 'utf8');
  const inner = svg.slice(svg.indexOf('>', svg.indexOf('<svg')) + 1, svg.lastIndexOf('</svg>'))
    .replace(/\s*\n\s*/g, '').replace(/\s+\/>/g, '/>').trim();
  out[name] = inner;
}
if (missing.length) {
  console.error('missing icons:\n  ' + missing.join('\n  '));
  process.exit(1);
}
const body = Object.entries(out).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n');
writeFileSync(join(ROOT, 'sharepoint/KBAssets/js/kb-icons.js'),
  `/* آیکن‌های پایگاه دانش — برگرفته از Lucide (https://lucide.dev)، مجوز ISC. تولید خودکار: tools/gen-icons.mjs */\nwindow.KB_ICONS = {\n${body}\n};\n`);
console.log(`✔ ${Object.keys(out).length} icons`);
