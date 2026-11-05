import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { api } from '../lib/api'
import { useAppStore } from '../store/useAppStore'
import { AnimatedNumber, StatusBar } from '../components/ShellComponents'

const WORDBOOK_DISPLAY_CARDS = [
  {
    id: 1,
    word: 'deprecate',
    phonetic: '/ˈdeprəkeɪt/',
    def: 'v. 弃用；淘汰',
    tag: '#API',
    topic: 'tech_dev',
    statusType: 'plan' as const,
    statusLabel: "In Today's Plan",
  },
  {
    id: 2,
    word: 'idempotent',
    phonetic: '/ˌaɪdəmˈpoʊtənt/',
    def: 'adj. 幂等的',
    tag: '#Arch',
    topic: 'tech_dev',
    statusType: 'plan' as const,
    statusLabel: "In Today's Plan",
  },
  {
    id: 3,
    word: 'bottleneck',
    phonetic: '/ˈbɑːtlnek/',
    def: 'n. 瓶颈；障碍',
    tag: '#Perf',
    topic: 'problem_solving',
    statusType: 'review' as const,
    statusLabel: 'Review · S: 14d',
  },
  {
    id: 4,
    word: 'ratify',
    phonetic: '/ˈrætɪfaɪ/',
    def: 'v. 正式批准；签署',
    tag: '#Gov',
    topic: 'workplace_comm',
    statusType: 'voice' as const,
    statusLabel: 'Voice Target',
  },
  {
    id: 5,
    word: 'contingent',
    phonetic: '/kənˈtɪndʒənt/',
    def: 'adj. 依条件而定',
    tag: '#Contract',
    topic: 'workplace_comm',
    statusType: 'new' as const,
    statusLabel: 'New · Queue #5',
  },
  {
    id: 6,
    word: 'ameliorate',
    phonetic: '/əˈmiːliəreɪt/',
    def: 'v. 改善缓解',
    tag: '#Refactor',
    topic: 'problem_solving',
    statusType: 'ingested' as const,
    statusLabel: 'Ingested',
  },
]

