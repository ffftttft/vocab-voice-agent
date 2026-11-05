import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import { api } from '../lib/api'
import { useAppStore } from '../store/useAppStore'
import { StatusBar } from '../components/ShellComponents'

export default function FsrsSprintPage() {
  const currentScreen = useAppStore((s) => s.currentScreen)
  const navigate = useAppStore((s) => s.navigate)
  const cards = useAppStore((s) => s.cards)
  const currentCardIndex = useAppStore((s) => s.currentCardIndex)
  const selectedOption = useAppStore((s) => s.selectedOption)
  const autoAudio = useAppStore((s) => s.autoAudio)
  const setAutoAudio = useAppStore((s) => s.setAutoAudio)
  const confusableExpanded = useAppStore((s) => s.confusableExpanded)
  const setConfusableExpanded = useAppStore((s) => s.setConfusableExpanded)
  const submitCardChoice = useAppStore((s) => s.submitCardChoice)
  const overrideCardRating = useAppStore((s) => s.overrideCardRating)
  const nextSprintCard = useAppStore((s) => s.nextSprintCard)
  const plan = useAppStore((s) => s.plan)

  const card = cards[currentCardIndex] ?? cards[0]
  const doneCount = plan?.progress.done ?? 43
  const totalCount = plan?.progress.total ?? 120

  // Live response timer for 02-fsrs-sprint-question
  const [timerSec, setTimerSec] = useState(1.8)
  const [autoAdvancePaused, setAutoAdvancePaused] = useState(false)
  const [activeRating, setActiveRating] = useState<2 | 3 | 4>(4)
  const startTimeRef = useRef<number>(performance.now())

  useEffect(() => {
    if (currentScreen !== '02-fsrs-sprint-question') return
    setTimerSec(1.8)
    startTimeRef.current = performance.now()
    const id = window.setInterval(() => {
      setTimerSec((t) => (t < 29.9 ? Number((t + 0.1).toFixed(1)) : t))
    }, 100)
    return () => window.clearInterval(id)
  }, [currentScreen, currentCardIndex])

  const highlightTargetWord = (sentence: string, word: string, underlineColorClass: string) => {
    const regex = new RegExp(`(${word})`, 'ig')
    const parts = sentence.split(regex)
    return parts.map((part, i) =>
      part.toLowerCase() === word.toLowerCase() ? (
        <span key={i} className={underlineColorClass}>
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      ),
    )
  }

  // ============================================================================
  // SCREEN 02: FSRS SPRINT — QUESTION STATE
  // ============================================================================
  if (currentScreen === '02-fsrs-sprint-question') {
    return (
      <div className="h-[100dvh] max-h-[100dvh] w-full bg-[#F9F6F0] text-[#1C202B] flex flex-col justify-between px-4 pt-0 pb-3 overflow-hidden select-none sprint-shell">
        <div className="shrink-0">
          <StatusBar compact />

          {/* Top Header Bar: Close | Dual-segment Progress | Status Pills */}
          <nav className="w-full mt-1 mb-2 flex items-center justify-between gap-2 sprint-header">
            <button
              type="button"
              aria-label="Exit sprint"
              onClick={() => navigate('01-today-studio')}
              className="w-11 h-11 rounded-full bg-white shadow-sm border border-[#EAE3D6] flex items-center justify-center text-[#1C202B] press-scale-sm shrink-0"
            >
              <span className="material-symbols-outlined text-[19px]">close</span>
            </button>

            {/* Center: Dual Segment Progress Indicator */}
            <div className="flex-1 flex flex-col items-center px-1">
              <div className="flex items-center justify-between w-full mb-1 px-0.5">
                <div className="flex items-center gap-1 text-[11px] font-mono text-[#5A554C] tabular-nums">
                  <span className="font-semibold text-[#1C202B]">{doneCount}</span>
                  <span className="text-[#8C857B]">/</span>
                  <span className="text-[#8C857B]">{totalCount}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono font-medium">
                  <span className="text-[#6B5AED] flex items-center gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#9B8AFB]" />
                    14N
                  </span>
                  <span className="text-[#2B579A] flex items-center gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6A9AE2]" />
                    29R
                  </span>
                </div>
              </div>
              <div className="w-full h-[6px] bg-[#EAE3D5] rounded-full flex gap-1 p-[1px] overflow-hidden">
                <div className="h-full bg-[#9B8AFB] rounded-full" style={{ width: '32%' }} />
                <div className="h-full bg-[#6A9AE2] rounded-full" style={{ width: '24%' }} />
              </div>
            </div>

            {/* Right: Timer Pill & Audio Mode Pill */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div
                className="h-9 px-2.5 bg-[#FEF7EE] border border-[#FAD89A] rounded-full flex items-center gap-1 shadow-sm"
                title="Speed-to-grade timer"
              >
                <span className="material-symbols-outlined text-[15px] text-[#A66E14]">timer</span>
                <span className="font-mono text-[12px] font-semibold text-[#A66E14] tabular-nums">
                  {timerSec.toFixed(1)}s
                </span>
              </div>
              <button
                type="button"
                aria-label="Toggle auto audio"
                onClick={() => {
                  setAutoAudio(!autoAudio)
                  toast(autoAudio ? 'Auto Sentence Audio OFF' : 'Auto Sentence Audio ON (+600ms)')
                }}
                className="tap-target-expand h-9 px-2.5 bg-white border border-[#E5DECF] rounded-full flex items-center gap-1 text-[#1C202B] press-scale shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px] text-[#1C202B] fill-icon">
                  {autoAudio ? 'volume_up' : 'volume_off'}
                </span>
                <span className="text-[11px] font-body font-semibold tracking-tight text-[#1C202B]">
                  {autoAudio ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>
          </nav>
        </div>

        {/* Middle Content: Word Hero + Contextual Scenario Sentence */}
        <div className="flex-1 flex flex-col justify-center min-h-0 space-y-2.5">
          {/* 3. Word Hero Card (Draggable for tactile card feel) */}
          <motion.section
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.14}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', duration: 0.34, bounce: 0 }}
            className="bg-white rounded-[26px] p-4 shadow-[0_8px_24px_rgba(45,38,30,0.04)] border border-[#F0EAE1] flex flex-col relative sprint-hero-card"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-1.5">
                <span className="bg-[#F0EDFF] text-[#6B5AED] text-[10.5px] font-body font-semibold px-2.5 py-0.5 rounded-full tracking-wide">
                  {card.item_type === 'NEW' ? 'NEW WORD' : 'REVIEW'}
                </span>
                <span className="text-[11px] font-mono text-[#8C857B]">
                  {card.topic_tag ?? '#tech_architecture'}
                </span>
              </div>
              <div className="bg-[#FFF4D6] text-[#A66E14] text-[10.5px] font-body font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                <span className="material-symbols-outlined text-[13px] fill-icon">mic</span>
                <span>Tonight&apos;s Voice Target #1</span>
              </div>
            </div>

            <div className="text-center my-2 sprint-headword-wrap">
              <h1 className="font-headline font-semibold text-[40px] leading-tight text-[#1C202B] tracking-tight sprint-headword">
                {card.word}
              </h1>
            </div>

            <div className="flex items-center justify-center gap-3">
              <span className="font-mono font-medium text-[14px] text-[#5A554C]">
                US {card.phonetic_us ?? '/ˈdeprəkeɪt/'}
              </span>
              <button
                type="button"
                aria-label="Replay pronunciation"
                onClick={() => void api.playSpeech(card.word)}
                className="tap-target-expand h-8 pl-2.5 pr-3 bg-[#FFF8EB] border border-[#FAD89A] rounded-full flex items-center gap-2 text-[#A66E14] press-scale"
              >
                <div className="flex items-center gap-[2px] h-3.5 w-3 justify-center">
                  <span className="w-[2px] bg-[#F4B844] rounded-full wave-bar-gpu wave-bar-gpu-1" />
                  <span className="w-[2px] bg-[#F4B844] rounded-full wave-bar-gpu wave-bar-gpu-2" />
                  <span className="w-[2px] bg-[#F4B844] rounded-full wave-bar-gpu wave-bar-gpu-3" />
                  <span className="w-[2px] bg-[#F4B844] rounded-full wave-bar-gpu wave-bar-gpu-4" />
                </div>
                <span className="text-[11px] font-body font-semibold text-[#8A5A0A]">
                  Playing word audio...
                </span>
              </button>
            </div>
          </motion.section>

          {/* 4. Pip's Contextual Scenario Sentence Card */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', duration: 0.36, bounce: 0, delay: 0.04 }}
            className="bg-[#EFE6D5] rounded-[24px] p-3.5 border border-[#E3D9C6] flex flex-col relative shadow-xs sprint-sentence-card"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <img
                  alt="Pip companion avatar"
                  className="w-6 h-6 rounded-full object-cover ring-1 ring-white/70 shadow-2xs"
                  src="/assets/pip-avatar.png"
                />
                <span className="text-[10.5px] font-body font-bold text-[#6D6559] tracking-wider uppercase">
                  SCENARIO: LEGACY API MIGRATION
                </span>
              </div>
              <button
                type="button"
                onClick={() => void api.playSpeech(card.sentence_en ?? card.word)}
                className="tap-target-expand flex items-center gap-1 bg-white/80 text-[#7D7569] font-mono text-[10px] px-2.5 py-1 rounded-full press-scale border border-white/60"
              >
                <span className="material-symbols-outlined text-[12px]">headphones</span>
                <span>+600ms Sentence Audio</span>
              </button>
            </div>

            <p className="font-headline text-[16.5px] leading-[1.38] text-[#1C202B] my-0.5 font-normal sprint-sentence-en">
              &ldquo;
              {highlightTargetWord(
                card.sentence_en ??
                  "We plan to deprecate the legacy webhook endpoint before Friday's release so clients migrate cleanly.",
                card.word,
                'bg-[#FFF0C8] underline decoration-[#F4B844] decoration-2 underline-offset-4 font-medium px-1 rounded inline-block text-[#1C202B]',
              )}
              &rdquo;
            </p>

            <div className="mt-2 bg-white/65 backdrop-blur-sm rounded-xl py-1 px-2.5 flex items-center justify-center gap-1.5 text-[10.5px] font-body text-[#7A7265] border border-white/50">
              <span className="material-symbols-outlined text-[13px] text-[#8C857B]">lock</span>
              <span className="truncate">
                Chinese translation &amp; FSRS stability unlock after choosing
              </span>
            </div>
          </motion.section>
        </div>

        {/* 5. Bottom Thumb-Zone: 4 Same-POS Chinese Meaning Options */}
        <section className="flex flex-col justify-end shrink-0 pt-1">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#8C857B]">
              CHOOSE THE CORRECT MEANING (ALL SAME POS: {card.options[0]?.pos ?? 'v.'})
            </span>
            <span className="font-mono text-[10px] text-[#A8A195]">SINGLE CHOICE</span>
          </div>

          <div className="flex flex-col gap-1.5">
            {card.options.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => void submitCardChoice(opt.label, Math.round(timerSec * 1000))}
                className="sprint-option-btn press-scale group w-full h-[52px] min-h-[44px] rounded-[18px] bg-white border border-[#E6E0D4] flex items-center px-3.5 gap-3 cursor-pointer text-left"
              >
                <span className="w-7 h-7 shrink-0 rounded-full bg-[#F4EFE6] text-[#1C202B] font-bold text-xs flex items-center justify-center">
                  {opt.label}
                </span>
                <span className="font-body font-medium text-[13px] leading-snug text-[#1C202B] line-clamp-1">
                  <span className="font-semibold text-[#8C857B] mr-1">{opt.pos}</span>
                  {opt.text}
                </span>
              </button>
            ))}
          </div>

          {/* 6. Monospace Speed-to-Grade FSRS Footer */}
          <footer className="mt-2 pt-0.5 text-center select-none">
            <p className="font-mono text-[10px] text-[#8C857B] tracking-tight flex items-center justify-center gap-1.5 flex-wrap">
              <span>
                Answer &lt; 3.5s →{' '}
                <strong className="font-medium text-[#236B42]">Auto Easy (4)</strong>
              </span>
              <span className="text-[#D3CBC0]">|</span>
              <span>
                3.5–8s → <strong className="font-medium text-[#2B579A]">Good (3)</strong>
              </span>
              <span className="text-[#D3CBC0]">|</span>
              <span>
                &gt; 8s → <strong className="font-medium text-[#A83825]">Hard (2)</strong>
              </span>
            </p>
          </footer>
        </section>
      </div>
    )
  }

  // ============================================================================
  // SCREEN 03: FSRS SPRINT — CORRECT REVEAL STATE
  // ============================================================================
  if (currentScreen === '03-fsrs-sprint-reveal') {
    const defText =
      card.pos_defs?.[0]?.def ?? '弃用，淘汰（软件功能或旧接口）；对…表示不赞成'
    const defPos = card.pos_defs?.[0]?.pos ?? 'v.'

    return (
      <div
        onPointerDown={() => setAutoAdvancePaused(true)}
        className="h-[100dvh] max-h-[100dvh] w-full bg-[#F9F6F0] text-[#1C202B] flex flex-col justify-between overflow-hidden select-none sprint-shell"
      >
        <div className="px-4 pt-0 shrink-0">
          <StatusBar compact />

          {/* 1. Top Header Row */}
          <header className="flex items-center justify-between gap-2.5 pt-1 mb-1.5 sprint-header">
            <button
              type="button"
              aria-label="Exit Sprint"
              onClick={() => navigate('01-today-studio')}
              className="w-11 h-11 rounded-full bg-white border border-[#EBE4D8] flex items-center justify-center shadow-sm text-[#1C202B] press-scale-sm shrink-0"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>

            <div className="flex-1 px-1">
              <div className="flex items-center justify-between mb-1 px-0.5">
                <span className="font-mono text-[11px] font-bold text-stone-600 tracking-wide tabular-nums">
                  {doneCount} / {totalCount}
                </span>
                <span className="font-mono text-[10px] text-stone-400 font-medium">Card Sprint</span>
              </div>
              <div className="w-full h-2 bg-[#E9E3D5] rounded-full overflow-hidden p-[1px] flex">
                <div className="h-full bg-[#58B37C] rounded-full" style={{ width: '36%' }} />
              </div>
            </div>

            <div className="bg-[#E6F5EC] border border-[#BFE6CE] text-[#236B42] font-mono font-bold text-[11px] px-2.5 py-1.5 rounded-full flex items-center gap-1 shadow-sm shrink-0">
              <span className="material-symbols-outlined text-[14px] text-[#236B42]">bolt</span>
              <span>2.4s · Fast Recall!</span>
            </div>
          </header>
        </div>

        {/* Middle Content: Word Hero + Revealed Sentence + 4 Compact Options */}
        <div className="flex-1 px-4 flex flex-col justify-between min-h-0 space-y-1.5">
          {/* 2. Word Hero & Expanded Dictionary Card */}
          <motion.section
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', duration: 0.34, bounce: 0 }}
            className="bg-white rounded-[24px] p-3.5 border border-stone-200/60 shadow-sm relative overflow-hidden shrink-0 sprint-hero-card"
          >
            <div className="flex items-start justify-between gap-2 relative">
              <div>
                <div className="flex items-baseline gap-2">
                  <h1 className="font-serif font-medium text-[30px] leading-tight text-[#1C202B] tracking-tight sprint-headword">
                    {card.word}
                  </h1>
                  <button
                    type="button"
                    aria-label="Listen to pronunciation"
                    onClick={() => void api.playSpeech(card.word)}
                    className="tap-target-expand w-7 h-7 rounded-full bg-[#FCEFDA] text-[#9A6B1A] flex items-center justify-center press-scale-sm shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[15px]">volume_up</span>
                  </button>
                </div>
                <p className="font-mono text-[11.5px] text-stone-500 tracking-tight">
                  US {card.phonetic_us ?? '/ˈdeprəkeɪt/'}
                </p>
              </div>
              <div className="bg-[#FFF6E5] text-[#9A6B1A] border border-[#F4D086] text-[10.5px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-2xs shrink-0">
                <span className="material-symbols-outlined text-[13px] fill-icon">star</span>
                <span>Voice Target #1</span>
              </div>
            </div>

            {/* Expanded Dictionary Meaning */}
            <div className="mt-1.5 pt-1.5 border-t border-stone-100">
              <div className="flex items-start gap-2">
                <span className="bg-[#F4EFE6] text-stone-700 font-mono text-[9.5px] font-bold px-1.5 py-0.5 rounded uppercase mt-0.5 shrink-0">
                  DEF
                </span>
                <p className="font-sans text-[12.5px] leading-snug text-[#1C202B] font-medium line-clamp-1">
                  <span className="font-semibold text-stone-500">{defPos}</span> {defText}
                </p>
              </div>
            </div>

            {/* Collocation Chips Row (Hidden on ultra-compact height to keep 100dvh 0-scroll) */}
            <div className="flex flex-wrap gap-1.5 mt-2 sprint-hide-compact">
              {(
                card.collocations ?? [
                  'deprecate an API',
                  'deprecation warning',
                  'formally deprecate',
                ]
              ).map((col) => (
                <span
                  key={col}
                  className="bg-[#F4EFE6] text-[#4A453D] text-[10.5px] font-medium px-2 py-0.5 rounded-lg border border-[#E5DDD0]"
                >
                  {col}
                </span>
              ))}
            </div>

            {/* FSRS Memory Telemetry Bar */}
            <div className="bg-[#EBF2FC] text-[#2B579A] border border-[#BED7F7] font-mono text-[10px] px-2.5 py-1 rounded-xl mt-1.5 flex items-center justify-between flex-wrap gap-y-0.5 tabular-nums sprint-hide-compact">
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px] text-[#2B579A]">
                  monitoring
                </span>
                <span className="font-bold">FSRS: Learning → Review</span>
              </div>
              <div className="tracking-tighter">
                <span>
                  S: 1.8d → <strong className="font-semibold text-emerald-800">11.4d</strong>
                </span>
                <span className="mx-1 text-[#9BBBE8]">·</span>
                <span>D: 4.6</span>
                <span className="mx-1 text-[#9BBBE8]">·</span>
                <span>R: 90%</span>
              </div>
            </div>
          </motion.section>

          {/* 3. Contextual Scenario Sentence Card (Revealed Translation) */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', duration: 0.36, bounce: 0, delay: 0.04 }}
            className="bg-[#EFE6D5] rounded-2xl p-3 border border-[#E2D8C3] shadow-2xs relative sprint-sentence-card"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <img
                  alt="Companion Pip"
                  className="w-5 h-5 rounded-full object-cover ring-1 ring-white/80 shadow-2xs"
                  src="/assets/pip-avatar.png"
                />
                <span className="font-mono text-[9.5px] tracking-wider text-stone-600 font-bold uppercase">
                  SCENARIO: LEGACY API MIGRATION
                </span>
              </div>
              <button
                type="button"
                aria-label="Replay Sentence Audio"
                onClick={() => void api.playSpeech(card.sentence_en ?? card.word)}
                className="tap-target-expand w-7 h-7 rounded-full bg-white/75 text-stone-600 flex items-center justify-center press-scale-sm shadow-2xs"
              >
                <span className="material-symbols-outlined text-[14px]">replay</span>
              </button>
            </div>
            <p className="font-serif text-[14.5px] leading-snug text-[#1C202B] mt-1.5 sprint-sentence-en">
              &ldquo;
              {highlightTargetWord(
                card.sentence_en ??
                  "We plan to deprecate the legacy webhook endpoint before Friday's release so clients migrate cleanly.",
                card.word,
                'underline decoration-amber-400 decoration-2 font-semibold',
              )}
              &rdquo;
            </p>
            <div className="border-t border-dashed border-[#DACFBA] my-1.5" />
            <p className="font-sans text-[12.5px] leading-snug text-[#4A453C] font-normal sprint-sentence-zh">
              “
              {card.sentence_zh ??
                '我们计划在周五发布前弃用旧版 Webhook 端点，以便客户端平滑迁移。'}
              ”
            </p>
          </motion.section>

          {/* 4. Compact 4 Options List */}
          <section className="space-y-1">
            {card.options.map((opt) => {
              const isCorrect = opt.label === 'B'
              if (isCorrect) {
                return (
                  <div
                    key={opt.label}
                    className="sprint-option-compact bg-[#E6F5EC] border-2 border-[#58B37C] text-[#1E5E3A] font-medium rounded-xl px-3 py-1.5 flex items-center justify-between shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-5 h-5 rounded-full bg-[#1E5E3A] text-white font-mono text-[10.5px] font-bold flex items-center justify-center shrink-0">
                        {opt.label}
                      </div>
                      <span className="font-sans text-[12.5px] font-semibold tracking-tight text-[#1E5E3A] truncate">
                        {opt.pos} {opt.text}
                      </span>
                    </div>
                    <div className="bg-[#58B37C] text-white text-[10px] font-bold font-sans px-2 py-0.5 rounded-full flex items-center gap-0.5 shrink-0 ml-1">
                      <span className="material-symbols-outlined text-[12px]">check</span>
                      <span>Correct ✓</span>
                    </div>
                  </div>
                )
              }
              return (
                <div
                  key={opt.label}
                  className="sprint-option-compact opacity-45 border border-stone-200 bg-white/75 rounded-xl px-3 py-1.5 flex items-center gap-2.5 text-stone-400 text-xs"
                >
                  <div className="w-5 h-5 rounded-full border border-stone-300 font-mono text-[10px] font-semibold flex items-center justify-center shrink-0">
                    {opt.label}
                  </div>
                  <span className="font-sans text-[12px] leading-none truncate">
                    {opt.pos} {opt.text}
                  </span>
                </div>
              )
            })}
          </section>
        </div>

        {/* 5. Bottom Floating FSRS Auto-Rating & Manual Override Dock */}
        <div className="w-full bg-white rounded-t-3xl px-4 pt-2.5 pb-3 shadow-[0_-8px_30px_rgba(28,32,43,0.08)] border-t border-stone-200/70 z-20 shrink-0 sprint-dock">
          {/* Auto-Rating Countdown Alert */}
          <div className="bg-[#EAF7EE] text-[#236B42] border border-[#BCE7CB] font-mono text-[10px] font-semibold py-1 px-2.5 rounded-full flex items-center justify-between gap-2 whitespace-nowrap">
            <div className="flex items-center gap-1 shrink-0">
              <span className="material-symbols-outlined text-[13px] text-[#236B42]">
                progress_activity
              </span>
              <span>Answered in 2.4s (&lt;3.5s)</span>
            </div>
            <span className="font-bold text-[#1E5E3A] truncate">
              {autoAdvancePaused ? 'Timer paused · Choose grade' : 'Auto-rating Easy (4) in 1.2s...'}
            </span>
          </div>

          {/* Three Side-by-Side Manual Override Buttons (all >= 44px height) */}
          <div className="flex items-center gap-2 my-2">
            <button
              type="button"
              onClick={() => {
                setActiveRating(2)
                void overrideCardRating(2)
              }}
              className={`flex-1 min-h-[44px] text-[11.5px] font-semibold py-2 rounded-xl border text-center press-scale ${
                activeRating === 2
                  ? 'bg-[#E6F5EC] border-2 border-[#58B37C] text-[#1E5E3A] font-bold'
                  : 'bg-[#F4F0E8] text-[#5C5549] border-[#E3DCCE]'
              }`}
            >
              Hard · 模糊 <span className="font-mono text-[10px] text-stone-500">(2d)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveRating(3)
                void overrideCardRating(3)
              }}
              className={`flex-1 min-h-[44px] text-[11.5px] font-semibold py-2 rounded-xl border text-center press-scale ${
                activeRating === 3
                  ? 'bg-[#E6F5EC] border-2 border-[#58B37C] text-[#1E5E3A] font-bold'
                  : 'bg-[#F4F0E8] text-[#5C5549] border-[#E3DCCE]'
              }`}
            >
              Good · 良好 <span className="font-mono text-[10px] text-stone-500">(5d)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveRating(4)
                void overrideCardRating(4)
              }}
              className={`flex-1 min-h-[44px] text-[11.5px] py-2 rounded-xl text-center shadow-2xs press-scale ${
                activeRating === 4
                  ? 'bg-[#E6F5EC] border-2 border-[#58B37C] text-[#1E5E3A] font-bold'
                  : 'bg-[#F4F0E8] text-[#5C5549] border border-[#E3DCCE] font-semibold'
              }`}
            >
              Easy · 秒杀 <span className="font-mono text-[10px] text-emerald-700">(11d)</span>
            </button>
          </div>

          {/* Full-Width Primary Pill Action Button */}
          <button
            type="button"
            aria-label="Proceed to Next Word"
            onClick={() => nextSprintCard()}
            className="sprint-cta-btn w-full h-11 min-h-[44px] bg-[#1C202B] text-white rounded-full font-sans font-semibold text-sm flex items-center justify-center gap-2 shadow-md press-scale"
          >
            <span>Next Word</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>
    )
  }

  // ============================================================================
  // SCREEN 04: FSRS SPRINT — WRONG ANSWER & REQUEUE STATE
  // ============================================================================
  const wrongLabel = selectedOption && selectedOption !== 'B' ? selectedOption : 'C'

  return (
    <motion.div
      initial={{ x: 0 }}
      animate={{ x: [0, -7, 7, -4, 4, 0] }}
      transition={{ duration: 0.34 }}
      className="h-[100dvh] max-h-[100dvh] w-full bg-[#F9F6F0] text-[#1C202B] flex flex-col justify-between overflow-hidden select-none relative sprint-shell"
    >
      {/* Top Header & Requeue Banner */}
      <div className="px-4 pt-0 shrink-0">
        <StatusBar compact />

        <div className="space-y-1.5 mt-1 mb-1.5 sprint-header">
          <div className="flex items-center justify-between gap-2.5">
            <button
              type="button"
              aria-label="Exit sprint"
              onClick={() => navigate('01-today-studio')}
              className="w-11 h-11 rounded-full bg-white/90 border border-stone-200/90 flex items-center justify-center text-stone-600 shadow-sm press-scale-sm shrink-0"
            >
              <span className="material-symbols-outlined text-[19px]">close</span>
            </button>

            <div className="flex-1 px-1">
              <div className="flex items-center justify-between mb-1 text-[11px] font-semibold text-stone-500 font-label">
                <span className="tracking-wide">Sprint Progress</span>
                <span className="font-mono text-stone-700 text-[11px] tabular-nums">
                  {doneCount} / {totalCount}
                </span>
              </div>
              <div className="w-full h-1.5 bg-stone-200/70 rounded-full overflow-hidden flex">
                <div className="h-full bg-emerald-500 rounded-l-full" style={{ width: '32%' }} />
                <div className="h-full bg-[#E5735D]" style={{ width: '4%' }} />
              </div>
            </div>

            <div className="shrink-0 bg-[#FCECE8] border border-[#E5735D]/40 text-[#A83825] px-2.5 py-1 rounded-full text-[10.5px] font-mono font-semibold flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px] text-[#A83825]">
                sync_problem
              </span>
              <span>Requeue #1</span>
            </div>
          </div>

          {/* Requeue Lock Banner */}
          <div className="bg-[#FCECE8] border-[1.5px] border-[#E5735D] text-[#A83825] rounded-2xl py-1.5 px-3 flex items-center gap-2 shadow-[0_2px_8px_rgba(229,115,93,0.12)]">
            <span className="material-symbols-outlined text-[16px] text-[#A83825] fill-icon shrink-0">
              error
            </span>
            <p className="text-[11px] leading-[15px] font-medium tracking-tight">
              <span className="font-bold">Locked as Again (Rating 1)</span> • Pushed to end of
              today&apos;s queue (<span className="font-mono font-semibold">#120</span>) until
              answered correctly.
            </p>
          </div>
        </div>
      </div>

      {/* Middle Content: Word Hero + Sentence + 4 Options Comparison */}
      <div className="flex-1 px-4 flex flex-col justify-between min-h-0 space-y-1.5">
        {/* Section 2: Word Hero & Confusable Contrast Card */}
        <section className="bg-white rounded-[24px] p-3.5 shadow-[0_4px_20px_rgba(45,38,30,0.05)] border border-stone-200/70 sprint-hero-card">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <div className="flex items-baseline gap-2">
                <h1 className="font-headline italic text-[30px] leading-tight font-medium text-[#1C202B] tracking-tight sprint-headword">
                  {card.word}
                </h1>
                <span className="font-mono text-stone-500 text-[12px] tracking-tight">
                  {card.phonetic_us ?? '/ˈdeprəkeɪt/'}
                </span>
                <span className="text-[10px] font-semibold bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded uppercase font-label">
                  verb
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void api.playSpeech(card.word)}
              className="tap-target-expand bg-[#F4F0E8] border border-stone-200/60 rounded-full px-2.5 py-1 flex items-center gap-1.5 text-stone-700 shadow-2xs shrink-0 press-scale"
            >
              <div className="flex items-center gap-0.5 h-3 px-0.5">
                <span className="w-[2px] bg-[#E5735D] rounded-full wave-bar-gpu wave-bar-gpu-1" />
                <span className="w-[2px] bg-[#E5735D] rounded-full wave-bar-gpu wave-bar-gpu-2" />
                <span className="w-[2px] bg-[#E5735D] rounded-full wave-bar-gpu wave-bar-gpu-3" />
                <span className="w-[2px] bg-[#E5735D] rounded-full wave-bar-gpu wave-bar-gpu-4" />
              </div>
              <span className="text-[10px] font-medium text-stone-600">Replaying...</span>
            </button>
          </div>

          <div className="mt-1 pb-1.5 border-b border-stone-100 flex items-center justify-between gap-2">
            <p className="text-[12px] leading-snug font-medium text-stone-800 truncate">
              <span className="font-semibold text-stone-500 font-mono text-[10.5px] mr-1">
                DEF:
              </span>
              v. 弃用，淘汰（软件接口或旧功能）；对…表示不赞成
            </p>
            {/* Compact Expandable Trigger for Small Screens (375x667) */}
            <button
              type="button"
              onClick={() => setConfusableExpanded(!confusableExpanded)}
              className="tap-target-expand shrink-0 bg-[#FFF8E6] border border-amber-300 text-amber-950 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5 press-scale"
            >
              <span>辨析 Note</span>
              <span className="material-symbols-outlined text-[12px]">
                {confusableExpanded ? 'expand_less' : 'expand_more'}
              </span>
            </button>
          </div>

          {/* Pip's Confusable Note (Full box on tall screens, popover when tapped on compact screens) */}
          <div className="bg-[#FFF8E6] border border-amber-200/90 rounded-[14px] p-2 my-1.5 sprint-hide-compact">
            <div className="flex items-center gap-1.5 mb-0.5">
              <img
                alt="Pip"
                className="w-5 h-5 rounded-full object-cover ring-1 ring-amber-300 shrink-0"
                src="/assets/pip-avatar.png"
              />
              <span className="font-bold text-[11px] text-amber-950 font-body">
                Pip&apos;s Confusable Note (形近词辨析)
              </span>
            </div>
            <p className="text-[11px] leading-snug text-amber-950/90">
              Do not confuse <strong className="font-semibold text-[#1C202B]">&ldquo;deprecate&rdquo;</strong>{' '}
              (<span className="font-mono text-[10px]">/ˈdeprəkeɪt/</span>, v. 弃用) with{' '}
              <strong className="font-semibold text-[#1C202B]">&ldquo;depreciate&rdquo;</strong> (v.
              折旧/贬值) or <strong className="font-semibold text-[#1C202B]">&ldquo;degrade&rdquo;</strong>{' '}
              (v. 降级).
            </p>
          </div>

          <div className="font-mono text-[10px] text-[#A83825] bg-[#FCECE8]/70 border border-[#E5735D]/30 rounded-xl px-2.5 py-1 mt-1 flex items-center justify-between tracking-tight tabular-nums">
            <span className="font-medium">Lapses: 1 → 2</span>
            <span className="text-stone-300">|</span>
            <span className="font-medium">Stability Reset S: 0.4d</span>
            <span className="text-stone-300">|</span>
            <span className="font-semibold uppercase tracking-wider text-[9.5px]">
              State: Relearning
            </span>
          </div>
        </section>

        {/* Section 3: Contextual Scenario Sentence Card - Fully Revealed */}
        <section className="bg-[#EFE6D5] rounded-[20px] p-3 border border-[#E2D8C3] shadow-2xs sprint-sentence-card">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <img
                alt="Pip"
                className="w-[18px] h-[18px] rounded-full object-cover shrink-0"
                src="/assets/pip-avatar.png"
              />
              <span className="font-label font-bold text-[9.5px] tracking-wider text-stone-700 uppercase">
                Scenario: Legacy API Migration
              </span>
            </div>
            <button
              type="button"
              onClick={() => void api.playSpeech(card.sentence_en ?? card.word)}
              className="tap-target-expand flex items-center gap-1 text-[10.5px] font-semibold text-stone-700 bg-white/70 px-2 py-0.5 rounded-full press-scale"
            >
              <span className="material-symbols-outlined text-[13px]">volume_up</span>
              <span>Listen</span>
            </button>
          </div>

          <blockquote className="font-headline italic text-[14px] leading-snug text-[#1C202B] mb-1 font-normal sprint-sentence-en">
            “We plan to{' '}
            <span className="underline decoration-[#E5735D] decoration-2 underline-offset-2 font-medium not-italic text-[#1C202B]">
              deprecate
            </span>{' '}
            the legacy webhook endpoint before Friday&apos;s release so clients migrate cleanly.”
          </blockquote>

          <div className="pt-1 border-t border-stone-300/60 sprint-sentence-zh">
            <p className="text-[11.5px] leading-snug text-stone-700 font-medium">
              “我们计划在周五发布前弃用旧版 Webhook 端点，以便客户端平滑迁移。”
            </p>
          </div>
        </section>

        {/* Section 4: Compact 4 Options Comparison */}
        <section className="space-y-1">
          {card.options.map((opt) => {
            const isCorrect = opt.label === 'B'
            const isWrongChoice = opt.label === wrongLabel
            if (isCorrect) {
              return (
                <div
                  key={opt.label}
                  className="sprint-option-compact bg-[#E6F5EC] border-2 border-[#58B37C] rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[#1B4A2F] flex items-center justify-between shadow-2xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[11px] font-bold text-[#236B42] w-4 shrink-0">
                      {opt.label}
                    </span>
                    <span className="truncate">
                      {opt.pos} {opt.text}
                    </span>
                  </div>
                  <span className="bg-[#58B37C] text-white text-[9.5px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 shrink-0 ml-1">
                    <span className="material-symbols-outlined text-[11px]">check</span>
                    <span>Correct Meaning</span>
                  </span>
                </div>
              )
            }
            if (isWrongChoice) {
              return (
                <div
                  key={opt.label}
                  className="sprint-option-compact bg-[#FCECE8] border-2 border-[#E5735D] rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[#732617] flex items-center justify-between shadow-2xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[11px] font-bold text-[#A83825] w-4 shrink-0">
                      {opt.label}
                    </span>
                    <span className="truncate">
                      {opt.pos} {opt.text}
                    </span>
                  </div>
                  <span className="bg-[#E5735D] text-white text-[9.5px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 shrink-0 ml-1">
                    <span className="material-symbols-outlined text-[11px]">close</span>
                    <span>Your Choice</span>
                  </span>
                </div>
              )
            }
            return (
              <div
                key={opt.label}
                className="sprint-option-compact opacity-40 bg-white border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs text-stone-500 flex items-center justify-between select-none"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[11px] font-semibold text-stone-400 w-4 shrink-0">
                    {opt.label}
                  </span>
                  <span className="truncate">
                    {opt.pos} {opt.text}
                  </span>
                </div>
              </div>
            )
          })}
        </section>
      </div>

      {/* Expandable Confusable Note Popover for Compact Screens (e.g. 375x667 iPhone SE) */}
      <AnimatePresence>
        {confusableExpanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', duration: 0.28, bounce: 0 }}
            onClick={() => setConfusableExpanded(false)}
            className="absolute inset-x-4 top-28 z-40 bg-[#FFF8E6] border-2 border-[#F4B844] rounded-2xl p-3.5 shadow-xl"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <img
                  alt="Pip"
                  className="w-6 h-6 rounded-full object-cover"
                  src="/assets/pip-avatar.png"
                />
                <span className="font-bold text-xs text-amber-950">
                  Pip&apos;s Confusable Note (形近词辨析)
                </span>
              </div>
              <span className="material-symbols-outlined text-[16px] text-amber-900">close</span>
            </div>
            <p className="text-xs leading-relaxed text-amber-950">
              Do not confuse <strong>&ldquo;deprecate&rdquo;</strong> (/ˈdeprəkeɪt/, v. 弃用) with{' '}
              <strong>&ldquo;depreciate&rdquo;</strong> (/dɪˈpriːʃieɪt/, v. 折旧/贬值) or{' '}
              <strong>&ldquo;degrade&rdquo;</strong> (v. 降级).
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Section 5: Bottom Forced Review Dock */}
      <div className="pt-1.5 pb-3 px-4 bg-[#F9F6F0] z-30 flex flex-col items-center shrink-0 sprint-dock">
        <p className="text-[10.5px] text-stone-400 font-medium mb-1.5 tracking-tight text-center sprint-hide-compact">
          Manual rating override is disabled on wrong answers (FSRS Again = 1 locked).
        </p>
        <button
          type="button"
          onClick={() => nextSprintCard()}
          className="sprint-cta-btn w-full bg-[#1C202B] text-white h-[48px] min-h-[44px] rounded-full font-semibold text-[14px] flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(28,32,43,0.22)] press-scale"
        >
          <span>Got It • Re-Queue for Later</span>
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </div>
    </motion.div>
  )
}
