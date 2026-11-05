import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { api } from '../lib/api'
import { AnimatedNumber, LangTogglePill } from '../components/ShellComponents'
import { useAppStore } from '../store/useAppStore'

export default function LexiconPlanetPage() {
  const currentScreen = useAppStore((s) => s.currentScreen)
  const navigate = useAppStore((s) => s.navigate)
  const lang = useAppStore((s) => s.lang)
  const stats = useAppStore((s) => s.stats)
  const plan = useAppStore((s) => s.plan)
  const words = useAppStore((s) => s.words)
  const tagCounts = useAppStore((s) => s.tagCounts)
  const books = useAppStore((s) => s.books)
  const selectedTopicTag = useAppStore((s) => s.selectedTopicTag)
  const setSelectedTopicTag = useAppStore((s) => s.setSelectedTopicTag)
  const selectedWordIds = useAppStore((s) => s.selectedWordIds)
  const toggleWordSelection = useAppStore((s) => s.toggleWordSelection)
  const activeWordbookName = useAppStore((s) => s.activeWordbookName)
  const importWordbookFile = useAppStore((s) => s.importWordbookFile)
  const regenerateDailyPlan = useAppStore((s) => s.regenerateDailyPlan)
  const uiStateMode = useAppStore((s) => s.uiStateMode)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedDayIdx, setSelectedDayIdx] = useState(0)

  const isZh = lang === 'zh'
  const totalWords = stats?.total ?? words.length
  const currentBookLabel = activeWordbookName || books[0] || ''

  // ============================================================================
  // SCREEN 06: WORDBOOKS & AI TAGGING
  // ============================================================================
  if (currentScreen === '06-wordbooks-tagging') {
    const mappedCards = words.map((w) => {
      const firstDef =
        w.pos_defs?.[0]?.pos || w.pos_defs?.[0]?.def
          ? `${w.pos_defs[0].pos ?? ''} ${w.pos_defs[0].def ?? ''}`.trim()
          : isZh
            ? '点击听取发音'
            : 'Tap to listen'
      const primaryTag = w.topic_tags?.[0] ?? 'general'
      const statusType =
        w.state === 2
          ? ('review' as const)
          : w.state === 1 || w.state === 3
            ? ('plan' as const)
            : ('new' as const)
      const statusLabel =
        w.state === 2
          ? isZh
            ? `复习 · 稳定度 ${w.stability ?? 1}d`
            : `Review · S: ${w.stability ?? 1}d`
          : w.state === 1
            ? isZh
              ? '学习中'
              : 'Learning'
            : w.state === 3
              ? isZh
                ? '重学中'
                : 'Relearning'
              : isZh
                ? '新词卡片'
                : 'New Card'

      return {
        id: w.id,
        word: w.word,
        phonetic: w.phonetic_us || '/—/',
        def: firstDef,
        tag: primaryTag.startsWith('#') ? primaryTag : `#${primaryTag}`,
        tags: w.topic_tags ?? [],
        statusType,
        statusLabel,
      }
    })

    const filteredCards =
      selectedTopicTag === 'all'
        ? mappedCards
        : mappedCards.filter((c) => c.tags.includes(selectedTopicTag))

    const topicTabs = [
      { id: 'all', label: isZh ? `全部 (${totalWords})` : `All (${totalWords})`, count: '' },
      {
        id: 'tech_dev',
        label: isZh ? '技术研发' : 'tech_dev',
        count: `(${tagCounts.tech_dev ?? 0})`,
      },
      {
        id: 'workplace_comm',
        label: isZh ? '职场沟通' : 'workplace_comm',
        count: `(${tagCounts.workplace_comm ?? 0})`,
      },
      {
        id: 'problem_solving',
        label: isZh ? '问题排查' : 'problem_solving',
        count: `(${tagCounts.problem_solving ?? 0})`,
      },
      {
        id: 'daily_life',
        label: isZh ? '日常表达' : 'daily_life',
        count: `(${tagCounts.daily_life ?? 0})`,
      },
    ]

    return (
      <div className="min-h-dvh bg-[#F9F6F0] text-[#1C202B] flex flex-col justify-between relative">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) {
              void importWordbookFile(file)
            }
          }}
        />

        {/* Top Fixed Structure: Top Navigation */}
        <div className="sticky top-0 z-40 bg-[#F9F6F0]/95 backdrop-blur-md pb-1 pt-2">
          <div className="flex items-center justify-between px-5 mt-1 mb-2">
            {/* Circular Back Button */}
            <button
              type="button"
              aria-label={isZh ? '返回词书星球' : 'Go Back'}
              onClick={() => navigate('05-lexicon-planet')}
              className="w-10 h-10 rounded-full bg-white border border-[#EBE4D8] shadow-[0_2px_8px_rgba(45,38,30,0.06)] flex items-center justify-center text-[#1C202B] press-scale"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">
                arrow_back_ios_new
              </span>
            </button>

            {/* Center Title */}
            <h1 className="font-headline italic text-xl font-medium tracking-tight text-[#1C202B]">
              {isZh ? '词书导入与分类' : 'Wordbooks & AI Tagging'}
            </h1>

            {/* Right: Lang Toggle + Word Count Badge */}
            <div className="flex items-center gap-1.5">
              <LangTogglePill />
              <div className="flex items-center gap-1 bg-[#FFF4D6] border border-[#F4B844]/40 px-2.5 py-1 rounded-full shadow-[0_0_12px_rgba(244,184,68,0.22)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F4B844] animate-pulse" />
                <span className="text-[11px] font-label font-semibold text-[#946300] tracking-tight">
                  <AnimatedNumber value={totalWords} /> {isZh ? '词' : 'Words'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content Canvas */}
        <div className="flex-1 px-4 space-y-4 pb-28">
          {/* Scenario Clustering Hero Card (Warm Champagne Sand) */}
          <section className="bg-[#EFE6D5] border border-[#E5DAC8] rounded-3xl p-5 shadow-[0_4px_20px_rgba(45,38,30,0.04)]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="relative w-11 h-11 rounded-2xl overflow-hidden shadow-inner bg-[#F9F6F0] border-2 border-white flex-shrink-0 flex items-center justify-center">
                  <img
                    alt="Pip avatar"
                    className="w-full h-full object-cover scale-110"
                    src="/assets/pip-avatar.png"
                  />
                </div>
                <div>
                  <span className="block text-[10px] font-mono tracking-wider font-semibold text-[#8C857B] uppercase">
                    {isZh ? 'FSRS · 语境智能聚类' : 'FSRS • SEMANTIC ENGINE'}
                  </span>
                  <h2 className="text-[16px] font-headline font-semibold text-[#1C202B] leading-snug">
                    {isZh ? '告别按字母表死记硬背' : 'Non-Sequential Scenario Clustering'}
                  </h2>
                </div>
              </div>
            </div>

            <p className="font-body text-[12.5px] leading-relaxed text-[#5A554C] mb-4">
              {isZh
                ? '上传任意 JSON 或 CSV 词书，系统自动初始化 FSRS 记忆卡片并按真实语境主题完成归类。'
                : 'Upload any JSON or CSV wordbook to initialize FSRS memory cards and automatically cluster words by scenario.'}
            </p>

            {/* Inner Dashed Ivory Dropzone */}
            <div className="bg-[#FFFDF9] border border-dashed border-[#D6CAB4] rounded-2xl p-3.5 text-center transition-colors">
              <div className="w-8 h-8 mx-auto mb-1.5 rounded-full bg-[#F3EBDD] flex items-center justify-center text-[#1C202B]">
                <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
              </div>
              <h3 className="text-xs font-body font-semibold text-[#1C202B]">
                {isZh ? '上传 JSON / CSV 词书文件' : 'Upload JSON / CSV Wordbook'}
              </h3>
              <p className="text-[11px] font-mono text-[#8C857B] mt-0.5">
                {isZh
                  ? '支持字段：word, phonetic_us, pos_defs'
                  : 'Fields: word, phonetic_us, pos_defs'}
              </p>

              {/* Active File Indicator */}
              <div className="my-3 py-1.5 px-2.5 rounded-xl bg-[#F4EFE3] flex items-center justify-center gap-1.5 text-[11px] font-mono text-[#5A554C] border border-[#E9DFCE]">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    currentBookLabel ? 'bg-[#58B37C]' : 'bg-[#8C857B]'
                  }`}
                />
                <span className="truncate max-w-[240px]">
                  {currentBookLabel ? (
                    isZh ? (
                      <>
                        当前词书：<strong className="font-medium text-[#1C202B]">{currentBookLabel}</strong>（{totalWords} 词）
                      </>
                    ) : (
                      <>
                        Active: <strong className="font-medium text-[#1C202B]">{currentBookLabel}</strong> ({totalWords} words)
                      </>
                    )
                  ) : isZh ? (
                    '尚未导入词书 · 点击下方按钮选择文件'
                  ) : (
                    'No wordbook imported yet · Tap below to choose a file'
                  )}
                </span>
              </div>

              {/* Browse Pill Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-[#1C202B] text-white text-xs font-body font-medium px-4 py-2.5 min-h-[44px] rounded-full inline-flex items-center gap-1.5 shadow-sm press-scale"
              >
                <span className="material-symbols-outlined text-[15px]">folder_open</span>
                <span>
                  {isZh ? '选择本地词书 (.json / .csv)' : 'Browse File (.json / .csv)'}
                </span>
              </button>
            </div>
          </section>

          {/* Scenario Topic Filter Tabs */}
          <nav
            aria-label={isZh ? '语境分类标签' : 'Scenario Topics'}
            className="relative -mx-4 px-4 overflow-x-auto no-scrollbar flex items-center gap-2 pt-1 pb-1"
          >
            {topicTabs.map((tab) => {
              const active = selectedTopicTag === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedTopicTag(tab.id)}
                  className={`relative flex-shrink-0 px-3.5 py-2 min-h-[40px] rounded-full text-xs press-scale ${
                    active
                      ? 'bg-white border border-[#EBE4D8] text-[#1C202B] font-body font-semibold shadow-sm'
                      : 'bg-white/70 border border-[#E8E1D3] text-[#5A554C] font-mono font-medium'
                  }`}
                >
                  <span>{tab.label}</span>{' '}
                  {tab.count && (
                    <span className="text-[#8C857B] font-body text-[11px]">{tab.count}</span>
                  )}
                  {active && (
                    <motion.span
                      layoutId="topic-underline"
                      className="absolute bottom-1 left-3.5 right-3.5 h-[2px] bg-[#FF6B4A] rounded-full"
                    />
                  )}
                </button>
              )
            })}
          </nav>

          {/* Section Title & Grid Metrics */}
          <div className="flex items-center justify-between px-1 pt-1">
            <span className="text-xs font-body font-semibold text-[#5A554C]">
              {isZh ? '已归类词汇卡片' : 'Clustered Vocabulary Cards'}
            </span>
            <span className="text-[11px] font-mono text-[#8C857B]">
              {isZh
                ? `显示 ${filteredCards.length} / 共 ${totalWords} 词`
                : `${filteredCards.length} / ${totalWords} shown`}
            </span>
          </div>

          {/* 2-Column Tactile Word Grid */}
          {uiStateMode === 'empty' || filteredCards.length === 0 ? (
            <div className="bg-white rounded-[24px] p-6 border border-[#EBE4D8] text-center space-y-2">
              <p className="font-headline italic text-lg text-[#1C202B]">
                {totalWords === 0
                  ? isZh
                    ? '尚未导入词书'
                    : 'No Wordbook Imported Yet'
                  : isZh
                    ? '该分类下暂无词汇'
                    : 'No words in this category'}
              </p>
              <p className="text-xs text-[#8C857B]">
                {totalWords === 0
                  ? isZh
                    ? '点击上方按钮上传 JSON 或 CSV 词表文件，即可在此查看卡片。'
                    : 'Tap Browse File above to upload a JSON or CSV vocabulary deck.'
                  : isZh
                    ? '请切换其他主题标签或上传更多词汇。'
                    : 'Switch topic tabs or upload additional words.'}
              </p>
            </div>
          ) : (
            <section className="grid grid-cols-2 gap-3">
              {filteredCards.map((card, i) => {
                const isSelected = selectedWordIds.includes(card.id)
                return (
                  <motion.article
                    key={card.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: Math.min(i * 0.02, 0.2) }}
                    onClick={() => {
                      toggleWordSelection(card.id)
                      void api.playSpeech(card.word)
                    }}
                    className={`relative bg-white rounded-[24px] p-3.5 flex flex-col justify-between h-[154px] press-scale cursor-pointer ${
                      isSelected
                        ? 'border-2 border-[#FF6B4A] shadow-[0_8px_20px_rgba(255,107,74,0.12)]'
                        : 'border border-[#EBE4D8] shadow-[0_6px_16px_rgba(45,38,30,0.03)]'
                    }`}
                  >
                    {/* Top Row: Tag & Checkmark Badge */}
                    <div className="flex items-start justify-between">
                      <span
                        className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-medium truncate max-w-[100px] ${
                          isSelected
                            ? 'bg-[#FFF0EC] text-[#FF6B4A] border border-[#FF6B4A]/20'
                            : 'bg-[#F5F2EB] text-[#5A554C]'
                        }`}
                      >
                        {card.tag}
                      </span>
                      {isSelected ? (
                        <div className="w-5 h-5 rounded-full bg-[#FF6B4A] text-white flex items-center justify-center shadow-sm">
                          <span className="material-symbols-outlined text-[13px] font-bold">
                            check
                          </span>
                        </div>
                      ) : (
                        <span className="material-symbols-outlined text-[#8C857B]/40 text-[18px]">
                          bookmark_border
                        </span>
                      )}
                    </div>

                    {/* Middle Content: Headword & Definition */}
                    <div className="my-auto">
                      <h3 className="font-headline italic text-[19px] font-semibold text-[#1C202B] leading-tight tracking-tight truncate">
                        {card.word}
                      </h3>
                      <span className="block font-mono text-[10.5px] text-[#8C857B] mt-0.5 truncate">
                        {card.phonetic}
                      </span>
                      <p className="font-body text-[11.5px] font-medium text-[#5A554C] mt-1 line-clamp-1">
                        {card.def}
                      </p>
                    </div>

                    {/* Bottom: Status Pill */}
                    <div>
                      {card.statusType === 'plan' && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EBF2FC] text-[#2B579A] text-[10px] font-body font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#6A9AE2]" />
                          <span>{card.statusLabel}</span>
                        </div>
                      )}
                      {card.statusType === 'review' && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFF4D6] text-[#946300] text-[10px] font-mono font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#F4B844]" />
                          <span>{card.statusLabel}</span>
                        </div>
                      )}
                      {card.statusType === 'new' && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F0EDFF] text-[#533FD1] text-[10px] font-mono font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#9B8AFB]" />
                          <span>{card.statusLabel}</span>
                        </div>
                      )}
                    </div>
                  </motion.article>
                )
              })}
            </section>
          )}
        </div>

        {/* Bottom Floating Action Area */}
        <footer className="sticky bottom-0 z-40 bg-gradient-to-t from-[#F9F6F0] via-[#F9F6F0]/95 to-transparent pt-3 pb-2 px-4 backdrop-blur-[2px]">
          <button
            type="button"
            onClick={async () => {
              await regenerateDailyPlan()
              navigate('01-today-studio')
            }}
            className="w-full bg-[#1C202B] text-white py-3.5 px-5 min-h-[50px] rounded-full shadow-[0_8px_24px_rgba(28,32,43,0.25)] flex items-center justify-center gap-2 press-scale"
          >
            <span className="material-symbols-outlined text-[18px] text-[#F4B844]">
              auto_fix_high
            </span>
            <span className="font-body font-semibold text-[13.5px] tracking-tight">
              {isZh ? '生成今日场景学习计划 →' : "Regenerate Today's Scenario Plan →"}
            </span>
          </button>
        </footer>
      </div>
    )
  }

  // ============================================================================
  // SCREEN 05: LEXICON PLANET (3D ISLAND & FSRS ECOSYSTEM)
  // ============================================================================
  const rawUpcoming =
    stats?.upcoming && stats.upcoming.length === 7
      ? stats.upcoming
      : Array.from({ length: 7 }, (_, idx) => {
          const dt = new Date()
          dt.setDate(dt.getDate() + idx)
          return { date: dt.toISOString().slice(0, 10), offset: idx, count: 0 }
        })

  const maxBarCount = Math.max(1, ...rawUpcoming.map((u) => u.count))
  const dayShortZh = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const upcomingBars = rawUpcoming.map((u, idx) => {
    const dt = new Date(`${u.date}T00:00:00`)
    const dayLabel =
      idx === 0
        ? isZh
          ? '今日'
          : 'Today'
        : Number.isNaN(dt.getTime())
          ? `+${idx}d`
          : isZh
            ? dayShortZh[dt.getDay()]
            : dt.toLocaleDateString('en-US', { weekday: 'short' })
    const height = u.count === 0 ? 8 : Math.max(14, Math.round((u.count / maxBarCount) * 68))
    return {
      day: dayLabel,
      date: u.date,
      count: u.count,
      height,
      isToday: idx === 0,
    }
  })

  const totalUpcomingDue = upcomingBars.reduce((acc, b) => acc + b.count, 0)
  const levelNum = Math.max(1, Math.floor(totalWords / 200) + 1)
  const levelProgressPct =
    totalWords === 0 ? 0 : Math.min(100, Math.round(((totalWords % 200) / 200) * 100))
  const planDone = plan?.progress.done ?? 0
  const planTotal = plan?.progress.total ?? 0
  const planPct = planTotal > 0 ? Math.round((planDone / planTotal) * 100) : 0

  return (
    <div className="min-h-dvh bg-[#F9F6F0] text-[#1C202B] relative flex flex-col overflow-x-hidden pb-28">
      {/* Top Hero Gradient Canvas (Lavender-Peach Dawn to Alabaster) */}
      <div className="absolute top-0 left-0 right-0 h-[360px] bg-gradient-to-b from-[#DBD6F5] via-[#F5E2D4] to-[#F9F6F0] pointer-events-none z-0" />

      {/* Main Scrollable Content Area */}
      <div className="relative z-10 flex-1 pt-2">
        {/* 2. Hero Sky & Floating Level Bar */}
        <section className="px-4 pt-1 pb-2">
          <div className="backdrop-blur-md bg-white/75 border border-white/70 shadow-sm rounded-full px-4 py-2.5 flex items-center justify-between gap-2">
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-headline italic font-medium text-[17px] text-[#1C202B] leading-tight truncate">
                  {isZh ? 'Pip 的词书星球' : "Pip's Lexicon Planet"}
                </span>
                <span className="inline-block w-2 h-2 rounded-full bg-[#58B37C] animate-pulse shrink-0" />
              </div>
              <div className="w-24 bg-[#1C202B]/10 rounded-full h-[4px] mt-1.5 overflow-hidden">
                <div
                  className="bg-[#F4B844] h-full rounded-full"
                  style={{ width: `${levelProgressPct}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <LangTogglePill />
              <div className="text-right">
                <span className="font-mono text-[11px] font-semibold text-[#1C202B] block tracking-tight">
                  Lv {levelNum}
                </span>
                <span className="font-mono text-[9.5px] text-[#5A554C] block leading-none">
                  <AnimatedNumber value={totalWords} /> {isZh ? '词' : 'words'}
                </span>
              </div>
              <button
                type="button"
                aria-label={isZh ? '导入或管理词书' : 'Import Wordbook'}
                onClick={() => navigate('06-wordbooks-tagging')}
                className="w-10 h-10 rounded-full bg-[#1C202B] text-white flex items-center justify-center shadow-sm press-scale"
              >
                <span className="material-symbols-outlined text-[18px]">auto_stories</span>
              </button>
            </div>
          </div>

          {/* 3D Miniature Floating Island with Overlay Badges */}
          <div className="relative mt-3 flex items-center justify-center">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-[272px] h-[272px] flex items-center justify-center"
            >
              <div className="absolute inset-0 rounded-[32px] bg-gradient-to-tr from-amber-100/30 to-rose-100/20 blur-xl scale-95 pointer-events-none" />
              <img
                alt="Pip's 3D clay miniature floating cottage island with garden and sunflowers"
                className="relative z-10 w-full h-full object-contain filter drop-shadow-[0_18px_24px_rgba(70,45,20,0.18)]"
                src="/assets/lexicon-island.png"
              />
            </motion.div>

            {/* Frosted Floating Callout Pill Top-Left: Fountain */}
            <button
              type="button"
              onClick={() =>
                toast.success(
                  isZh
                    ? `复习池 · 共 ${stats?.review ?? 0} 张成熟卡片`
                    : `FSRS Review Pool · ${stats?.review ?? 0} mature cards`,
                )
              }
              className="absolute top-4 left-1 z-20 backdrop-blur-md bg-white/85 border border-white shadow-[0_6px_16px_rgba(0,0,0,0.06)] rounded-full px-3 py-1.5 flex items-center gap-1.5 press-scale"
            >
              <span className="text-xs">⛲</span>
              <span className="text-[11px] font-semibold text-[#1C202B] font-body tracking-tight">
                {isZh ? '复习期' : 'Review'} ·{' '}
                <span className="font-mono text-[#2B579A]">{stats?.review ?? 0}</span>
              </span>
            </button>

            {/* Frosted Floating Callout Pill Bottom-Right: Sunflowers */}
            <button
              type="button"
              onClick={() => navigate('12-memory-journal')}
              className="absolute bottom-2 right-1 z-20 backdrop-blur-md bg-white/85 border border-white shadow-[0_6px_16px_rgba(0,0,0,0.06)] rounded-full px-3 py-1.5 flex items-center gap-1.5 press-scale"
            >
              <span className="text-xs">🌻</span>
              <span className="text-[11px] font-semibold text-[#1C202B] font-body tracking-tight">
                {isZh ? '今日待复习' : 'Due Today'} ·{' '}
                <span className="font-mono text-[#946300]">{stats?.due ?? 0}</span>
              </span>
            </button>
          </div>
        </section>

        {/* 3. Section: Grown from your talks (Scenario Word Clusters) */}
        <section className="mt-4 px-4">
          <div className="flex items-baseline justify-between mb-2.5">
            <div>
              <h2 className="font-headline italic text-[19px] font-medium text-[#1C202B] leading-snug">
                {isZh ? '语境主题词群' : 'Grown from your talks'}
              </h2>
              <p className="text-[11.5px] text-[#8C857B] font-body">
                {isZh
                  ? '每个语境词群都承载着可在真实对话中开口调用的词汇'
                  : 'Every scenario cluster holds active vocabulary memories'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('06-wordbooks-tagging')}
              className="text-xs font-semibold text-[#1C202B] flex items-center gap-0.5 py-1 px-2 rounded-lg press-scale"
            >
              <span>{isZh ? '导入词书' : 'Import Book'}</span>
              <span className="material-symbols-outlined text-[14px]">add</span>
            </button>
          </div>

          <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-4 px-4 py-1">
            {[
              {
                emoji: '🏡',
                emojiBg: 'bg-[#E6F5EC]',
                badge: isZh ? '主题' : 'Cluster',
                badgeClass: 'text-[#236B42] bg-[#E6F5EC]',
                title: isZh ? '技术与研发' : 'Tech & Dev',
                count: isZh ? `${tagCounts.tech_dev ?? 0} 词` : `${tagCounts.tech_dev ?? 0} words`,
                tag: 'tech_dev',
              },
              {
                emoji: '🌻',
                emojiBg: 'bg-[#FFF4D6]',
                badge: isZh ? '主题' : 'Cluster',
                badgeClass: 'text-[#946300] bg-[#FFF4D6]',
                title: isZh ? '职场沟通' : 'Workplace',
                count: isZh
                  ? `${tagCounts.workplace_comm ?? 0} 词`
                  : `${tagCounts.workplace_comm ?? 0} words`,
                tag: 'workplace_comm',
              },
              {
                emoji: '☕',
                emojiBg: 'bg-[#EBF2FC]',
                badge: isZh ? '主题' : 'Cluster',
                badgeClass: 'text-[#2B579A] bg-[#EBF2FC]',
                title: isZh ? '日常表达' : 'Daily Life',
                count: isZh
                  ? `${tagCounts.daily_life ?? 0} 词`
                  : `${tagCounts.daily_life ?? 0} words`,
                tag: 'daily_life',
              },
              {
                emoji: '🎙️',
                emojiBg: 'bg-[#F0EDFF]',
                badge: isZh ? '主题' : 'Cluster',
                badgeClass: 'text-[#533FD1] bg-[#F0EDFF]',
                title: isZh ? '问题排查' : 'Problem Solving',
                count: isZh
                  ? `${tagCounts.problem_solving ?? 0} 词`
                  : `${tagCounts.problem_solving ?? 0} words`,
                tag: 'problem_solving',
              },
            ].map((cluster) => (
              <button
                key={cluster.tag}
                type="button"
                onClick={() => {
                  setSelectedTopicTag(cluster.tag)
                  navigate('06-wordbooks-tagging')
                }}
                className="rounded-[22px] p-3.5 min-w-[128px] max-w-[134px] flex flex-col justify-between shrink-0 text-left press-scale bg-white shadow-[0_4px_16px_rgba(45,38,30,0.04)] border border-[#EBE4D8]"
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`w-8 h-8 rounded-full ${cluster.emojiBg} flex items-center justify-center text-sm shadow-xs`}
                  >
                    {cluster.emoji}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full ${cluster.badgeClass}`}
                  >
                    {cluster.badge}
                  </span>
                </div>
                <div className="mt-2.5">
                  <h3 className="font-bold text-[12.5px] leading-tight tracking-tight text-[#1C202B]">
                    {cluster.title}
                  </h3>
                  <p className="font-mono text-[10px] text-[#5A554C] mt-0.5">{cluster.count}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* 4. FSRS 4-State Ecosystem & 7-Day Due Forecast Card */}
        <section className="mt-4 px-4">
          <div className="bg-white rounded-[26px] p-4 shadow-[0_8px_24px_rgba(45,38,30,0.04)] border border-[#EBE4D8]">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-headline italic text-[17px] font-medium text-[#1C202B]">
                {isZh ? 'FSRS 记忆生态分布' : 'FSRS Memory Ecosystem'}
              </h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold font-mono bg-[#E6F5EC] text-[#236B42] px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-[#58B37C]" />
                {isZh ? `共 ${totalWords} 词` : `Total ${totalWords}`}
              </span>
            </div>
            <p className="text-[11px] text-[#8C857B] font-body mb-3">
              {isZh
                ? '基于 FSRS 间隔重复算法追踪四态记忆留存率'
                : 'Free Spaced Repetition Scheduler parameter weights active'}
            </p>

            {/* 4 State Chips Grid */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <button
                type="button"
                onClick={() => navigate('06-wordbooks-tagging')}
                className="bg-[#F0EDFF] rounded-[16px] py-2 px-1 border border-[#9B8AFB]/20 press-scale"
              >
                <span className="block text-[10px] uppercase font-semibold text-[#533FD1] tracking-wider">
                  {isZh ? '新词' : 'New'}
                </span>
                <span className="font-mono text-[13px] font-bold text-[#533FD1]">
                  <AnimatedNumber value={stats?.new ?? 0} />
                </span>
              </button>
              <button
                type="button"
                onClick={() => navigate('02-fsrs-sprint-question')}
                className="bg-[#FFF4D6] rounded-[16px] py-2 px-1 border border-[#F4B844]/20 press-scale"
              >
                <span className="block text-[10px] uppercase font-semibold text-[#946300] tracking-wider">
                  {isZh ? '学习中' : 'Learn'}
                </span>
                <span className="font-mono text-[13px] font-bold text-[#946300]">
                  <AnimatedNumber value={stats?.learning ?? 0} />
                </span>
              </button>
              <button
                type="button"
                onClick={() => navigate('02-fsrs-sprint-question')}
                className="bg-[#E6F5EC] rounded-[16px] py-2 px-1 border border-[#58B37C]/20 press-scale"
              >
                <span className="block text-[10px] uppercase font-semibold text-[#236B42] tracking-wider">
                  {isZh ? '复习' : 'Review'}
                </span>
                <span className="font-mono text-[13px] font-bold text-[#236B42]">
                  <AnimatedNumber value={stats?.review ?? 0} />
                </span>
              </button>
              <button
                type="button"
                onClick={() => navigate('02-fsrs-sprint-question')}
                className="bg-[#FCECE8] rounded-[16px] py-2 px-1 border border-[#E5735D]/20 press-scale"
              >
                <span className="block text-[10px] uppercase font-semibold text-[#A83825] tracking-wider">
                  {isZh ? '重学' : 'Relearn'}
                </span>
                <span className="font-mono text-[13px] font-bold text-[#A83825]">
                  <AnimatedNumber value={stats?.relearning ?? 0} />
                </span>
              </button>
            </div>

            <div className="mt-4 pt-3 border-t border-[#F2ECE1] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#1C202B] font-body">
                {isZh ? '未来 7 日复习压力预测' : '7-Day FSRS Review Pressure'}
              </span>
              <span className="font-mono text-[11px] text-[#5A554C]">
                {isZh ? `合计: ${totalUpcomingDue} 词` : `Total: ${totalUpcomingDue} words`}
              </span>
            </div>

            {/* 7-Day Due Pressure Bar Chart */}
            <div className="mt-3 grid grid-cols-7 gap-1.5 items-end h-[96px] pt-4 px-1">
              {upcomingBars.map((bar, idx) => {
                const isSelected = selectedDayIdx === idx
                return (
                  <button
                    key={bar.date + idx}
                    type="button"
                    onClick={() => {
                      setSelectedDayIdx(idx)
                      toast(
                        isZh
                          ? `${bar.date}：预计 ${bar.count} 个单词待复习`
                          : `${bar.date}: ${bar.count} FSRS reviews scheduled`,
                      )
                    }}
                    className="flex flex-col items-center gap-1.5 h-full justify-end cursor-pointer focus:outline-none"
                  >
                    <span
                      className={`font-mono text-[10px] leading-tight ${
                        bar.isToday || isSelected
                          ? 'font-bold text-[#1C202B] bg-amber-100 px-1 rounded-sm'
                          : 'text-[#5A554C]'
                      }`}
                    >
                      {bar.count}
                    </span>
                    <div
                      style={{ height: `${bar.height}px` }}
                      className={`w-full rounded-t-[8px] transition-opacity ${
                        bar.isToday || isSelected ? 'bg-[#1C202B]' : 'bg-[#6A9AE2]/85'
                      }`}
                    />
                    <span
                      className={`text-[10px] font-body ${
                        bar.isToday || isSelected
                          ? 'font-bold text-[#1C202B]'
                          : 'text-[#8C857B]'
                      }`}
                    >
                      {bar.day}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        {/* 5. Watering / Bloom Progress Card */}
        <section className="mt-3 px-4">
          <button
            type="button"
            onClick={() => navigate('07-voice-studio-lobby')}
            className="w-full text-left bg-white rounded-[22px] p-3.5 shadow-[0_4px_16px_rgba(45,38,30,0.04)] border border-[#EBE4D8] flex items-center justify-between gap-3 press-scale"
          >
            <div className="w-10 h-10 rounded-full bg-[#EBF2FC] text-[#2B579A] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px] fill-icon">water_drop</span>
            </div>
            <div className="flex-1 pr-1">
              <p className="text-xs font-semibold text-[#1C202B] leading-tight">
                {isZh ? '今日背词与口语进度' : "Today's Study & Voice Progress"}
              </p>
              <p className="text-[11px] text-[#5A554C] mt-0.5 leading-snug">
                {planTotal > 0
                  ? isZh
                    ? `今日已完成 ${planDone} / ${planTotal} 张记忆卡片`
                    : `${planDone} of ${planTotal} FSRS cards completed today`
                  : isZh
                    ? '生成今日计划后即可开启背词与语音对练'
                    : 'Generate today’s plan to start daily FSRS & voice practice'}
              </p>
            </div>
            <div className="flex flex-col items-end shrink-0 w-16">
              <span className="font-mono text-xs font-bold text-[#6A9AE2]">{planPct}%</span>
              <div className="w-full bg-[#EBF2FC] rounded-full h-1.5 mt-1 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#6A9AE2] to-[#58B37C] h-full rounded-full"
                  style={{ width: `${planPct}%` }}
                />
              </div>
            </div>
          </button>
        </section>

        {/* Pip's Daily Memory Garden Encouragement Note */}
        <section className="mt-3 px-4 pb-2">
          <div className="bg-[#EFE6D5] rounded-[22px] p-3.5 border border-[#E6DEC8] flex items-center gap-3">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-rose-200/50 shrink-0 border border-white flex items-center justify-center">
              <img
                alt="Pip warm companion face"
                className="w-full h-full object-cover"
                src="/assets/pip-avatar.png"
              />
            </div>
            <p className="font-headline italic text-[13px] text-[#1C202B] leading-snug">
              {totalWords > 0
                ? isZh
                  ? `“当前词库共收录 ${totalWords} 个单词，待复习 ${stats?.due ?? 0} 个。”`
                  : `“Your lexicon holds ${totalWords} words, with ${stats?.due ?? 0} due for review today.”`
                : isZh
                  ? '“点击右上角词书按钮导入你的第一份 JSON 或 CSV 词表吧！”'
                  : '“Tap the wordbook icon in the top-right to import your first JSON or CSV deck!”'}
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
