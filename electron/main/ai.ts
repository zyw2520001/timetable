import { app, dialog, ipcMain, BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import axios, { AxiosError } from 'axios'
import { PDFParser } from './pdf'

// ============ 核心提示词（写死在代码中） ============

/** 课表解析系统提示词 */
export const COURSE_PARSE_SYSTEM_PROMPT = `你是一个专业的课表解析助手，负责从用户提供的课表文本或图片中提取所有课程信息。

输出要求：
1. 严格输出一个 JSON 数组，不要包含任何解释性文字、Markdown 标记或代码块标记。
2. 数组中每个元素代表一门课程，必须包含以下字段：
   - week：number，星期几，1=周一，2=周二，...，7=周日
   - startSection：number，起始节次（从 1 开始，如第 1 节课）
   - endSection：number，结束节次（如第 2 节课）
   - className：string，课程名称
   - teacher：string，授课教师（若未提及则为空字符串）
   - location：string，上课教室（若未提及则为空字符串）
   - weekType：number，周次类型，0=单周，1=双周，2=单双周（即每周都上）
   - startWeek：number，上课起始周（如1表示从第1周开始）
   - endWeek：number，上课结束周（如16表示到第16周结束）
   - color：string，课程的标识颜色，使用十六进制格式如 "#4F8DF7"，为每门不同课程分配一个协调的颜色

注意事项：
- 节次按每天的时间顺序编号，通常 1-2 节为上午第一段，3-4 节为上午第二段，5-6 节为下午第一段，7-8 节为下午第二段，9-10 节为晚上。
- 若课表中存在"第 X-Y 周"信息且无法判断单双周，默认 weekType 为 2。
- 仅单周上课的课程 weekType 为 0，仅双周上课的为 1。
- 同一门课若在不同时间段上课，需拆分为多个数组元素。
- 若输入为图片，请仔细识别表格中的所有课程，不要遗漏。
- 颜色应避免重复，尽量使用明亮且区分度高的颜色。

示例输出格式：
[{"week":1,"startSection":1,"endSection":2,"className":"高等数学","teacher":"张三","location":"A101","weekType":2,"startWeek":1,"endWeek":16,"color":"#4F8DF7"}]`

/** 空闲自习规划系统提示词 */
export const FREE_TIME_PLAN_SYSTEM_PROMPT = `你是一个专业的学习规划助手，负责根据用户今日的空闲时段生成详细的学习安排。

规划原则：
1. 根据用户选择的学习方向（日常自习 / 考公复习 / 考研复习）制定针对性计划。
2. 为每一段空闲时间分配具体的学习任务，任务应合理填充该时段，不要过长或过短。
3. 安排应包含：学习科目、具体内容、建议时长，必要时给出学习方法提示。
4. 适当安排短暂休息（长时间学习时段每 45-50 分钟休息 5-10 分钟）。
5. 输出为纯文本，使用清晰的分段和列表，便于用户阅读和复制。

输出格式建议：
- 按时段分块呈现，如"🌅 上午时段（08:00-10:00）"。
- 每段下列出具体任务，标注建议时长。
- 末尾可附一句简短的学习寄语。

不同方向的重点：
- 日常自习：均衡安排当天各科作业、预习、复习。
- 考公复习：行测（言语理解、判断推理、数量关系、资料分析）与申论交替，注重刷题与总结。
- 考研复习：英语（单词、阅读、长难句）、政治、数学/专业课交替，注重基础与真题。`

// ============ API Key 存取 ============

function getApiKeyPath(): string {
  return path.join(app.getPath('userData'), 'api-key.txt')
}

function readApiKey(): string {
  try {
    const keyPath = getApiKeyPath()
    if (fs.existsSync(keyPath)) {
      return fs.readFileSync(keyPath, 'utf-8').trim()
    }
    return ''
  } catch (err) {
    console.error('[AI] 读取 API Key 失败:', err)
    return ''
  }
}

function writeApiKey(key: string): void {
  const keyPath = getApiKeyPath()
  fs.writeFileSync(keyPath, (key || '').trim(), 'utf-8')
}

// ============ 通义千问 API 调用 ============

const QWEN_API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<Record<string, unknown>>
}

