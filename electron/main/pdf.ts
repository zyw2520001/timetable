import fs from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

// CJS 模式下 __filename 直接可用；createRequire 用于加载原生 CJS 模块
const localRequire = createRequire(__filename)

/**
 * PDF 解析工具：用 pdfjs-dist 将 PDF 每页渲染为 base64 PNG
 */
export const PDFParser = {
  /**
   * 将 PDF 每页渲染为 base64 编码的 PNG 图片
   * @param pdfPath PDF 文件绝对路径
   * @returns base64 字符串数组（每页一张图，含 data:image/png;base64, 前缀）
   */
  async renderPdfToImages(pdfPath: string): Promise<string[]> {
    if (!pdfPath) throw new Error('PDF 文件路径为空')
    if (!fs.existsSync(pdfPath)) {
      throw new Error('PDF 文件不存在：' + pdfPath)
    }

    // 懒加载 pdfjs-dist（ESM 模块，需用动态 import）
    const pdfjsLib: any = await import('pdfjs-dist')

    // 懒加载 @napi-rs/canvas（原生 CJS 模块，用 createRequire 加载）
    const canvasMod: any = localRequire('@napi-rs/canvas')
    const createCanvas: (
      width: number,
      height: number
    ) => { getContext: (type: string) => any; toDataURL: (type: string) => string } =
      canvasMod.createCanvas

    // 配置 worker（用 file:// 协议指向本地 worker 文件）
    const workerPath = localRequire.resolve('pdfjs-dist/build/pdf.worker.mjs')
    pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href

    // 读取 PDF 文件
    const data = new Uint8Array(fs.readFileSync(pdfPath))
    const loadingTask = pdfjsLib.getDocument({ data })
    const pdf = await loadingTask.promise

    const images: string[] = []
    try {
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 2 })
        const canvas = createCanvas(viewport.width, viewport.height)
        const context = canvas.getContext('2d')
        await page.render({ canvasContext: context, viewport }).promise
        const base64 = canvas.toDataURL('image/png')
        images.push(base64)
      }
    } finally {
      try {
        await pdf.destroy()
      } catch {
        // 忽略资源清理错误
      }
    }

    return images
  },
}
