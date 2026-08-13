<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Course } from '@/types/course'
import { genId, randomColor } from '@/utils/storage'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [v: boolean]
  import: [courses: Course[]]
}>()

type Mode = 'text' | 'image' | 'pdf'
const mode = ref<Mode>('text')
const loading = ref(false)
const error = ref('')
const text = ref('')
const images = ref<string[]>([])
const imageNames = ref<string[]>([])
const pdfPath = ref('')
const parsed = ref<Course[]>([])

const tabs: { key: Mode; label: string }[] = [
  { key: 'text', label: '粘贴文本' },
  { key: 'image', label: '上传图片' },
  { key: 'pdf', label: '上传PDF' }
]

const hasResult = computed(() => parsed.value.length > 0)

function close() {
  emit('update:visible', false)
}

function reset() {
  parsed.value = []
  error.value = ''
  text.value = ''
  images.value = []
  imageNames.value = []
  pdfPath.value = ''
}

function pick(obj: any, keys: string[]): any {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k]
  }
  return undefined
}

function toInt(v: any, fallback: number): number {
  if (typeof v === 'number' && !isNaN(v)) return v
  if (typeof v === 'string') {
    const m = v.match(/\d+/)
    if (m) return parseInt(m[0], 10)
  }
  return fallback
}

function parseWeek(v: any): number {
  if (typeof v === 'number') return Math.max(1, Math.min(7, v))
  if (typeof v === 'string') {
    const map: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 }
    for (const k in map) {
      if (v.includes(k)) return map[k]
    }
    const m = v.match(/\d+/)
    if (m) return Math.max(1, Math.min(7, parseInt(m[0], 10)))
  }
  return 1
}

function parseWeekType(v: any): 0 | 1 | 2 {
  if (typeof v === 'number') {
    if (v === 0 || v === 1) return v
    return 2
  }
  if (typeof v === 'string') {
    if (v.includes('单双') || v.includes('每周') || v.includes('全周')) return 2
    if (v.includes('双')) return 1
    if (v.includes('单')) return 0
  }
  return 2
}

function normalizeItem(item: any): Course {
  const startSection = toInt(
    pick(item, ['startSection', 'start', 'sectionStart', '起始节', '开始节', '开始节次', 'from']),
    1
  )
  const endRaw = pick(item, ['endSection', 'end', 'sectionEnd', '结束节', '结束节次', 'to'])
  const endSection = endRaw !== undefined ? toInt(endRaw, startSection) : startSection
  const startWeek = toInt(pick(item, ['startWeek', 'start_week', '起始周']), 1)
  const endWeek = toInt(pick(item, ['endWeek', 'end_week', '结束周']), 16)
  return {
    id: genId(),
    className: String(pick(item, ['className', 'name', 'courseName', '课程名', '课程', '名称']) || '未命名'),
    teacher: String(pick(item, ['teacher', '教师', '老师', '授课教师']) || ''),
    location: String(pick(item, ['location', 'place', '地点', '教室', '上课地点']) || ''),
    week: parseWeek(pick(item, ['week', 'day', 'weekday', '星期', '周几', '星期几'])),
    startSection,
    endSection,
    weekType: parseWeekType(pick(item, ['weekType', 'week_type', '周类型', '周次类型', '单双周'])),
    startWeek,
    endWeek,
    color: randomColor()
  }
}

function applyResult(list: any[]) {
  if (!Array.isArray(list)) {
    error.value = '识别结果格式异常'
    return
  }
  parsed.value = list.map(normalizeItem)
  if (!parsed.value.length) error.value = '未识别到任何课程'
}

async function onParseText() {
  if (!text.value.trim()) {
    error.value = '请粘贴教务文本'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const res = await window.api.ai.parseText(text.value)
    applyResult(res)
  } catch (e: any) {
    error.value = e?.message || '识别失败'
  } finally {
    loading.value = false
  }
}

async function onImageChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  images.value = []
  imageNames.value = []
  for (const file of Array.from(input.files)) {
    const dataUrl = await readFileAsDataURL(file)
    images.value.push(dataUrl)
    imageNames.value.push(file.name)
  }
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function onParseImage() {
  if (!images.value.length) {
    error.value = '请选择课表图片'
    return
  }
  loading.value = true
  error.value = ''
  try {
    // 关键：用展开运算符创建纯数组，避免 Vue Proxy 导致 IPC 克隆失败
    const plainImages = images.value.map(s => String(s))
    const res = await window.api.ai.parseImage(plainImages)
    applyResult(res)
  } catch (e: any) {
    error.value = e?.message || '识别失败'
  } finally {
    loading.value = false
  }
}

async function onPickPdf() {
  const p = await window.api.dialog.openPdf()
  if (p) pdfPath.value = p
}

async function onParsePdf() {
  if (!pdfPath.value) {
    error.value = '请选择 PDF 文件'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const res = await window.api.ai.parsePdf(pdfPath.value)
    applyResult(res)
  } catch (e: any) {
    error.value = e?.message || '识别失败'
  } finally {
    loading.value = false
  }
}