/** 调用 qwen-vl-plus（多模态模型，用于课表图片/文本识别） */
export async function callQwenVlPlus(
  apiKey: string,
  messages: ChatMessage[],
  timeout = 60000
): Promise<string> {
  try {
    const res = await axios.post(
      QWEN_API_URL,
      { model: 'qwen-vl-plus', messages },
      {
        timeout,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      }
    )
    return res.data?.choices?.[0]?.message?.content ?? ''
  } catch (err) {
    throw normalizeApiError(err)
  }
}

/** 调用 qwen-plus（纯文本模型，用于学习规划生成） */
export async function callQwenText(
  apiKey: string,
  messages: ChatMessage[],
  timeout = 60000
): Promise<string> {
  try {
    const res = await axios.post(
      QWEN_API_URL,
      { model: 'qwen-plus', messages },
      {
        timeout,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      }
    )
    return res.data?.choices?.[0]?.message?.content ?? ''
  } catch (err) {
    throw normalizeApiError(err)
  }
}

/** 将 axios 错误统一转换为带可读提示的 Error */
function normalizeApiError(err: unknown): Error {
  const error = err as AxiosError<{ error?: { message?: string }; message?: string }>
  if (error.response) {
    const status = error.response.status
    const msg =
      error.response.data?.error?.message ||
      error.response.data?.message ||
      ''
    if (status === 401) {
      return new Error('API Key 无效或已过期，请检查后重试（401）')
    }
    if (status === 429) {
      return new Error('请求过于频繁，请稍后重试（429）')
    }
    if (status === 400) {
      return new Error('请求参数错误：' + (msg || '请检查输入内容') + '（400）')
    }
    return new Error(`请求失败（${status}）：${msg}`)
  }
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return new Error('请求超时，请检查网络后重试')
  }
  if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    return new Error('网络连接失败，请检查网络设置')
  }
  return new Error('请求失败：' + (error.message || String(err)))
}

// ============ JSON 提取 ============

/** 从 AI 返回文本中提取 JSON 数组，兼容代码块包裹 / 前后多余文字 */
export function extractJsonArray(text: string): unknown[] {
  if (!text) return []
  let cleaned = text.trim()

  // 去除 ```json ... ``` 或 ``` ... ``` 代码块包裹
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim()
  }

  // 尝试直接解析
  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) return parsed
    if (parsed && typeof parsed === 'object') {
      // 兼容 { courses: [...] } / { data: [...] } 等包裹结构
      for (const key of ['courses', 'data', 'list', 'result', 'items']) {
        if (Array.isArray((parsed as Record<string, unknown>)[key])) {
          return (parsed as Record<string, unknown[]>)[key]
        }
      }
      return [parsed]
    }
  } catch {
    // 继续尝试提取
  }

  // 提取第一个 [ 到最后一个 ] 之间的内容
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start !== -1 && end !== -1 && end > start) {
    const slice = cleaned.slice(start, end + 1)
    try {
      const parsed = JSON.parse(slice)
      if (Array.isArray(parsed)) return parsed
    } catch {
      // 忽略
    }
  }

  throw new Error('AI 返回内容无法解析为 JSON 数组，请重试')
}

// ============ 消息构造 ============

function buildImageContent(
  images: string[],
  instruction: string
): Array<Record<string, unknown>> {
  const content: Array<Record<string, unknown>> = []
  for (const img of images) {
    const url = img.startsWith('data:') ? img : `data:image/png;base64,${img}`
    content.push({ type: 'image_url', image_url: { url } })
  }
  content.push({ type: 'text', text: instruction })
  return content
}

// ============ IPC 注册 ============

