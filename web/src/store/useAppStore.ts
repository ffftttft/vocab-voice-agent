import { create } from 'zustand'
import { toast } from 'sonner'
import { api } from '../lib/api'
import type {
  LinguisticMistakeRecord,
  PlanResponse,
  ReviewResult,
  ScreenId,
  Stats,
  StudyCard,
  WordRecord,
} from '../lib/types'

export type UiStateOverride = 'default' | 'loading' | 'empty' | 'error' | 'voice_ready' | 'completed'
export type UiLang = 'zh' | 'en'

export const ONBOARDING_STORAGE_KEY = 'pip_onboarding_seen_v1'
export const ONBOARDING_CARD_DISMISSED_KEY = 'pip_onboarding_card_dismissed_v1'
export const LANG_STORAGE_KEY = 'pip_ui_lang'

function getInitialLang(): UiLang {
  if (typeof window === 'undefined') return 'zh'
  const saved = window.localStorage.getItem(LANG_STORAGE_KEY)
  return saved === 'en' ? 'en' : 'zh'
}

function getInitialOnboardingOpen(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  if (params.get('screen')) return false
  return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) !== '1'
}

function getInitialOnboardingCardDismissed(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(ONBOARDING_CARD_DISMISSED_KEY) === '1'
}

export interface StageConfigState {
  provider: string
  base_url: string
  ws_url: string
  api_key: string
  model_name: string
  voice_id: string
  temperature?: number | null
}

const DEFAULT_PROFILE_MD = `# 用户画像

## 身份背景

- 职业：程序员（软件开发者）
- 当前目标：准备跳槽到外企，需要能在英文技术面试与日常研发沟通中开口
- 当前英语水平：能读简单单词，**几乎无法组织完整句子开口说话**，词汇量一般
- 常用语境：程序员开发日常 —— 代码评审、需求讨论、线上故障排查、技术方案争论、每日站会

## 学习偏好

- 偏好具体、确定、可复用的表达，不喜欢空泛的鸡汤式例句
- 能接受被纠正，但反感长篇说教

## 近期动态
`

const DEFAULT_ERRORS_MD = `# 语言顽疾病历本

> 由每日夜间 Compaction 自动聚合维护，保留最核心的 Top 15 条活跃病历。
> 次日语音会话启动时注入 System Prompt，让语音模型优先关注这些薄弱点。

## 发音易错点

## 语法 / 用词盲区
`

interface AppStore {
  currentScreen: ScreenId
  lang: UiLang
  darkMode: boolean
  uiStateMode: UiStateOverride
  loading: boolean
  error: string | null

  // Onboarding state
  onboardingOpen: boolean
  onboardingStep: number
  onboardingCardDismissed: boolean

  // Data from backend
  plan: PlanResponse | null
  stats: Stats | null
  cards: StudyCard[]
  currentCardIndex: number
  selectedOption: string | null
  lastReviewResult: ReviewResult | null
  lastDurationMs: number
  autoAudio: boolean
  confusableExpanded: boolean

  // Words & Mistakes
  words: WordRecord[]
  mistakes: LinguisticMistakeRecord[]
  tagCounts: Record<string, number>
  books: string[]
  selectedTopicTag: string
  selectedWordIds: number[]
  activeWordbookName: string

  // Voice Studio & Live Call
  voicePersona: 'Chelsie' | 'Ethan' | 'Serena'
  callElapsedSec: number
  isMuted: boolean
  recastDismissed: boolean
  hintStreaming: boolean
  hintTextEn: string
  hintTextZh: string
  playingHintDemo: boolean
  proactiveWords: string[]
  hintAssistedWords: string[]

  // Memory Editor
  activeMemoryDoc: 'user_profile' | 'error_patterns'
  memoryViewMode: 'raw' | 'structured'
  userProfileMd: string
  errorPatternsMd: string

  // Study Quotas & Engine Router
  studyPlanQuotas: {
    daily_new_words: number
    daily_review_limit: number
    voice_target_words_count: number
    voice_sliding_window_size: number
  }
  activeRouterStage: 1 | 2 | 3
  modelStages: {
    realtime_voice: StageConfigState
    text_llm: StageConfigState
    tts: StageConfigState
  }

