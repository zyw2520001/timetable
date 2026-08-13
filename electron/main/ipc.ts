import { registerAiIpc } from './ai'

/**
 * 注册所有 IPC 处理器
 * 在 app.whenReady() 之后调用
 */
export function registerIpcHandlers(): void {
  registerAiIpc()
}
