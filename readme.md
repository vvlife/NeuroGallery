<p align="center">
	<br>
    <img src="https://i.imgur.com/0fo4BTJ.png" alt="Neuro-Gallery Logo" width="100">
    <h3 align="center">Neuro-Gallery</h3>
    <br>
</p>

**Neuro-Gallery** is an immersive, interactive 3D art exhibition built with **Three.js** and **Vite**. Step into a beautifully rendered virtual gallery where you can not only admire pre-existing AI-generated artworks but also create your own unique piece in real-time using the power of an OpenAI-compatible image API (configurable — see **Configuration**).

This project was developed for the **Computer Graphics** course at the **Faculty of Cybernetics, Statistics, and Economic Informatics (CSIE)**, within the **Bucharest University of Economic Studies (ASE)**.

# Features ✨

### 🎨 Interactive AI Art Generation
Powered by an OpenAI-compatible image API, users can step up to the central easel, enter a descriptive prompt, and watch as a unique piece of art is generated and displayed on the canvas in real-time. The endpoint and model are fully configurable (see **Configuration**).

### 🖼️ Multiple Selectable Scenes
Switch between four immersive environments with the scene selector in the top-right corner:
- **🏛️ Classic Gallery** — the original museum room with paintings hung on concrete walls
- **🌿 Animal Crossing Garden** — a sunny village green with trees, flowers, a white fence, and wooden easel stands
- **🚀 Space Station** — deep space with twinkling stars, orbiting planets, asteroids, and floating holographic painting pods
- **🌃 Cyberpunk City** — a rainy neon metropolis with skyscrapers, glowing signs, and holographic billboards

Each scene has its own lighting, atmosphere, and display style; the AI easel and paintings automatically adapt to the active scene.

### 🚶 Immersive 3D Exploration
Navigate the gallery in a first-person perspective with familiar, intuitive controls. Move with WASD, look around with the mouse, jump with the spacebar, and sprint with the shift key for a fluid and engaging experience.

### 🎬 Cinematic Focus Mode
Click on any painting to trigger a dynamic presentation view. The camera smoothly glides in to focus on the artwork while an elegant UI overlay displays its title, the AI model used, and the detailed prompt that brought it to life.

### 🌞 Dynamic Day/Night Cycle
Instantly switch between a bright, sunlit daytime environment and an atmospheric, spotlight-lit nighttime scene. This feature, accessible through the control panel, completely transforms the gallery's mood and lighting.

### 🔧 Advanced Scene Control Panel
Toggle a comprehensive `lil-gui` menu to tweak dozens of real-time parameters. Fine-tune lighting intensity and color, adjust camera FOV, modify particle effects, and monitor performance metrics, all without leaving the experience.

### 🚀 Built with Modern Technologies
Leverages the power of **Three.js** for stunning 3D rendering, **Vite** for a blazing-fast development environment and HMR, and **lil-gui** for an intuitive and powerful debugging and control interface.

## Getting Started 🚀

To get a local copy up and running, follow these simple steps.

### Prerequisites
- Node.js (v18.x or later)
- npm / pnpm / yarn

### Installation

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/mihainiculai/NeuroGallery.git
    ```

2.  **Navigate to the project directory:**
    ```sh
    cd NeuroGallery
    ```

3.  **Install NPM packages:**
    ```sh
    npm install
    ```

4.  **Configure the backend API key (required for the easel's AI art generation):**
    - Copy `server/.env.example` to `server/.env` and set your provider key:
      ```
      AGNES_API_KEY=your_api_key_here
      ```
    - ✅ **The frontend bundle contains no API key.** All image requests go through the backend proxy in `server/index.js`, so secrets never reach the browser or any static host.
    > **Note:** The wall paintings and the gallery itself work without a key. Only the easel's "generate" feature needs a valid backend key.

5.  **Run the development server:**
    ```sh
    npm run dev
    ```

The application will be available at `http://localhost:5173`.

