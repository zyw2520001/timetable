/// <reference types="vite/client" />
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
interface Window {
  api: {
    ai: {
      parseText: (text: string) => Promise<any[]>
      parseImage: (images: string[]) => Promise<any[]>
      parsePdf: (pdfPath: string) => Promise<any[]>
      planFreeTime: (params: { freeSlots: any[]; totalMinutes: number; goal: string }) => Promise<string>
    }
    apiKey: {
      get: () => Promise<string>
      save: (key: string) => Promise<boolean>
    }
    dialog: {
      saveFile: (defaultName: string) => Promise<string | null>
      openPdf: () => Promise<string | null>
    }
    fs: {
      writeFile: (filePath: string, content: string) => Promise<boolean>
    }
  }
}