export function registerAiIpc(): void {
  // 获取 API Key
  ipcMain.handle('ai:get-api-key', () => {
    return readApiKey()
  })

  // 保存 API Key
  ipcMain.handle('ai:save-api-key', (_event, key: string) => {
    writeApiKey(key)
    return true
  })

  // 文本解析课表（文本也走 qwen-vl-plus，保证解析能力一致）
  ipcMain.handle('ai:parse-text', async (_event, text: string) => {
    const apiKey = readApiKey()
    if (!apiKey) throw new Error('尚未配置通义千问 API Key，请先在设置中填写')
    if (!text || !text.trim()) throw new Error('待解析文本为空')

    const messages: ChatMessage[] = [
      { role: 'system', content: COURSE_PARSE_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `请解析以下课表文本并输出标准 JSON 数组：\n\n${text}`,
      },
    ]
    const result = await callQwenVlPlus(apiKey, messages)
    return extractJsonArray(result)
  })

  // 图片解析课表（base64 数组 → qwen-vl-plus）
  ipcMain.handle('ai:parse-image', async (_event, images: string[]) => {
    const apiKey = readApiKey()
    if (!apiKey) throw new Error('尚未配置通义千问 API Key，请先在设置中填写')
    if (!images || images.length === 0) throw new Error('未提供待识别的图片')

    const messages: ChatMessage[] = [
      { role: 'system', content: COURSE_PARSE_SYSTEM_PROMPT },
      {
        role: 'user',
        content: buildImageContent(
          images,
          '请识别以上课表图片，提取所有课程信息并输出标准 JSON 数组。'
        ),
      },
    ]
    const result = await callQwenVlPlus(apiKey, messages, 90000)
    return extractJsonArray(result)
  })

  // PDF 解析课表（PDF → 转图片 → qwen-vl-plus）
  ipcMain.handle('ai:parse-pdf', async (_event, pdfPath: string) => {
    const apiKey = readApiKey()
    if (!apiKey) throw new Error('尚未配置通义千问 API Key，请先在设置中填写')
    if (!pdfPath) throw new Error('未提供 PDF 文件路径')

    const images = await PDFParser.renderPdfToImages(pdfPath)
    if (images.length === 0) {
      throw new Error('PDF 解析失败，未能生成图片，请检查文件是否损坏')
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: COURSE_PARSE_SYSTEM_PROMPT },
      {
        role: 'user',
        content: buildImageContent(
          images,
          '请识别以上 PDF 课表的所有页面，提取所有课程信息并输出标准 JSON 数组。'
        ),
      },
    ]
    const result = await callQwenVlPlus(apiKey, messages, 120000)
    return extractJsonArray(result)
  })

  // 空闲自习规划（空闲时段 → qwen-plus 文本模型）
  ipcMain.handle('ai:plan-free-time', async (_event, params: unknown) => {
    const apiKey = readApiKey()
    if (!apiKey) throw new Error('尚未配置通义千问 API Key，请先在设置中填写')

    const {
      freeSlots,
      totalMinutes,
      direction,
    } = (params || {}) as {
      freeSlots?: Array<{ start: string; end: string; minutes: number }>
      totalMinutes?: number
      direction?: string
    }

    const userText = [
      `学习方向：${direction || '日常自习'}`,
      `今日空闲总时长：${totalMinutes || 0} 分钟`,
      `空闲时段明细：`,
      ...(Array.isArray(freeSlots) ? freeSlots : []).map(
        (s) => `- ${s.start} ~ ${s.end}（约 ${s.minutes} 分钟）`
      ),
      '',
      '请根据以上空闲时段，为每段空闲时间生成具体的学习安排。',
    ].join('\n')

    const messages: ChatMessage[] = [
      { role: 'system', content: FREE_TIME_PLAN_SYSTEM_PROMPT },
      { role: 'user', content: userText },
    ]
    const result = await callQwenText(apiKey, messages, 90000)
    return result
  })

  // 保存文件对话框
  ipcMain.handle('dialog:save-file', async (_event, name: string) => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showSaveDialog(win ?? undefined, {
      title: '选择保存位置',
      defaultPath: name || '导出文件',
      filters: [{ name: '所有文件', extensions: ['*'] }],
    })
    if (result.canceled || !result.filePath) return ''
    return result.filePath
  })

  // 打开 PDF 文件对话框
  ipcMain.handle('dialog:open-pdf', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win ?? undefined, {
      title: '选择 PDF 课表文件',
      properties: ['openFile'],
      filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
    })
    if (result.canceled || result.filePaths.length === 0) return ''
    return result.filePaths[0]
  })

  // 写文件
  ipcMain.handle('fs:write-file', (_event, filePath: string, content: string) => {
    if (!filePath) throw new Error('文件路径为空')
    fs.writeFileSync(filePath, content, 'utf-8')
    return true
  })
}
