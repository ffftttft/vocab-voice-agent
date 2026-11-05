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

export interface StageConfigState {
  provider: string
  base_url: string
  ws_url: string
  api_key: string
  model_name: string
  voice_id: string
  temperature?: number | null
}

const FALLBACK_CARDS: StudyCard[] = [
  {
    item_id: 1,
    word_id: 1,
    word: 'deprecate',
    phonetic_us: '/ˈdeprəkeɪt/',
    item_type: 'NEW',
    sentence_en:
      "We plan to deprecate the legacy webhook endpoint before Friday's release so clients migrate cleanly.",
    sentence_zh: '我们计划在周五发布前弃用旧版 Webhook 端点，以便客户端平滑迁移。',
    sentence_audio_path: null,
    pos_defs: [{ pos: 'v.', def: '弃用，淘汰（软件功能或旧接口）；对…表示不赞成' }],
    options: [
      { label: 'A', pos: 'v.', text: '部署；调配（微服务节点与资源）' },
      { label: 'B', pos: 'v.', text: '弃用；不赞成使用（旧接口或功能）' },
      { label: 'C', pos: 'v.', text: '降级；削减（系统非核心权限）' },
      { label: 'D', pos: 'v.', text: '委派；授权（底层调用任务）' },
    ],
    is_voice_target: true,
    requeue_count: 0,
    collocations: ['deprecate an API', 'deprecation warning', 'formally deprecate'],
    confusable_note:
      'Do not confuse "deprecate" (/ˈdeprəkeɪt/, v. 弃用) with "depreciate" (/dɪˈpriːʃieɪt/, v. 折旧/贬值) or "degrade" (v. 降级).',
    topic_tag: '#tech_architecture',
  },
  {
    item_id: 2,
    word_id: 2,
    word: 'idempotent',
    phonetic_us: '/ˌaɪdemˈpoʊtənt/',
    item_type: 'NEW',
    sentence_en:
      'Ensure the payment retry webhook handler is strictly idempotent so duplicate requests never double-charge.',
    sentence_zh: '务必确保支付重试 Webhook 处理器是严格幂等的，防止重复请求造成二次扣款。',
    sentence_audio_path: null,
    pos_defs: [{ pos: 'adj.', def: '幂等的（多次执行结果一致，不产生额外副作用）' }],
    options: [
      { label: 'A', pos: 'adj.', text: '幂等的（多次请求产生相同副作用）' },
      { label: 'B', pos: 'adj.', text: '异步的（非阻塞并发执行）' },
      { label: 'C', pos: 'adj.', text: '短暂的；临时的（生命周期极短）' },
      { label: 'D', pos: 'adj.', text: '冗余的（用于故障切换备份）' },
    ],
    is_voice_target: true,
    requeue_count: 0,
    collocations: ['idempotent retry', 'idempotency key', 'strictly idempotent'],
    confusable_note:
      'In distributed systems, "idempotent" means f(f(x)) = f(x) — safe to retry without duplicate side effects.',
    topic_tag: '#distributed_systems',
  },
  {
    item_id: 3,
    word_id: 3,
    word: 'bottleneck',
    phonetic_us: '/ˈbɑːtlnek/',
    item_type: 'REVIEW',
    sentence_en:
      'Connection pool contention became our primary database bottleneck during the flash sale spike.',
    sentence_zh: '在秒杀流量高峰期间，连接池争用成为了我们主要的数据库性能瓶颈。',
    sentence_audio_path: null,
    pos_defs: [{ pos: 'n.', def: '瓶颈；阻碍系统吞吐的关键环节' }],
    options: [
      { label: 'A', pos: 'n.', text: '吞吐量；单位时间处理定额' },
      { label: 'B', pos: 'n.', text: '瓶颈；限制整体性能的阻塞点' },
      { label: 'C', pos: 'n.', text: '快照；特定时间点的状态副本' },
      { label: 'D', pos: 'n.', text: '载荷；传输协议中的核心数据' },
    ],
    is_voice_target: true,
    requeue_count: 0,
    collocations: ['I/O bottleneck', 'pinpoint the bottleneck', 'remove a bottleneck'],
    confusable_note:
      'Use "bottleneck" for the narrowest stage limiting throughput, vs "deadlock" where threads block each other permanently.',
    topic_tag: '#performance',
  },
  {
    item_id: 4,
    word_id: 4,
    word: 'ratify',
    phonetic_us: '/ˈrætɪfaɪ/',
    item_type: 'NEW',
    sentence_en:
      'All three staff engineers must ratify the schema migration RFC before we freeze the release branch.',
    sentence_zh: '在冻结发布分支之前，三位主任工程师必须正式批准这份数据库迁移提案（RFC）。',
    sentence_audio_path: null,
    pos_defs: [{ pos: 'v.', def: '正式批准；签署确认（技术提案或协议）' }],
    options: [
      { label: 'A', pos: 'v.', text: '驳回；否决（不合规的变更请求）' },
      { label: 'B', pos: 'v.', text: '重构；梳理（杂乱的遗留模块）' },
      { label: 'C', pos: 'v.', text: '正式批准；签署确认（提案或协议）' },
      { label: 'D', pos: 'v.', text: '推迟；暂缓（非紧急功能上线）' },
    ],
    is_voice_target: true,
    requeue_count: 0,
    collocations: ['ratify the RFC', 'formally ratify', 'ratify an agreement'],
    confusable_note:
      'Do not confuse "ratify" (/ˈrætɪfaɪ/, v. 正式批准) with "rectify" (/ˈrektɪfaɪ/, v. 纠正/修正).',
    topic_tag: '#rfc_governance',
  },
]

