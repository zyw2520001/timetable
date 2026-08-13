const { contextBridge, ipcRenderer } = require('electron')

// 通过 contextBridge 安全地向渲染进程暴露 API
// 渲染层通过 window.api 调用，无法直接访问 Node / Electron 内部能力
contextBridge.exposeInMainWorld('api', {
  ai: {
    parseText: (text: string) => ipcRenderer.invoke('ai:parse-text', text),
    parseImage: (images: string[]) => ipcRenderer.invoke('ai:parse-image', images),
    parsePdf: (pdfPath: string) => ipcRenderer.invoke('ai:parse-pdf', pdfPath),
    planFreeTime: (params: unknown) => ipcRenderer.invoke('ai:plan-free-time', params),
  },
  apiKey: {
    get: () => ipcRenderer.invoke('ai:get-api-key'),
    save: (key: string) => ipcRenderer.invoke('ai:save-api-key', key),
  },
  dialog: {
    saveFile: (name: string) => ipcRenderer.invoke('dialog:save-file', name),
    openPdf: () => ipcRenderer.invoke('dialog:open-pdf'),
  },
  fs: {
    writeFile: (path: string, content: string) =>
      ipcRenderer.invoke('fs:write-file', path, content),
  },
})
