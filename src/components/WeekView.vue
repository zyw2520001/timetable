<script setup lang="ts">
import { computed } from 'vue'
import type { Course } from '@/types/course'
import { getCoursesByDay, isTodayInWeek, getWeekDate, type SectionTime } from '@/utils/freeTime'

const props = defineProps<{
  courses: Course[]
  weekOffset: 0 | 1
  currentWeek?: number
  semesterStart?: string
  sectionTimes?: SectionTime[]
}>()

const emit = defineEmits<{
  add: [payload: { week: number; startSection: number; endSection: number }]
  edit: [course: Course]
}>()

const SECTION_HEIGHT = 52
const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const totalHeight = SECTION_HEIGHT * 12

const times = computed(() => props.sectionTimes?.length ? props.sectionTimes : [])

const days = computed(() =>
  Array.from({ length: 7 }, (_, i) => {
    const week = i + 1
    const list = getCoursesByDay(props.courses, week, props.weekOffset, props.currentWeek)
    const dateStr = props.currentWeek ? getWeekDate(props.currentWeek, week, props.semesterStart) : ''
    const isToday = props.currentWeek ? isTodayInWeek(props.currentWeek, week, props.semesterStart) : false
    return { week, label: DAYS[i], dateStr, list, isToday }
  })
)

function blockStyle(course: Course) {
  const top = (course.startSection - 1) * SECTION_HEIGHT
  const height = (course.endSection - course.startSection + 1) * SECTION_HEIGHT
  return {
    top: `${top}px`,
    height: `${height}px`,
    backgroundColor: course.color
  }
}

function cellStyle(section: number) {
  return {
    top: `${(section - 1) * SECTION_HEIGHT}px`,
    height: `${SECTION_HEIGHT}px`
  }
}

function isOutOfRange(c: Course): boolean {
  if (props.currentWeek === undefined) return false
  const start = c.startWeek || 1
  const end = c.endWeek || 16
  return props.currentWeek < start || props.currentWeek > end
}
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
    <!-- 表头 -->
    <div class="grid grid-cols-[64px_repeat(7,1fr)] border-b border-gray-200 bg-gray-50">
      <div class="p-2 text-center text-xs text-gray-500">节次</div>
      <div
        v-for="d in days"
        :key="d.week"
        class="p-2 text-center border-l border-gray-100"
        :class="d.isToday ? 'bg-primary-50' : 'bg-gray-50'"
      >
        <div class="text-sm font-medium" :class="d.isToday ? 'text-primary-600' : 'text-gray-700'">{{ d.label }}</div>
        <div class="text-[10px] mt-0.5" :class="d.isToday ? 'text-primary-500' : 'text-gray-400'">{{ d.dateStr }}</div>
      </div>
    </div>
    <!-- 主体 -->
    <div class="flex">
      <!-- 时间列 -->
      <div class="w-16 border-r border-gray-200 bg-gray-50/50">
        <div
          v-for="(st, i) in times"
          :key="i"
          class="flex flex-col items-center justify-center border-b border-gray-100"
          :style="{ height: SECTION_HEIGHT + 'px' }"
        >
          <span class="text-xs font-medium text-gray-600">{{ st.section }}</span>
          <span class="text-[10px] text-gray-400">{{ st.start }}</span>
        </div>
      </div>
      <!-- 每天列 -->
      <div
        v-for="d in days"
        :key="d.week"
        class="flex-1 relative border-r border-gray-100 last:border-r-0"
        :class="d.isToday ? 'bg-primary-50/30' : ''"
        :style="{ height: totalHeight + 'px' }"
      >
        <!-- 空格子 -->
        <div
          v-for="s in 12"
          :key="s"
          class="absolute left-0 right-0 border-b border-gray-100 cursor-pointer hover:bg-primary-50/60 transition"
          :style="cellStyle(s)"
          @click="emit('add', { week: d.week, startSection: s, endSection: s })"
        ></div>
        <!-- 课程块 -->
        <div
          v-for="c in d.list"
          :key="c.id"
          class="absolute left-0.5 right-0.5 rounded-md p-1.5 text-white text-xs overflow-hidden cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.02] transition"
          :class="{ 'opacity-50': isOutOfRange(c) }"
          :style="blockStyle(c)"
          @click.stop="emit('edit', c)"
        >
          <div class="font-semibold truncate leading-tight">{{ c.className }}</div>
          <div class="truncate opacity-90 leading-tight">@{{ c.location }}</div>
          <div class="truncate opacity-75 leading-tight">{{ c.teacher }}</div>
          <div class="truncate opacity-60 leading-tight">{{ c.startWeek || 1 }}-{{ c.endWeek || 16 }}周</div>
        </div>
      </div>
    </div>
  </div>
</template>
