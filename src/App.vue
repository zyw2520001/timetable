<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Course } from '@/types/course'
import { loadCourses, saveCourses, loadCurrentWeek, saveCurrentWeek, loadSemesterStart, saveSemesterStart, loadSectionConfig, saveSectionConfig, type SectionConfig } from '@/utils/storage'
import { exportCoursesToICS } from '@/utils/icsExport'
import { generateSectionTimes, type SectionTime } from '@/utils/freeTime'
import WeekView from '@/components/WeekView.vue'
import DayView from '@/components/DayView.vue'
import CourseDialog from '@/components/CourseDialog.vue'
import AiImport from '@/components/AiImport.vue'
import FreeTimePlanner from '@/components/FreeTimePlanner.vue'

const courses = ref<Course[]>(loadCourses())
const view = ref<'week' | 'day'>('week')
const dayViewWeek = ref<number>(1)
const currentWeek = ref<number>(loadCurrentWeek())
const semesterStart = ref<string>(loadSemesterStart())
const sectionConfig = ref<SectionConfig>(loadSectionConfig())
const sectionTimes = computed<SectionTime[]>(() => generateSectionTimes(sectionConfig.value))

// 单双周自动判断：奇数周=单周(0)，偶数周=双周(1)
const weekOffset = computed<0 | 1>(() => (currentWeek.value % 2 === 1 ? 0 : 1))
const weekOffsetLabel = computed(() => (weekOffset.value === 0 ? '单周' : '双周'))

const courseDialogVisible = ref(false)
const editingCourse = ref<Course | null>(null)
const coursePreset = ref<{ week: number; startSection: number; endSection: number } | null>(null)

const aiImportVisible = ref(false)
const plannerVisible = ref(false)

const apiKeyDialogVisible = ref(false)
const apiKeyInput = ref('')
const apiKeyStatus = ref('未配置')

const toast = ref<{ msg: string; type: 'error' | 'success' } | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(msg: string, type: 'error' | 'success' = 'error') {
  toast.value = { msg, type }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = null), 2600)
}

function checkApiAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.api
}

const totalCourses = computed(() => courses.value.length)

function persistCourses() {
  saveCourses(courses.value)
}

function prevWeek() {
  if (currentWeek.value > 1) {
    currentWeek.value--
    saveCurrentWeek(currentWeek.value)
  }
}

function nextWeek() {
  if (currentWeek.value < 30) {
    currentWeek.value++
    saveCurrentWeek(currentWeek.value)
  }
}

function onCurrentWeekChange() {
  let w = Number(currentWeek.value)
  if (isNaN(w) || w < 1) w = 1
  if (w > 30) w = 30
  currentWeek.value = w
  saveCurrentWeek(w)
}

function onSemesterStartChange() {
  saveSemesterStart(semesterStart.value)
}

function onSectionConfigChange() {
  saveSectionConfig(sectionConfig.value)
}

// 预览：根据配置生成的课节时间表
const sectionPreview = computed(() => {
  return sectionTimes.value.map(s => `第${s.section}节 ${s.start}-${s.end}`).join('  ·  ')
})

// 课程新增/编辑
function openAdd(payload: { week: number; startSection: number; endSection: number }) {
  editingCourse.value = null
  coursePreset.value = payload
  courseDialogVisible.value = true
}

function openAddBlank() {
  editingCourse.value = null
  coursePreset.value = null
  courseDialogVisible.value = true
}

// 一键清除所有课程
const clearConfirmVisible = ref(false)
function clearAllCourses() {
  courses.value = []
  persistCourses()
  clearConfirmVisible.value = false
  showToast('已清除全部课程', 'success')
}

function openEdit(course: Course) {
  editingCourse.value = course
  coursePreset.value = null
  courseDialogVisible.value = true
}

function handleSaveCourse(course: Course) {
  const idx = courses.value.findIndex((c) => c.id === course.id)
  if (idx >= 0) {
    const next = [...courses.value]
    next[idx] = course
    courses.value = next
  } else {
    courses.value = [...courses.value, course]
  }
  persistCourses()
}

// AI 导入
function openAiImport() {
  if (!checkApiAvailable()) {
    showToast('请在桌面端使用 AI 导入功能')
    return
  }
  aiImportVisible.value = true
}

