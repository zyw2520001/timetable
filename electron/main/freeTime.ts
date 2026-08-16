import type { Course } from '@/types/course'
import type { SectionConfig } from '@/utils/storage'

export interface SectionTime {
  section: number
  start: string
  end: string
}

export interface FreeSlot {
  startSection: number
  endSection: number
  startTime: string
  endTime: string
  minutes: number
  label: string
}

export const SECTION_TIMES: SectionTime[] = [
  { section: 1, start: '08:00', end: '08:45' },
  { section: 2, start: '08:55', end: '09:40' },
  { section: 3, start: '10:00', end: '10:45' },
  { section: 4, start: '10:55', end: '11:40' },
  { section: 5, start: '11:50', end: '12:35' },
  { section: 6, start: '14:00', end: '14:45' },
  { section: 7, start: '14:55', end: '15:40' },
  { section: 8, start: '15:50', end: '16:35' },
  { section: 9, start: '16:50', end: '17:35' },
  { section: 10, start: '18:30', end: '19:15' },
  { section: 11, start: '19:25', end: '20:10' },
  { section: 12, start: '20:20', end: '21:05' }
]

export const WEEK_TYPE_LABELS: string[] = ['单周', '双周', '单双周']

/** 将 "HH:MM" 转为分钟数 */
function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** 将分钟数转为 "HH:MM" */
function minToTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * 根据用户配置生成 12 节课的时间表
 * - 第1-5节：从 morningStart 开始，每节课 duration 分钟 + 课间 breakMin 分钟
 * - 第6-9节：从 afternoonStart 开始
 * - 第10-12节：从 eveningStart 开始
 */
export function generateSectionTimes(config: SectionConfig): SectionTime[] {
  const { morningStart, afternoonStart, eveningStart, duration, breakMin } = config
  const result: SectionTime[] = []

  // 上午 1-5 节
  let cursor = timeToMin(morningStart)
  for (let i = 1; i <= 5; i++) {
    result.push({ section: i, start: minToTime(cursor), end: minToTime(cursor + duration) })
    cursor += duration + breakMin
  }

  // 下午 6-9 节
  cursor = timeToMin(afternoonStart)
  for (let i = 6; i <= 9; i++) {
    result.push({ section: i, start: minToTime(cursor), end: minToTime(cursor + duration) })
    cursor += duration + breakMin
  }

  // 晚上 10-12 节
  cursor = timeToMin(eveningStart)
  for (let i = 10; i <= 12; i++) {
    result.push({ section: i, start: minToTime(cursor), end: minToTime(cursor + duration) })
    cursor += duration + breakMin
  }

  return result
}

export const TOTAL_SECTIONS = 12

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function getTodayWeek(): number {
  const d = new Date().getDay() // 0=周日 ... 6=周六
  return d === 0 ? 7 : d
}

/**
 * 计算某周的某天对应的实际日期
 * @param currentWeek 第几周（1-based）
 * @param dayOfWeek 星期几（1=周一 ... 7=周日）
 * @param semesterStart 学期起始日期 YYYY-MM-DD（第1周周一）
 */
export function getWeekDate(currentWeek: number, dayOfWeek: number, semesterStart?: string): string {
  const startStr = semesterStart || (() => {
    const now = new Date()
    const day = now.getDay() || 7
    const monday = new Date(now)
    monday.setDate(now.getDate() - day + 1)
    return monday.toISOString().slice(0, 10)
  })()
  const startDate = new Date(startStr + 'T00:00:00')
  // 第N周第D天 = startDate + (N-1)*7 + (D-1) 天
  const target = new Date(startDate)
  target.setDate(startDate.getDate() + (currentWeek - 1) * 7 + (dayOfWeek - 1))
  const m = target.getMonth() + 1
  const d = target.getDate()
  return `${m}月${d}日`
}

/**
 * 获取某周7天的日期数组
 */
export function getWeekDates(currentWeek: number, semesterStart?: string): string[] {
  return Array.from({ length: 7 }, (_, i) => getWeekDate(currentWeek, i + 1, semesterStart))
}

/**
 * 判断某周的某天是否是今天
 */
export function isTodayInWeek(currentWeek: number, dayOfWeek: number, semesterStart?: string): boolean {
  const today = new Date()
  const startStr = semesterStart || (() => {
    const now = new Date()
    const day = now.getDay() || 7
    const monday = new Date(now)
    monday.setDate(now.getDate() - day + 1)
    return monday.toISOString().slice(0, 10)
  })()
  const startDate = new Date(startStr + 'T00:00:00')
  const target = new Date(startDate)
  target.setDate(startDate.getDate() + (currentWeek - 1) * 7 + (dayOfWeek - 1))
  return today.getFullYear() === target.getFullYear() &&
    today.getMonth() === target.getMonth() &&
    today.getDate() === target.getDate()
}

export function getCoursesByDay(courses: Course[], week: number, offset: 0 | 1, currentWeek?: number): Course[] {
  return courses
    .filter((c) => c.week === week)
    .filter((c) => {
      // 按周次范围过滤（startWeek/endWeek）
      if (currentWeek !== undefined) {
        const start = c.startWeek || 1
        const end = c.endWeek || 16
        if (currentWeek < start || currentWeek > end) return false
      }
      // weekType: 0=单周 1=双周 2=单双周
      if (c.weekType === 2) return true
      if (c.weekType === 0) return offset === 0
      return offset === 1
    })
    .sort((a, b) => a.startSection - b.startSection)
}

export function computeFreeSlotsOfDay(
  courses: Course[],
  week: number,
  offset: 0 | 1,
  currentWeek?: number,
  sectionTimes?: SectionTime[]
): FreeSlot[] {
  const times = sectionTimes && sectionTimes.length >= TOTAL_SECTIONS ? sectionTimes : SECTION_TIMES
  const dayCourses = getCoursesByDay(courses, week, offset, currentWeek)
  const occupied = new Array<boolean>(TOTAL_SECTIONS).fill(false)
  for (const c of dayCourses) {
    const s = Math.max(1, Math.min(TOTAL_SECTIONS, c.startSection))
    const e = Math.max(1, Math.min(TOTAL_SECTIONS, c.endSection))
    for (let i = s; i <= e; i++) occupied[i - 1] = true
  }

  const slots: FreeSlot[] = []
  let i = 0
  while (i < TOTAL_SECTIONS) {
    if (!occupied[i]) {
      let j = i
      while (j < TOTAL_SECTIONS && !occupied[j]) j++
      const startSection = i + 1
      const endSection = j
      const startTime = times[startSection - 1].start
      const endTime = times[endSection - 1].end
      const minutes = timeToMinutes(endTime) - timeToMinutes(startTime)
      slots.push({
        startSection,
        endSection,
        startTime,
        endTime,
        minutes,
        label: `第${startSection}-${endSection}节 (${startTime}-${endTime})`
      })
      i = j
    } else {
      i++
    }
  }
  return slots
}
