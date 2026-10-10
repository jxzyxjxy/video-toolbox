# 项目上下文

## 技术栈

- **核心**: Vite 7, React 19, TypeScript
- **UI**: Tailwind CSS 3
- **服务端**: Express（仅用于托管页面，业务均在浏览器端完成）

## 产品定位

移动端 H5「视频工具箱」（VidPop）——面向普通用户的一站式视频处理工具集合。
仅针对手机竖屏体验，服务端不承载业务逻辑；所有视频处理均在浏览器本地完成，不上传数据。

## 目录结构

```
├── scripts/                  # 构建与启动脚本（由模板预置，勿改）
├── server/                   # Express 服务端（托管静态页面 + 预留 API）
│   ├── routes/index.ts       # 预留 API 路由
│   ├── server.ts             # Express 服务入口
│   └── vite.ts               # Vite 中间件/静态资源集成
├── src/                      # 前端源码
│   ├── main.tsx              # React 客户端入口
│   ├── App.tsx               # 根组件（Hash 路由分发）
│   ├── router.ts             # 极简 Hash 路由 hook
│   ├── index.css             # 全局样式 + 设计 Tokens + Tailwind
│   ├── components/           # 公共组件（品牌头 / 工具卡片）
│   ├── pages/                # 页面（首页 / 工具壳 / 即将上线）
│   └── tools/                # 工具模块层
│       ├── types.ts          # 工具定义类型
│       ├── registry.ts       # ★ 工具注册表（新增工具只需在此登记）
│       ├── icons/            # 工具图标
│       ├── lib/videoProcessor.ts   # 视频去水印处理引擎（纯前端 canvas + MediaRecorder）
│       └── components/       # 各工具实现
│           ├── WatermarkTool.tsx          # 视频去水印主流程
│           └── watermark/                 # 分步组件（上传/框选）
├── index.html                # 入口 HTML（viewport 移动端适配）
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 架构约定（可扩展机制）

- **工具注册表**：`src/tools/registry.ts` 中的 `TOOL_REGISTRY` 数组是唯一入口。
  新增工具 = 追加一条 `ToolDef`（含 id/name/desc/status/icon/component/featured）。
  首页卡片、Hash 路由分发、占位页均自动由注册表驱动，无需改动其他代码。
- **路由**：约定 `#/home`（首页）、`#/tool/:id`（工具页），由 `src/router.ts` 解析。
- **工具状态**：`online` 已上线；`coming-soon` 占位（无需实现组件，显示"即将上线"）。

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。
**常用命令**：
- 安装依赖：`pnpm add <package>`
- 安装开发依赖：`pnpm add -D <package>`
- 安装所有依赖：`pnpm install`
- 移除依赖：`pnpm remove <package>`

## 开发规范

- 使用 Tailwind CSS + 全局设计 Tokens（见 `src/index.css` 与 `DESIGN.md`）进行样式开发
- 移动端优先：禁止固定像素宽度布局，使用 viewport + rem/百分比自适应

### 编码规范

- 默认按 TypeScript `strict` 心智写代码；优先复用当前作用域已声明的变量、函数、类型和导入，禁止引用未声明标识符或拼错变量名。
- 禁止隐式 `any` 和 `as any`；函数参数、返回值、解构项、事件对象、Express `req`/`res`、`catch` 错误在使用前应有明确类型或先完成类型收窄，并清理未使用的变量和导入。
- React 组件一律用函数组件 + Hooks；组件定义遵循单一职责，拆分为独立文件。

## 设计规范

详细设计语言见 `DESIGN.md`。核心：深色磨砂底 + 靛蓝→紫罗兰渐变品牌色、大圆角卡片、柔光浮现动效；只面向手机竖屏触摸交互（点按/拖动，无 PC 悬浮依赖）。