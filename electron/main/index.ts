import { app, BrowserWindow, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { registerIpcHandlers } from './ipc'

let mainWindow: BrowserWindow | null = null

function resolveIconPath(): string {
  // 打包后 build 目录在 app 根目录下
  const candidates = [
    path.join(__dirname, '../../build/icon.png'),    // 开发模式
    path.join(app.getAppPath(), 'build/icon.png'),   // asar 内
    path.join(process.resourcesPath, 'build/icon.png'), // 打包后
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return ''
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: '智能课程表Pro',
    icon: resolveIconPath(),
    webPreferences: {
      // CJS 模式下 __dirname 直接可用，preload 编译输出为 ../preload/index.js
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // 外部链接交给系统浏览器打开，不在应用内导航
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 开发模式加载 Vite dev server，生产模式加载打包后的 index.html
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }
}

app.whenReady().then(() => {
  // 全局异常捕获，避免进程闪退
  process.on('uncaughtException', (err) => {
    console.error('[Main] uncaughtException:', err)
  })
  process.on('unhandledRejection', (reason) => {
    console.error('[Main] unhandledRejection:', reason)
  })

  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
