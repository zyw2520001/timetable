<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Course } from '@/types/course'
import { computeFreeSlotsOfDay, getTodayWeek, type SectionTime } from '@/utils/freeTime'

const props = defineProps<{
  visible: boolean
  courses: Course[]
  weekOffset: 0 | 1
  currentWeek?: number
  sectionTimes?: SectionTime[]
}>()

const emit = defineEmits<{
  'update:visible': [v: boolean]
}>()

const GOALS = [
  { key: '日常自习', desc: '巩固当天知识、完成作业' },
  { key: '考公', desc: '行测、申论专项训练' },
  { key: '考研', desc: '专业课与公共课复习' }
]

const goal = ref('日常自习')
const loading = ref(false)
const error = ref('')
const result = ref('')
const copied = ref(false)

const today = getTodayWeek()
const freeSlots = computed(() => computeFreeSlotsOfDay(props.courses, today, props.weekOffset, props.currentWeek, props.sectionTimes))
const totalMinutes = computed(() => freeSlots.value.reduce((sum, s) => sum + s.minutes, 0))

function close() {
  emit('update:visible', false)
}

async function generate() {
  loading.value = true
  error.value = ''
  result.value = ''
  copied.value = false
  try {
    const text = await window.api.ai.planFreeTime({
      freeSlots: freeSlots.value.map(s => ({
        start: s.startTime,
        end: s.endTime,
        minutes: s.minutes
      })),
      totalMinutes: totalMinutes.value,
      direction: goal.value
    })
    result.value = text
  } catch (e: any) {
    error.value = e?.message || '生成失败'
  } finally {
    loading.value = false
  }
}

async function copyResult() {
  if (!result.value) return
  try {
    await navigator.clipboard.writeText(result.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    error.value = '复制失败，请手动选择文本'
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in p-4"
      @click.self="close"
    >
      <div class="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[88vh] flex flex-col animate-slide-up">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 class="text-base font-semibold text-gray-800 flex items-center gap-2">
            <span class="text-primary-500">📅</span>
            空闲自习规划
          </h3>
          <button class="text-gray-400 hover:text-gray-600 text-xl leading-none" @click="close">×</button>
        </div>

        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <!-- 今日空闲时段 -->
          <div>
            <div class="text-xs font-medium text-gray-600 mb-2">
              今日空闲时段（共 {{ totalMinutes }} 分钟）
            </div>
            <div v-if="freeSlots.length" class="flex flex-wrap gap-2">
              <span
                v-for="(slot, i) in freeSlots"
                :key="i"
                class="inline-flex items-center px-2.5 py-1 rounded-full bg-primary-50 border border-primary-200 text-xs text-primary-700"
              >
                {{ slot.label }} · {{ slot.minutes }}分钟
              </span>
            </div>
            <p v-else class="text-sm text-gray-400">今日无空闲时段</p>
          </div>

          <!-- 规划方向 -->
          <div>
            <div class="text-xs font-medium text-gray-600 mb-2">规划方向</div>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="g in GOALS"
                :key="g.key"
                class="p-3 rounded-lg border text-left transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                :class="goal === g.key
                  ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-100'
                  : 'border-gray-200 hover:border-primary-300 hover:bg-primary-50/30'"
                @click="goal = g.key"
              >
                <div class="text-sm font-medium text-gray-800">{{ g.key }}</div>
                <div class="text-[11px] text-gray-500 mt-0.5">{{ g.desc }}</div>
              </button>
            </div>
          </div>

          <!-- 生成按钮 -->
          <button
            class="w-full px-4 py-2.5 text-sm rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50"
            :disabled="loading || !freeSlots.length"
            @click="generate"
          >
            {{ loading ? '生成中...' : '生成规划' }}
          </button>

          <!-- 加载动画 -->
          <div v-if="loading" class="flex items-center justify-center py-6">
            <div class="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
            <span class="ml-3 text-sm text-gray-500">AI 规划中...</span>
          </div>

          <!-- 错误 -->
          <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

          <!-- 结果 -->
          <div v-if="result && !loading" class="space-y-2">
            <div class="flex items-center justify-between">
              <div class="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                <span>💡</span>
                规划建议
              </div>
              <button
                class="text-xs px-2.5 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition"
                @click="copyResult"
              >
                {{ copied ? '已复制' : '复制' }}
              </button>
            </div>
            <pre class="px-4 py-3 bg-gradient-to-br from-gray-50 to-primary-50/30 rounded-lg text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed border border-gray-100">{{ result }}</pre>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
