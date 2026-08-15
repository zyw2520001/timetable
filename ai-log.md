# 智能课程表Pro - AI 开发日志

## 项目简介

这是一个用 AI 辅助开发的 Windows 桌面课程表应用。从零开始，一步一步做出来，期间踩了不少坑，也都解决了。下面是完整的开发过程记录。

---

## 一、项目起步

**目标：** 做一个 Windows 桌面课程表 APP，不是网页，不是小程序，是能装在电脑上的 exe 程序。

**选用的技术：**
- Electron（把网页打包成桌面程序）
- Vite（构建工具，速度快）
- Vue3（写界面的框架）
- Tailwind CSS（写样式特别快）
- TypeScript（带类型的 JavaScript，不容易出错）

**对接的 AI：**
- 通义千问 `qwen-vl-plus`（能看图片的多模态模型，用来识别课表）
- 通义千问 `qwen-plus`（纯文本模型，用来生成学习计划）

---

## 二、基础功能开发

### 2.1 搭项目骨架

一开始先把项目结构搭好：
- `electron/` 放 Electron 主进程代码
- `src/` 放 Vue 前端代码
- 配好 Vite + Electron 的集成

### 2.2 做课表界面

做了两个视图：
- **周视图**：像大学教室里贴的那种整周课表，横着是星期一到星期五，竖着是节次
- **日视图**：只看某一天的课程

课程用不同颜色的色块显示，一眼就能区分不同的课。

### 2.3 课程增删改

做了一个弹窗（`CourseDialog.vue`），可以：
- 添加新课程
- 编辑已有课程
- 删除课程

每个课程包含：课程名、星期几、第几节到第几节、老师、教室、颜色。

### 2.4 数据存本地

用 `localStorage` 把课程数据存在浏览器本地，关掉程序再打开数据还在。

---

## 三、进阶功能开发

### 3.1 AI 一键导入课表（最核心功能）

这是整个项目的重点。用户不用手动一门一门输课程，直接让 AI 帮你识别。

**支持三种输入方式：**
1. **文本导入**：从教务系统复制课表文字，粘贴进去
2. **图片导入**：上传课表截图，支持多张图片
3. **PDF 导入**：上传课表 PDF，程序自动把每一页转成图片再识别

**处理流程：**
- 前端把用户输入的内容发给 Electron 主进程
- 主进程调用通义千问 `qwen-vl-plus` 模型
- AI 返回标准 JSON 格式的课程数据
- 前端展示识别结果，用户确认后一键导入

**为什么要放在主进程里调 API？**
因为 API Key 是敏感信息，不能暴露在前端代码里。放在主进程里，通过 IPC 通信中转，更安全。

### 3.2 空闲自习 AI 规划

这个功能是帮你安排没课的时间该干嘛。

**实现逻辑：**
1. 遍历你今天所有的课程，找出哪些节次是空的
2. 把空闲时段拼起来，算出总空闲时间
3. 让你选学习方向：日常自习 / 考公 / 考研
4. 把空闲时段和学习方向发给通义千问 `qwen-plus` 模型
5. AI 返回一份详细的学习计划，比如"上午 8:00-10:00 复习高数，做课后题"

### 3.3 导出 ICS 日历文件

可以把课程导出成 `.ics` 文件，这个格式是通用日历格式，导入到手机日历里就能看到。

默认导出未来 16 周，基本覆盖一整个学期。

---

## 四、踩过的坑和解决方案

### 4.1 API Key 保存不上

**问题：** 点保存按钮没反应，`window.api` 是 undefined。

**原因：** Preload 脚本没用对格式。Electron 的 `contextIsolation: true` 模式下，Preload 脚本必须用 CommonJS 格式（`require`），不能用 ES Module 的 `import` 语法，否则会静默失败，不报错但也不工作。

**解决：** 把 preload 脚本的扩展名改成 `.cjs`，用 `require` 语法，用 `contextBridge.exposeInMainWorld` 暴露 API。

### 4.2 AI 导入图片报错

**问题：** 传图片给主进程时报 `An object could not be cloned` 错误。

**原因：** Vue 的响应式数据是 Proxy 对象，不能直接通过 IPC 传递。IPC 只能传纯数据。

**解决：** 把图片数组转成纯字符串数组再传：
```javascript
const plainImages = images.value.map(s => String(s))
```

### 4.3 打包下载 winCodeSign 失败

**问题：** 用 `electron-builder` 打包 exe 时，会从 GitHub 下载 `winCodeSign`，国内网络经常下载失败。

