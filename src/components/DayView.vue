<script setup lang="ts">
import { computed } from 'vue'
import type { Course } from '@/types/course'
import {
  getCoursesByDay,
  computeFreeSlotsOfDay,
  getTodayWeek,
  getWeekDate,
  isTodayInWeek,
  type SectionTime
} from '@/utils/freeTime'

const props = defineProps<{
  courses: Course[]
  weekOffset: 0 | 1
  currentDay: number
  currentWeek?: number
  semesterStart?: string
  sectionTimes?: SectionTime[]
}>()

const emit = defineEmits<{
  add: [payload: { week: number; startSection: number; endSection: number }]
  edit: [course: Course]
  changeWeek: [week: number]
}>()

const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const times = computed(() => props.sectionTimes?.length ? props.sectionTimes : [])

const dateStr = computed(() => props.currentWeek ? getWeekDate(props.currentWeek, props.currentDay, props.semesterStart) : '')
const isToday = computed(() => props.currentWeek ? isTodayInWeek(props.currentWeek, props.currentDay, props.semesterStart) : false)

const dayCourses = computed(() => getCoursesByDay(props.courses, props.currentDay, props.weekOffset, props.currentWeek))
const freeSlots = computed(() => computeFreeSlotsOfDay(props.courses, props.currentDay, props.weekOffset, props.currentWeek))

const occupiedSections = computed(() => {
  const set = new Set<number>()
  for (const c of dayCourses.value) {
    for (let s = c.startSection; s <= c.endSection; s++) set.add(s)
  }
  return set
})

function prev() {
  const w = props.currentDay <= 1 ? 7 : props.currentDay - 1
  emit('changeWeek', w)
}
function next() {
  const w = props.currentDay >= 7 ? 1 : props.currentDay + 1
  emit('changeWeek', w)
}
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
    <!-- 日期切换栏 -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
      <button class="w-8 h-8 rounded hover:bg-gray-200 text-gray-600 flex items-center justify-center" @click="prev">‹</button>
      <div class="text-center">
        <div class="text-lg font-semibold text-gray-800">
          {{ DAYS[currentDay - 1] }}
          <span v-if="dateStr" class="ml-2 text-sm text-gray-400 font-normal">{{ dateStr }}</span>
          <span v-if="isToday" class="ml-2 text-xs text-primary-600 align-middle">今天</span>
        </div>
        <div class="text-xs text-gray-500">共 {{ dayCourses.length }} 节课 · 空闲 {{ freeSlots.length }} 段</div>
      </div>
      <button class="w-8 h-8 rounded hover:bg-gray-200 text-gray-600 flex items-center justify-center" @click="next">›</button>
    </div>

    <!-- 时间线 -->
    <div class="divide-y divide-gray-100">
      <div
        v-for="st in times"
        :key="st.section"
        class="flex items-stretch min-h-[56px]"
        :class="occupiedSections.has(st.section) ? '' : 'bg-gray-50/40'"
      >
        <div class="w-20 flex-shrink-0 flex flex-col items-center justify-center border-r border-gray-100 py-2">
          <span class="text-sm font-medium text-gray-700">第{{ st.section }}节</span>
          <span class="text-[11px] text-gray-400">{{ st.start }}-{{ st.end }}</span>
        </div>
        <div class="flex-1 py-2 px-3">
          <template v-for="c in dayCourses.filter(x => x.startSection === st.section)" :key="c.id">
            <div
              class="rounded-md p-3 text-white shadow-sm cursor-pointer hover:shadow-md transition"
              :style="{ backgroundColor: c.color }"
              @click="emit('edit', c)"
            >
              <div class="font-semibold">{{ c.className }}</div>
              <div class="text-sm opacity-90 mt-0.5">
                第{{ c.startSection }}-{{ c.endSection }}节 · @{{ c.location }}
              </div>
              <div class="text-xs opacity-75 mt-0.5">{{ c.teacher }}</div>
            </div>
          </template>
          <button
            v-if="!occupiedSections.has(st.section)"
            class="w-full h-full min-h-[40px] text-xs text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition flex items-center justify-center"
            @click="emit('add', { week: currentDay, startSection: st.section, endSection: st.section })"
          >
            + 添加课程
          </button>
        </div>
      </div>
    </div>

    <!-- 空闲时段汇总 -->
    <div v-if="freeSlots.length" class="px-4 py-3 border-t border-gray-200 bg-primary-50/40">
      <div class="text-xs font-medium text-primary-700 mb-2">今日空闲时段</div>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="(slot, i) in freeSlots"
          :key="i"
          class="inline-flex items-center px-2.5 py-1 rounded-full bg-white border border-primary-200 text-xs text-primary-700"
        >
          {{ slot.label }} · {{ slot.minutes }}分钟
        </span>
      </div>
    </div>
  </div>
</template>
