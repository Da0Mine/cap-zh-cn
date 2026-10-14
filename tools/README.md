# 汉化工具链

因为 Cap 没有 i18n 框架，汉化只能改源码。直接全局替换英文是有风险的 —— 有些字符串**同时**是界面文案和程序逻辑值（窗口标题用于「录制时排除自身窗口」的比对、键盘码、配置键名……），译了就会出功能 bug。

所以这套工具的核心思路是：**先把「哪些能译、哪些不能译」变成可判定的问题，再动手替换。**

## 流水线

```
① join_literals.js   把 \ 折行的跨行字面量合并成单行
        ↓
② scan_strings2.js   扫描全部英文字符串候选 → scan_v*.txt
        ↓
③ audit_dict.js      全树用法审计：每条候选在整仓库找全部出现位置，判定类别 → scan_v3_audit.txt
        ↓
④ split_audit.js     按文件拆分作业包 audit/<文件>.txt + 边缘项 edge-review.txt
        ↓
⑤ 人工/子代理        产出 dict/*.json（[英文, 中文] 或 [英文, 中文, 行号]）
        ↓
⑥ verify_dict.js     字典自检（0 错误才继续）
        ↓
⑦ apply_dicts.js     应用到 localized-src/
        ↓
⑧ check_syntax.sh    rustfmt 全量语法校验
        ↓
⑨ gen_inventory.js   生成对照清单
```

## 脚本说明

| 文件 | 作用 |
|---|---|
| `join_literals.js` | 合并 `\`+换行 折行的字面量。Rust 语义：反斜杠+换行会**吃掉换行和后续缩进、不补空格**。注意 raw string（`r#"…"#`）必须整体跳过，否则内容里的引号会被当成新字符串起点，一路吞到文件尾。 |
| `scan_strings2.js` | 字符串扫描器。识别四类上下文：UI 调用（`.section(`/`.label(`/`Tooltip::new(`…，**含"参数独占一行"时看上一非空行**）、match 臂标签（`=> "X"`）、宏标签（`X = "key", "Label";`）、元组标签（`(Variant, "Label")` / `(0, "Off")`）。会跳过 `#[cfg(test)] mod` 区块。 |
| `audit_dict.js` | **全树用法审计**，本工具链最关键的一步。对每条候选在整棵树里找出**所有**出现位置，逐处判定，汇总为四类：<br>`[SAFE]` 可直接译<br>`[LOGONLY]` 只出现在日志宏里<br>`[TESTMIX]` 在测试区出现过 → **不译**<br>`[RISK:*]` 出现在 match 键 / `==` / `contains()` / key 赋值 → **不译** |
| `split_audit.js` | 生成 `audit/<文件>.txt`（只含 SAFE/LOGONLY，交给译者）与 `edge-review.txt`（边缘项，人工裁决） |
| `verify_dict.js` | 字典自检：原文能否在目标文件找到、占位符 `{}`/`%s`/`\n` 是否一致、是否命中禁译清单、是否误译了 RISK 项、同文件同原文是否出现两种译文 |
| `apply_dicts.js` | 应用字典。只替换**带引号的完整字面量**（不做子串替换）、跳过注释行、自动拦截逻辑位置，支持 `[英文, 中文, 行号]` 三元素精确锁定（应对同一字面量在不同行含义不同） |
| `blacklist.txt` | 禁译清单（163 条）。审计器抓不到但绝不能译的：窗口标题、字体名、模型名、camelCase 配置键、大写单字母、API 路径等 |
| `edge-allow.txt` | 人工批准的例外（28 条），允许这些串在 TESTMIX/RISK 判定下仍入库 |
| `check_syntax.sh` | 用 rustfmt 逐个解析文件，抓「翻译破坏了字符串字面量」的语法错误 |
| `gen_inventory.js` | 对比上游原版与汉化版，生成逐条对照清单 |
| `scan_dual.js` | 早期版本的双用途扫描器（已被 `audit_dict.js` 取代，保留作参考） |
| `build.sh` | 四步构建脚本 |
| `glossary.md` | 既有译法总表（1362 条），保证术语前后一致 |
| `dict/*.json` | 28 份字典，格式 `{"files": {"<相对 apps/desktop-gpui/src 的路径>": [["英文","中文"], …]}}` |

## ⚠️ 字典的作用方向（重要）

`dict/*.json` 里记的是「**英文原文 → 中文译文**」，它是**输入**，要作用在**未汉化的上游源码**上：

```bash
# 正确用法：先 checkout 上游源码，再叠加字典
git clone https://github.com/CapSoftware/Cap && cd Cap && git checkout 8a14802
cp -r /path/to/cap-zh-cn/dict /path/to/cap-zh-cn/tools .   # 放到仓库根，保持 dict/ 与 tools/ 同级
node tools/apply_dicts.js
```

所以 `verify_dict.js` 在**本仓库里直接跑会大量报「原文未找到」**，这是正常的 —— 因为本仓库的 `localized-src/` 已经是**译文**了，英文原文当然找不到。它要配合未汉化的源码树使用。

要核对本仓库的改动结果，请用 `patches/cap-zh-full-v3.patch` 或 `docs/汉化字符串清单.md`。

## 三条最重要的判据

1. **在测试代码里出现过的字符串一律不译**（`TESTMIX`）。
   测试的期望值经常把该串作为**更长字面量的子串**嵌进去，只译源码侧不会编译报错，但会**静默弄红测试**。
   这条规则顺带自动挡住了全部窗口标题 —— 因为 `app_windows.rs` 里有一张断言这些标题的表。
2. **`match` 键 / `==` 比较 / `contains()` / `key:` 赋值位置的串不译**（`RISK`）。
3. **审计器抓不到的要靠 `blacklist.txt` 兜底**：字体名、模型名、camelCase 配置键、大写单字母、窗口标题。

## 踩过的坑

1. `settings_pages.rs` 的快捷键映射 `"delete" => "Delete"` —— 右侧返回值是**键盘码**，译成中文会破坏 Delete 键映射。
2. `editor_tabs.rs` 的 `FONT_OPTIONS` —— 字体名**既显示又写入配置**，必须与前端默认值一致。
3. `settings_window.rs` 的 `format_project_name()` —— `.replace("{target_kind}", "Window")` 有测试断言 `starts_with("Safari (Window) ")`，译了会红测试。
4. **同一个英文串在不同文件/不同行可能是两种含义**。例如 `store.rs` 的 `"Light"`：第 59 行是摄像头模糊档位（轻度），第 589 行是主题（浅色）。必须用三元素 `[英文, 中文, 行号]` 分开处理。
5. **必须多轮扫描直到收敛**。候选去重是按「字面量 + 首个文件」做的，同一个英文出现在多个文件时**只有第一个文件会被译**。本项目实际跑了 3 轮（v3 → v5 → v6）才收敛。
6. **验收汉化不要只看"在成品二进制里 grep 中文"的命中率**。`format!("…{x}…")` 的模板串会被格式参数元数据从中间劈开，连续字节搜不到；平台专属代码路径（Linux/macOS）不会进 Windows 包；被判定不可达的函数会被编译器整体剔除。这三类都会让命中率虚低。详见 [`../docs/已知限制-源码中文串未入成品清单.txt`](../docs/已知限制-源码中文串未入成品清单.txt)。

## 复用这套工具到别的项目

`scan_strings2.js` / `audit_dict.js` / `apply_dicts.js` / `verify_dict.js` 的路径是硬编码的（指向 `cap-zh/apps/desktop-gpui/src`），换项目需要改文件顶部的 `ROOT` / `SRC` 常量。核心逻辑与项目无关，可以直接复用。
