# NeuroGallery Curator Skill

> 让 Agent 通过自然语言指令自动策划 3D 虚拟展览。支持本地部署和在线版两种模式。

## 概述

本 Skill 让 Agent 能够操作 NeuroGallery 策展系统，通过 HTTP API 自动完成：
1. 根据主题生成展览方案（标题、描述、真实参考链接）
2. 从 Wikimedia Commons 搜索并下载真实图片
3. 写入画廊配置文件并热重载 3D 画廊
4. 切换展览场景（经典画廊 / 动森花园 / 太空站 / 赛博朋克）

所有图片均为**真实来源**（Wikimedia Commons），不使用 AI 生成假图。文字 AI 仅用于整理真实公开事实。

## 两种使用模式

### 模式 A：在线版（推荐，无需本地部署）

使用已部署的在线服务，用户无需安装任何东西。

**在线服务地址：**
- **画廊**：`https://vvlife.github.io/NeuroGallery/`
- **策展服务**：`https://neurogallery-curator.railway.app`（示例地址，实际以部署为准）
- **后端代理**：`https://neurogallery-api.railway.app`（示例地址）

**Agent 调用流程：**

```sh
# 1. 检查策展服务状态
curl -s https://neurogallery-curator.railway.app/api/status

# 2. 策划展览（流式 NDJSON）
curl -s -N -X POST https://neurogallery-curator.railway.app/api/curate \
  -H "Content-Type: application/json" \
  -d '{"theme":"太空探索","count":6,"language":"中文","scene":"space"}'

# 3. 返回结果中的 galleryUrl 已包含 ?paintings= 参数，直接可用
#    例：https://vvlife.github.io/NeuroGallery/?paintings=https://curator.../painting_data.json&scene=space
```

**用户访问：** 直接打开策展服务返回的 `galleryUrl`，或在画廊 URL 后附加参数：

```
https://vvlife.github.io/NeuroGallery/?scene=cyberpunk
https://vvlife.github.io/NeuroGallery/?paintings=https://curator.../painting_data.json&scene=space
https://vvlife.github.io/NeuroGallery/?apiBase=https://api.../api
```

### 模式 B：本地部署

适合开发、定制或离线使用。

**前置条件：**
- Node.js v18+
- `server/.env` 中配置了 `AGNES_API_KEY`

**启动：**
```sh
cd NeuroGallery
npm install
npm run dev    # 画廊(5173) + 后端(3001) + 策展(4000)
```

**API 端点：**
- 策展服务：`http://localhost:4000`
- 后端代理：`http://localhost:3001`
- 画廊：`http://localhost:5173`

## API 参考

### 检查服务状态
```sh
curl -s <CURATOR_URL>/api/status
```
返回：
```json
{ "backend": true, "gallery": true, "galleryUrl": "https://..." }
```

### 策划展览（流式 NDJSON）
```sh
curl -s -N -X POST <CURATOR_URL>/api/curate \
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
{"type":"log","step":"plan","message":"已生成 6 个展品方案，开始生成画作…"}
{"type":"log","step":"image","message":"(1/6) 搜索真实图片：Hubble Space Telescope"}
...
{"type":"done","ok":true,"theme":"太空探索","count":6,"scene":"gallery","galleryUrl":"https://vvlife.github.io/NeuroGallery/?paintings=https://curator.../painting_data.json","message":"展览已生成并启动！"}
```

**关键：** `done` 消息中的 `galleryUrl` 已包含所有必要参数，直接给用户打开即可。

### 获取当前展览配置
```sh
curl -s <CURATOR_URL>/painting_data.json
```

### 场景切换

画廊运行时，通过 URL 参数切换场景：
```
<GALLERY_URL>?scene=cyberpunk
```

可选场景：`gallery`、`animalCrossing`、`space`、`cyberpunk`

## URL 参数参考

画廊支持以下 URL 参数（可组合使用）：