function confirmImport() {
  if (!parsed.value.length) return
  emit('import', parsed.value)
  reset()
  close()
}

const WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const WEEK_TYPE_LABELS = ['单周', '双周', '单双周']
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in p-4"
      @click.self="close"
    >
      <div class="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[88vh] flex flex-col animate-slide-up">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 class="text-base font-semibold text-gray-800">AI 导入课程</h3>
          <button class="text-gray-400 hover:text-gray-600 text-xl leading-none" @click="close">×</button>
        </div>

        <div class="flex-1 overflow-y-auto px-5 py-4">
          <!-- 模式切换 -->
          <div class="flex gap-1 mb-4 border-b border-gray-200">
            <button
              v-for="t in tabs"
              :key="t.key"
              class="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition"
              :class="mode === t.key
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'"
              @click="mode = t.key"
            >
              {{ t.label }}
            </button>
          </div>

          <!-- 文本模式 -->
          <div v-if="mode === 'text'" class="space-y-3">
            <textarea
              v-model="text"
              rows="8"
              placeholder="将教务系统课表文本粘贴至此..."
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 font-mono"
            ></textarea>
            <button
              class="px-4 py-2 text-sm rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50"
              :disabled="loading"
              @click="onParseText"
            >
              {{ loading ? '识别中...' : '开始识别' }}
            </button>
          </div>

          <!-- 图片模式 -->
          <div v-else-if="mode === 'image'" class="space-y-3">
            <input
              type="file"
              accept="image/*"
              multiple
              @change="onImageChange"
              class="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 cursor-pointer"
            />
            <div v-if="imageNames.length" class="text-xs text-gray-500">
              已选择 {{ imageNames.length }} 张图片：{{ imageNames.join('、') }}
            </div>
            <button
              class="px-4 py-2 text-sm rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50"
              :disabled="loading"
              @click="onParseImage"
            >
              {{ loading ? '识别中...' : '开始识别' }}
            </button>
          </div>

          <!-- PDF 模式 -->
          <div v-else class="space-y-3">
            <div class="flex items-center gap-3">
              <button
                class="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
                @click="onPickPdf"
              >
                选择 PDF 文件
              </button>
              <span v-if="pdfPath" class="text-xs text-gray-500 truncate flex-1">{{ pdfPath }}</span>
            </div>
            <button
              class="px-4 py-2 text-sm rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50"
              :disabled="loading"
              @click="onParsePdf"
            >
              {{ loading ? '识别中...' : '开始识别' }}
            </button>
          </div>

          <!-- 加载动画 -->
          <div v-if="loading" class="flex items-center justify-center py-8">
            <div class="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
            <span class="ml-3 text-sm text-gray-500">AI 识别中，请稍候...</span>
          </div>

          <!-- 错误提示 -->
          <p v-if="error" class="mt-3 text-sm text-red-500">{{ error }}</p>

          <!-- 预览表格 -->
          <div v-if="hasResult && !loading" class="mt-4">
            <div class="text-sm font-medium text-gray-700 mb-2">
              识别到 {{ parsed.length }} 门课程，请确认：
            </div>
            <div class="overflow-x-auto border border-gray-200 rounded-lg">
              <table class="w-full text-xs">
                <thead class="bg-gray-50 text-gray-600">
                  <tr>
                    <th class="px-2 py-2 text-left font-medium">星期</th>
                    <th class="px-2 py-2 text-left font-medium">节次</th>
                    <th class="px-2 py-2 text-left font-medium">课程</th>
                    <th class="px-2 py-2 text-left font-medium">教师</th>
                    <th class="px-2 py-2 text-left font-medium">地点</th>
                    <th class="px-2 py-2 text-left font-medium">周类型</th>
                    <th class="px-2 py-2 text-left font-medium">周次</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-for="c in parsed" :key="c.id" class="hover:bg-gray-50">
                    <td class="px-2 py-1.5">{{ WEEK_LABELS[c.week - 1] }}</td>
                    <td class="px-2 py-1.5">{{ c.startSection }}-{{ c.endSection }}</td>
                    <td class="px-2 py-1.5 font-medium text-gray-800">{{ c.className }}</td>
                    <td class="px-2 py-1.5 text-gray-600">{{ c.teacher || '-' }}</td>
                    <td class="px-2 py-1.5 text-gray-600">{{ c.location || '-' }}</td>
                    <td class="px-2 py-1.5 text-gray-600">{{ WEEK_TYPE_LABELS[c.weekType] }}</td>
                    <td class="px-2 py-1.5 text-gray-600">第{{ c.startWeek }}-{{ c.endWeek }}周</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
          <button
            class="px-4 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100"
            @click="close"
          >
            取消
          </button>
          <button
            v-if="hasResult"
            class="px-4 py-1.5 text-sm rounded-lg bg-primary-500 text-white hover:bg-primary-600"
            @click="confirmImport"
          >
            导入 {{ parsed.length }} 门课程
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
