import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import { api } from '../lib/api'
import { useAppStore } from '../store/useAppStore'
import { StatusBar } from '../components/ShellComponents'

const JOURNAL_DAYS = [
  {
    day: 'M',
    emoji: '🌱',
    bg: 'bg-[#E8F5E9] border-[#C8E6C9]',
    summary: 'Mon · 94% Vocal Flow · 14 words bloomed',
  },
  {
    day: 'T',
    emoji: '💧',
    bg: 'bg-[#EBF2FC] border-[#BBDEFB]',
    summary: 'Tue · 92% Vocal Flow · 12 words bloomed',
  },
  {
    day: 'W',
    emoji: '⚡️',
    bg: 'bg-[#FCECE8] border-[#FFCDD2]',
    badge: '3',
    labelClass: 'font-bold text-[#E5735D]',
    summary: 'Wed · 3 Recasts logged during Architecture Roleplay',
  },
  {
    day: 'T',
    emoji: '✨',
    bg: 'bg-[#F3E5F5] border-[#E1BEE7]',
    summary: 'Thu · 95% Vocal Flow · 18 words bloomed',
  },
  {
    day: 'F',
    emoji: '🌸',
    bg: 'bg-[#FCE4EC] border-[#F8BBD0]',
    summary: 'Fri · 96% Vocal Flow · Zero grammar slips',
  },
  {
    day: 'S',
    emoji: '🍯',
    bg: 'bg-[#FFF9C4] border-[#FFE082]',
    summary: 'Sat · 25m Deep Dive completed',
  },
  {
    day: 'S',
    emoji: '☀️',
    bg: 'bg-[#FFF8E1] border-[#FFE082] ring-2 ring-[#1C202B] ring-offset-2 ring-offset-white shadow-md',
    labelClass: 'font-bold text-[#1C202B]',
    summary: 'Sun (Today) · Post-Compaction Journal Ready',
  },
]

