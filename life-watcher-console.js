'use strict';
// HDS 生活监视器 —— 独立只读程序，实时显示 hds-interlude 的生活剧本与对话。
// 不修改 bot 任何代码；bot 更新后把本文件与 启动生活监视器.bat 一起复制过去即可继续使用。
//
// 用法: node life-watcher.js [--life] [数据库路径]
//   --life        只显示生活剧本旁白（角色的生活动态），不显示聊天消息
//   数据库路径    手动指定 koishi.db 位置；默认从脚本所在目录向上自动查找 data/koishi.db

const fs = require('node:fs');
const path = require('node:path');

let DatabaseSync;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch (e) {
  console.error('[生活监视器] 本程序需要 Node.js 22.5 或更高版本（内置 node:sqlite 模块）。');
  console.error('[生活监视器] 当前 Node 版本: ' + process.version);
  process.exit(1);
}

const POLL_MS = 2000;
const RECENT_COUNT = 10;
const LIFE_ONLY = process.argv.includes('--life');
const argDb = process.argv.slice(2).find((a) => !a.startsWith('--'));

function findDb() {
  if (argDb) return argDb;
  let dir = __dirname;
  for (let i = 0; i < 4 && dir; i++) {
    for (const candidate of [path.join(dir, 'data', 'koishi.db'), path.join(dir, 'koishi', 'data', 'koishi.db')]) {
      try {
        if (fs.statSync(candidate).isFile()) return candidate;
      } catch (e) {}
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const useColor = Boolean(process.stdout.isTTY) && (!process.stdout.hasColors || process.stdout.hasColors());
const c = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);

function labelOf(entry, charName) {
  if (entry.kind === 'script') return c('93', '【生活剧本】');
  if (entry.kind === 'character-message') return c('92', `【${charName || '角色'}】`);
  if (entry.kind === 'user-message') return c('96', '【用户】');
  if (entry.kind === 'character-platform-action') {
    let action = '';
    try { action = JSON.parse(entry.metadata || '{}').action || ''; } catch (e) {}
    return c('95', '【动作' + (action ? '·' + action : '') + '】');
  }
  return c('90', '【系统】');
}

const wantEntry = (entry) => !LIFE_ONLY || entry.kind === 'script';

function ts(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function fmt(entry, charName) {
  return labelOf(entry, charName) + ' ' + c('90', ts(entry.occurredAt)) + '\n'
    + String(entry.content || '').replace(/<sep\/>/g, '\n');
}

let db = null;
let dbPath = null;

function openDb() {
  try {
    db = new DatabaseSync(dbPath, { readOnly: true });
    return true;
  } catch (e) {
    db = null;
    return false;
  }
}

// bot 写入时可能短暂锁库：查询失败静默返回 null，下一轮重试
function safeQuery(sql, ...params) {
  try { return db.prepare(sql).all(...params); } catch (e) { return null; }
}

function main() {
  dbPath = findDb();
  if (!dbPath) {
    console.error('[生活监视器] 未找到 data/koishi.db。');
    console.error('[生活监视器] 请把本脚本放到 bot 的 koishi 目录（与 package.json 同级），或手动指定数据库路径：');
    console.error('    node life-watcher.js "<数据库文件夹>\\koishi.db"');
    process.exit(1);
  }
  if (!openDb()) {
    console.error('[生活监视器] 无法以只读方式打开数据库: ' + dbPath);
    process.exit(1);
  }

  let charName = '';
  try {
    const row = safeQuery('SELECT setting FROM interlude_story LIMIT 1');
    if (row && row[0]) charName = JSON.parse(row[0].setting).character?.name || '';
  } catch (e) {}

  const line = '─'.repeat(46);
  console.log(line);
  console.log(`  HDS 生活监视器${charName ? ' — ' + charName : ''}${LIFE_ONLY ? '（只看生活剧本）' : ''}`);
  console.log('  数据库: ' + dbPath);
  console.log(`  每 ${POLL_MS / 1000} 秒自动刷新新动态，Ctrl+C 退出`);
  console.log(line);

  const maxRow = safeQuery('SELECT MAX(id) AS m FROM interlude_script_entry');
  let lastId = (maxRow && maxRow[0] && maxRow[0].m) || 0;

  const recentRaw = safeQuery('SELECT * FROM interlude_script_entry ORDER BY id DESC LIMIT ?', LIFE_ONLY ? 200 : RECENT_COUNT);
  const recent = (recentRaw || []).filter(wantEntry).slice(0, RECENT_COUNT).reverse();
  if (recent.length) {
    console.log(c('90', '—— 最近的记录 ——'));
    for (const r of recent) {
      console.log('');
      console.log(fmt(r, charName));
    }
    console.log('');
    console.log(c('90', '—— 以上为历史记录，以下是新动态 ——'));
  } else {
    console.log(c('90', '暂无记录，等待新动态…'));
  }

  setInterval(() => {
    if (!db && !openDb()) return;
    let rows = null;
    try {
      rows = db.prepare('SELECT * FROM interlude_script_entry WHERE id > ? ORDER BY id').all(lastId);
    } catch (e) { rows = null; }
    if (!rows || !rows.length) return;
    for (const r of rows) {
      lastId = r.id;
      if (!wantEntry(r)) continue;
      console.log('');
      console.log(fmt(r, charName));
    }
  }, POLL_MS);
}

main();