  // Actions
  navigate: (screen: ScreenId) => void
  setLang: (lang: UiLang) => void
  toggleLang: () => void
  openOnboarding: (step?: number) => void
  closeOnboarding: () => void
  setOnboardingStep: (step: number) => void
  dismissOnboardingCard: () => void
  toggleDarkMode: () => void
  setUiStateMode: (mode: UiStateOverride) => void
  setAutoAudio: (v: boolean) => void
  setConfusableExpanded: (v: boolean) => void

  initBackendData: () => Promise<void>
  regenerateDailyPlan: () => Promise<void>
  submitCardChoice: (label: string, durationMs: number) => Promise<void>
  overrideCardRating: (rating: 2 | 3 | 4) => Promise<void>
  nextSprintCard: () => void

  setSelectedTopicTag: (tag: string) => void
  toggleWordSelection: (id: number) => void
  importWordbookFile: (file: File) => Promise<void>

  setVoicePersona: (persona: 'Chelsie' | 'Ethan' | 'Serena') => void
  toggleMicMute: () => void
  triggerNewHintAngle: () => void
  playHintDemoWithAutoMute: () => Promise<void>
  completeLiveVoiceSession: () => Promise<void>

  setActiveMemoryDoc: (doc: 'user_profile' | 'error_patterns') => void
  setMemoryViewMode: (mode: 'raw' | 'structured') => void
  updateMemoryContent: (content: string) => void
  insertMarkdownSnippet: (snippet: string) => void
  saveActiveMemory: () => Promise<void>
  runMemoryCompaction: () => Promise<void>

  setActiveRouterStage: (stage: 1 | 2 | 3) => void
  adjustQuota: (
    key: 'daily_new_words' | 'daily_review_limit',
    delta: number,
    min: number,
    max: number,
  ) => void
  updateStageField: (
    stage: 'realtime_voice' | 'text_llm' | 'tts',
    key: keyof StageConfigState,
    value: string,
  ) => void
  saveAndHotReloadConfig: () => Promise<void>
}

