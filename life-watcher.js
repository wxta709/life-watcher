'use strict';
// HDS 生活监视器 Web 版 —— 独立只读程序，与旧版终端监视器互相独立、可同时运行。
// 启动后 CMD 窗口照常滚动打印新动态（日志模式），同时在本机开放一个网页端口，
//
// 用法: node life-watcher.js [--port 3741] [--db 数据库路径] [--open] [--limit N]
//   --port N    指定网页端口（默认 3741）
//   --db 路径   手动指定 koishi.db；默认从脚本所在位置向上自动查找 data/koishi.db
//   --open      启动成功后自动用默认浏览器打开页面
//   --limit N   页面只加载最近 N 条历史（默认 0 = 全部加载）

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { exec } = require('node:child_process');

let DatabaseSync;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch (e) {
  console.error('[生活监视器] 本程序需要 Node.js 22.5 或更高版本（内置 node:sqlite 模块）。');
  console.error('[生活监视器] 当前 Node 版本: ' + process.version);
  process.exit(1);
}

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const PORT = Number(argOf('--port', process.env.LIFE_WATCHER_PORT || 3741)) || 3741;
const DB_ARG = argOf('--db', undefined);
const OPEN_BROWSER = args.includes('--open');
const POLL_MS = 2000;
// 页面初始加载的历史条数：0 = 全部加载（默认）。历史特别多时可用 --limit N 只加载最近 N 条。
const SNAPSHOT_LIMIT = Number(argOf('--limit', 0)) || 0;

function findDb() {
  if (DB_ARG) return DB_ARG;
  let dir = __dirname;
  for (let i = 0; i < 5 && dir; i++) {
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

let db = null;
let dbPath = null;
let lastId = 0;
let charName = '';

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
function safeAll(sql, ...params) {
  try { return db.prepare(sql).all(...params); } catch (e) { return null; }
}

function ts(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function consoleLabel(entry) {
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

function printToConsole(entry) {
  console.log('');
  console.log(consoleLabel(entry) + ' ' + c('90', ts(entry.occurredAt)));
  console.log(String(entry.content || '').replace(/<sep\/>/g, '\n'));
}

// ---------- SSE 实时推送 ----------
const clients = new Set();
function sseSend(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
function broadcast(entry) {
  for (const res of clients) {
    try { sseSend(res, 'entry', entry); } catch (e) {}
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/' || url.pathname === '/index.html') {
    fs.readFile(path.join(__dirname, 'index.html'), (err, buf) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('index.html 缺失');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(buf);
    });
    return;
  }
  if (url.pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    sseSend(res, 'meta', { charName, dbPath, port: PORT });
    let snap;
    if (SNAPSHOT_LIMIT > 0) {
      snap = (safeAll('SELECT * FROM interlude_script_entry ORDER BY id DESC LIMIT ?', SNAPSHOT_LIMIT) || []).reverse();
    } else {
      snap = safeAll('SELECT * FROM interlude_script_entry ORDER BY id') || [];
    }
    sseSend(res, 'snapshot', snap);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`[生活监视器] 端口 ${PORT} 已被占用。换一个端口启动：node life-watcher.js --port 3742`);
    process.exit(1);
  }
  console.error('[生活监视器] 服务错误:', e.message);
});

function main() {
  dbPath = findDb();
  if (!dbPath) {
    console.error('[生活监视器] 未找到 data/koishi.db。');
    console.error('[生活监视器] 请把本文件夹放在 bot 的 koishi 目录内，或用 --db 手动指定数据库路径。');
    process.exit(1);
  }
  if (!openDb()) {
    console.error('[生活监视器] 无法以只读方式打开数据库: ' + dbPath);
    process.exit(1);
  }
  try {
    const row = safeAll('SELECT setting FROM interlude_story LIMIT 1');
    if (row && row[0]) charName = JSON.parse(row[0].setting).character?.name || '';
  } catch (e) {}
  const maxRow = safeAll('SELECT MAX(id) AS m FROM interlude_script_entry');
  lastId = (maxRow && maxRow[0] && maxRow[0].m) || 0;

  server.listen(PORT, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${PORT}/`;
    console.log(`${c('90', '[I] 生活监视器')} server listening at ${c('96', url)}`);
    console.log(`${c('90', '[I] 生活监视器')} webui is available at ${c('96', url)}`);
    console.log(`${c('90', '[I] 生活监视器')} ${charName ? '角色：' + charName + '　' : ''}数据库: ${dbPath}`);
    console.log(`${c('90', '[I] 生活监视器')} 仅监听本机 127.0.0.1，聊天内容不会暴露到局域网；Ctrl+C 退出`);
    if (OPEN_BROWSER && process.platform === 'win32') exec(`start "" "${url}"`);
  });

  setInterval(() => {
    for (const res of clients) {
      try { res.write(': ping\n\n'); } catch (e) {}
    }
  }, 15000);

  setInterval(() => {
    if (!db && !openDb()) return;
    let rows = null;
    try {
      rows = db.prepare('SELECT * FROM interlude_script_entry WHERE id > ? ORDER BY id').all(lastId);
    } catch (e) { rows = null; }
    if (!rows || !rows.length) return;
    lastId = rows[rows.length - 1].id;
    for (const r of rows) {
      printToConsole(r);
      broadcast(r);
    }
  }, POLL_MS);
}

main();
