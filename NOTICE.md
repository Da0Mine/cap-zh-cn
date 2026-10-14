# NOTICE

本文件按 **AGPL-3.0 第 5 条**的要求，声明本仓库是对上游作品的修改版本，并说明改动内容与日期。

## 一、原始作品

- **作品名称**：Cap
- **著作权人**：Copyright (c) 2023-present **Cap Software, Inc.**
- **来源**：https://github.com/CapSoftware/Cap
- **使用的版本**：`main` 分支 commit `8a14802`（提交日期 2026-10-13，提交说明
  `fix(desktop): confirm before discarding an incomplete recording (#2459)`）
- **上游最新正式发布**：`cap-v0.6.0`（2026-09-15）；本仓库所用提交位于该发布**之后**的主干，
  其 `Cargo.toml` 版本号字段为 `0.6.1`。

## 二、原始许可证

上游采用**分部分授权**（原文见 [LICENSE](LICENSE)，本仓库**原样保留、一字未改**）：

- `cap-camera*` 与 `scap-*` 系列 crate：**MIT**（见 [licenses/LICENSE-MIT](licenses/LICENSE-MIT)）
- 第三方组件：沿用各自所有者的原始许可证
- 其余全部内容：**GNU Affero General Public License v3.0（AGPL-3.0）**

本仓库的修改落在 `apps/desktop-gpui/`（属 AGPL-3.0 部分），因此本仓库整体以 **AGPL-3.0** 分发，
未附加任何额外限制。

## 三、修改声明

**这是修改版本，不是原始作品。**

| 项目 | 说明 |
|---|---|
| 修改人 | Da0Mine（GitHub） |
| 修改日期 | **2026-10-13 ~ 2026-10-14** |
| 修改性质 | 仅**替换界面字符串字面量**（英文 → 简体中文），并调整两处打包参数以适配本机构建环境 |
| 修改范围 | `apps/desktop-gpui/src/` 下 **72 个 `.rs` 文件，共 2238 处** |
| 是否改动逻辑 | **否**。未改动任何控制流、数据结构、算法或依赖；仅字符串字面量的内容发生变化 |
| 是否新增功能 | **否**。未新增、未删除任何功能 |

### 具体改动清单

1. **界面文案汉化（2238 处 / 72 文件）**
   逐条「英文原文 → 中文译文」对照见 [`docs/汉化字符串清单.md`](docs/汉化字符串清单.md)。
   完整代码级差异见 [`patches/cap-zh-full-v3.patch`](patches/cap-zh-full-v3.patch)，
   逐文件落地结果见 [`localized-src/`](localized-src/)。
2. **打包参数调整（2 处，位于 `apps/desktop-gpui/tauri.conf.json`，不属于源码目录）**
   - `bundle.windows.nsis.compression`：`lzma` → `bzip2`
     （32 位 makensis 用 SOLID lzma 压缩约 180 MB 载荷时确定性报错
     `Internal compiler error #12345: deflateInit() failed`）
   - `bundle.createUpdaterArtifacts`：`true` → `false`
     （该选项需 Cap 官方私钥签名更新包，本机无私钥；不影响安装包本身）

### 未改动的部分

- `LICENSE`、`licenses/LICENSE-MIT`：**原样保留**
- 上游版权声明、作者署名：**原样保留**
- `cap-camera*` / `scap-*` 系列 crate 及全部第三方组件：**未改动**

## 四、刻意保留英文的字符串

以下字符串**同时**是界面文案与程序逻辑值，翻译会破坏功能，因此按原样保留：

- **窗口标题**（`Cap`、`Cap Settings`、`Cap Camera`、`Cap Target Select`、`Cap Recording Controls`、
  `Cap Mode Selection`、`Cap Teleprompter`、`Cap Editor`、`Cap Screenshot Editor`、
  `Welcome to Cap`、`Cap Window Capture Occluder`、`Cap Capture Area`、`Cap Recordings Overlay`）
  —— 参与「录制时排除自身窗口」的比对，且旧版本已把对比值持久化到用户配置中
- **键盘码**（W3C UI Events code）：`Space`、`Comma`、`Enter`、`Backspace`、`ArrowUp`、`Period` …
- **配置键名与身份值**：`recordingsPath`、`updateChannel`、`enableGpuiApp`、`so.cap.desktop`、
  `/api/desktop/*`、`application/octet-stream` …
- **字体名与模型名**：`System Sans-Serif / Serif / Monospace`、`Helvetica Neue`、`Segoe UI`、
  `whisper.cpp small / medium`
- **错误分类比对串**：`Export cancelled`、`Insufficient disk space`、`Window Server`、`sign in` …
- **导出格式标识**：`Mp4`、`Gif`、`Social`、`Web`、`Potato`、`File`
- **产品与品牌名**：`Cap`、`Cap Pro`、`Google Drive`、`Webhook`
- 文件扩展名、URL、shell / AppleScript 片段，以及测试代码中的字符串

完整清单见 [`tools/blacklist.txt`](tools/blacklist.txt)。

## 五、商标与非官方声明

- 本仓库是**第三方非官方汉化**，与 **Cap Software, Inc. 没有任何关系**，
  未获得其背书、赞助、认证或授权。
- "Cap" 名称、Logo 及相关标识归 Cap Software, Inc. 所有。
  按 AGPL-3.0 第 7(e) 条，本许可证**不授予任何商标权**，本仓库亦不主张任何商标权利。
- 本仓库**不分发任何品牌素材**（Logo、图标字体等）；安装包中的图标来自上游源码构建产物。
- 上游项目地址：https://github.com/CapSoftware/Cap
  上游官网：https://cap.so

## 六、免责声明

本软件按原样提供，不附带任何明示或默示的担保。使用本汉化版产生的一切后果由使用者自行承担。
如遇功能问题，请先确认是否在官方英文版上同样存在，再向**上游**反馈；汉化相关的文案问题请在本仓库开 Issue。

## 七、源码获取

按 AGPL-3.0 第 6 条，本仓库已随二进制分发提供完整对应源码：

- 上游源码：https://github.com/CapSoftware/Cap （commit `8a14802`）
- 本仓库的修改：`patches/cap-zh-full-v3.patch` + `localized-src/`
- 重建方式：见 [`docs/构建说明.md`](docs/构建说明.md)

两者合并即构成可编译出本仓库所分发二进制的完整对应源码。