**解决方案（经过多次尝试）：**
1. 禁用代码签名：设置 `CSC_IDENTITY_AUTO_DISCOVERY=false`、`CSC_LINK=` 为空
2. 在 build 配置里加 `sign: false`、`signAndEditExecutable: false`、`forceCodeSigning: false`
3. 用 npmmirror 国内镜像源：
   - `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`
   - `ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/`
4. 设置项目专属缓存目录，避免权限问题：
   - `ELECTRON_CACHE=.electron-cache`
   - `ELECTRON_BUILDER_CACHE=.electron-builder-cache`

**代价：** Windows 会提示"无法验证发布者"，但功能完全正常，用户点"仍要运行"就行。

### 4.4 koa-connect 导致上下文泄漏

**问题：** Vite 和 Electron 集成时用了 `koa-connect` 做中间件包装，结果导致 Koa 的 `ctx` 对象泄漏，请求处理出问题。

**解决：** 不用 `koa-connect` 包装了，直接用 Koa 原生中间件实现。

### 4.5 应用图标不显示

**问题：** 打包出来的 exe 和运行时的窗口图标都是 Electron 默认图标。

**解决：**
1. 自己设计了一个图标（蓝紫色渐变背景 + 学士帽 + 课程表卡片 + AI 标志）
2. 在 `BrowserWindow` 创建时设置 `icon` 属性
3. 写了多路径探测逻辑，确保打包后也能找到图标文件
4. `electron-builder` 配置里指定 `win.icon` 路径

### 4.6 课节时间不生效

**问题：** 用户在设置里改了每节课的时间，但周视图和日视图还是显示旧时间。

**原因：** 视图组件里用的是写死的 `SECTION_TIMES` 常量，没有用用户配置的时间。

**解决：** 把静态常量改成从配置动态生成的 `sectionTimes`，通过 prop 传给子组件。

### 4.7 自习规划参数名对不上

**问题：** 点了"生成规划"按钮，AI 返回的学习计划里时间全是 undefined。

**原因：** 前端传的参数叫 `startTime`/`endTime`，后端解构的却是 `start`/`end`，对不上。

**解决：** 前端把参数名映射成后端期望的格式：
```javascript
freeSlots: freeSlots.value.map(s => ({
  start: s.startTime,
  end: s.endTime,
  minutes: s.minutes
}))
```

---

## 五、后续优化迭代

### 5.1 界面美化

- 导航栏加了渐变背景
- 按钮加了 hover 动画
- 弹窗样式统一，加了圆角和阴影
- 空状态做了友好提示

### 5.2 周数导航功能

- 加了周数切换器，左右箭头翻周
- 可以直接输入数字跳到某一周
- 选了学期起始日期后自动算当前是第几周
- 根据周数自动判断单双周，不用手动切了

### 5.3 课节时间配置

- 可以设置每节课多长、课间休息多久
- 可以分别设上午/下午/晚上第一节课几点开始
- 保存后所有视图的时间自动更新

### 5.4 一键清除所有课程

- 在设置 → 数据管理里加了个红色警告卡片
- 显示当前有多少门课
- 点"清除"会弹二次确认，防止手滑

### 5.5 更换应用图标

- 设计了新图标：蓝紫渐变 + 学士帽 + 课程表 + AI 标
- 窗口图标、任务栏图标、exe 文件图标都统一了

### 5.6 清理无用文件

- 删了 `.electron-builder-cache/`（多个 winCodeSign 和 NSIS 版本副本）
- 删了 `.electron-cache/`（Electron 下载缓存）
- 删了打包临时产物（`win-unpacked/`、`builder-debug.yml`、`.blockmap`）
- 删了图标生成脚本和只为此用的依赖（sharp、png-to-ico）
- 最终 `dist-release/` 只保留两个 exe：便携版和安装版

---

## 六、项目最终结构

