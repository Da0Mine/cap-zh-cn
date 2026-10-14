#!/usr/bin/env bash
# Cap 中文版构建脚本（Windows / MSVC）
# 用法: bash build.sh [步骤号]   不传则依次执行全部
#
# 目录约定（可用环境变量覆盖）：
#   ROOT       仓库根目录（默认取本脚本上一级）
#   BUILD_DIR  可编译的上游源码树（默认 $ROOT/cap-build）
#   BUN_DIR    bun 可执行文件所在目录（默认 $ROOT/build-tools/bun/bun-windows-x64）
#   TEMP/TMP   临时目录（Windows 下必须指向真实可写的 Windows 路径）
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${BUILD_DIR:-$ROOT/cap-build}"
BUN_DIR="${BUN_DIR:-$ROOT/build-tools/bun/bun-windows-x64}"

# Windows 下 TEMP 必须是真实的 Windows 路径；Git Bash 默认给的 /tmp 会让部分工具静默失败
if [ -z "${TEMP:-}" ] || [ "${TEMP#/}" != "$TEMP" ]; then
  TEMP="$(cygpath -w "${TMPDIR:-/tmp}" 2>/dev/null || echo "$LOCALAPPDATA\\Temp")"
fi
export TEMP TMP="$TEMP"

# 注意：绝不要把 /c/Windows/System32 前置进 PATH —— 那会让脚本里的 `bash`
# 解析成 System32\bash.exe（WSL 启动器），报「未安装 WSL」。Git Bash 自带所需。
export PATH="$BUN_DIR:$HOME/.cargo/bin:$PATH"
export RUSTUP_DIST_SERVER="${RUSTUP_DIST_SERVER:-https://rsproxy.cn}"
TARGET="${TARGET:-x86_64-pc-windows-msvc}"

if [ ! -d "$BUILD_DIR" ]; then
  echo "找不到可编译源码树: $BUILD_DIR"
  echo "请先把上游源码 checkout 到该目录（commit 8a14802），再叠加 localized-src/ 覆盖。"
  exit 1
fi
cd "$BUILD_DIR"

step="${1:-all}"

run_step() {
  local n="$1"; shift
  local title="$1"; shift
  if [[ "$step" == "all" || "$step" == "$n" ]]; then
    echo ""
    echo "=================== [$n] $title ==================="
    echo "开始: $(date)"
    if "$@"; then
      echo "✓ [$n] 完成: $(date)"
    else
      echo "✗ [$n] 失败（退出码 $?）: $(date)"
      exit 1
    fi
  fi
}

# 1. 原生依赖 + .cargo/config.toml（ffmpeg/dxc/onnxruntime 已预置到 target/，跳过被墙下载）
run_step 1 "cap-setup：原生依赖与 cargo 配置" node scripts/setup.js

# 2. 外部二进制 cap-muxer / cap-cli / cap-exporter（根工作区，Rust 1.88.0）
run_step 2 "构建 cap-muxer / cap-cli（Rust 1.88）" bash scripts/build-desktop-binaries.sh "$TARGET"

# 3. GPUI 主二进制（apps/desktop-gpui，Rust 1.95.0）
run_step 3 "构建 GPUI 主程序 Cap.exe（Rust 1.95）" bash scripts/build-gpui-binary.sh release "$TARGET"

# 4. Tauri 打包（NSIS 安装程序）
run_step 4 "Tauri 打包 NSIS 安装程序" node scripts/bundle-gpui.mjs "$TARGET" --skip-build

echo ""
echo "=============================================="
echo "构建产物目录: cap-build/apps/desktop-gpui/target/$TARGET/release/bundle/"
ls -la "apps/desktop-gpui/target/$TARGET/release/bundle/" 2>/dev/null || true
