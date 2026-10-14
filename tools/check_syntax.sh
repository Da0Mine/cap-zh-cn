#!/usr/bin/env bash
# 语法校验：用 rustfmt 解析所有汉化文件，揪出被翻译动作破坏的字符串字面量
# （如整句中含转义引号 \" 时若丢失转义会直接语法错误）
# 用法: bash check_syntax.sh [源码目录]   （默认自动探测 localized-src/ 或 cap-zh/）
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SRC="${1:-}"
if [ -z "$SRC" ]; then
  for c in "$ROOT/localized-src" "$ROOT/cap-zh"; do
    [ -d "$c" ] && { SRC="$c"; break; }
  done
fi
if [ -z "$SRC" ] || [ ! -d "$SRC" ]; then
  echo "找不到汉化源码目录，请显式传入，例如: bash check_syntax.sh /path/to/localized-src"
  exit 1
fi

export PATH="$HOME/.cargo/bin:$PATH"
TOOLCHAIN="${RUSTFMT_TOOLCHAIN:-stable}"
bad=0; total=0; skipped=0
cd "$SRC" || exit 1
for f in $(find . -name '*.rs' | sed 's|^\./||'); do
  total=$((total + 1))
  err=$(rustfmt "+$TOOLCHAIN" --check --edition 2024 "$f" 2>&1 >/dev/null | grep -E "^error" | head -3)
  if [ -n "$err" ]; then
    # include! 引用了 src/ 之外的兄弟 crate 文件（如 apps/desktop/src-tauri/src/*.rs）。
    # 只检查了 desktop-gpui 这一个 crate 时该文件必然找不到，属已知误报，不计为语法错误。
    if echo "$err" | grep -q "couldn't find file"; then
      skipped=$((skipped + 1))
      echo "○ $f  （跳过：include! 引用了本 crate 之外的文件，需完整源码树才能校验）"
      continue
    fi
    bad=$((bad + 1))
    echo "✗ $f"
    echo "$err" | sed 's/^/    /'
  fi
done
echo "---- 语法校验完成: $total 个文件, $bad 个语法错误, $skipped 个跳过 ----"