## Configuration ⚙️

Everything — the paintings on the walls **and** the easel's AI API — is driven by plain config files. **No code changes are needed** to add, move, or restyle artworks, nor to point the easel at a different OpenAI-compatible endpoint.

### 🖼️ Paintings — positions, images & text
**File:** `public/textures/paintings/painting_data.json`

Each array entry is one artwork hung on a wall. Edit, add, or remove entries freely:

| Field | Meaning |
|-------|---------|
| `id` | Unique identifier |
| `title` | Title shown in the popup |
| `aiModel` | Small tech tag shown under the title |
| `prompt` | Description text shown when you walk close |
| `repoUrl` | Link opened when you click the painting *(optional)* |
| `imageFile` | Relative path to the artwork image (under `public/`) |
| `position` | `[x, y, z]` 3D coordinates of the frame on the wall |
| `rotation` | *(optional)* override facing angle in radians; auto-derived from `position` if omitted |

Example entry:
```json
{
  "id": "p1",
  "title": "Agnes 漫剧生成器",
  "aiModel": "GitHub",
  "prompt": "🎭 免费全流程 AI 漫剧生成器 ...",
  "repoUrl": "https://github.com/vvlife/agnes-comic-drama",
  "imageFile": "textures/paintings/picture1.jpg",
  "position": [-6, 3.5, -11.8]
}
```
Put image files in `public/textures/paintings/`. A size around **1792×1024** works best (it is cover-cropped to the frame).

### 🎨 Easel AI API — backend proxy (no key in the client)
The central easel generates art through an OpenAI-compatible image API. **Crucially, the API key lives only on the backend** — the browser never sees it and it is never bundled into the static site.

**Request flow:**
```
Browser ──POST /api/generate-image──▶ server/index.js ──▶ Agnes (or any OpenAI-compatible API)
   ◀──────── image bytes (blob) ──────┘  (key stays server-side; CORS handled here)
```
The backend also resolves cross-origin issues by fetching the generated image server-side and returning the raw bytes to the browser.

**Backend key & endpoint — `server/`**
- `server/.env` (git-ignored, **create it**): `AGNES_API_KEY=your_key_here`
- `server/config.json` (committed, no secret):
  ```json
  {
    "baseURL": "https://apihub.agnes-ai.com/v1",
    "imageModel": "agnes-image-2.1-flash"
  }
  ```

**Frontend base URL — `public/textures/paintings/easel_config.json`**
```json
{
  "api": {
    "baseURL": "https://apihub.agnes-ai.com/v1",
    "imageModel": "agnes-image-2.1-flash"
  },
  "apiBase": "/api"
}
```
- `apiBase` — where the frontend sends the generate request. Default `/api` (same-origin; works in local dev when the backend runs alongside the frontend). When you host the backend separately, set this to its public URL, e.g. `https://my-backend.vercel.app`.
- `api.baseURL` / `api.imageModel` are **display-only** hints; the real values are taken from `server/config.json`.

> **Tip:** Switch providers by editing `server/config.json` (`baseURL` + `imageModel`) — no frontend rebuild needed. The key never leaves the server.

### 🔍 AI Curator — build a real-source exhibition from a topic
A standalone web app in `curator/` turns a **theme** into a full, ready-to-view exhibition — no manual editing of `painting_data.json` required.

**What it does**
1. You type a **theme** (e.g. *太空探索*, *印象派绘画*, *中国古建筑*) into the curator page.
2. It calls the **text AI** through the *existing backend* (`/api/generate-text`) to curate a coherent set of N **real, verifiable** exhibits — each with a title, a factually accurate description, an English search phrase, and a real reference URL.
3. For every exhibit it **searches Wikimedia Commons** for a real photo/image and downloads it into `public/textures/paintings/`. **No AI-generated fake images are used** — every picture is a real, sourced image (its Commons URL is recorded in `painting_data.json` as `source`).
4. It rewrites `painting_data.json` (backing up the previous one to `painting_data.backup.json`) and the running gallery **hot-reloads** so the new show loads automatically.

