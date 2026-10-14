# Cap 简体中文版（非官方汉化）

[Cap](https://github.com/CapSoftware/Cap) 是一款开源录屏工具（Rust + GPUI 原生桌面端）。它**没有国际化框架**，界面文案全部硬编码在源码里，所以官方版本只有英文。

本仓库把 Cap 桌面端的硬编码英文**逐条精确替换为简体中文**，并重新编译出可直接安装的 Windows 安装包。中文是**编译进二进制的**，装完即是中文，没有（也不需要）语言切换开关。

> **⚠️ 非官方声明**
> 本仓库是**第三方非官方汉化**，与 Cap Software, Inc. **没有任何关系**，也未获得其背书、赞助或授权。
> "Cap" 名称与标识归 Cap Software, Inc. 所有。本仓库不主张任何商标权利，也不分发任何品牌素材。
> 若你是 Cap 官方并希望本仓库做任何调整，请开 Issue 告知，我会立即配合。

---

## 基本信息

| 项目 | 内容 |
|---|---|
| 上游仓库 | [CapSoftware/Cap](https://github.com/CapSoftware/Cap) |
| 上游基线 | `main` 分支 commit [`8a14802`](https://github.com/CapSoftware/Cap/commit/8a14802)（2026-10-13） |
| 对应版本 | 该提交的版本号字段为 **0.6.1**，即**上游最新正式发布 `cap-v0.6.0` 之后的主干代码**；界面与 0.6.0 基本一致 |
| 汉化规模 | **2238 处 / 72 个源文件** |
| 目标平台 | Windows x64（NSIS / MSI 安装包） |
| 许可证 | **AGPL-3.0**（继承上游，见 [LICENSE](LICENSE)） |

## 下载安装

到 [Releases](../../releases) 下载 `Cap-中文版-0.6.1-x64-setup.exe`，双击安装即可。

- 产品标识与官方一致（`so.cap.desktop`），**已装官方版会被本版替换**。
- 首次启动按提示允许摄像头 / 麦克风 / 屏幕录制权限。
- 与官方版共享同一套配置目录，装了汉化版不会丢失你原来的录制与设置。

## 汉化了什么

| 模块 | 覆盖内容 |
|---|---|
| 录制主流程 | 模式选择卡片、录制控制条、系统托盘菜单、区域选择浮层、摄像头气泡、提词器、新手引导、权限页、更新提示 |
| 主窗口 | 模式标题与说明、空状态、设备选择（摄像头 / 麦克风 / 系统声音）、删除确认、存储告警、快捷键提示 |
| 设置 | 设置侧栏、全部设置页（通用 / 录制 / 画质 / 外观 / 套餐授权 / 快捷键 / 自动化 / 开发者选项）、存储路径、诊断面板、反馈页 |
| 内容管理 | 导入（视频 / 图片）、上传与上传队列、转录、媒体库、动态流 |
| 系统组件 | 诊断报告、更新安装、深链错误、单实例、登录、开发期恢复 |
| 录制内核展示层 | 录制状态、设备名、快捷键、摄像头模糊、捕获排除 |
| **视频编辑器** | 主界面、属性面板（文字 / 字幕 / 3D 镜头）、时间线、片段操作、裁剪、配色、边框、导出设置 |
| **截图编辑器** | 标注、裁剪、导出 |

逐条对照见 [`docs/汉化字符串清单.md`](docs/汉化字符串清单.md)。

## 刻意**没有**汉化的部分（这是正确行为，不是遗漏）

这些字符串**同时**是显示文案和程序逻辑值，翻译会破坏功能：

| 类别 | 例子 | 原因 |
|---|---|---|
| 窗口标题 | `Cap Settings`、`Cap Camera`、`Cap Target Select` … | 参与「录制时排除自身窗口」的比对，且旧版本已把对比值持久化进用户配置；译了会导致录制时把自己的窗口录进去 |
| 键盘码 | `Space`、`Enter`、`ArrowUp`、`Period` … | W3C UI Events code，既是显示文本也是键位映射值 |
| 配置键名 | `recordingsPath`、`updateChannel`、`enableGpuiApp` … | 读写 `config.json` 的键 |
| 字体名 / 模型名 | `System Sans-Serif`、`Helvetica Neue`、`whisper.cpp small` | 写进配置、传给系统的标识 |
| 错误分类比对串 | `Export cancelled`、`Insufficient disk space` … | 既显示又参与 `contains()` 判断 |
| 导出格式标识 | `Mp4`、`Gif`、`Social`、`Web` | 同时作为配置值与解析键 |
| 产品与品牌 | `Cap`、`Cap Pro`、`Google Drive`、`Webhook` | 专有名词 |

完整禁译清单（163 条）见 [`tools/blacklist.txt`](tools/blacklist.txt)。

## 已知限制

1. **源码里已译、但在成品二进制中以连续字节检索不到**的字符串约占 19%，逐条核查后确认都不是漏译，原因有三类：
   - 只对 Linux / macOS 生效的代码路径（本机编的是 Windows 版，这些分支不进包）；
   - 被编译器判定不可达的上游遗留 / 开发期功能；
   - `format!("…{x}…")` 模板串 —— **文本确实在包里，但会被格式参数元数据从中间劈开**，连续字节检索自然搜不到。
   逐条清单见 [`docs/已知限制-源码中文串未入成品清单.txt`](docs/已知限制-源码中文串未入成品清单.txt)。
2. 极少数内部 `tracing` 日志、平台专属文案（Linux 桌面门户 / Wayland / macOS 菜单栏）保持英文或不会出现在 Windows 界面里。
3. 上游更新后本汉化不会自动跟进，需要重新走一遍流水线。

## 自己编译

构建环境、四步构建命令、以及本机网络绕行方案见 [`docs/构建说明.md`](docs/构建说明.md)。

简要流程：

```bash
bash build.sh 1   # 原生依赖 + cargo 配置
bash build.sh 2   # cap-muxer / cap-cli / cap-exporter（Rust 1.88）
bash build.sh 3   # GPUI 主程序 Cap.exe（Rust 1.95）—— 最耗时
bash build.sh 4   # Tauri 打包 NSIS / MSI
```

## 汉化是怎么做的

因为上游没有 i18n 框架，只能改源码。为了避免"把逻辑值也译了"这类事故，本仓库的流水线是**扫描 → 全树审计 → 字典 → 精确替换 → 语法校验 → 编译验证**：

| 脚本 | 作用 |
|---|---|
| `join_literals.js` | 把 `\`+换行 折行的跨行字面量合并成单行（Rust 语义等价），否则逐行替换匹配不到 |
| `scan_strings2.js` | 扫描全部英文字符串候选（能识别 match 臂标签、宏标签、元组标签、上一行 UI 上下文） |
| `audit_dict.js` | **全树用法审计**：对每条候选在整个仓库找全部出现位置，判定 `安全 / 仅日志 / 测试区 / 双用途` |
| `verify_dict.js` | 字典自检：原文能否找到、占位符一致、禁译清单、双用途拦截、同文件同原文多译文 |
| `apply_dicts.js` | 应用字典，只替换完整字面量、自动拦截逻辑位置，支持 `[英文, 中文, 行号]` 精确锁定 |
| `check_syntax.sh` | rustfmt 解析全部文件，抓「翻译破坏字符串字面量」的语法错误 |
| `gen_inventory.js` | 按上游原版与汉化版的真实差异生成对照清单 |

详见 [`tools/README.md`](tools/README.md)。这里最值得复用的是那条判据：**在测试代码里出现过的字符串一律不译** —— 因为测试期望值常把该串作为更长字面量的子串嵌入，只译源码侧会静默弄红测试。

## 许可证与二次开发要求

本项目**继承上游许可证**，请注意：

- **主体是 AGPL-3.0**（见 [LICENSE](LICENSE)），上游原文照录未改。
- 例外：`cap-camera*` 与 `scap-*` 系列 crate 为 MIT（见 [`licenses/LICENSE-MIT`](licenses/LICENSE-MIT)）；第三方组件沿用其各自许可证。

按 AGPL-3.0 的要求，本仓库已经做到：

| 要求 | 本仓库的落实 |
|---|---|
| 分发二进制时提供**完整对应源码** | 上游源码 + 本仓库的 [`patches/cap-zh-full-v3.patch`](patches/cap-zh-full-v3.patch)，以及逐文件落地的 [`localized-src/`](localized-src/) |
| **保留版权与许可声明** | `LICENSE` / `licenses/LICENSE-MIT` 原样保留，见 [NOTICE.md](NOTICE.md) |
| **显著声明修改内容与日期** | [NOTICE.md](NOTICE.md) 列出改动范围与日期 |
| **衍生作品同样以 AGPL-3.0 分发** | 本仓库整体以 AGPL-3.0 发布，未附加任何额外限制 |
| **不授予商标权**（AGPL §7(e)） | 本仓库不主张任何商标权利，README 顶部有明确非官方声明 |

**如果你想基于本汉化继续二次开发**：可以直接用，但你的衍生作品**也必须以 AGPL-3.0 开源**（包括通过网络提供服务的情形）。若你需要闭源商用，得向 Cap Software, Inc. 取得商业授权，本汉化不提供该授权。

## 英文摘要（English）

Unofficial Simplified Chinese localization of [Cap](https://github.com/CapSoftware/Cap) desktop, based on upstream `main` @ `8a14802` (version string `0.6.1`, i.e. trunk right after the `cap-v0.6.0` release). Cap ships no i18n framework, so the hardcoded English UI strings were replaced in-source and recompiled: **2238 strings across 72 files**. Strings that double as logic values (window titles used for capture exclusion, keyboard codes, config keys, font/model names, error-classification substrings, export format identifiers) are intentionally left in English — see [`tools/blacklist.txt`](tools/blacklist.txt).

Not affiliated with, endorsed by, or sponsored by Cap Software, Inc. "Cap" is a trademark of its owner. Licensed under **AGPL-3.0**, inheriting the upstream license; corresponding source is provided in this repository.

## 致谢

- [CapSoftware/Cap](https://github.com/CapSoftware/Cap) —— 上游项目，全部功能与绝大部分代码归其所有。
- 本仓库只做了一件事：把界面文案换成中文。