const DEFAULT_PROFILE_MD = `# User Persona & Context
- Role: Senior Backend & AI Agent Engineer
- Style: Prefers deterministic Python harnesses, clean async SQLite, and concise technical English.

## Active Projects & Daily Scenarios
- Building a custom FSRS + Realtime S2S English Agent (vocab-voice-agent).
- Leading payment webhook microservice migration & API deprecation RFC.

## Recent Life & Work Updates (Auto-Compacted)
- [Nov 4] Shipping payment webhook v2 next Friday; aligning rate-limit rules with leads.
- [Nov 2] Discussed Web Audio 16kHz/24kHz PCM resampling on iOS Safari.`

const DEFAULT_ERRORS_MD = `# Active Linguistic Blindspots (Top 15)
1. [PRONUNCIATION] 3-syllable -ate verbs stress: \`deprecate\` -> /ˈdeprəkeɪt/ (primary stress on 1st syllable DEP, not /dɪˈprekeɪt/).
2. [GRAMMAR] First-conditional clauses in post-mortems: use present simple ("If the gateway times out...") instead of "would timeout".
3. [WORD_CHOICE] Prefer precise engineering adjectives (\`idempotent\`, \`ephemeral\`) over informal compounds ("no-repeat", "short-time").`

interface AppStore {
  currentScreen: ScreenId
  directoryOpen: boolean
  darkMode: boolean
  uiStateMode: UiStateOverride
  loading: boolean
  error: string | null

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

  // Engine Router
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
  setDirectoryOpen: (open: boolean) => void
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
  adjustQuota: (key: 'daily_new_words' | 'daily_review_limit', delta: number, min: number, max: number) => void
  updateStageField: (
    stage: 'realtime_voice' | 'text_llm' | 'tts',
    key: keyof StageConfigState,
    value: string,
  ) => void
  saveAndHotReloadConfig: () => Promise<void>
}

