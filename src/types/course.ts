export interface Course {
  id: string
  week: number        // 1-7 周一至周日
  startSection: number // 起始节次
  endSection: number   // 结束节次
  className: string
  teacher: string
  location: string
  weekType: 0 | 1 | 2  // 0=单周 1=双周 2=单双周
  color: string         // 十六进制颜色
  startWeek: number     // 起始周（默认1）
  endWeek: number       // 结束周（默认16）
}