**Run it (recommended — same origin as the gallery)**

Just run the normal dev command; Vite serves the curator under `/curator` and proxies
its API (`/curator-api/*`) to the curator service, so the whole flow (page + every
request, including `POST`) shares a single origin and works behind the preview proxy.

```sh
npm run dev            # gallery at http://localhost:5173
```
Then open `http://localhost:5173/curator`, enter a theme, choose a count (3–6) and
language, and hit **策划展览**. The right-hand panel shows a live progress log and a
live preview of the running 3D gallery.

**Run it (standalone)**

```sh
npm run curator        # starts the curator at http://localhost:4000
```
Then open `http://localhost:4000` (same UI, same behaviour). Use this when you prefer
the curator on its own port.

> The curator reuses `server/.env` for the **text AI** key and `server/config.json` for the model/endpoint — it adds **no new secrets** and never bundles the key. Image sourcing uses the public **Wikimedia Commons** API (no key, no generation): the text AI only curates real facts, and the actual pictures are searched & downloaded from Commons. If Commons has no suitable image for an exhibit, that exhibit is skipped rather than filled with a fake AI image.

## 🤖 Agent Skill — 自动策展

NeuroGallery 内置一个 Agent Skill（`skill/SKILL.md`），让 AI Agent 能够通过自然语言指令自动策划 3D 虚拟展览。

### 能力

- 输入主题 → 自动生成展览方案（标题、描述、真实参考链接）
- 从 Wikimedia Commons 搜索并下载**真实图片**（非 AI 生成）
- 自动写入画廊配置并热重载
- 支持四种场景切换

### 快速使用

```sh
# 1. 启动服务
npm run dev

# 2. 通过 API 策展
curl -s -N -X POST http://localhost:4000/api/curate \
  -H "Content-Type: application/json" \
  -d '{"theme":"太空探索","count":6,"language":"中文","scene":"space"}'
```

Agent 读取 `skill/SKILL.md` 后即可按照标准流程操作策展系统。详见 Skill 文件中的完整 API 参考和示例。

### 场景推荐

| 主题类型 | 推荐场景 |
|----------|----------|
| 艺术 / 绘画 / 经典展览 | 🏛️ 经典画廊 |
| 自然 / 植物 / 轻松主题 | 🌿 动森花园 |
| 太空 / 科技 / 未来 | 🚀 太空站 |
| 赛博朋克 / 霓虹 / 科幻 | 🌃 赛博朋克 |

## Technology Stack 💻

-   **Frontend Tooling**: Vite
-   **3D Rendering**: Three.js
-   **AI Image Generation**: OpenAI-compatible image API, proxied through a small backend in `server/` (the key stays server-side)
-   **AI Curator**: Wikimedia Commons real-image search + text AI curation
-   **Agent Skill**: `skill/SKILL.md` for automated exhibition creation
-   **Control Panel**: lil-gui
-   **Core Language**: JavaScript (ES6+)

## 🌐 在线预览 / Live Demo

公开预览地址（纯静态部署于 CloudStudio，墙上的 6 幅作品展示完全正常）：

**https://e6e51c4b571c46499d6cbbe283224353.app.codebuddy.work**

> 画架的「在线生成画作」由后端代理 `server/index.js` 提供——密钥只在后端、不会进入前端 bundle，比原先的浏览器直连更安全。
> 该 CloudStudio 预览为**纯静态托管**，不含 Node 后端，因此公网预览中画架生成功能暂不可用；浏览 6 幅作品不受影响。
> 若要在公网完整使用生成功能：把 `server/` 部署到任意支持 Node 的平台（Vercel / Railway / Render 等），再把 `easel_config.json` 的 `apiBase` 改成该后端地址即可。

## License 🪪

This project is licensed under the [MIT License](LICENSE).
