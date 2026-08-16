import { createEvents, type EventAttributes } from 'ics'
import dayjs from 'dayjs'
import type { Course } from '@/types/course'
import { SECTION_TIMES, type SectionTime } from './freeTime'

function timeToParts(date: dayjs.Dayjs, time: string): [number, number, number, number, number] {
  const [h, m] = time.split(':').map(Number)
  const d = date.hour(h).minute(m).second(0)
  return [d.year(), d.month() + 1, d.date(), d.hour(), d.minute()]
}

function durationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return eh * 60 + em - (sh * 60 + sm)
}

export function exportCoursesToICS(courses: Course[], weeksToExport = 16, sectionTimes?: SectionTime[]): string {
  const times = sectionTimes?.length ? sectionTimes : SECTION_TIMES
  // 以本周一作为学期起始（第1周星期一）
  const semesterStart = dayjs().startOf('week').add(1, 'day')

  const events: EventAttributes[] = []

  for (const course of courses) {
    const startSec = Math.max(1, Math.min(times.length, course.startSection))
    const endSec = Math.max(1, Math.min(times.length, course.endSection))
    const startTime = times[startSec - 1].start
    const endTime = times[endSec - 1].end
    const dur = durationMinutes(startTime, endTime)

    // 课程的实际上课周范围
    const courseStartWeek = course.startWeek || 1
    const courseEndWeek = course.endWeek || 16
    const maxWeek = Math.min(weeksToExport, courseEndWeek)

    for (let w = courseStartWeek; w <= maxWeek; w++) {
      // weekType: 0=单周(奇数周) 1=双周(偶数周) 2=单双周
      if (course.weekType === 0 && w % 2 === 0) continue
      if (course.weekType === 1 && w % 2 === 1) continue

      const day = semesterStart.add((w - 1) * 7 + (course.week - 1), 'day')
      const startArr = timeToParts(day, startTime)

      events.push({
        title: course.className,
        description: `教师：${course.teacher || '无'}\n周次类型：${course.weekType === 0 ? '单周' : course.weekType === 1 ? '双周' : '单双周'}\n上课周次：第${courseStartWeek}-${courseEndWeek}周\n第${startSec}-${endSec}节`,
        location: course.location || '',
        start: startArr,
        duration: { minutes: dur }
      })
    }
  }

  let output = ''
  let errorMsg = ''
  createEvents(events, (error, value) => {
    if (error) errorMsg = String(error)
    else output = value
  })

  if (errorMsg) throw new Error(errorMsg)
  return output
}