export default function MemoryJournalPage() {
  const currentScreen = useAppStore((s) => s.currentScreen)
  const navigate = useAppStore((s) => s.navigate)
  const mistakes = useAppStore((s) => s.mistakes)
  const activeMemoryDoc = useAppStore((s) => s.activeMemoryDoc)
  const setActiveMemoryDoc = useAppStore((s) => s.setActiveMemoryDoc)
  const memoryViewMode = useAppStore((s) => s.memoryViewMode)
  const setMemoryViewMode = useAppStore((s) => s.setMemoryViewMode)
  const userProfileMd = useAppStore((s) => s.userProfileMd)
  const errorPatternsMd = useAppStore((s) => s.errorPatternsMd)
  const updateMemoryContent = useAppStore((s) => s.updateMemoryContent)
  const insertMarkdownSnippet = useAppStore((s) => s.insertMarkdownSnippet)
  const saveActiveMemory = useAppStore((s) => s.saveActiveMemory)
  const runMemoryCompaction = useAppStore((s) => s.runMemoryCompaction)
  const uiStateMode = useAppStore((s) => s.uiStateMode)

  const [periodTab, setPeriodTab] = useState<'week' | 'month'>('week')
  const [clinicFilter, setClinicFilter] = useState<
    'ALL' | 'PRONUNCIATION' | 'GRAMMAR' | 'WORD_CHOICE'
  >('ALL')
  const [playingClipId, setPlayingClipId] = useState<number | null>(null)
  const [unsavedEdits, setUnsavedEdits] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  // ============================================================================
  // SCREEN 13: DUAL-LAYER MARKDOWN MEMORY EDITOR
  // ============================================================================
  if (currentScreen === '13-memory-editor') {
    const activeContent = activeMemoryDoc === 'user_profile' ? userProfileMd : errorPatternsMd
    const lineCount = activeContent.split('\n').length
    const wordCount = activeContent.trim().split(/\s+/).filter(Boolean).length

    return (
      <div className="min-h-dvh bg-[#F9F6F0] text-[#1C202B] flex flex-col relative overflow-x-hidden">
        <StatusBar />

        {/* 2. Header Bar */}
        <header className="px-5 pt-2 pb-3 flex items-center justify-between gap-2 z-40">
          <button
            type="button"
            aria-label="Go back to Memory Journal"
            onClick={() => navigate('12-memory-journal')}
            className="w-11 h-11 rounded-full bg-white border border-stone-200/70 shadow-sm flex items-center justify-center text-[#1C202B] press-scale"
          >
            <span className="material-symbols-outlined text-xl">chevron_left</span>
          </button>

          <div className="text-center">
            <h1 className="font-body font-bold text-[17px] text-[#1C202B] tracking-tight">
              Pip&apos;s Long-Term Memory
            </h1>
          </div>

          <div
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 border shadow-2xs ${
              unsavedEdits
                ? 'bg-[#FFF4D6] text-[#946300] border-[#F4E0A8]'
                : 'bg-[#E6F5EC] text-[#246B44] border-[#CFEDDA]'
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  unsavedEdits ? 'bg-[#F4B844]' : 'bg-[#58B37C]'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  unsavedEdits ? 'bg-[#F4B844]' : 'bg-[#58B37C]'
                }`}
              />
            </span>
            <span>{justSaved ? 'Saved ✓' : unsavedEdits ? 'Unsaved' : 'Synced · 2.4 KB'}</span>
          </div>
        </header>

        {/* Main Scrollable Canvas Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-28 pt-1 no-scrollbar">
          {/* 3. File Switcher Segmented Bar */}
          <div
            className="bg-[#EBE6DC] p-1 rounded-full flex gap-1 mb-4 shadow-inner"
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeMemoryDoc === 'user_profile'}
              onClick={() => setActiveMemoryDoc('user_profile')}
              className={`flex-1 font-mono text-[11.5px] py-2.5 px-3 min-h-[44px] rounded-full flex items-center justify-center gap-1.5 press-scale ${
                activeMemoryDoc === 'user_profile'
                  ? 'bg-[#1C202B] text-white font-semibold shadow-sm'
                  : 'text-[#665E55] font-medium'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="truncate">user_profile.md</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeMemoryDoc === 'error_patterns'}
              onClick={() => setActiveMemoryDoc('error_patterns')}
              className={`flex-1 font-mono text-[11.5px] py-2.5 px-3 min-h-[44px] rounded-full flex items-center justify-center gap-1.5 press-scale ${
                activeMemoryDoc === 'error_patterns'
                  ? 'bg-[#1C202B] text-white font-semibold shadow-sm'
                  : 'text-[#665E55] font-medium'
              }`}
            >
              <span className="truncate">error_patterns.md</span>
              <span className="text-[10px] opacity-75 font-sans font-normal">(Top 15)</span>
            </button>
          </div>

          {/* 4. Architecture Banner Card (Warm Champagne Sand) */}
          <section className="bg-[#EFE6D5] rounded-[24px] p-4 border border-[#E4DAC7] shadow-sm mb-4 relative overflow-hidden">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2.5">
                <div className="relative w-9 h-9 rounded-full overflow-hidden border border-white/80 shadow-xs bg-[#F7D8CB] shrink-0">
                  <img
                    alt="Pip avatar"
                    className="w-full h-full object-cover"
                    src="/assets/pip-avatar.png"
                  />
                </div>
                <div>
                  <p className="font-body font-bold text-[#1C202B] text-[13px] leading-tight">
                    Dual-Layer Plaintext Memory
                  </p>
                  <p className="font-mono text-[10.5px] text-[#8C857B] leading-none mt-0.5">
                    /data/memory/
                  </p>
                </div>
              </div>

              {/* Mode Toggle: Structured vs Raw .md */}
              <div className="bg-white/70 p-0.5 rounded-full flex border border-[#DDD3BF] shrink-0">
                <button
                  type="button"
                  onClick={() => setMemoryViewMode('structured')}
                  className={`text-[11px] px-2.5 py-1.5 min-h-[34px] rounded-full press-scale tap-target-expand ${
                    memoryViewMode === 'structured'
                      ? 'bg-[#1C202B] text-white font-semibold shadow-xs'
                      : 'text-stone-500 font-medium'
                  }`}
                >
                  Structured
                </button>
                <button
                  type="button"
                  onClick={() => setMemoryViewMode('raw')}
                  className={`text-[11px] px-2.5 py-1.5 min-h-[34px] rounded-full press-scale tap-target-expand ${
                    memoryViewMode === 'raw'
                      ? 'bg-[#1C202B] text-white font-semibold shadow-xs'
                      : 'text-stone-500 font-medium'
                  }`}
                >
                  Raw .md
                </button>
              </div>
            </div>

            <p className="font-body text-[12px] text-[#5D554B] leading-relaxed">
              Injected into Daily Planner (for authentic personal scenarios) and Voice Orchestrator.
              Manually editable anytime—no black-box vector DB.
            </p>
          </section>

          {/* 5. Interactive Markdown Editor Card */}
          <section className="bg-white rounded-[26px] p-4 border border-[#EBE4D8] shadow-[0_4px_24px_rgba(28,32,43,0.04)] mb-4">
            {/* Editor Top Toolbar */}
            <div className="flex items-center justify-between gap-1.5 pb-3 border-b border-[#F4EFE6] mb-3">
              <div className="font-mono text-[11px] text-[#6A6359] bg-[#F7F5F0] px-2.5 py-1 rounded-md border border-[#EBE4D8] flex items-center gap-1.5 truncate max-w-[165px]">
                <span className="material-symbols-outlined text-[13px] text-amber-700">
                  folder_open
                </span>
                <span className="truncate">{activeMemoryDoc}.md</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    insertMarkdownSnippet('## New Scenario Focus')
                    setUnsavedEdits(true)
                  }}
                  className="tap-target-expand bg-[#F5F2EA] text-stone-700 text-[11px] font-mono px-2.5 py-1 rounded-md border border-[#E8E2D4] press-scale"
                >
                  # H2
                </button>
                <button
                  type="button"
                  onClick={() => {
                    insertMarkdownSnippet('- [Nov 4] Practiced idiomatic post-mortem transitions.')
                    setUnsavedEdits(true)
                  }}
                  className="tap-target-expand bg-[#F5F2EA] text-stone-700 text-[11px] font-mono px-2.5 py-1 rounded-md border border-[#E8E2D4] press-scale"
                >
                  - Bullet
                </button>
                <button
                  type="button"
                  onClick={() => void runMemoryCompaction()}
                  className="tap-target-expand bg-[#FFF9EC] text-[#B87B14] text-[11px] font-body font-semibold px-2.5 py-1 rounded-md border border-[#F4DCAC] flex items-center gap-0.5 press-scale"
                >
                  <span>Auto-Compact</span>
                  <span className="text-xs">✦</span>
                </button>
              </div>
            </div>

            {/* Styled Markdown View or Editable Textarea (font-size: 16px to prevent iOS zoom) */}
            {memoryViewMode === 'structured' ? (
              <div className="space-y-2.5">
                <label
                  htmlFor="markdown-memory-textarea"
                  className="block text-[11px] font-mono text-[#8C857B]"
                >
                  Direct Plaintext Editor (16px iOS Safe Input):
                </label>
                <textarea
                  id="markdown-memory-textarea"
                  value={activeContent}
                  onChange={(e) => {
                    updateMemoryContent(e.target.value)
                    setUnsavedEdits(true)
                  }}
                  rows={10}
                  className="w-full font-mono text-[16px] leading-relaxed text-[#1C202B] bg-[#FAF7F2] rounded-2xl p-3.5 border border-[#EBE4D8] focus:outline-none focus:border-[#1C202B]"
                />
              </div>
            ) : activeMemoryDoc === 'user_profile' ? (
              <div
                onClick={() => setMemoryViewMode('structured')}
                className="relative min-h-[255px] font-mono text-[12px] leading-relaxed text-[#2C2723] space-y-2.5 cursor-text"
              >
                <div>
                  <div className="text-[#874116] font-headline font-semibold text-[15px] tracking-normal mb-1 flex items-center gap-1.5">
                    <span className="text-stone-300 font-mono text-xs select-none">#</span>
                    <span>User Persona &amp; Context</span>
                  </div>
                  <div className="pl-2 space-y-1">
                    <div className="flex items-start gap-1.5">
                      <span className="text-stone-400 select-none">-</span>
                      <span>
                        <strong className="font-semibold text-stone-800">Role:</strong> Senior
                        Backend &amp; AI Agent Engineer
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-stone-400 select-none">-</span>
                      <span>
                        <strong className="font-semibold text-stone-800">Style:</strong> Prefers
                        deterministic Python harnesses, clean async SQLite, and concise technical
                        English.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-1.5">
                  <div className="text-[#874116] font-headline font-semibold text-[14px] tracking-normal mb-1 flex items-center gap-1.5">
                    <span className="text-stone-300 font-mono text-xs select-none">##</span>
                    <span>Active Projects &amp; Daily Scenarios</span>
                  </div>
                  <div className="pl-2 space-y-1">
                    <div className="flex items-start gap-1.5">
                      <span className="text-stone-400 select-none">-</span>
                      <span>
                        Building a custom FSRS + Realtime S2S English Agent (vocab-voice-agent).
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-stone-400 select-none">-</span>
                      <span>
                        Leading payment webhook microservice migration &amp; API deprecation RFC.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-1.5">
                  <div className="text-[#874116] font-headline font-semibold text-[14px] tracking-normal mb-1 flex items-center gap-1.5">
                    <span className="text-stone-300 font-mono text-xs select-none">##</span>
                    <span>Recent Life &amp; Work Updates (Auto-Compacted)</span>
                  </div>
                  <div className="pl-2 space-y-1.5">
                    <div className="flex items-start gap-1.5">
                      <span className="text-stone-400 select-none">-</span>
                      <span>
                        <span className="text-[#236B42] bg-[#E6F5EC] border border-[#D0ECC2]/50 px-1 py-0.5 rounded text-[11px] font-medium mr-1">
                          [Nov 4]
                        </span>
                        Shipping payment webhook v2 next Friday; aligning rate-limit rules with
                        leads.
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-stone-400 select-none">-</span>
                      <span>
                        <span className="text-[#236B42] bg-[#E6F5EC] border border-[#D0ECC2]/50 px-1 py-0.5 rounded text-[11px] font-medium mr-1">
                          [Nov 2]
                        </span>
                        Discussed Web Audio 16kHz/24kHz PCM resampling on iOS Safari.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-stone-400 pl-2">
                  <span className="text-stone-300 select-none">-</span>
                  <span className="w-1.5 h-3.5 bg-[#1C202B] inline-block animate-pulse" />
                </div>
              </div>
            ) : (
              <div
                onClick={() => setMemoryViewMode('structured')}
                className="relative min-h-[255px] font-mono text-[12px] leading-relaxed text-[#2C2723] space-y-2.5 cursor-text"
              >
                <div>
                  <div className="text-[#A83825] font-headline font-semibold text-[15px] mb-1">
                    # Active Linguistic Blindspots (Top 15)
                  </div>
                  <div className="pl-2 space-y-2">
                    <div>
                      <span className="text-[#A83825] font-bold">1. [PRONUNCIATION]</span>{' '}
                      3-syllable -ate verbs stress: <code>deprecate</code> → /ˈdeprəkeɪt/ (1st
                      syllable DEP).
                    </div>
                    <div>
                      <span className="text-[#2B579A] font-bold">2. [GRAMMAR]</span>{' '}
                      First-conditional clauses in post-mortems: use present simple (&ldquo;If the
                      gateway times out...&rdquo;).
                    </div>
                    <div>
                      <span className="text-[#236B42] font-bold">3. [WORD_CHOICE]</span> Prefer
                      domain adjectives (<code>idempotent</code>, <code>ephemeral</code>) over
                      informal compounds.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Editor footer status bar */}
            <div className="pt-2.5 mt-3 border-t border-stone-100 flex items-center justify-between text-[11px] font-mono text-stone-400 select-none tabular-nums">
              <div className="flex items-center gap-2">
                <span>Lines: {lineCount}</span>
                <span className="text-stone-300">·</span>
                <span>Words: {wordCount}</span>
                <span className="text-stone-300">·</span>
                <span>UTF-8</span>
              </div>
              <div className="flex items-center gap-1 text-stone-500 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Ln 14, Col 62</span>
              </div>
            </div>
          </section>

          {/* 6. Peek Card for Second File */}
          <button
            type="button"
            onClick={() =>
              setActiveMemoryDoc(
                activeMemoryDoc === 'user_profile' ? 'error_patterns' : 'user_profile',
              )
            }
            className="w-full text-left bg-[#F2ECE1] rounded-[22px] p-3.5 border border-[#E5DDD0] shadow-sm mb-4 block press-scale"
          >
            <div className="flex items-center justify-between text-[#1C202B] mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-[#8C857B]">
                  description
                </span>
                <span className="font-mono text-[12px] font-semibold truncate">
                  {activeMemoryDoc === 'user_profile' ? 'error_patterns.md' : 'user_profile.md'}
                </span>
                <span className="text-[10.5px] bg-stone-200/80 px-1.5 py-0.5 rounded text-stone-600 font-mono">
                  12/15 Slots
                </span>
              </div>
              <div className="text-[11.5px] font-body font-semibold text-stone-600 flex items-center gap-0.5">
                <span>Switch</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </div>
            </div>
            <div className="font-mono text-[11px] text-stone-600 line-clamp-2 bg-white/70 p-2 rounded-xl border border-stone-200/50 leading-relaxed">
              <span className="text-[#A83825] font-semibold">1. [PRONUNCIATION]</span> 3-syllable
              -ate verbs stress (/ˈdeprəkeɪt/) ·{' '}
              <span className="text-[#2B579A] font-semibold">2. [GRAMMAR]</span> Past counterfactual
              modals in sprint reviews...
            </div>
          </button>
        </div>

        {/* 7. Sticky Bottom Action Row */}
        <div
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-gradient-to-t from-[#F9F6F0] via-[#F9F6F0]/95 to-transparent pt-3 pb-5 px-4 flex gap-3 z-50"
          style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}
        >
          <button
            type="button"
            onClick={() => void runMemoryCompaction()}
            className="flex-1 bg-[#EFECE4] text-[#1C202B] font-body font-semibold text-[12.5px] py-3.5 min-h-[48px] rounded-full border border-[#DDD6C8] flex items-center justify-center gap-1.5 shadow-sm press-scale"
          >
            <span className="material-symbols-outlined text-[16px]">auto_fix_high</span>
            <span>Run Compaction</span>
          </button>
          <button
            type="button"
            onClick={async () => {
              await saveActiveMemory()
              setUnsavedEdits(false)
              setJustSaved(true)
              window.setTimeout(() => setJustSaved(false), 1500)
            }}
            className="flex-[1.4] bg-[#1C202B] text-white font-body font-semibold text-[12.5px] py-3.5 min-h-[48px] rounded-full shadow-md flex items-center justify-center gap-2 press-scale"
          >
            <span className="material-symbols-outlined text-[16px] text-emerald-400">save</span>
            <span>Save {activeMemoryDoc}.md</span>
          </button>
        </div>
      </div>
    )
  }

  // ============================================================================
  // SCREEN 12: MEMORY JOURNAL & LINGUISTIC MISTAKE CLINIC
  // ============================================================================
  const filteredMistakes =
    clinicFilter === 'ALL'
      ? mistakes
      : mistakes.filter((m) => m.mistake_type.toUpperCase() === clinicFilter)

  const handlePlayClinicAudio = async (id: number, text: string) => {
    setPlayingClipId(id)
    await api.playSpeech(text)
    setPlayingClipId(null)
  }

  return (
    <div className="min-h-dvh bg-[#F9F6F0] text-[#1C202B] relative flex flex-col pb-32 overflow-x-hidden">
      <StatusBar />

      {/* Header Row (Journal Title + Segmented Switcher) */}
      <div className="px-6 pt-2 pb-2 flex justify-between items-center">
        <div className="flex items-baseline space-x-2">
          <h1 className="font-headline italic text-[#1C202B] text-[34px] leading-tight font-normal">
            Journal
          </h1>
        </div>
        <div className="flex items-center bg-[#EFECE4] p-1 rounded-full shadow-inner">
          <button
            type="button"
            onClick={() => setPeriodTab('week')}
            className={`font-body text-xs font-semibold px-3.5 py-1.5 min-h-[36px] rounded-full press-scale tap-target-expand ${
              periodTab === 'week' ? 'bg-white text-[#1C202B] shadow-sm' : 'text-[#8C857B]'
            }`}
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => {
              setPeriodTab('month')
              toast('Monthly Fluency Overview · 92.8% Average Retention')
            }}
            className={`font-body text-xs font-semibold px-3 py-1.5 min-h-[36px] rounded-full press-scale tap-target-expand ${
              periodTab === 'month' ? 'bg-white text-[#1C202B] shadow-sm' : 'text-[#8C857B]'
            }`}
          >
            Month
          </button>
        </div>
      </div>

      {/* Main Content Stream */}
      <div className="px-5 space-y-4 pt-1">
        {/* 2. Weekly Vocal Mood & Fluency Card */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', duration: 0.36, bounce: 0 }}
          className="bg-white rounded-3xl p-5 border border-[#EBE4D8] shadow-[0_8px_24px_rgba(45,38,30,0.04)]"
        >
          <div className="flex justify-between items-center mb-1">
            <span className="text-[#8C857B] text-[12px] font-label font-semibold tracking-wider uppercase">
              OCT 29 – NOV 4
            </span>
            <div className="flex items-center text-[#58B37C] text-xs font-medium space-x-1 bg-[#E6F5EC] px-2.5 py-0.5 rounded-full">
              <span className="material-symbols-outlined text-[13px] text-[#236B42]">
                auto_awesome
              </span>
              <span className="text-[#236B42] text-[12px] font-semibold">
                {periodTab === 'week' ? '91% Flow' : '93% Month'}
              </span>
            </div>
          </div>
          <h2 className="font-headline text-[18px] font-bold text-[#1C202B] tracking-tight leading-snug">
            Mostly fluent, one tricky Wednesday
          </h2>

          {/* 7 Expressive 3D Clay Droplet Character Days (M, T, W, T, F, S, S) */}
          <div className="grid grid-cols-7 gap-1.5 mt-4 pt-1">
            {JOURNAL_DAYS.map((d, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toast(d.summary)}
                className="flex flex-col items-center press-scale-sm min-h-[56px]"
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center relative shadow-sm border ${d.bg}`}
                >
                  <span className="text-base select-none">{d.emoji}</span>
                  {d.badge && (
                    <span className="absolute -top-1 -right-0.5 w-3.5 h-3.5 bg-[#E5735D] text-white rounded-full text-[9px] flex items-center justify-center font-bold font-mono">
                      {d.badge}
                    </span>
                  )}
                </div>
                <span className={`text-[12px] mt-1.5 ${d.labelClass ?? 'font-semibold text-[#8C857B]'}`}>
                  {d.day}
                </span>
              </button>
            ))}
          </div>
        </motion.section>

        {/* 3. Featured Companion Reflection Card ('A note from Pip') */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', duration: 0.38, bounce: 0, delay: 0.04 }}
          className="bg-[#EFE6D5] rounded-3xl p-5 border border-[#E5DAC4] shadow-[0_8px_20px_rgba(72,62,45,0.06)] relative overflow-hidden"
        >
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-[#F8DEB5]/30 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center space-x-3 mb-3">
            <div className="relative w-11 h-11 rounded-full overflow-hidden bg-[#FCE2D4] ring-2 ring-white/80 shadow-sm flex-shrink-0">
              <img
                alt="Pip Mascot Avatar"
                className="w-full h-full object-cover"
                src="/assets/pip-avatar.png"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-1.5">
                <h3 className="font-body font-semibold text-sm text-[#1C202B]">A note from Pip</h3>
                <span className="w-1.5 h-1.5 rounded-full bg-[#F4B844]" />
              </div>
              <p className="text-xs text-[#7A7365] font-body truncate">
                Wednesday evening · Post-Compaction
              </p>
            </div>
            <button
              type="button"
              aria-label="Bookmark note"
              onClick={() => toast.success('Saved reflection to Memory Highlights')}
              className="w-11 h-11 rounded-full flex items-center justify-center text-[#7A7365] press-scale-sm"
            >
              <span className="material-symbols-outlined text-lg">bookmark_border</span>
            </button>
          </div>

          <blockquote className="font-headline italic text-[#1C202B] text-[20px] leading-snug tracking-tight">
            “Dear Alex, you sounded much bolder in tonight’s architecture roleplay than last week.”
          </blockquote>

          <p className="font-body text-[13.5px] text-[#5A554C] leading-relaxed mt-2.5">
            You wove 15 new engineering verbs into our talk without tapping a single hint—and your
            first-syllable stress on{' '}
            <span className="font-medium text-[#1C202B] bg-white/60 px-1.5 py-0.5 rounded font-mono text-xs">
              deprecate
            </span>{' '}
            clicked right away.
          </p>

          <div className="grid grid-cols-2 gap-2.5 mt-4 pt-1">
            <button
              type="button"
              onClick={() => navigate('07-voice-studio-lobby')}
              className="h-11 min-h-[44px] rounded-full bg-[#1C202B] text-white font-body font-semibold text-xs flex items-center justify-center space-x-1.5 shadow-sm press-scale"
            >
              <span className="material-symbols-outlined text-sm text-[#F4B844]">auto_awesome</span>
              <span>Practice 3 Recasts</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('13-memory-editor')}
              className="h-11 min-h-[44px] rounded-full bg-[#E2D7C1] text-[#3F3A30] font-body font-semibold text-xs flex items-center justify-center space-x-1 press-scale"
            >
              <span className="material-symbols-outlined text-sm text-[#5A554C]">code</span>
              <span>Edit Memory (.md)</span>
            </button>
          </div>
        </motion.section>

        {/* 4. Section 'Linguistic Mistake Clinic (Today's Recasts)' */}
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="font-body font-bold text-base text-[#1C202B] tracking-tight">
                  Linguistic Mistake Clinic
                </h2>
                <span className="bg-[#FCECE8] text-[#A83825] text-[12px] font-mono font-bold px-2.5 py-0.5 rounded-full border border-[#FFCDD2]">
                  {mistakes.length} Recasts Logged
                </span>
              </div>
              <p className="text-xs text-[#8C857B] font-body mt-0.5">
                Non-blocking in-flow repairs from Episode 14
              </p>
            </div>
          </div>

          {/* Horizontal Pill Filters */}
          <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'ALL' as const, label: `All (${mistakes.length})` },
              { id: 'PRONUNCIATION' as const, label: 'Pronunciation' },
              { id: 'GRAMMAR' as const, label: 'Grammar' },
              { id: 'WORD_CHOICE' as const, label: 'Word Choice' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setClinicFilter(tab.id)}
                className={`px-3.5 py-2 min-h-[40px] rounded-full font-body text-xs whitespace-nowrap press-scale tap-target-expand ${
                  clinicFilter === tab.id
                    ? 'bg-[#1C202B] text-white font-semibold shadow-sm'
                    : 'bg-[#EFECE4] text-[#5A554C] font-medium'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Mistake Cards List */}
          {uiStateMode === 'empty' || filteredMistakes.length === 0 ? (
            <div className="bg-[#E6F5EC] rounded-2xl p-4 border border-[#C8E6C9] text-[#236B42] text-xs font-medium">
              🎉 Zero mistakes logged in this category! Complete a live voice call with Pip to
              receive personalized pronunciation &amp; grammar recasts.
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredMistakes.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  className="bg-white rounded-2xl p-4 border border-[#EBE4D8] shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="bg-[#FCECE8] text-[#C84B31] font-mono text-[12px] tracking-wider uppercase font-bold px-2.5 py-0.5 rounded-full border border-[#FFCDD2]/60">
                      {item.mistake_type === 'PRONUNCIATION'
                        ? 'PRONUNCIATION & STRESS'
                        : item.mistake_type}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handlePlayClinicAudio(item.id, item.corrected_version)}
                      className="tap-target-expand flex items-center space-x-1 text-xs font-body font-semibold text-[#1C202B] bg-[#F9F6F0] px-3 py-1.5 min-h-[36px] rounded-full border border-[#E8E2D7] press-scale"
                    >
                      <span className="material-symbols-outlined text-sm">compare_arrows</span>
                      <span>Compare Audio</span>
                    </button>
                  </div>

                  {/* Strikethrough Original Sentence */}
                  <div className="bg-[#FFF8F7] border border-[#FADCD5] rounded-xl p-2.5 text-xs text-[#8C857B] font-body">
                    <span className="text-[#E5735D] font-mono font-semibold mr-1.5">Spoken:</span>
                    <span className="line-through decoration-[#E5735D] decoration-1 text-[#8C5850]">
                      “{item.user_original}”
                    </span>
                  </div>

                  {/* Natural Recast Correction */}
                  <div className="bg-[#F2F9F4] border border-[#D5EEDD] rounded-xl p-3">
                    <div className="flex items-start space-x-2">
                      <span className="material-symbols-outlined text-[#236B42] text-base mt-0.5">
                        check_circle
                      </span>
                      <div className="flex-1">
                        <p className="font-headline font-semibold text-[15.5px] text-[#236B42] leading-snug">
                          “{item.corrected_version}”
                        </p>
                        <div className="flex items-center space-x-2 mt-1.5 flex-wrap gap-y-1">
                          <span className="text-[12px] font-mono bg-[#E6F5EC] text-[#236B42] px-2 py-0.5 rounded font-medium border border-[#C8E6C9]">
                            {item.explanation}
                          </span>
                          <span className="text-[12px] font-mono text-[#8C857B]">
                            S: 3.8d · FSRS Good
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Audio Waveform Preview Button */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        aria-label="Play corrected pronunciation clip"
                        onClick={() => void handlePlayClinicAudio(item.id, item.corrected_version)}
                        className="w-11 h-11 rounded-full bg-[#1C202B] text-white flex items-center justify-center press-scale shadow-sm"
                      >
                        <span className="material-symbols-outlined text-base">
                          {playingClipId === item.id ? 'graphic_eq' : 'play_arrow'}
                        </span>
                      </button>
                      <div className="flex items-center space-x-0.5">
                        <span className="w-1 h-3 bg-[#58B37C] rounded-full animate-pulse" />
                        <span className="w-1 h-5 bg-[#58B37C] rounded-full" />
                        <span className="w-1 h-2 bg-[#58B37C] rounded-full" />
                        <span className="w-1 h-6 bg-[#58B37C] rounded-full" />
                        <span className="w-1 h-4 bg-[#C8E6C9] rounded-full" />
                        <span className="w-1 h-2.5 bg-[#C8E6C9] rounded-full" />
                        <span className="w-1 h-5 bg-[#C8E6C9] rounded-full" />
                        <span className="w-1 h-3 bg-[#C8E6C9] rounded-full" />
                      </div>
                      <span className="text-[12px] font-mono text-[#8C857B]">0.8s clip</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('07-voice-studio-lobby')}
                      className="tap-target-expand text-[12px] font-body font-medium text-[#5A554C] press-scale"
                    >
                      Repeat with Pip →
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </section>

        {/* 5. Section 'Moments Pip will remember' */}
        <section className="space-y-2.5 pt-2">
          <div className="flex items-baseline justify-between">
            <div>
              <h2 className="font-body font-bold text-base text-[#1C202B] tracking-tight">
                Moments Pip will remember
              </h2>
              <p className="text-xs text-[#8C857B] font-body">
                Extracted facts automatically compacted into persistent agent memory
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('13-memory-editor')}
              className="tap-target-expand text-xs font-semibold text-[#1C202B] flex-shrink-0 ml-2 press-scale"
            >
              See all →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => navigate('13-memory-editor')}
              className="bg-white rounded-2xl p-3.5 border border-[#EBE4D8] shadow-sm flex flex-col justify-between text-left press-scale"
            >
              <div>
                <div className="flex items-center space-x-1 text-[#F4B844] mb-2">
                  <span className="material-symbols-outlined text-sm fill-icon">bolt</span>
                  <span className="text-[12px] font-mono uppercase font-bold text-[#8C857B]">
                    Work Context
                  </span>
                </div>
                <p className="font-headline italic text-[13.5px] text-[#1C202B] leading-snug">
                  “Shipping the new payment webhook microservice next Friday.”
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-[#F2ECE1] flex items-center justify-between text-[12px] text-[#8C857B] font-mono w-full">
                <span>Today</span>
                <span className="text-emerald-700">Committed</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate('13-memory-editor')}
              className="bg-white rounded-2xl p-3.5 border border-[#EBE4D8] shadow-sm flex flex-col justify-between text-left press-scale"
            >
              <div>
                <div className="flex items-center space-x-1 text-[#6A9AE2] mb-2">
                  <span className="material-symbols-outlined text-sm fill-icon">psychology</span>
                  <span className="text-[12px] font-mono uppercase font-bold text-[#8C857B]">
                    Tech Profile
                  </span>
                </div>
                <p className="font-headline italic text-[13.5px] text-[#1C202B] leading-snug">
                  “Prefers deterministic Python harnesses over heavy frameworks.”
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-[#F2ECE1] flex items-center justify-between text-[12px] text-[#8C857B] font-mono w-full">
                <span>Nov 1</span>
                <span className="text-emerald-700">Permanent</span>
              </div>
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