export const useAppStore = create<AppStore>((set, get) => ({
  currentScreen: '01-today-studio',
  lang: getInitialLang(),
  darkMode: false,
  uiStateMode: 'default',
  loading: false,
  error: null,

  onboardingOpen: getInitialOnboardingOpen(),
  onboardingStep: 0,
  onboardingCardDismissed: getInitialOnboardingCardDismissed(),

  plan: {
    plan_date: new Date().toISOString().slice(0, 10),
    cached: true,
    scenario_title: null,
    scenario_brief: null,
    status: undefined,
    progress: {
      new: { total: 0, done: 0 },
      review: { total: 0, done: 0 },
      total: 0,
      done: 0,
      remaining: 0,
      all_done: false,
    },
  },
  stats: {
    new: 0,
    due: 0,
    learning: 0,
    review: 0,
    relearning: 0,
    total: 0,
    upcoming: [],
  },
  cards: [],
  currentCardIndex: 0,
  selectedOption: null,
  lastReviewResult: null,
  lastDurationMs: 0,
  autoAudio: true,
  confusableExpanded: false,

  words: [],
  mistakes: [],
  tagCounts: {},
  books: [],
  selectedTopicTag: 'all',
  selectedWordIds: [],
  activeWordbookName: '',

  voicePersona: 'Chelsie',
  callElapsedSec: 0,
  isMuted: false,
  recastDismissed: false,
  hintStreaming: false,
  hintTextEn: '',
  hintTextZh: '',
  playingHintDemo: false,
  proactiveWords: [],
  hintAssistedWords: [],

  activeMemoryDoc: 'user_profile',
  memoryViewMode: 'raw',
  userProfileMd: DEFAULT_PROFILE_MD,
  errorPatternsMd: DEFAULT_ERRORS_MD,

  studyPlanQuotas: {
    daily_new_words: 30,
    daily_review_limit: 90,
    voice_target_words_count: 22,
    voice_sliding_window_size: 4,
  },
  activeRouterStage: 1,
  modelStages: {
    realtime_voice: {
      provider: 'qwen_omni',
      base_url: '',
      ws_url: '',
      api_key: '',
      model_name: 'qwen-omni-turbo-realtime',
      voice_id: 'Chelsie',
    },
    text_llm: {
      provider: 'openai_compatible',
      base_url: '',
      ws_url: '',
      api_key: '',
      model_name: 'deepseek-chat',
      voice_id: '',
      temperature: 0.7,
    },
    tts: {
      provider: 'edge_tts',
      base_url: '',
      ws_url: '',
      api_key: '',
      model_name: 'edge-tts-neural',
      voice_id: 'en-US-AndrewMultilingualNeural',
    },
  },

  navigate: (screen) => {
    set({ currentScreen: screen, confusableExpanded: false })
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('screen', screen)
      window.history.replaceState({}, '', url.toString())
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    }
  },

  setLang: (lang) => {
    set({ lang })
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang)
      document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
    }
  },

  toggleLang: () => {
    const next: UiLang = get().lang === 'zh' ? 'en' : 'zh'
    get().setLang(next)
    toast(next === 'zh' ? '已切换为中文界面' : 'Switched to English UI')
  },

  openOnboarding: (step = 0) => {
    set({ onboardingOpen: true, onboardingStep: step, onboardingCardDismissed: false })
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ONBOARDING_CARD_DISMISSED_KEY)
    }
  },

  closeOnboarding: () => {
    set({ onboardingOpen: false })
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1')
    }
  },

  setOnboardingStep: (step) => {
    set({ onboardingStep: step })
  },

  dismissOnboardingCard: () => {
    set({ onboardingCardDismissed: true, onboardingOpen: false })
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1')
      window.localStorage.setItem(ONBOARDING_CARD_DISMISSED_KEY, '1')
    }
  },

  toggleDarkMode: () => {
    const next = !get().darkMode
    set({ darkMode: next })
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', next)
    }
  },

  setUiStateMode: (mode) => set({ uiStateMode: mode }),
  setAutoAudio: (v) => set({ autoAudio: v }),
  setConfusableExpanded: (v) => set({ confusableExpanded: v }),

  initBackendData: async () => {
    try {
      const [queueRes, statsRes, wordsRes, cfgRes, memRes] = await Promise.all([
        api.queue(true).catch(() => null),
        api.stats().catch(() => null),
        api.wordsAndMistakes().catch(() => null),
        api.getConfig().catch(() => null),
        api.getMemory().catch(() => null),
      ])

      set((state) => {
        const cards = queueRes?.cards ?? []
        const firstSentenceCard = cards.find((c) => c.sentence_en)
        const nextPlan: PlanResponse = {
          plan_date: queueRes?.plan_date ?? new Date().toISOString().slice(0, 10),
          cached: true,
          scenario_title: queueRes?.scenario_title ?? null,
          scenario_brief: queueRes?.scenario_brief ?? null,
          status: queueRes?.status ?? undefined,
          progress: queueRes?.progress ?? state.plan?.progress ?? {
            new: { total: 0, done: 0 },
            review: { total: 0, done: 0 },
            total: 0,
            done: 0,
            remaining: 0,
            all_done: false,
          },
        }

        const mapModelStage = (
          raw: Record<string, unknown> | undefined,
          fallback: StageConfigState,
        ): StageConfigState => {
          if (!raw) return fallback
          return {
            provider: typeof raw.provider === 'string' && raw.provider ? raw.provider : fallback.provider,
            base_url: typeof raw.base_url === 'string' ? raw.base_url : fallback.base_url,
            ws_url: typeof raw.ws_url === 'string' ? raw.ws_url : fallback.ws_url,
            api_key: '',
            model_name:
              typeof raw.model_name === 'string' && raw.model_name
                ? raw.model_name
                : fallback.model_name,
            voice_id:
              typeof raw.voice_id === 'string' && raw.voice_id ? raw.voice_id : fallback.voice_id,
          }
        }

        const books = wordsRes?.books ?? []

        return {
          cards,
          plan: nextPlan,
          stats: statsRes ?? state.stats,
          words: wordsRes?.words ?? [],
          mistakes: wordsRes?.mistakes ?? [],
          tagCounts: wordsRes?.tag_counts ?? {},
          books,
          activeWordbookName: books[0] ?? '',
          hintTextEn: firstSentenceCard?.sentence_en ?? '',
          hintTextZh: firstSentenceCard?.sentence_zh ?? '',
          userProfileMd:
            typeof memRes?.user_profile === 'string' && memRes.user_profile.trim().length > 0
              ? memRes.user_profile
              : state.userProfileMd,
          errorPatternsMd:
            typeof memRes?.error_patterns === 'string' && memRes.error_patterns.trim().length > 0
              ? memRes.error_patterns
              : state.errorPatternsMd,
          studyPlanQuotas: cfgRes?.study_plan
            ? {
                daily_new_words: cfgRes.study_plan.daily_new_words ?? 30,
                daily_review_limit: cfgRes.study_plan.daily_review_limit ?? 90,
                voice_target_words_count: cfgRes.study_plan.voice_target_words_count ?? 22,
                voice_sliding_window_size: cfgRes.study_plan.voice_sliding_window_size ?? 4,
              }
            : state.studyPlanQuotas,
          modelStages: cfgRes?.models
            ? {
                realtime_voice: mapModelStage(
                  cfgRes.models.realtime_voice,
                  state.modelStages.realtime_voice,
                ),
                text_llm: mapModelStage(cfgRes.models.text_llm, state.modelStages.text_llm),
                tts: mapModelStage(cfgRes.models.tts, state.modelStages.tts),
              }
            : state.modelStages,
        }
      })
    } catch {
      /* Keep clean empty state if backend is unreachable */
    }
  },

  regenerateDailyPlan: async () => {
    const isZh = get().lang === 'zh'
    set({ loading: true, error: null })
    try {
      const planRes = await api.regeneratePlan()
      const [queueRes, statsRes] = await Promise.all([
        api.queue(true).catch(() => null),
        api.stats().catch(() => null),
      ])
      set((state) => ({
        loading: false,
        currentCardIndex: 0,
        cards: queueRes?.cards ?? state.cards,
        stats: statsRes ?? state.stats,
        plan: {
          ...planRes,
          progress: queueRes?.progress ?? planRes.progress,
        },
      }))
      toast.success(isZh ? '今日场景学习计划已生成' : 'Daily Scenario Plan Generated', {
        description:
          planRes.scenario_title ||
          (isZh ? '已完成今日新词与复习词聚类' : 'Today’s new & review words are ready'),
      })
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : isZh
            ? '请先导入词书并检查模型配置'
            : 'Please import a wordbook and verify settings'
      set({ loading: false, error: msg })
      toast.error(isZh ? '生成今日计划失败' : 'Failed to generate daily plan', {
        description: msg,
      })
    }
  },

  submitCardChoice: async (label, durationMs) => {
    const { cards, currentCardIndex, lang } = get()
    const isZh = lang === 'zh'
    const card = cards[currentCardIndex]
    if (!card) return
    set({ selectedOption: label, lastDurationMs: durationMs })

    try {
      const res = await api.reviewCard({
        word_id: card.word_id,
        selected_label: label,
        duration_ms: durationMs,
      })
      set((s) => ({
        lastReviewResult: res,
        plan: s.plan ? { ...s.plan, progress: res.progress } : s.plan,
      }))
      if (res.is_correct) {
        get().navigate('03-fsrs-sprint-reveal')
      } else {
        void api.playSpeech(card.word)
        get().navigate('04-fsrs-sprint-wrong')
      }
    } catch (err) {
      toast.error(isZh ? '提交答题结果失败' : 'Failed to submit answer', {
        description:
          err instanceof Error
            ? err.message
            : isZh
              ? '请检查网络连接'
              : 'Please check your network connection',
      })
    }
  },

  overrideCardRating: async (rating) => {
    const { cards, currentCardIndex, selectedOption, lastDurationMs, lang } = get()
    const isZh = lang === 'zh'
    const card = cards[currentCardIndex]
    if (!card) return
    try {
      const res = await api.reviewCard({
        word_id: card.word_id,
        selected_label: selectedOption,
        duration_ms: lastDurationMs,
        manual_rating: rating,
      })
      set((s) => ({
        lastReviewResult: res,
        plan: s.plan ? { ...s.plan, progress: res.progress } : s.plan,
      }))
    } catch {
      /* ignore */
    }
    const labelsZh: Record<number, string> = { 2: '模糊 (2)', 3: '良好 (3)', 4: '秒杀 (4)' }
    const labelsEn: Record<number, string> = { 2: 'Hard (2)', 3: 'Good (3)', 4: 'Easy (4)' }
    toast.success(
      isZh
        ? `FSRS 评级已更新 → ${labelsZh[rating]}`
        : `FSRS Rating Updated → ${labelsEn[rating]}`,
      {
        description: isZh
          ? `已更新 "${card.word}" 的记忆稳定性曲线`
          : `Updated memory stability for "${card.word}"`,
      },
    )
    get().nextSprintCard()
  },

  nextSprintCard: () => {
    const { cards, currentCardIndex } = get()
    if (cards.length === 0) {
      get().navigate('01-today-studio')
      return
    }
    const nextIdx = (currentCardIndex + 1) % cards.length
    set({
      currentCardIndex: nextIdx,
      selectedOption: null,
      lastReviewResult: null,
      confusableExpanded: false,
    })
    get().navigate('02-fsrs-sprint-question')
  },

  setSelectedTopicTag: (tag) => set({ selectedTopicTag: tag }),

  toggleWordSelection: (id) => {
    const cur = get().selectedWordIds
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    set({ selectedWordIds: next })
  },

  importWordbookFile: async (file) => {
    const isZh = get().lang === 'zh'
    try {
      const res = await api.importWordbook(file)
      toast.success(
        isZh
          ? `已从 ${file.name} 导入 ${res.imported} 个单词`
          : `Imported ${res.imported} words from ${file.name}`,
        {
          description: isZh
            ? `跳过 ${res.skipped} 个重复词 · FSRS 记忆卡片已初始化`
            : `Skipped ${res.skipped} duplicates · FSRS cards initialized`,
        },
      )
      const [wordsRes, statsRes] = await Promise.all([
        api.wordsAndMistakes().catch(() => null),
        api.stats().catch(() => null),
      ])
      set((s) => ({
        activeWordbookName: res.book_name || file.name,
        words: wordsRes?.words ?? s.words,
        tagCounts: wordsRes?.tag_counts ?? s.tagCounts,
        books: wordsRes?.books ?? s.books,
        stats: statsRes ?? s.stats,
      }))
    } catch (err) {
      toast.error(isZh ? '词书导入失败' : 'Wordbook import failed', {
        description:
          err instanceof Error
            ? err.message
            : isZh
              ? '请检查 JSON / CSV 文件格式'
              : 'Please check your JSON / CSV format',
      })
    }
  },

  setVoicePersona: (persona) => {
    const isZh = get().lang === 'zh'
    set({ voicePersona: persona })
    toast.success(isZh ? `音色已切换 → ${persona}` : `Voice switched → ${persona}`)
  },

  toggleMicMute: () => {
    const isZh = get().lang === 'zh'
    const next = !get().isMuted
    set({ isMuted: next })
    toast(
      next
        ? isZh
          ? '麦克风已静音'
          : 'Microphone muted'
        : isZh
          ? '麦克风已开启 (16kHz PCM)'
          : 'Microphone active (16kHz PCM)',
    )
  },

  triggerNewHintAngle: () => {
    const { cards, words } = get()
    const sentenceCards = cards.filter((c) => c.sentence_en)
    if (sentenceCards.length > 0) {
      const current = get().hintTextEn
      const nextCard =
        sentenceCards.find((c) => c.sentence_en !== current) ?? sentenceCards[0]
      set({
        hintStreaming: false,
        hintTextEn: nextCard.sentence_en ?? '',
        hintTextZh: nextCard.sentence_zh ?? '',
      })
      return
    }
    if (words.length > 0) {
      const sample = words.slice(0, 3).map((w) => w.word).join(', ')
      set({
        hintStreaming: false,
        hintTextEn: `Try weaving these target words into your response: ${sample}.`,
        hintTextZh: `尝试在回答中自然串联这些目标词：${sample}。`,
      })
    }
  },

  playHintDemoWithAutoMute: async () => {
    const cleanText = get().hintTextEn.replace(/\*\*/g, '').trim()
    if (!cleanText) return
    const wasMuted = get().isMuted
    set({ playingHintDemo: true, isMuted: true })
    await api.playSpeech(cleanText, 0.96)
    set({ playingHintDemo: false, isMuted: wasMuted })
  },

  completeLiveVoiceSession: async () => {
    const { proactiveWords, hintAssistedWords } = get()
    try {
      await api.completeVoiceSession({
        proactive_words: proactiveWords,
        hint_words: hintAssistedWords,
        mistakes: [],
      })
    } catch {
      /* ignore */
    }
    get().navigate('11-session-wrapped')
  },

  setActiveMemoryDoc: (doc) => set({ activeMemoryDoc: doc }),
  setMemoryViewMode: (mode) => set({ memoryViewMode: mode }),

  updateMemoryContent: (content) => {
    if (get().activeMemoryDoc === 'user_profile') {
      set({ userProfileMd: content })
    } else {
      set({ errorPatternsMd: content })
    }
  },

  insertMarkdownSnippet: (snippet) => {
    const { activeMemoryDoc, userProfileMd, errorPatternsMd, lang } = get()
    const isZh = lang === 'zh'
    const current = activeMemoryDoc === 'user_profile' ? userProfileMd : errorPatternsMd
    const updated = `${current.trimEnd()}\n${snippet}`
    if (activeMemoryDoc === 'user_profile') {
      set({ userProfileMd: updated })
    } else {
      set({ errorPatternsMd: updated })
    }
    toast.success(
      isZh ? `已插入到 ${activeMemoryDoc}.md` : `Inserted into ${activeMemoryDoc}.md`,
    )
  },

  saveActiveMemory: async () => {
    const { activeMemoryDoc, userProfileMd, errorPatternsMd, lang } = get()
    const isZh = lang === 'zh'
    const content = activeMemoryDoc === 'user_profile' ? userProfileMd : errorPatternsMd
    try {
      await api.updateMemory(activeMemoryDoc, content)
      toast.success(
        isZh ? `已保存 ${activeMemoryDoc}.md` : `Saved ${activeMemoryDoc}.md`,
        {
          description: isZh
            ? `${new Blob([content]).size} 字节已写入 /data/memory/`
            : `${new Blob([content]).size} bytes written to /data/memory/`,
        },
      )
    } catch (err) {
      toast.error(
        isZh ? `保存 ${activeMemoryDoc}.md 失败` : `Failed to save ${activeMemoryDoc}.md`,
        {
          description:
            err instanceof Error
              ? err.message
              : isZh
                ? '请检查网络连接'
                : 'Please check your network connection',
        },
      )
    }
  },

  runMemoryCompaction: async () => {
    const isZh = get().lang === 'zh'
    try {
      const res = await api.compactMemory()
      set({
        userProfileMd: res.user_profile || get().userProfileMd,
        errorPatternsMd: res.error_patterns || get().errorPatternsMd,
      })
      toast.success(isZh ? '记忆整理完成' : 'Memory Compaction Complete', {
        description: isZh
          ? '已更新 user_profile.md 与 error_patterns.md'
          : 'Updated user_profile.md & error_patterns.md',
      })
    } catch (err) {
      toast.error(isZh ? '记忆整理失败' : 'Memory compaction failed', {
        description:
          err instanceof Error
            ? err.message
            : isZh
              ? '请检查模型配置'
              : 'Please check model configuration',
      })
    }
  },

  setActiveRouterStage: (stage) => set({ activeRouterStage: stage }),

  adjustQuota: (key, delta, min, max) => {
    const cur = get().studyPlanQuotas[key]
    const next = Math.max(min, Math.min(max, cur + delta))
    set((s) => ({
      studyPlanQuotas: {
        ...s.studyPlanQuotas,
        [key]: next,
      },
    }))
  },

  updateStageField: (stage, key, value) => {
    set((s) => ({
      modelStages: {
        ...s.modelStages,
        [stage]: {
          ...s.modelStages[stage],
          [key]: value,
        },
      },
    }))
  },

  saveAndHotReloadConfig: async () => {
    const { studyPlanQuotas, modelStages, lang } = get()
    const isZh = lang === 'zh'
    try {
      const cleanStage = (st: StageConfigState) => ({
        provider: st.provider,
        base_url: st.base_url,
        ws_url: st.ws_url,
        api_key: st.api_key.includes('•') || st.api_key.includes('*') ? '' : st.api_key,
        model_name: st.model_name,
        voice_id: st.voice_id,
      })
      await api.updateConfig({
        study_plan: studyPlanQuotas,
        realtime_voice: cleanStage(modelStages.realtime_voice),
        text_llm: cleanStage(modelStages.text_llm),
        tts: cleanStage(modelStages.tts),
      })
      toast.success(isZh ? '学习与语音偏好已保存' : 'Study & voice preferences saved')
    } catch (err) {
      toast.error(isZh ? '配置保存失败' : 'Failed to save preferences', {
        description:
          err instanceof Error
            ? err.message
            : isZh
              ? '请检查服务状态'
              : 'Please check server status',
      })
    }
  },
}))
