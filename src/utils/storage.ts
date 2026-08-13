import type { Course } from '@/types/course'

const COURSES_KEY = 'timetable-courses'
const WEEK_OFFSET_KEY = 'timetable-week-offset'
const CURRENT_WEEK_KEY = 'timetable-current-week'
const SEMESTER_START_KEY = 'timetable-semester-start'
const SECTION_CONFIG_KEY = 'timetable-section-config'

export interface SectionConfig {
  morningStart: string    // 第1节开始时间，如 "08:00"
  afternoonStart: string   // 第6节开始时间（下午第一节），如 "14:00"
  eveningStart: string     // 第10节开始时间（晚课第一节），如 "18:30"
  duration: number          // 每节课时长（分钟），如 45
  breakMin: number          // 课间休息（分钟），如 10
}

const DEFAULT_SECTION_CONFIG: SectionConfig = {
  morningStart: '08:00',
  afternoonStart: '14:00',
  eveningStart: '18:30',
  duration: 45,
  breakMin: 10
}

const PALETTE = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6',
  '#06b6d4', '#ef4444', '#14b8a6', '#f97316', '#6366f1',
  '#84cc16', '#a855f7'
]

export function loadCourses(): Course[] {
  try {
    const raw = localStorage.getItem(COURSES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as Course[] : []
  } catch {
    return []
  }
}

export function saveCourses(courses: Course[]): void {
  try {
    localStorage.setItem(COURSES_KEY, JSON.stringify(courses))
  } catch {
    /* ignore quota errors */
  }
}

export function loadWeekOffset(): 0 | 1 {
  try {
    const raw = localStorage.getItem(WEEK_OFFSET_KEY)
    if (raw === '1') return 1
    return 0
  } catch {
    return 0
  }
}

export function saveWeekOffset(offset: 0 | 1): void {
  try {
    localStorage.setItem(WEEK_OFFSET_KEY, String(offset))
  } catch {
    /* ignore */
  }
}

export function loadCurrentWeek(): number {
  try {
    const raw = localStorage.getItem(CURRENT_WEEK_KEY)
    const n = parseInt(raw || '1', 10)
    return isNaN(n) || n < 1 ? 1 : n
  } catch {
    return 1
  }
}

export function saveCurrentWeek(week: number): void {
  try {
    localStorage.setItem(CURRENT_WEEK_KEY, String(week))
  } catch {
    /* ignore */
  }
}

export function loadSectionConfig(): SectionConfig {
  try {
    const raw = localStorage.getItem(SECTION_CONFIG_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...DEFAULT_SECTION_CONFIG, ...parsed }
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_SECTION_CONFIG }
}

export function saveSectionConfig(config: SectionConfig): void {
  try {
    localStorage.setItem(SECTION_CONFIG_KEY, JSON.stringify(config))
  } catch { /* ignore */ }
}

export function loadSemesterStart(): string {
  try {
    const raw = localStorage.getItem(SEMESTER_START_KEY)
    if (raw) return raw
  } catch { /* ignore */ }
  // 默认：本周一作为学期第1周
  const now = new Date()
  const day = now.getDay() || 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + 1)
  return monday.toISOString().slice(0, 10) // YYYY-MM-DD
}

export function saveSemesterStart(date: string): void {
  try {
    localStorage.setItem(SEMESTER_START_KEY, date)
  } catch { /* ignore */ }
}

export function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export function randomColor(): string {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)]
}
