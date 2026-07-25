# NeuroGallery Curator Skill

> 让 Agent 通过自然语言指令自动策划 3D 虚拟展览。

## 概述

本 Skill 让 Agent 能够操作 NeuroGallery 策展系统，通过 HTTP API 自动完成：
1. 根据主题生成展览方案（标题、描述、真实参考链接）
2. 从 Wikimedia Commons 搜索并下载真实图片
3. 写入画廊配置文件并热重载 3D 画廊
4. 切换展览场景（经典画廊 / 动森花园 / 太空站 / 赛博朋克）

所有图片均为**真实来源**（Wikimedia Commons），不使用 AI 生成假图。文字 AI 仅用于整理真实公开事实。

## 前置条件

- NeuroGallery 项目已克隆并安装依赖（`npm install`）
- `server/.env` 中配置了 `AGNES_API_KEY`（用于文字 AI 策展）
- 系统中有 `curl`（用于下载 Wikimedia Commons 图片）
- Node.js v18+

## 启动服务

Agent 首先需要确保画廊和后端服务正在运行：

```sh
cd /path/to/NeuroGallery
npm run dev          # 启动画廊 (5173) + 后端 (3001) + 策展服务 (4000)
```

或者分别启动：
```sh
npm run dev          # 画廊 + 后端
npm run curator      # 策展服务 (4000)
```

## API 参考

### 检查服务状态
```sh
curl -s http://localhost:4000/api/status
```
返回：
```json
{ "backend": true, "gallery": true, "galleryUrl": "http://localhost:5173" }
```

### 策划展览（流式 NDJSON）
```sh
curl -s -N -X POST http://localhost:4000/api/curate \
  -H "Content-Type: application/json" \
  -d '{"theme":"太空探索","count":6,"language":"中文","scene":"gallery"}'
```

参数：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `theme` | string | ✅ | 展览主题（任意语言） |
| `count` | number | ❌ | 展品数量 1-6，默认 6 |
| `language` | string | ❌ | 描述文案语言，默认 "中文" |
| `scene` | string | ❌ | 场景：`gallery` / `animalCrossing` / `space` / `cyberpunk` |

返回格式为 NDJSON 流（每行一个 JSON 对象）：
```json
{"type":"log","step":"init","message":"主题：「太空探索」 数量：6 语言：中文 场景：gallery"}
{"type":"log","step":"start","message":"启动 / 检查现有画廊与后端…"}
{"type":"log","step":"plan","message":"已生成 6 个展品方案，开始生成画作…"}
{"type":"log","step":"image","message":"(1/6) 搜索真实图片：Hubble Space Telescope"}
{"type":"log","step":"image","message":"(1) 已保存 picture1.jpg（来源：Hubble_Space_Telescope.jpg）"}
...
{"type":"done","ok":true,"theme":"太空探索","count":6,"scene":"gallery","galleryUrl":"http://localhost:5173","message":"展览已生成并启动！"}
```

错误时：
```json
{"type":"error","message":"描述错误原因"}
```

### 场景切换

画廊运行时，在前端通过 URL 参数切换场景：
```
http://localhost:5173/?scene=cyberpunk
```

可选场景：`gallery`、`animalCrossing`、`space`、`cyberpunk`

## Agent 使用流程

### 标准策展流程

1. **检查服务状态**
   ```sh
   curl -s http://localhost:4000/api/status
   ```
   如果 `backend` 或 `gallery` 为 false，先启动服务。

2. **策划展览**
   ```sh
   curl -s -N -X POST http://localhost:4000/api/curate \
     -H "Content-Type: application/json" \
     -d '{"theme":"用户指定的主题","count":6,"language":"中文","scene":"gallery"}'
   ```
   解析 NDJSON 流，向用户报告进度。

3. **确认结果**
   - `type: "done"` 且 `ok: true` → 展览已生成
   - 告知用户画廊地址：`http://localhost:5173`
   - 如需切换场景，附上带 `?scene=` 参数的链接

### 示例对话

**用户：** 帮我做一个深海生物的展览

**Agent：**
> 好的，我来为你策划一个「深海生物」主题的 3D 虚拟展览。
>
> 正在调用策展系统...
>
> ✅ 展览已生成！共 6 件展品：
> 1. 深海鮟鱇鱼
> 2. 巨型乌贼
> 3. 水熊虫
> 4. 管水母
> 5. 吸血鬼乌贼
> 6. 黑龙鱼
>
> 🏛️ 画廊地址：http://localhost:5173
>
> 所有图片来自 Wikimedia Commons 真实照片。

### 场景推荐

根据主题推荐场景：
| 主题类型 | 推荐场景 | scene 值 |
|----------|----------|----------|
| 艺术、绘画、经典展览 | 经典画廊 | `gallery` |
| 自然、植物、轻松主题 | 动森花园 | `animalCrossing` |
| 太空、科技、未来主题 | 太空站 | `space` |
| 赛博朋克、霓虹、科幻 | 赛博朋克 | `cyberpunk` |

## 文件结构

```
NeuroGallery/
├── curator/
│   ├── server.js              # 策展服务（HTTP API）
│   └── public/
│       └── index.html         # 策展前端页面
├── server/
│   ├── index.js               # 后端代理（图片/文字 AI）
│   ├── config.json            # API 配置
│   └── .env                   # API 密钥（git-ignored）
├── public/
│   └── textures/
│       └── paintings/
│           ├── painting_data.json    # 画廊配置（策展自动写入）
│           ├── painting_data.backup.json  # 上次配置备份
│           ├── picture1.jpg          # 展品图片（策展自动下载）
│           ├── picture2.jpg
│           └── ...
├── skill/
│   └── SKILL.md               # 本文件
├── src/                       # 前端 Three.js 源码
└── package.json
```

## 注意事项

- **真实图片**：所有展品图片来自 Wikimedia Commons，不使用 AI 生成图片
- **自动备份**：每次策展自动备份当前配置到 `painting_data.backup.json`
- **热重载**：写入配置后 Vite 自动检测变更并刷新画廊，无需重启
- **展位固定**：6 个固定墙面位置（后墙 3 个 + 前墙 3 个），策展只替换内容
- **API 密钥**：仅存在于 `server/.env`，前端 bundle 不含密钥
- **Wikimedia 限流**：连续策展时建议间隔几秒，避免被 Commons API 限流