```
timetable/
├── package.json              # 项目配置和打包设置
├── vite.config.ts            # Vite + Electron 集成配置
├── tailwind.config.js        # Tailwind CSS 配置
├── tsconfig.json             # TypeScript 配置
├── index.html                # 入口 HTML
│
├── build/
│   ├── icon.png              # 应用图标
│   └── icon.svg              # 图标源文件
│
├── electron/                  # Electron 主进程
│   ├── main/
│   │   ├── index.ts          # 主进程入口，创建窗口
│   │   ├── ipc.ts            # IPC 通信注册
│   │   ├── ai.ts             # 通义千问 API 调用
│   │   └── pdf.ts            # PDF 转图片
│   └── preload/
│       └── index.ts          # 安全暴露 API 给前端
│
├── src/                       # Vue 前端
│   ├── main.ts               # Vue 入口
│   ├── App.vue               # 主页面
│   ├── style.css             # 全局样式
│   ├── env.d.ts              # 类型声明
│   ├── types/
│   │   └── course.ts         # Course 类型定义
│   ├── utils/
│   │   ├── storage.ts        # 数据存储 + 课节时间配置
│   │   ├── freeTime.ts       # 空闲时段计算 + 时间表生成
│   │   └── icsExport.ts      # ICS 日历导出
│   └── components/
│       ├── WeekView.vue      # 周视图
│       ├── DayView.vue       # 日视图
│       ├── CourseDialog.vue   # 课程增删改弹窗
│       ├── AiImport.vue      # AI 导入
│       └── FreeTimePlanner.vue  # 自习规划
│
├── dist-release/              # 最终打包产物
│   ├── 智能课程表Pro 1.0.0.exe        # 便携版
│   └── 智能课程表Pro Setup 1.0.0.exe  # 安装版
│
├── .gitignore                # Git 忽略配置
├── README.md                 # 项目说明
└── ai-log.md                 # 本文件
```

---

## 七、用到的通义千问 API

### 7.1 课表识别（qwen-vl-plus）

**调用方式：** POST 请求，带图片的 base64 和文字提示词

**提示词要点：**
- 告诉 AI 输出标准 JSON 数组
- 每门课必须有：星期、节次、课名、老师、教室、周次类型、颜色
- 同一门课在不同时间要拆成多条
- 颜色不能重复，要明亮好区分

### 7.2 学习规划（qwen-plus）

**调用方式：** POST 请求，纯文本对话

**提示词要点：**
- 按空闲时段分段生成学习计划
- 每段包含：学习科目、具体内容、建议时长
- 长时间学习要安排休息（45-50 分钟学，5-10 分钟休息）
- 输出纯文本，方便复制

### 7.3 API 端点

```
https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
```

所有请求都在 Electron 主进程里发，前端碰不到 API Key。

---

## 八、打包配置踩坑总结

打包是最折腾的部分，总结一下关键配置：

| 配置项 | 值 | 作用 |
|--------|-----|------|
| `CSC_IDENTITY_AUTO_DISCOVERY` | `false` | 不自动找证书 |
| `CSC_LINK` | 空 | 不用证书 |
| `sign` | `false` | 不签名 |
| `signAndEditExecutable` | `false` | 不编辑 exe 签名 |
| `forceCodeSigning` | `false` | 不强制签名 |
| `ELECTRON_MIRROR` | npmmirror | 国内下载 Electron |
| `ELECTRON_BUILDER_BINARIES_MIRROR` | npmmirror | 国内下载打包工具 |
| `ELECTRON_CACHE` | `.electron-cache` | 项目内缓存 |
| `ELECTRON_BUILDER_CACHE` | `.electron-builder-cache` | 项目内缓存 |
| `asarUnpack` | canvas、pdfjs | 原生模块不解包进 asar |

---

## 九、开发心得

1. **Electron 的 IPC 通信是个大坑**：前端和主进程之间传数据，类型要完全匹配，Vue 的 Proxy 对象不能直接传，必须转成纯数据。

2. **国内打包 Electron 真的需要镜像**：GitHub 的下载速度太慢了，winCodeSign 经常下到一半超时。用 npmmirror 镜像后基本一次就过。

3. **Preload 脚本的格式很重要**：`contextIsolation: true` 下必须用 CommonJS，用错了不报错但完全不工作，排查很费时间。

4. **AI 对接要做好容错**：网络可能超时、图片可能损坏、AI 可能返回格式不对的 JSON，每一步都要 try-catch 并给用户友好提示。

5. **图标这种小事也要折腾**：Electron 在不同环境下找图标的路径不一样，打包后路径还会变，需要做多路径探测。

---

## 十、版本记录

- **v1.0.0**：第一个完整版本
  - 周课表 / 单日课表视图
  - 课程增删改 + localStorage 持久化
  - AI 一键导入（文本/图片/PDF）
  - 空闲自习 AI 规划
  - 导出 ICS 日历
  - 周数导航 + 自动单双周
  - 自定义课节时间
  - 一键清除所有课程
  - 自定义应用图标
  - NSIS 安装包 + 便携版 exe