| 参数 | 说明 | 示例 |
|------|------|------|
| `scene` | 初始场景 | `?scene=space` |
| `paintings` | 远程展品 JSON URL | `?paintings=https://curator.../painting_data.json` |
| `apiBase` | 远程后端 API 地址（用于画架 AI 生成） | `?apiBase=https://api.../api` |

策展页面支持以下 URL 参数：

| 参数 | 说明 | 示例 |
|------|------|------|
| `gallery` | 画廊地址 | `?gallery=https://vvlife.github.io/NeuroGallery/` |
| `backend` | 策展 API 地址 | `?backend=https://curator.../api` |

## Agent 标准流程

### 在线版策展流程

1. **检查服务状态**
   ```sh
   curl -s <CURATOR_URL>/api/status
   ```
   确认 `backend` 为 true（画廊可以为 false，因为远程画廊是纯静态的）。

2. **策划展览**
   ```sh
   curl -s -N -X POST <CURATOR_URL>/api/curate \
     -H "Content-Type: application/json" \
     -d '{"theme":"用户指定的主题","count":6,"language":"中文","scene":"推荐场景"}'
   ```
   解析 NDJSON 流，向用户报告进度。

3. **返回结果**
   - `type: "done"` 且 `ok: true` → 展览已生成
   - 提取 `galleryUrl`，直接给用户打开
   - 如需额外场景切换，在 galleryUrl 上追加 `&scene=xxx`

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
> 🔗 点击查看展览：https://vvlife.github.io/NeuroGallery/?paintings=https://curator.../painting_data.json&scene=space
>
> 所有图片来自 Wikimedia Commons 真实照片。推荐使用太空站场景展示深海生物（深海与太空的视觉风格相似）。

### 场景推荐

根据主题推荐场景：
| 主题类型 | 推荐场景 | scene 值 |
|----------|----------|----------|
| 艺术、绘画、经典展览 | 经典画廊 | `gallery` |
| 自然、植物、轻松主题 | 动森花园 | `animalCrossing` |
| 太空、科技、未来、深海 | 太空站 | `space` |
| 赛博朋克、霓虹、科幻 | 赛博朋克 | `cyberpunk` |

## 部署指南

### 画廊（GitHub Pages，纯静态）

画廊前端自动部署到 GitHub Pages：
1. Push 到 `main` 分支 → GitHub Actions 自动构建并部署
2. 地址：`https://vvlife.github.io/NeuroGallery/`
3. 纯静态，无需服务器

### 策展服务 + 后端代理（Railway / Vercel / Render 等）

策展服务和后端代理需要 Node.js 运行时：

**环境变量配置：**
```env
# 后端代理（server/index.js）
AGNES_API_KEY=sk-xxxx

# 策展服务（curator/server.js）
BACKEND_URL=https://your-backend.railway.app
GALLERY_URL=https://vvlife.github.io/NeuroGallery
PUBLIC_URL=https://your-curator.railway.app
PAINTINGS_DIR=/data/paintings
PORT=$PORT
```

**启动命令：**
```sh
# 后端代理
node server/index.js

# 策展服务
node curator/server.js
```

## 注意事项

- **真实图片**：所有展品图片来自 Wikimedia Commons，不使用 AI 生成图片
- **自动备份**：每次策展自动备份当前配置到 `painting_data.backup.json`
- **热重载**：本地模式下 Vite 自动检测变更并刷新画廊；远程模式下通过 URL 参数 `?paintings=` 加载新配置
- **展位固定**：6 个固定墙面位置（后墙 3 个 + 前墙 3 个），策展只替换内容
- **API 密钥**：仅存在于后端服务的 `.env` 中，前端 bundle 不含密钥
- **Wikimedia 限流**：连续策展时建议间隔几秒，避免被 Commons API 限流
- **CORS**：策展服务和后端代理均设置了 `Access-Control-Allow-Origin: *`，支持跨域调用
