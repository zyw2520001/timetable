智能课程表Pro
基于 Electron + Vite + Vue3 + Tailwind CSS 的桌面端智能课程管理应用
对接通义千问 `qwen-vl-plus` 多模态大模型，支持图片/PDF/文本一键导入课程

基础功能
周课表 / 单日课表  视图自由切换
课程新增 / 编辑 / 删除 弹窗，每节课程自定义标识色
完整课程字段：星期 1-7、起止节次、课程名、教师、教室、**单周/双周/单双周**、**周次范围**
localStorage 持久化，重启 APP 数据不丢失

周次管理
周数导航器：左右箭头切换周数，支持手动输入跳转
动根据学期起始日期计算当前周数
根据周数自动判断单双周，无需手动切换
日历视图显示当前周对应日期

课节时间配置
可自定义每节课时长、课间休息时间
可设置上午/下午/晚上各时段第一节课开始时间
动态生成课程时间表，周视图和日视图实时同步

AI 一键导入
三种导入方式：粘贴教务文本、上传课表图片、上传 PDF 课表
PDF 处理：通过 `pdfjs-dist` 分页渲染转 canvas，输出 base64 图片
所有 AI 接口请求统一在 Electron 主进程，IPC 通信中转，禁止渲染层直接调用
固定使用模型 `qwen-vl-plus`，传入课表解析专用 System 提示词
AI 只输出标准课程 JSON
完善异常容错：网络超时、密钥错误、损坏图片/PDF、无效文本弹窗提示

空闲自习 AI 规划助手
自动算法：遍历全部课程，计算今日所有无课空闲时间段，按早/中/晚分段
基于用户配置的课节时间动态计算空闲时段
一键将今日空闲时长、空闲时段传给通义千问 `qwen-plus` 文本模型
支持三种规划方向：**日常自习 / 考公复习 / 考研复习**
AI 输出细化到每段空闲时间的学习安排
规划结果可复制文本，本地缓存上次方案

数据管理
一键清除所有课程：带二次确认防止误操作
设置入口位于 ⚙️ 设置 → 数据管理

极客考点
导出标准 .ics 日历文件，用户自选本地保存路径
文件可直接导入 iPhone、安卓系统自带日历

技术栈
技术 说明
lectron | 跨平台桌面应用框架 |
| Vite | 极速构建工具 |
| Vue 3 | 渐进式前端框架 |
| Tailwind CSS | 原子化 CSS 框架 |
| TypeScript | 类型安全 |
| axios | HTTP 请求（仅在主进程） |
| dayjs | 日期处理 |
| ics | ICS 日历文件生成 |
| pdfjs-dist | PDF 转图片 |
| @napi-rs/canvas | Node 环境 canvas（PDF 渲染依赖） |
| electron-builder | NSIS exe 打包 |

环境要求
Node.js >= 18
npm >= 9
Windows 10/11（打包需要 NSIS）

安装依赖
```bash
npm install
```
配置通义千问 API Key
启动应用后，点击右上角设置按钮，粘贴你的 DashScope API Key。
获取地址：https://dashscope.console.aliyun.com/apiKey
Key 仅保存在本地 `%APPDATA%/smart-timetable-pro/api-key.txt`，不会上传任何服务器

开发模式
```bash
npm run dev
```
启动后会同时运行 Vite Dev Server 和 Electron 窗口。

打包 exe
```bash
npm run build:win
```
打包后的安装包位于 `dist-release/` 目录：
`智能课程表Pro 1.0.0.exe` — 便携版，双击直接运行
`智能课程表Pro Setup 1.0.0.exe` — NSIS 安装版，支持自定义安装路径

通义千问 API Key 配置
1. 访问 [阿里云 DashScope 控制台](https://dashscope.console.aliyun.com/apiKey)
2. 登录阿里云账号，开通 DashScope 服务
3. 点击「创建 API Key」，复制生成的 Key（形如 `sk-xxxxxxxxxxxxxxxxxxxx`）
4. 启动智能课程表Pro，点击右上角设置按钮
5. 粘贴 Key 到输入框，点击保存

API 调用说明：
多模态模型：`qwen-vl-plus`（课表图片/PDF 识别）
文本模型：`qwen-plus`（学习规划生成）
端点：`https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
所有请求均在 Electron 主进程中发起，渲染层无法直接访问

核心提示词
代码中写死的两条 System Prompt 位于 `src/utils/prompts.ts`：
课表解析提示词：让 AI 输出标准课程 JSON 数组
空闲自习规划提示词：让 AI 按空闲时段分段生成学习计划
详细内容见 `src/utils/prompts.ts` 文件。

使用指南
添加课程
点击右上角「+ 新增课程」按钮，或在周视图空白格子上点击
填写课程名、星期、节次、教师、教室、周次类型、颜色、周次范围
周次类型：单周（仅在单周生效）/ 双周（仅在双周生效）/ 单双周都上
周次范围：设置该课程从第几周开始到第几周结束

周次切换
使用顶部周数导航器的左右箭头切换周数
可直接输入数字跳转到指定周数
系统根据学期起始日期自动计算当前周数
单双周状态根据当前周数自动判断

课节时间配置
点击设置 → 课节时间
设置每节课时长（分钟）、课间休息（分钟）
设置上午/下午/晚上第一节课开始时间
保存后周视图和日视图自动更新时间显示

AI 一键导入
点击「AI导入」按钮
选择三种方式之一：
文本：从教务系统复制课表文本粘贴
图片：上传课表截图（支持多张）
PDF：选择课表 PDF 文件（自动逐页转图片识别）
点击「开始 AI 识别」，等待 qwen-vl-plus 解析
预览识别结果，确认后一键导入

空闲自习规划
点击「自习规划」按钮
查看今日空闲时间段（基于课节时间配置动态计算）
选择学习目标：日常自习 / 考公复习 / 考研复习
点击「一键生成今日学习规划」
复制结果或查看上次缓存的方案

导出 ICS 日历
点击「导出ICS」
选择保存路径
将生成的 .ics 文件导入 iPhone / 安卓系统日历
默认导出未来 16 周（覆盖一学期）

清除所有课程
点击设置 → 数据管理
查看当前课程总数
点击「清除」按钮，二次确认后删除所有课程

异常容错
应用内置完善的异常处理：
网络超时：友好提示重试
API Key 错误：401 错误明确提示检查密钥
频率限制：429 错误提示稍后重试
损坏 PDF/图片：PDF 解析失败时明确提示文件损坏
JSON 格式异常：AI 返回非标准 JSON 时提示重试
全局异常捕获：主进程和渲染层均注册了 uncaughtException 处理，程序不会闪退

打包说明
`electron-builder` 配置：
目标：NSIS Windows 安装包 + 便携版
代码签名已禁用（避免 winCodeSign 下载问题）
使用 npmmirror 国内镜像源加速下载
输出目录：`dist-release/`

打包命令：
```bash
npm run build:win

MIT License
