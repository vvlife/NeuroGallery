#!/bin/zsh
# NeuroGallery 在线 VR 艺术馆 — 一键启动脚本（macOS）
# 双击本文件即可在本机浏览器打开展览。
cd "$(dirname "$0")"
echo "正在启动 NeuroGallery 虚拟艺术馆…"
if [ ! -d node_modules ]; then
  echo "首次运行，安装依赖中…"
  npm install
fi
npm run dev -- --open