export default function LexiconPlanetPage() {
  const currentScreen = useAppStore((s) => s.currentScreen)
  const navigate = useAppStore((s) => s.navigate)
  const stats = useAppStore((s) => s.stats)
  const words = useAppStore((s) => s.words)
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

  // ============================================================================
  // SCREEN 06: WORDBOOKS & AI TAGGING
  // ============================================================================
  if (currentScreen === '06-wordbooks-tagging') {
    const dynamicCards =
      words.length >= 6
        ? words.slice(0, 6).map((w, idx) => ({
            id: w.id || idx + 1,
            word: w.word,
            phonetic: w.phonetic_us || WORDBOOK_DISPLAY_CARDS[idx % 6].phonetic,
            def:
              w.pos_defs?.[0]?.pos && w.pos_defs?.[0]?.def
                ? `${w.pos_defs[0].pos} ${w.pos_defs[0].def}`
                : WORDBOOK_DISPLAY_CARDS[idx % 6].def,
            tag: w.topic_tags?.[0]
              ? `#${w.topic_tags[0].slice(0, 8)}`
              : WORDBOOK_DISPLAY_CARDS[idx % 6].tag,
            topic: w.topic_tags?.[0] ?? WORDBOOK_DISPLAY_CARDS[idx % 6].topic,
            statusType: WORDBOOK_DISPLAY_CARDS[idx % 6].statusType,
            statusLabel: WORDBOOK_DISPLAY_CARDS[idx % 6].statusLabel,
          }))
        : WORDBOOK_DISPLAY_CARDS

    const filteredCards =
      selectedTopicTag === 'all'
        ? dynamicCards
        : dynamicCards.filter((c) => c.topic === selectedTopicTag || c.tag.toLowerCase().includes(selectedTopicTag.slice(0, 4)))

    const displayList = filteredCards.length > 0 ? filteredCards : dynamicCards

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

        {/* Top Fixed Structure: Status Bar & Top Navigation */}
        <div className="sticky top-0 z-40 bg-[#F9F6F0]/95 backdrop-blur-md pb-1">
          <StatusBar />
          <div className="flex items-center justify-between px-5 mt-1 mb-2">
            {/* Circular Back Button */}
            <button
              type="button"
              aria-label="Go Back"
              onClick={() => navigate('05-lexicon-planet')}
              className="w-11 h-11 rounded-full bg-white border border-[#EBE4D8] shadow-[0_2px_8px_rgba(45,38,30,0.06)] flex items-center justify-center text-[#1C202B] press-scale"
            >
              <span className="material-symbols-outlined text-[20px] leading-none">
                arrow_back_ios_new
              </span>
            </button>

            {/* Center Title */}
            <h1 className="font-headline italic text-xl font-medium tracking-tight text-[#1C202B]">
              Wordbooks &amp; AI Tagging
            </h1>

            {/* Right Honey-Gold Glowing Pill Badge */}
            <div className="flex items-center gap-1.5 bg-[#FFF4D6] border border-[#F4B844]/40 px-2.5 py-1 rounded-full shadow-[0_0_12px_rgba(244,184,68,0.22)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F4B844] animate-pulse" />
              <span className="text-[11px] font-label font-semibold text-[#946300] tracking-tight">
                <AnimatedNumber value={stats?.total ?? 3000} /> Words
              </span>
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
                    alt="Chubby coral-pink clay mascot Pip avatar"
                    className="w-full h-full object-cover scale-110"
                    src="/assets/pip-avatar.png"
                  />
                </div>
                <div>
                  <span className="block text-[10px] font-mono tracking-wider font-semibold text-[#8C857B] uppercase">
                    FSRS 4.5 • SEMANTIC ENGINE
                  </span>
                  <h2 className="text-[16px] font-headline font-semibold text-[#1C202B] leading-snug">
                    Non-Sequential Scenario Clustering
                  </h2>
                </div>
              </div>
            </div>

            <p className="font-body text-[12.5px] leading-relaxed text-[#5A554C] mb-4">
              Upload any JSON or CSV wordbook. Pip batch-tags every 50 words into real-life
              scenario themes and initializes FSRS cards.
            </p>

            {/* Inner Dashed Ivory Dropzone */}
            <div className="bg-[#FFFDF9] border border-dashed border-[#D6CAB4] rounded-2xl p-3.5 text-center transition-colors">
              <div className="w-8 h-8 mx-auto mb-1.5 rounded-full bg-[#F3EBDD] flex items-center justify-center text-[#1C202B]">
                <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
              </div>
              <h3 className="text-xs font-body font-semibold text-[#1C202B]">
                Upload JSON / CSV Wordbook
              </h3>
              <p className="text-[11px] font-mono text-[#8C857B] mt-0.5">
                Fields: word, phonetic_us, pos_defs
              </p>

              {/* Active File Indicator */}
              <div className="my-3 py-1.5 px-2.5 rounded-xl bg-[#F4EFE3] flex items-center justify-center gap-1.5 text-[11px] font-mono text-[#5A554C] border border-[#E9DFCE]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#58B37C]" />
                <span className="truncate max-w-[240px]">
                  Active: <strong className="font-medium text-[#1C202B]">{activeWordbookName}</strong> (60/60 batches tagged)
                </span>
              </div>

              {/* Browse Pill Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-[#1C202B] text-white text-xs font-body font-medium px-4 py-2.5 min-h-[44px] rounded-full inline-flex items-center gap-1.5 shadow-sm press-scale"
              >
                <span className="material-symbols-outlined text-[15px]">folder_open</span>
                <span>Browse File (.json / .csv)</span>
              </button>
            </div>
          </section>

          {/* Scenario Topic Filter Tabs */}
          <nav
            aria-label="Scenario Topics"
            className="relative -mx-4 px-4 overflow-x-auto no-scrollbar flex items-center gap-2 pt-1 pb-1"
          >
            {[
              { id: 'all', label: 'All (3,000)', count: '' },
              { id: 'tech_dev', label: 'tech_dev', count: '(1,240)' },
              { id: 'workplace_comm', label: 'workplace_comm', count: '(860)' },
              { id: 'problem_solving', label: 'problem_solving', count: '(520)' },
              { id: 'daily_life', label: 'daily_life', count: '(380)' },
            ].map((tab) => {
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
              Clustered Vocabulary Cards
            </span>
            <span className="text-[11px] font-mono text-[#8C857B]">Batch 01 / 60</span>
          </div>

          {/* 2-Column Tactile Word Grid (2x3 Grid) */}
          {uiStateMode === 'empty' ? (
            <div className="bg-white rounded-[24px] p-6 border border-[#EBE4D8] text-center space-y-2">
              <p className="font-headline italic text-lg text-[#1C202B]">No wordbooks imported yet</p>
              <p className="text-xs text-[#8C857B]">
                Tap Browse File above to upload a JSON or CSV vocabulary deck.
              </p>
            </div>
          ) : (
            <section className="grid grid-cols-2 gap-3">
              {displayList.map((card, i) => {
                const isSelected = selectedWordIds.includes(card.id)
                return (
                  <motion.article
                    key={card.word}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: i * 0.03 }}
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
                        className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-medium ${
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
                      <h3 className="font-headline italic text-[19px] font-semibold text-[#1C202B] leading-tight tracking-tight">
                        {card.word}
                      </h3>
                      <span className="block font-mono text-[10.5px] text-[#8C857B] mt-0.5">
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
                      {card.statusType === 'voice' && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFF8E7] border border-[#F4B844]/30 text-[#946300] text-[10px] font-body font-semibold">
                          <span className="material-symbols-outlined fill-icon text-[12px] text-[#F4B844]">
                            star
                          </span>
                          <span>{card.statusLabel}</span>
                        </div>
                      )}
                      {card.statusType === 'new' && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F0EDFF] text-[#533FD1] text-[10px] font-mono font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#9B8AFB]" />
                          <span>{card.statusLabel}</span>
                        </div>
                      )}
                      {card.statusType === 'ingested' && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E6F5EC] text-[#236B42] text-[10px] font-body font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#58B37C]" />
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

        {/* Bottom Floating Action Area + Home Bar Indicator */}
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
              Regenerate Today&apos;s 120-Word Scenario Plan →
            </span>
          </button>
          <div className="w-32 h-1 bg-[#1C202B]/25 rounded-full mx-auto mt-3 mb-1" />
        </footer>
      </div>
    )
  }

  // ============================================================================
  // SCREEN 05: LEXICON PLANET (3D ISLAND & FSRS ECOSYSTEM)
  // ============================================================================
  const upcomingBars = [
    { day: 'Today', count: 90, height: 68, isToday: true },
    { day: 'Thu', count: 74, height: 56, isToday: false },
    { day: 'Fri', count: 68, height: 51, isToday: false },
    { day: 'Sat', count: 52, height: 39, isToday: false },
    { day: 'Sun', count: 45, height: 34, isToday: false },
    { day: 'Mon', count: 61, height: 46, isToday: false },
    { day: 'Tue', count: 49, height: 37, isToday: false },
  ]

  return (
    <div className="min-h-dvh bg-[#F9F6F0] text-[#1C202B] relative flex flex-col overflow-x-hidden pb-28">
      {/* Top Hero Gradient Canvas (Lavender-Peach Dawn to Alabaster) */}
      <div className="absolute top-0 left-0 right-0 h-[360px] bg-gradient-to-b from-[#DBD6F5] via-[#F5E2D4] to-[#F9F6F0] pointer-events-none z-0" />

      <div className="relative z-20">
        <StatusBar />
      </div>

      {/* Main Scrollable Content Area */}
      <div className="relative z-10 flex-1">
        {/* 2. Hero Sky & Floating Level Bar */}
        <section className="px-4 pt-1 pb-2">
          <div className="backdrop-blur-md bg-white/75 border border-white/70 shadow-sm rounded-full px-4 py-2.5 flex items-center justify-between">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-headline italic font-medium text-[17px] text-[#1C202B] leading-tight">
                  Pip&apos;s Lexicon Planet
                </span>
                <span className="inline-block w-2 h-2 rounded-full bg-[#58B37C] animate-pulse" />
              </div>
              <div className="w-28 bg-[#1C202B]/10 rounded-full h-[4px] mt-1.5 overflow-hidden">
                <div className="bg-[#F4B844] h-full rounded-full w-[74%]" />
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="text-right">
                <span className="font-mono text-[11px] font-semibold text-[#1C202B] block tracking-tight">
                  Lv 7 → 8
                </span>
                <span className="font-mono text-[9.5px] text-[#5A554C] block leading-none">
                  1,420 words
                </span>
              </div>
              <button
                type="button"
                aria-label="Import Wordbook"
                onClick={() => navigate('06-wordbooks-tagging')}
                className="w-11 h-11 rounded-full bg-[#1C202B] text-white flex items-center justify-center shadow-sm press-scale"
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
                toast.success('FSRS Crystal Fountain · 91.4% Retrievability', {
                  description: '1,198 mature review cards maintaining >90% stability.',
                })
              }
              className="absolute top-4 left-1 z-20 backdrop-blur-md bg-white/85 border border-white shadow-[0_6px_16px_rgba(0,0,0,0.06)] rounded-full px-3 py-1.5 flex items-center gap-1.5 press-scale"
            >
              <span className="text-xs">⛲</span>
              <span className="text-[11px] font-semibold text-[#1C202B] font-body tracking-tight">
                Fountain · <span className="font-mono text-[#2B579A]">91.4%</span> FSRS
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
                Sunflowers · <span className="font-mono text-[#946300]">12d</span> streak
              </span>
            </button>
          </div>
        </section>

        {/* 3. Section: Grown from your talks (Scenario Word Clusters) */}
        <section className="mt-4 px-4">
          <div className="flex items-baseline justify-between mb-2.5">
            <div>
              <h2 className="font-headline italic text-[19px] font-medium text-[#1C202B] leading-snug">
                Grown from your talks
              </h2>
              <p className="text-[11.5px] text-[#8C857B] font-body">
                Every scenario cluster holds active vocabulary memories
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('06-wordbooks-tagging')}
              className="text-xs font-semibold text-[#1C202B] flex items-center gap-0.5 py-1 px-2 rounded-lg press-scale"
            >
              <span>Import Book</span>
              <span className="material-symbols-outlined text-[14px]">add</span>
            </button>
          </div>

          <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-4 px-4 py-1">
            {[
              {
                emoji: '🏡',
                emojiBg: 'bg-[#E6F5EC]',
                badge: '93% R',
                badgeClass: 'text-[#236B42] bg-[#E6F5EC]',
                title: 'Tech & Dev',
                count: '480 words',
                tag: 'tech_dev',
                locked: false,
              },
              {
                emoji: '🌻',
                emojiBg: 'bg-[#FFF4D6]',
                badge: '89% R',
                badgeClass: 'text-[#946300] bg-[#FFF4D6]',
                title: 'Workplace',
                count: '360 words',
                tag: 'workplace_comm',
                locked: false,
              },
              {
                emoji: '☕',
                emojiBg: 'bg-[#EBF2FC]',
                badge: 'Active',
                badgeClass: 'text-[#2B579A] bg-[#EBF2FC]',
                title: 'Daily Dining',
                count: '310 words',
                tag: 'daily_life',
                locked: false,
              },
              {
                emoji: '🎙️',
                emojiBg: 'bg-white/70',
                badge: 'lock',
                badgeClass: '',
                title: 'Debate & Pitch',
                count: '270 words · Next',
                tag: 'problem_solving',
                locked: true,
              },
            ].map((cluster) => (
              <button
                key={cluster.title}
                type="button"
                onClick={() => {
                  setSelectedTopicTag(cluster.tag)
                  navigate('06-wordbooks-tagging')
                }}
                className={`rounded-[22px] p-3.5 min-w-[128px] max-w-[134px] flex flex-col justify-between shrink-0 text-left press-scale ${
                  cluster.locked
                    ? 'bg-[#F6F2EA] border border-[#E8E1D5] opacity-85'
                    : 'bg-white shadow-[0_4px_16px_rgba(45,38,30,0.04)] border border-[#EBE4D8]'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`w-8 h-8 rounded-full ${cluster.emojiBg} flex items-center justify-center text-sm shadow-xs`}
                  >
                    {cluster.emoji}
                  </span>
                  {cluster.locked ? (
                    <span className="material-symbols-outlined text-[13px] text-[#8C857B]">
                      lock
                    </span>
                  ) : (
                    <span
                      className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full ${cluster.badgeClass}`}
                    >
                      {cluster.badge}
                    </span>
                  )}
                </div>
                <div className="mt-2.5">
                  <h3
                    className={`font-bold text-[12.5px] leading-tight tracking-tight ${
                      cluster.locked ? 'text-[#5A554C]' : 'text-[#1C202B]'
                    }`}
                  >
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
                FSRS Memory Ecosystem
              </h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold font-mono bg-[#E6F5EC] text-[#236B42] px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-[#58B37C]" />
                Health 94.2%
              </span>
            </div>
            <p className="text-[11px] text-[#8C857B] font-body mb-3">
              Free Spaced Repetition Scheduler parameter weights active
            </p>

            {/* 4 State Chips Grid */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <button
                type="button"
                onClick={() => navigate('06-wordbooks-tagging')}
                className="bg-[#F0EDFF] rounded-[16px] py-2 px-1 border border-[#9B8AFB]/20 press-scale"
              >
                <span className="block text-[10px] uppercase font-semibold text-[#533FD1] tracking-wider">
                  New
                </span>
                <span className="font-mono text-[13px] font-bold text-[#533FD1]">
                  <AnimatedNumber value={stats?.new ?? 1580} />
                </span>
              </button>
              <button
                type="button"
                onClick={() => navigate('02-fsrs-sprint-question')}
                className="bg-[#FFF4D6] rounded-[16px] py-2 px-1 border border-[#F4B844]/20 press-scale"
              >
                <span className="block text-[10px] uppercase font-semibold text-[#946300] tracking-wider">
                  Learn
                </span>
                <span className="font-mono text-[13px] font-bold text-[#946300]">142</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('02-fsrs-sprint-question')}
                className="bg-[#E6F5EC] rounded-[16px] py-2 px-1 border border-[#58B37C]/20 press-scale"
              >
                <span className="block text-[10px] uppercase font-semibold text-[#236B42] tracking-wider">
                  Review
                </span>
                <span className="font-mono text-[13px] font-bold text-[#236B42]">1,198</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('04-fsrs-sprint-wrong')}
                className="bg-[#FCECE8] rounded-[16px] py-2 px-1 border border-[#E5735D]/20 press-scale"
              >
                <span className="block text-[10px] uppercase font-semibold text-[#A83825] tracking-wider">
                  Relearn
                </span>
                <span className="font-mono text-[13px] font-bold text-[#A83825]">80</span>
              </button>
            </div>

            <div className="mt-4 pt-3 border-t border-[#F2ECE1] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#1C202B] font-body">
                7-Day FSRS Review Pressure
              </span>
              <span className="font-mono text-[11px] text-[#5A554C]">Total: 439 words</span>
            </div>

            {/* 7-Day Due Pressure Bar Chart */}
            <div className="mt-3 grid grid-cols-7 gap-1.5 items-end h-[96px] pt-4 px-1">
              {upcomingBars.map((bar, idx) => {
                const isSelected = selectedDayIdx === idx
                return (
                  <button
                    key={bar.day}
                    type="button"
                    onClick={() => {
                      setSelectedDayIdx(idx)
                      toast(`${bar.day}: ${bar.count} FSRS reviews scheduled`)
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
                Watering the Crystal Fountain
              </p>
              <p className="text-[11px] text-[#5A554C] mt-0.5 leading-snug">
                Speak <span className="font-bold text-[#1C202B]">6 proactive words</span> in live
                call to trigger bloom
              </p>
            </div>
            <div className="flex flex-col items-end shrink-0 w-16">
              <span className="font-mono text-xs font-bold text-[#6A9AE2]">72%</span>
              <div className="w-full bg-[#EBF2FC] rounded-full h-1.5 mt-1 overflow-hidden">
                <div className="bg-gradient-to-r from-[#6A9AE2] to-[#58B37C] h-full rounded-full w-[72%]" />
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
              &ldquo;Your Tech cluster is budding fast. Let&apos;s practice 3 phrases during
              lunch!&rdquo;
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
