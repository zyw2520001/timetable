<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import type { Course } from '@/types/course'
import { genId, randomColor } from '@/utils/storage'

const props = defineProps<{
  visible: boolean
  course?: Course | null
  preset?: { week?: number; startSection?: number; endSection?: number }
}>()

const emit = defineEmits<{
  'update:visible': [v: boolean]
  save: [course: Course]
}>()

const PALETTE = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6',
  '#06b6d4', '#ef4444', '#14b8a6', '#f97316', '#6366f1',
  '#84cc16', '#a855f7'
]
const WEEK_TYPE_LABELS = ['单周', '双周', '单双周']
const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const form = reactive({
  id: '',
  className: '',
  teacher: '',
  location: '',
  week: 1,
  startSection: 1,
  endSection: 2,
  weekType: 2 as 0 | 1 | 2,
  startWeek: 1,
  endWeek: 16,
  color: '#22c55e'
})
const error = ref('')

watch(
  () => props.visible,
  (v) => {
    if (!v) return
    error.value = ''
    if (props.course) {
      Object.assign(form, props.course)
      form.startWeek = props.course.startWeek ?? 1
      form.endWeek = props.course.endWeek ?? 16
    } else {
      const ps = props.preset || {}
      const start = ps.startSection ?? 1
      form.id = ''
      form.className = ''
      form.teacher = ''
      form.location = ''
      form.week = ps.week ?? 1
      form.startSection = start
      form.endSection = ps.endSection ?? start
      form.weekType = 2
      form.startWeek = 1
      form.endWeek = 16
      form.color = randomColor()
    }
  }
)

function close() {
  emit('update:visible', false)
}

function submit() {
  if (!form.className.trim()) {
    error.value = '请输入课程名称'
    return
  }
  if (form.startSection > form.endSection) {
    error.value = '起始节次不能大于结束节次'
    return
  }
  const course: Course = {
    id: form.id || genId(),
    week: form.week,
    startSection: form.startSection,
    endSection: form.endSection,
    className: form.className.trim(),
    teacher: form.teacher.trim(),
    location: form.location.trim(),
    weekType: form.weekType,
    startWeek: form.startWeek,
    endWeek: form.endWeek,
    color: form.color
  }
  emit('save', course)
  close()
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in"
      @click.self="close"
    >
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-slide-up overflow-hidden">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-primary-50/60 to-transparent">
          <h3 class="flex items-center gap-2 text-base font-semibold text-gray-800">
            <span class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary-500 text-white text-sm shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            {{ form.id ? '编辑课程' : '新增课程' }}
          </h3>
          <button class="flex items-center justify-center w-7 h-7 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-xl leading-none transition" @click="close">×</button>
        </div>

        <div class="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1.5">课程名称 <span class="text-red-500">*</span></label>
            <input
              v-model="form.className"
              type="text"
              placeholder="如：高等数学"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">教师</label>
              <input
                v-model="form.teacher"
                type="text"
                placeholder="如：张老师"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">地点</label>
              <input
                v-model="form.location"
                type="text"
                placeholder="如：教学楼A101"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1.5">星期</label>
            <div class="flex gap-1">
              <button
                v-for="(d, i) in DAYS"
                :key="i"
                class="flex-1 py-1.5 text-xs rounded-md border transition shadow-sm"
                :class="form.week === i + 1
                  ? 'bg-primary-500 text-white border-primary-500 shadow-primary-200'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400 hover:shadow'"
                @click="form.week = i + 1"
              >
                {{ d }}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">起始节次</label>
              <select
                v-model.number="form.startSection"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 transition"
              >
                <option v-for="n in 12" :key="n" :value="n">第{{ n }}节</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">结束节次</label>
              <select
                v-model.number="form.endSection"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 transition"
              >
                <option v-for="n in 12" :key="n" :value="n">第{{ n }}节</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1.5">周次类型</label>
            <div class="flex gap-1">
              <button
                v-for="(label, i) in WEEK_TYPE_LABELS"
                :key="i"
                class="flex-1 py-1.5 text-xs rounded-md border transition shadow-sm"
                :class="form.weekType === i
                  ? 'bg-primary-500 text-white border-primary-500 shadow-primary-200'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400 hover:shadow'"
                @click="form.weekType = i as 0 | 1 | 2"
              >
                {{ label }}
              </button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1.5">上课周次</label>
            <div class="grid grid-cols-2 gap-3">
              <div class="flex items-center gap-2">
                <input
                  v-model.number="form.startWeek"
                  type="number"
                  min="1"
                  max="30"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition"
                />
                <span class="text-xs text-gray-500 whitespace-nowrap">周起</span>
              </div>
              <div class="flex items-center gap-2">
                <input
                  v-model.number="form.endWeek"
                  type="number"
                  min="1"
                  max="30"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition"
                />
                <span class="text-xs text-gray-500 whitespace-nowrap">周止</span>
              </div>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1.5">颜色</label>
            <div class="flex items-center gap-2 flex-wrap">
              <button
                v-for="c in PALETTE"
                :key="c"
                class="w-7 h-7 rounded-full border-2 transition hover:scale-110 hover:shadow-md"
                :class="form.color === c ? 'border-gray-700 scale-110 shadow-md' : 'border-white'"
                :style="{ backgroundColor: c }"
                @click="form.color = c"
              ></button>
              <input
                v-model="form.color"
                type="color"
                class="w-7 h-7 rounded cursor-pointer border border-gray-300 transition hover:scale-110 hover:shadow-md"
              />
            </div>
          </div>

          <p v-if="error" class="text-xs text-red-500">{{ error }}</p>
        </div>

        <div class="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            class="px-4 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 shadow-sm transition"
            @click="close"
          >
            取消
          </button>
          <button
            class="px-4 py-1.5 text-sm rounded-lg bg-primary-500 text-white hover:bg-primary-600 shadow-md hover:shadow-lg transition"
            @click="submit"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