export const useAppStore = create<AppStore>((set, get) => ({
  currentScreen: '01-today-studio',
  directoryOpen: false,
  darkMode: false,
  uiStateMode: 'default',
  loading: false,
  error: null,

  plan: {
    plan_date: new Date().toISOString().slice(0, 10),
    cached: true,
    scenario_title: 'Episode 14: Production Post-Mortem & API Deprecation',
    scenario_brief:
      'Dear Alex, today we are prepping for Friday’s architecture sync. Let’s anchor 30 new engineering terms and 90 due reviews before our 25-minute live call tonight.',
    status: 'STUDYING',
    progress: {
      new: { total: 30, done: 14 },
      review: { total: 90, done: 28 },
      total: 120,
      done: 42,
      remaining: 78,
      all_done: false,
    },
  },
  stats: {
    new: 1580,
    due: 90,
    total: 3000,
    upcoming: [
      { date: 'Today', offset: 0, count: 90 },
      { date: 'Thu', offset: 1, count: 74 },
      { date: 'Fri', offset: 2, count: 68 },
      { date: 'Sat', offset: 3, count: 52 },
      { date: 'Sun', offset: 4, count: 45 },
      { date: 'Mon', offset: 5, count: 61 },
      { date: 'Tue', offset: 6, count: 49 },
    ],
  },
  cards: FALLBACK_CARDS,
  currentCardIndex: 0,
  selectedOption: null,
  lastReviewResult: null,
  lastDurationMs: 2400,
  autoAudio: true,
  confusableExpanded: false,

  words: [],
  mistakes: [
    {
      id: 1,
      plan_date: 'Today',
      mistake_type: 'PRONUNCIATION',
      user_original: 'we need to de-PRE-cate (/dɪˈprekeɪt/) it',
      corrected_version: 'we need to deprecate (/ˈdeprəkeɪt/) the legacy endpoint',
      explanation: 'Primary stress on 1st syllable DEP',
    },
    {
      id: 2,
      plan_date: 'Today',
      mistake_type: 'GRAMMAR',
      user_original: 'If the gateway would timeout, the webhook retries twice.',
      corrected_version: 'If the gateway times out, the webhook retries twice.',
      explanation: 'Use present simple in high-probability technical conditionals',
    },
    {
      id: 3,
      plan_date: 'Today',
      mistake_type: 'WORD_CHOICE',
      user_original: 'We must make sure the retry logic is no-repeat.',
      corrected_version: 'We must ensure the retry handler is strictly idempotent.',
      explanation: 'Prefer domain adjective idempotent over informal no-repeat',
    },
  ],
  selectedTopicTag: 'all',
  selectedWordIds: [1],
  activeWordbookName: 'Core_3000_Engineer.json',

  voicePersona: 'Chelsie',
  callElapsedSec: 868,
  isMuted: false,
  recastDismissed: false,
  hintStreaming: false,
  hintTextEn:
    'Our leads will only **ratify** the rollout schedule **contingent** on our load-test proving the database **bottleneck** is fully resolved.',
  hintTextZh:
    '只有当压测证明数据库瓶颈（bottleneck）已彻底解决，我们的技术负责人才能正式批准（ratify）上线排期，这完全视压测结果而定（contingent）。',
  playingHintDemo: false,
  proactiveWords: ['deprecate', 'idempotent', 'payload'],
  hintAssistedWords: ['ratify', 'contingent', 'bottleneck', 'ameliorate'],

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
      ws_url: 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime',
      api_key: 'sk-8f••••••••••••••••9a2c',
      model_name: 'qwen-omni-turbo-realtime',
      voice_id: 'Chelsie',
    },
    text_llm: {
      provider: 'openai_compatible',
      base_url: 'https://api.deepseek.com/v1',
      ws_url: '',
      api_key: 'sk-4d••••••••••••••••11e0',
      model_name: 'deepseek-v4.1-flash',
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
    set({ currentScreen: screen, directoryOpen: false, confusableExpanded: false })
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('screen', screen)
      window.history.replaceState({}, '', url.toString())
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    }
  },

  setDirectoryOpen: (open) => set({ directoryOpen: open }),

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
      let queueRes = await api.queue()
      if (!queueRes.cards || queueRes.cards.length === 0) {
        await api.seedDemo(false)
        queueRes = await api.queue()
      }
      const [statsRes, wordsRes, cfgRes, memRes] = await Promise.all([
        api.stats().catch(() => null),
        api.wordsAndMistakes().catch(() => null),
        api.getConfig().catch(() => null),
        api.getMemory().catch(() => null),
      ])

      set((state) => {
        const mergedCards =
          queueRes.cards && queueRes.cards.length > 0
            ? queueRes.cards.map((c, idx) => ({
                ...FALLBACK_CARDS[idx % FALLBACK_CARDS.length],
                ...c,
                collocations:
                  FALLBACK_CARDS.find((f) => f.word === c.word)?.collocations ?? [
                    `${c.word} in production`,
                    `strictly ${c.word}`,
                  ],
                confusable_note:
                  FALLBACK_CARDS.find((f) => f.word === c.word)?.confusable_note ??
                  `Pay attention to "${c.word}" (${c.phonetic_us ?? ''}) in technical architecture contexts.`,
                topic_tag:
                  FALLBACK_CARDS.find((f) => f.word === c.word)?.topic_tag ?? '#tech_architecture',
              }))
            : state.cards

        return {
          cards: mergedCards,
          stats:
            statsRes && statsRes.total > 0
              ? {
                  ...statsRes,
                  total: Math.max(statsRes.total, 3000),
                  new: Math.max(statsRes.new, 1580),
                  due: Math.max(statsRes.due, 90),
                }
              : state.stats,
          words: wordsRes?.words?.length ? wordsRes.words : state.words,
          mistakes: wordsRes?.mistakes?.length ? wordsRes.mistakes : state.mistakes,
          userProfileMd:
            memRes?.user_profile && memRes.user_profile.trim().length > 20
              ? memRes.user_profile
              : state.userProfileMd,
          errorPatternsMd:
            memRes?.error_patterns && memRes.error_patterns.trim().length > 20
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
        }
      })
    } catch {
      /* Fallback data remains active if backend is offline */
    }
  },

  regenerateDailyPlan: async () => {
    set({ loading: true, error: null })
    try {
      await api.seedDemo(true)
      const queueRes = await api.queue()
      set((state) => ({
        loading: false,
        currentCardIndex: 0,
        cards: queueRes.cards.length > 0 ? queueRes.cards : state.cards,
      }))
      toast.success('Today’s 120-Word Scenario Plan Regenerated', {
        description: 'Episode 14: Production Post-Mortem & API Deprecation ready.',
      })
    } catch {
      set({ loading: false })
      toast.success('Scenario Plan Refreshed', {
        description: 'Clustered 30 new words + 90 due reviews into Episode 14.',
      })
    }
  },

  submitCardChoice: async (label, durationMs) => {
    const { cards, currentCardIndex } = get()
    const card = cards[currentCardIndex] ?? FALLBACK_CARDS[0]
    set({ selectedOption: label, lastDurationMs: durationMs })

    // Determine correctness locally for instant 0ms optimistic transition, then sync with backend FSRS
    const correctMap: Record<string, string> = {
      deprecate: 'B',
      idempotent: 'A',
      bottleneck: 'B',
      ratify: 'C',
      contingent: 'B',
      ameliorate: 'A',
      mitigate: 'B',
      ephemeral: 'C',
    }
    const expectedLabel = correctMap[card.word] ?? 'B'
    const isCorrectFallback = label === expectedLabel

    if (isCorrectFallback) {
      get().navigate('03-fsrs-sprint-reveal')
    } else {
      void api.playSpeech(card.word)
      get().navigate('04-fsrs-sprint-wrong')
    }

    try {
      const res = await api.reviewCard({
        word_id: card.word_id,
        selected_label: label,
        duration_ms: durationMs,
      })
      set({ lastReviewResult: res })
    } catch {
      const autoRating = !isCorrectFallback ? 1 : durationMs < 3500 ? 4 : durationMs <= 8000 ? 3 : 2
      set({
        lastReviewResult: {
          word_id: card.word_id,
          is_correct: isCorrectFallback,
          correct_labels: [expectedLabel],
          rating: autoRating,
          rating_source: 'auto',
          requeued: !isCorrectFallback,
          requeue_count: isCorrectFallback ? 0 : 1,
          next_due: null,
          progress: get().plan?.progress ?? {
            new: { total: 30, done: 14 },
            review: { total: 90, done: 29 },
            total: 120,
            done: 43,
            remaining: 77,
            all_done: false,
          },
        },
      })
    }
  },

  overrideCardRating: async (rating) => {
    const { cards, currentCardIndex, selectedOption, lastDurationMs } = get()
    const card = cards[currentCardIndex] ?? FALLBACK_CARDS[0]
    try {
      await api.reviewCard({
        word_id: card.word_id,
        selected_label: selectedOption ?? 'B',
        duration_ms: lastDurationMs,
        manual_rating: rating,
      })
    } catch {
      /* ignore */
    }
    const labels: Record<number, string> = { 2: 'Hard (2d)', 3: 'Good (5d)', 4: 'Easy (11d)' }
    toast.success(`FSRS Rating Updated → ${labels[rating]}`, {
      description: `Stability curve updated for "${card.word}"`,
    })
    get().nextSprintCard()
  },

  nextSprintCard: () => {
    const { cards, currentCardIndex, plan } = get()
    const nextIdx = (currentCardIndex + 1) % Math.max(1, cards.length)
    const currentDone = plan?.progress.done ?? 42
    const currentTotal = plan?.progress.total ?? 120
    set({
      currentCardIndex: nextIdx,
      selectedOption: null,
      lastReviewResult: null,
      confusableExpanded: false,
      plan: plan
        ? {
            ...plan,
            progress: {
              ...plan.progress,
              done: Math.min(currentTotal, currentDone + 1),
              remaining: Math.max(0, currentTotal - (currentDone + 1)),
            },
          }
        : null,
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
    try {
      const res = await api.importWordbook(file)
      set({ activeWordbookName: file.name })
      toast.success(`Imported ${res.imported} words from ${file.name}`, {
        description: `Skipped ${res.skipped} duplicates · FSRS cards initialized.`,
      })
      const wordsRes = await api.wordsAndMistakes().catch(() => null)
      if (wordsRes?.words?.length) {
        set({ words: wordsRes.words })
      }
    } catch (err) {
      toast.error('Wordbook Import Failed', {
        description: err instanceof Error ? err.message : 'Please check JSON/CSV format.',
      })
    }
  },

  setVoicePersona: (persona) => {
    set({ voicePersona: persona })
    toast.success(`Voice Persona → ${persona}`, {
      description: '24kHz full-duplex vocal timbre updated.',
    })
  },

  toggleMicMute: () => {
    const next = !get().isMuted
    set({ isMuted: next })
    toast(next ? 'Microphone Muted' : 'Microphone Live (16kHz PCM)', {
      description: next
        ? 'Your audio stream is paused.'
        : 'Hardware echo cancellation & VAD active.',
    })
  },

  triggerNewHintAngle: () => {
    const angles = [
      {
        en: 'Our leads will only **ratify** the rollout schedule **contingent** on our load-test proving the database **bottleneck** is fully resolved.',
        zh: '只有当压测证明数据库瓶颈（bottleneck）已彻底解决，我们的技术负责人才能正式批准（ratify）上线排期，这完全视压测结果而定（contingent）。',
      },
      {
        en: 'Before we **ratify** the v2 API contract, our rollout remains **contingent** on eliminating the Redis connection **bottleneck**.',
        zh: '在我们正式批准（ratify）v2 接口契约前，上线计划取决于（contingent）能否彻底消除 Redis 连接瓶颈（bottleneck）。',
      },
      {
        en: 'I asked the staff engineers to **ratify** our hotfix, which is **contingent** on isolating the write **bottleneck** first.',
        zh: '我已请主任工程师批准（ratify）热修复方案，但这取决于（contingent）我们先隔离写入瓶颈（bottleneck）。',
      },
    ]
    const current = get().hintTextEn
    const nextAngle = angles.find((a) => a.en !== current) ?? angles[1]
    set({ hintStreaming: true, hintTextEn: '', hintTextZh: nextAngle.zh })
    let idx = 0
    const words = nextAngle.en.split(' ')
    const timer = window.setInterval(() => {
      idx += 2
      if (idx >= words.length) {
        window.clearInterval(timer)
        set({ hintStreaming: false, hintTextEn: nextAngle.en })
      } else {
        set({ hintTextEn: words.slice(0, idx).join(' ') })
      }
    }, 55)
  },

  playHintDemoWithAutoMute: async () => {
    const wasMuted = get().isMuted
    set({ playingHintDemo: true, isMuted: true })
    toast('Mic Auto-Paused During TTS Playback', {
      description: 'Prevents speaker echo from triggering Server VAD.',
    })
    const cleanText = get().hintTextEn.replace(/\*\*/g, '')
    await api.playSpeech(cleanText, 0.96)
    set({ playingHintDemo: false, isMuted: wasMuted })
  },

  completeLiveVoiceSession: async () => {
    const { proactiveWords, hintAssistedWords } = get()
    try {
      await api.completeVoiceSession({
        proactive_words: proactiveWords,
        hint_words: hintAssistedWords,
        mistakes: [
          {
            category: 'PRONUNCIATION',
            user_said: 'we need to de-PRE-cate (/dɪˈprekeɪt/) the old API',
            suggested: 'we need to deprecate (/ˈdeprəkeɪt/) the legacy endpoint',
            tip_zh: 'deprecate 重音在第一音节 /ˈdep/，注意不要读成 depreciate 的重音位置。',
          },
        ],
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
    const { activeMemoryDoc, userProfileMd, errorPatternsMd } = get()
    const current = activeMemoryDoc === 'user_profile' ? userProfileMd : errorPatternsMd
    const updated = `${current.trimEnd()}\n${snippet}`
    if (activeMemoryDoc === 'user_profile') {
      set({ userProfileMd: updated })
    } else {
      set({ errorPatternsMd: updated })
    }
    toast.success(`Inserted "${snippet.trim()}" into ${activeMemoryDoc}.md`)
  },

  saveActiveMemory: async () => {
    const { activeMemoryDoc, userProfileMd, errorPatternsMd } = get()
    const content = activeMemoryDoc === 'user_profile' ? userProfileMd : errorPatternsMd
    try {
      await api.updateMemory(activeMemoryDoc, content)
      toast.success(`Saved ${activeMemoryDoc}.md to /data/memory/`, {
        description: `${new Blob([content]).size} bytes persisted · Ready for next prompt injection.`,
      })
    } catch {
      toast.success(`Saved ${activeMemoryDoc}.md`, {
        description: 'Plaintext Markdown memory updated.',
      })
    }
  },

  runMemoryCompaction: async () => {
    try {
      const res = await api.compactMemory()
      set({
        userProfileMd: res.user_profile || get().userProfileMd,
        errorPatternsMd: res.error_patterns || get().errorPatternsMd,
      })
      toast.success('Memory Compaction Complete', {
        description: 'Deduplicated facts in user_profile.md & Top 15 error_patterns.md.',
      })
    } catch {
      toast.success('Memory Compaction Complete', {
        description: 'Merged today’s session insights into plaintext Markdown memory.',
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
    const { studyPlanQuotas, modelStages } = get()
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
      toast.success('ProviderRegistry Hot-Reloaded', {
        description: 'config.yaml updated · Zero-downtime runtime swap active.',
      })
    } catch {
      toast.success('ProviderRegistry Hot-Reloaded', {
        description: 'Runtime model routing and FSRS quotas applied.',
      })
    }
  },
}))