function handleImport(imported: Course[]) {
  courses.value = [...courses.value, ...imported]
  persistCourses()
  showToast(`成功导入 ${imported.length} 门课程`, 'success')
}

// 自习规划
function openPlanner() {
  if (!checkApiAvailable()) {
    showToast('请在桌面端使用自习规划功能')
    return
  }
  plannerVisible.value = true
}

// 导出 ICS
async function handleExportICS() {
  if (!courses.value.length) {
    showToast('暂无课程可导出')
    return
  }
  let icsContent: string
  try {
    icsContent = exportCoursesToICS(courses.value, 16, sectionTimes.value)
  } catch (e: any) {
    showToast(e?.message || '生成 ICS 失败')
    return
  }
  if (!checkApiAvailable()) {
    // 浏览器环境降级：下载文件
    try {
      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = '课程表.ics'
      a.click()
      URL.revokeObjectURL(url)
      showToast('已下载 ICS 文件', 'success')
    } catch {
      showToast('导出失败')
    }
    return
  }
  try {
    const filePath = await window.api.dialog.saveFile('课程表.ics')
    if (!filePath) return
    await window.api.fs.writeFile(filePath, icsContent)
    showToast('导出成功', 'success')
  } catch (e: any) {
    showToast(e?.message || '导出失败')
  }
}

// API Key
function openApiKeyDialog() {
  apiKeyInput.value = ''
  apiKeyDialogVisible.value = true
}

async function saveApiKey() {
  if (!checkApiAvailable()) {
    showToast('当前环境不支持配置 API Key')
    return
  }
  try {
    const ok = await window.api.apiKey.save(apiKeyInput.value.trim())
    if (ok) {
      apiKeyStatus.value = apiKeyInput.value.trim() ? '已配置' : '未配置'
      apiKeyDialogVisible.value = false
      showToast('API Key 已保存', 'success')
    } else {
      showToast('保存失败')
    }
  } catch (e: any) {
    showToast(e?.message || '保存失败')
  }
}

