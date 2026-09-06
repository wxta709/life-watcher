# HDS 生活监视器 (life-watcher)

> 聊天在幕前发生，生活在页面里继续。
> 一个零依赖、即拷即用的 [hds-interlude](https://gitee.com/MomoiCore/hds-interlude) 配套监视工具：
> CMD 实时滚动机器人日志，浏览器里以**小说排版**阅读角色的每一天。

---

## ✨ 特性

- 📖 **小说排版** —— 按日期自动分章（"第一章 · 2026 年 9 月 4 日"），衬线字体、首行缩进、花饰分隔线，纸书质感
- 🎨 **三类内容分色** —— 章节标题（古铜金）、角色对白（玫瑰红）、你的对白（钢蓝）、日常旁白（琥珀斜体），旁白里嵌的「对话」再高亮一层
- 📺 **双输出同步** —— CMD 窗口滚动日志 + 浏览器实时页面，SSE 推送，新动态 2 秒内双端同步
- 🔍 **搜索** —— 全部匹配高亮、`n/m` 计数、`Enter` / `Shift+Enter` 跳转；可只搜**聊天内容**（「…」对白）或**日常生活**（旁白正文），可限定从某一天开始
- 🗂️ **章节目录** —— 右侧目录点击跳章，滚动自动高亮当前章；宽屏可一键收起沉浸阅读
- 🌗 **日间 / 夜间主题** —— 纸色与墨色一键切换，自动记住选择
- 🔒 **隐私优先** —— 只**只读**访问本机数据库，服务仅监听 `127.0.0.1`，**零外部网络请求**
- 📦 **零依赖** —— 全部使用 Node 内置模块，无需 `npm install`；整个文件夹复制到哪台电脑都能直接用

## 📋 环境要求

| 依赖 | 要求 |
|---|---|
| Node.js | ≥ 22.5（使用内置 `node:sqlite`，版本不足时启动会中文提示） |
| 机器人 | 已部署 [hds-interlude](https://gitee.com/MomoiCore/hds-interlude) 且存在 `data/koishi.db` |

## 🚀 快速开始

**1. 放置** —— 把整个 `life-watcher` 文件夹放进机器人目录：

```text
<机器人目录>\koishi\koishi\
├── data\
│   └── koishi.db        ← 机器人数据库（自动向上识别）
└── life-watcher\        ← 放这里
    ├── life-watcher.js
    ├── life-watcher-console.js
    ├── index.html
    ├── 启动生活监视器.bat
    └── README.md
```

**2. 启动** —— 双击 `启动生活监视器.bat`：

```text
[I] 生活监视器 server listening at http://127.0.0.1:3741
[I] 生活监视器 webui is available at http://127.0.0.1:3741
```

**3. 阅读** —— 浏览器打开 `http://127.0.0.1:3741`，CMD 窗口继续作为日志使用。

## 🔎 搜索

顶栏搜索框：

| 选项 | 说明 |
|---|---|
| 范围类型 | **聊天内容**（「…」对白，含旁白中嵌入的对话）/ **日常生活**（旁白正文）/ 全部内容 |
| 起始日期 | 只搜索这一天及之后的匹配 |

快捷键：`Enter` 下一个匹配 · `Shift+Enter` 上一个 · `Esc` 清除并回到原阅读位置。
切换「全文 / 只看日常」时会保持当前阅读位置，不会跳回末尾。

## ⚙️ 命令行参数

```bash
node life-watcher.js [--port 3741] [--db 数据库路径] [--open]
```

| 参数 | 说明 |
|---|---|
| `--port N` | 指定网页端口（默认 `3741`，被占用时换一个即可） |
| `--db 路径` | 手动指定 koishi.db 位置；默认从脚本所在位置向上自动搜索 |
| `--open` | 启动成功后自动用默认浏览器打开页面 |
| `--limit N` | 页面只加载最近 N 条历史（默认 `0` = 全部加载） |

另有纯终端版本 [`life-watcher-console.js`](life-watcher-console.js)（只有 CMD 彩色日志，无网页界面），适合只需要日志的场景。

## ❓ 常见问题

<details>
<summary><b>提示"未找到 data/koishi.db"</b></summary>

把文件夹放回 `<机器人目录>\koishi\koishi\` 内；或手动指定：

```bash
node life-watcher.js --db "D:\某个路径\data\koishi.db"
```
</details>

<details>
<summary><b>提示"端口已被占用"</b></summary>

```bash
node life-watcher.js --port 3742
```
</details>

<details>
<summary><b>提示需要 Node.js 22.5+</b></summary>

到 [nodejs.org](https://nodejs.org/) 安装 LTS 版本，安装完**重新打开 CMD** 再启动。
</details>

<details>
<summary><b>机器人更新后还能用吗？</b></summary>

能。把整个 `life-watcher` 文件夹复制到新机器人目录的 `koishi\koishi\` 下即可，无需任何重新配置。
</details>

<details>
<summary><b>会泄露聊天记录吗？</b></summary>

不会。数据库只以只读方式打开；网页服务仅监听 `127.0.0.1`（局域网内其他设备无法访问）；程序没有任何外部网络请求，不收集、不上传数据。
</details>

## 🖼️ 界面预览

> TODO：补充截图（日间章节排版 / 夜间主题 / 搜索高亮）

## 🔗 相关项目

- [hds-interlude](https://gitee.com/MomoiCore/hds-interlude) —— 本工具监视的叙事驱动持续聊天插件