onMounted(async () => {
  if (!checkApiAvailable()) {
    apiKeyStatus.value = '未配置'
    return
  }
  try {
    const key = await window.api.apiKey.get()
    apiKeyStatus.value = key ? '已配置' : '未配置'
  } catch {
    apiKeyStatus.value = '未配置'
  }
})
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-100 text-gray-800">
    <!-- 顶部导航栏 -->
    <header class="bg-gradient-to-r from-white to-gray-50 border-b border-gray-200 shadow-sm">
      <div class="px-4 py-2.5 flex items-center gap-3 flex-wrap">
        <!-- Logo -->
        <div class="flex items-center gap-2 mr-2">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 text-white flex items-center justify-center font-bold text-sm shadow-md">课</div>
          <span class="font-semibold text-gray-800">智能课程表Pro</span>
        </div>

        <!-- 视图切换 -->
        <div class="flex bg-gray-100 rounded-lg p-0.5">
          <button
            class="px-3 py-1 text-xs rounded-md transition"
            :class="view === 'week' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500'"
            @click="view = 'week'"
          >
            周视图
          </button>
          <button
            class="px-3 py-1 text-xs rounded-md transition"
            :class="view === 'day' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500'"
            @click="view = 'day'"
          >
            日视图
          </button>
        </div>

        <!-- 周数导航器 -->
        <div class="flex items-center gap-2 bg-gray-100 rounded-lg px-1 py-0.5">
          <button
            class="w-7 h-7 rounded-md bg-white text-gray-500 hover:text-primary-600 hover:shadow-sm flex items-center justify-center transition active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
            :disabled="currentWeek <= 1"
            @click="prevWeek"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div class="flex items-center gap-1.5">
            <span class="text-xs text-gray-500">第</span>
            <input
              v-model.number="currentWeek"
              type="number"
              min="1"
              max="30"
              @change="onCurrentWeekChange"
              class="w-10 px-1 py-0.5 text-sm font-semibold text-center text-gray-700 bg-white rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
            />
            <span class="text-xs text-gray-500">周</span>
            <span class="ml-1 px-1.5 py-0.5 text-[10px] rounded-full"
              :class="weekOffset === 0 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'"
            >{{ weekOffsetLabel }}</span>
          </div>
          <button
            class="w-7 h-7 rounded-md bg-white text-gray-500 hover:text-primary-600 hover:shadow-sm flex items-center justify-center transition active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
            :disabled="currentWeek >= 30"
            @click="nextWeek"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>

        <!-- 学期起始日期 -->
        <div class="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
          <span class="text-xs text-gray-400">学期起</span>
          <input
            v-model="semesterStart"
            type="date"
            @change="onSemesterStartChange"
            class="text-xs text-gray-600 bg-white rounded-md border border-gray-200 px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
          />
        </div>

        <div class="flex-1"></div>

        <!-- 操作按钮 -->
        <button
          class="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 hover:shadow-sm flex items-center gap-1 transition active:scale-95"
          @click="openAiImport"
        >
          <span>✨</span> AI导入
        </button>
        <button
          class="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 hover:shadow-sm flex items-center gap-1 transition active:scale-95"
          @click="openPlanner"
        >
          <span>📅</span> 自习规划
        </button>
        <button
          class="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 hover:shadow-sm flex items-center gap-1 transition active:scale-95"
          @click="handleExportICS"
        >
          <span>📤</span> 导出ICS
        </button>
        <button
          class="px-3 py-1.5 text-xs rounded-lg bg-primary-500 text-white hover:bg-primary-600 hover:shadow-sm flex items-center gap-1 transition active:scale-95"
          @click="openAddBlank"
        >
          <span>＋</span> 新增课程
        </button>
        <button
          class="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 hover:shadow-sm flex items-center gap-1 transition active:scale-95"
          @click="openApiKeyDialog"
        >
          <span>⚙</span> 设置
        </button>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="flex-1 overflow-auto p-4">
      <WeekView
        v-if="view === 'week'"
        :courses="courses"
        :week-offset="weekOffset"
        :current-week="currentWeek"
        :semester-start="semesterStart"
        :section-times="sectionTimes"
        @add="openAdd"
        @edit="openEdit"
      />
      <DayView
        v-else
        :courses="courses"
        :week-offset="weekOffset"
        :current-day="dayViewWeek"
        :current-week="currentWeek"
        :semester-start="semesterStart"
        :section-times="sectionTimes"
        @add="openAdd"
        @edit="openEdit"
        @change-week="(w) => (dayViewWeek = w)"
      />
    </main>

    <!-- 底部状态栏 -->
    <footer class="bg-gray-50/80 backdrop-blur border-t border-gray-200 rounded-t-xl px-4 py-2 flex items-center gap-4 text-xs text-gray-500">
      <span>课程总数：<b class="text-gray-700">{{ totalCourses }}</b></span>
      <span class="text-gray-300">|</span>
      <span>第<b class="text-primary-600">{{ currentWeek }}</b>周（{{ weekOffsetLabel }}）</span>
      <span class="text-gray-300">|</span>
      <span>API Key：<b :class="apiKeyStatus === '已配置' ? 'text-primary-600' : 'text-gray-400'">{{ apiKeyStatus }}</b></span>
      <div class="flex-1"></div>
      <span class="text-gray-400">点击空格子新增课程 · 点击课程块编辑</span>
    </footer>

    <!-- 全局错误提示 -->
    <Teleport to="body">
      <div
        v-if="toast"
        class="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-2xl shadow-2xl text-sm text-white animate-slide-up"
        :class="toast.type === 'success' ? 'bg-primary-500' : 'bg-red-500'"
      >
        {{ toast.msg }}
      </div>
    </Teleport>

    <!-- 课程弹窗 -->
    <CourseDialog
      v-model:visible="courseDialogVisible"
      :course="editingCourse"
      :preset="coursePreset || undefined"
      @save="handleSaveCourse"
    />

    <!-- AI 导入弹窗 -->
    <AiImport v-model:visible="aiImportVisible" @import="handleImport" />

    <!-- 自习规划弹窗 -->
    <FreeTimePlanner
      v-model:visible="plannerVisible"
      :courses="courses"
      :week-offset="weekOffset"
      :current-week="currentWeek"
      :section-times="sectionTimes"
    />

    <!-- 设置弹窗 -->
    <Teleport to="body">
      <div
        v-if="apiKeyDialogVisible"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in"
        @click.self="apiKeyDialogVisible = false"
      >
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-slide-up max-h-[85vh] flex flex-col">
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 class="text-base font-semibold text-gray-800">⚙ 设置</h3>
            <button class="text-gray-400 hover:text-gray-600 text-xl leading-none w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition" @click="apiKeyDialogVisible = false">×</button>
          </div>
          <div class="overflow-y-auto px-6 py-5 space-y-5">
            <!-- API Key -->
            <div class="space-y-2">
              <label class="text-sm font-medium text-gray-700">API Key</label>
              <p class="text-xs text-gray-400">用于 AI 识别课表与自习规划。Key 仅保存在本地。</p>
              <input
                v-model="apiKeyInput"
                type="password"
                placeholder="sk-..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
              />
              <div class="text-xs text-gray-400">
                当前状态：<span :class="apiKeyStatus === '已配置' ? 'text-primary-600' : 'text-gray-500'">{{ apiKeyStatus }}</span>
              </div>
            </div>

            <div class="border-t border-gray-100 pt-4"></div>

            <!-- 课节时间配置 -->
            <div class="space-y-3">
              <label class="text-sm font-medium text-gray-700">课节时间配置</label>
              <p class="text-xs text-gray-400">设置每节课时长和各时段开始时间，系统自动推算全部节次。</p>

              <!-- 每节课时长 + 课间休息 -->
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="text-xs text-gray-500 mb-1 block">每节课时长（分钟）</label>
                  <input
                    v-model.number="sectionConfig.duration"
                    type="number"
                    min="30"
                    max="120"
                    @change="onSectionConfigChange"
                    class="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                  />
                </div>
                <div>
                  <label class="text-xs text-gray-500 mb-1 block">课间休息（分钟）</label>
                  <input
                    v-model.number="sectionConfig.breakMin"
                    type="number"
                    min="0"
                    max="30"
                    @change="onSectionConfigChange"
                    class="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                  />
                </div>
              </div>

              <!-- 三段开始时间 -->
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label class="text-xs text-gray-500 mb-1 block">上午第1节</label>
                  <input
                    v-model="sectionConfig.morningStart"
                    type="time"
                    @change="onSectionConfigChange"
                    class="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                  />
                </div>
                <div>
                  <label class="text-xs text-gray-500 mb-1 block">下午第6节</label>
                  <input
                    v-model="sectionConfig.afternoonStart"
                    type="time"
                    @change="onSectionConfigChange"
                    class="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                  />
                </div>
                <div>
                  <label class="text-xs text-gray-500 mb-1 block">晚上第10节</label>
                  <input
                    v-model="sectionConfig.eveningStart"
                    type="time"
                    @change="onSectionConfigChange"
                    class="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                  />
                </div>
              </div>

              <!-- 预览 -->
              <div class="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500 leading-relaxed">
                {{ sectionPreview }}
              </div>
            </div>

            <div class="border-t border-gray-100 pt-4"></div>

            <!-- 危险区域 -->
            <div class="space-y-2">
              <label class="text-sm font-medium text-gray-700">数据管理</label>
              <div class="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <div>
                  <div class="text-sm text-gray-700">清除所有课程</div>
                  <div class="text-xs text-gray-400">删除全部 {{ totalCourses }} 门课程，不可恢复</div>
                </div>
                <button
                  class="px-3 py-1.5 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600 transition shadow-sm"
                  @click="clearConfirmVisible = true"
                >
                  清除
                </button>
              </div>
            </div>
          </div>
          <div class="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
            <button
              class="px-4 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition"
              @click="apiKeyDialogVisible = false"
            >
              关闭
            </button>
            <button
              class="px-4 py-1.5 text-sm rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition shadow-sm"
              @click="saveApiKey"
            >
              保存 API Key
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 清除确认弹窗 -->
    <Teleport to="body">
      <div
        v-if="clearConfirmVisible"
        class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 animate-fade-in"
        @click.self="clearConfirmVisible = false"
      >
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 animate-slide-up">
          <div class="px-6 pt-6 pb-4 text-center">
            <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
              <svg class="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            </div>
            <h3 class="text-base font-semibold text-gray-800 mb-1">确认清除所有课程？</h3>
            <p class="text-xs text-gray-500">将删除全部 {{ totalCourses }} 门课程，此操作不可恢复。</p>
          </div>
          <div class="flex gap-2 px-6 pb-6">
            <button
              class="flex-1 px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition"
              @click="clearConfirmVisible = false"
            >
              取消
            </button>
            <button
              class="flex-1 px-4 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 transition shadow-sm"
              @click="clearAllCourses"
            >
              确认清除
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
