import { useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { api } from '../lib/api'
import { useAppStore } from '../store/useAppStore'
import { AnimatedNumber, StatusBar } from '../components/ShellComponents'

const WEEK_RHYTHM = [
  { day: 'M', emoji: '🌱', bg: 'bg-[#CDE8D6]', summary: 'Mon · 120/120 cards · 94% R' },
  { day: 'T', emoji: '💧', bg: 'bg-[#D2E0F8]', summary: 'Tue · 115/115 cards · 92% R' },
  {
    day: 'W',
    emoji: '⚡',
    bg: 'bg-[#FCECE8] border border-[#E5735D]/40',
    textClass: 'text-[#A83825]',
    summary: 'Wed · 3 pronunciation recasts logged in Episode 12',
  },
  { day: 'T', emoji: '✨', bg: 'bg-[#E7DEFC]', summary: 'Thu · 18 proactive words bloomed' },
  { day: 'F', emoji: '🌸', bg: 'bg-[#FCDED2]', summary: 'Fri · Zero lapses in FSRS Sprint' },
  { day: 'S', emoji: '🍯', bg: 'bg-[#FCE5B4]', summary: 'Sat · 25m architecture roleplay completed' },
]

export default function TodayStudioPage() {
  const navigate = useAppStore((s) => s.navigate)
  const plan = useAppStore((s) => s.plan)
  const uiStateMode = useAppStore((s) => s.uiStateMode)
  const setUiStateMode = useAppStore((s) => s.setUiStateMode)
  const regenerateDailyPlan = useAppStore((s) => s.regenerateDailyPlan)
  const [modePill, setModePill] = useState<'sprint' | 'voice'>('sprint')
  const [playingWord, setPlayingWord] = useState<string | null>(null)

  const doneCount =
    uiStateMode === 'voice_ready' || uiStateMode === 'completed'
      ? 120
      : (plan?.progress.done ?? 42)
  const totalCount = plan?.progress.total ?? 120
  const remainingCount = Math.max(0, totalCount - doneCount)
  const newDone =
    uiStateMode === 'voice_ready' || uiStateMode === 'completed'
      ? 30
      : (plan?.progress.new.done ?? 14)
  const newTotal = plan?.progress.new.total ?? 30
  const revDone =
    uiStateMode === 'voice_ready' || uiStateMode === 'completed'
      ? 90
      : (plan?.progress.review.done ?? 28)
  const revTotal = plan?.progress.review.total ?? 90

  async function handlePlayWord(word: string, sentence: string) {
    setPlayingWord(word)
    toast(`Playing "${word}"`, { description: sentence })
    await api.playSpeech(word)
    setPlayingWord(null)
  }

  return (
    <div className="flex-1 flex flex-col bg-[#F9F6F0] text-[#1C202B] min-h-[100dvh]">
      <StatusBar />

      {/* Top Navigation Anchor */}
      <div className="flex justify-between items-center w-full px-6 pt-2 pb-1.5 max-w-md mx-auto">
        <button
          type="button"
          onClick={() => navigate('12-memory-journal')}
          className="flex items-center gap-2 press-scale tap-target-44"
        >
          <div className="relative w-8 h-8 rounded-full overflow-hidden border border-[#EBE4D8] shadow-sm">
            <img
              alt="Pip"
              className="w-full h-full object-cover"
              src="/assets/pip-avatar.png"
            />
            <div className="absolute inset-0 ring-1 ring-inset ring-amber-300/40 rounded-full" />
          </div>
          <span className="font-headline italic text-2xl font-normal text-[#1C202B]">Today</span>
        </button>

        <button
          type="button"
          aria-label="Open Engine & Router Settings"
          onClick={() => navigate('14-engine-router')}
          className="w-11 h-11 rounded-full flex items-center justify-center text-[#1C202B] press-scale-sm"
        >
          <span className="material-symbols-outlined text-[22px]">tune</span>
        </button>
      </div>

      {/* Scrollable Content Canvas */}
      <div className="flex-1 overflow-y-auto px-5 pt-1 pb-28 space-y-4 no-scrollbar">
        {/* 1. Header Row & Streak Row */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', duration: 0.36, bounce: 0 }}
          className="flex items-end justify-between pt-0.5"
        >
          <div>
            <span className="text-[12px] font-medium text-[#8C857B] tracking-wide block">
              Nov 4 · Episode 14
            </span>
            <h1 className="font-headline text-[32px] leading-tight text-[#1C202B] font-medium tracking-tight">
              Today Studio
            </h1>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {/* Segmented Pill Track */}
            <div className="bg-[#EFECE4] p-0.5 rounded-full flex items-center border border-[#E5DFCE]/60">
              <button
                type="button"
                onClick={() => setModePill('sprint')}
                className={`text-[11px] px-2.5 py-1 rounded-full press-scale ${
                  modePill === 'sprint'
                    ? 'bg-white text-[#1C202B] font-semibold shadow-sm'
                    : 'text-[#78716C] font-medium'
                }`}
              >
                Sprint
              </button>
              <button
                type="button"
                onClick={() => {
                  setModePill('voice')
                  navigate('07-voice-studio-lobby')
                }}
                className={`text-[11px] px-2.5 py-1 rounded-full press-scale ${
                  modePill === 'voice'
                    ? 'bg-white text-[#1C202B] font-semibold shadow-sm'
                    : 'text-[#78716C] font-medium'
                }`}
              >
                Voice
              </button>
            </div>
            {/* Honey Gold Streak Badge */}
            <button
              type="button"
              onClick={() =>
                toast('12-Day Streak · 91.4% FSRS Retention', {
                  description: 'Next milestone: 14-day Golden Sunflower badge.',
                })
              }
              className="bg-[#FFF4D6] text-[#B87A04] border border-[#F4E1A6]/80 text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs press-scale"
            >
              <span className="material-symbols-outlined text-[13px] fill-icon text-[#F4B844]">
                local_fire_department
              </span>
              <span>12d streak · 91% R</span>
            </button>
          </div>
        </motion.div>

        {/* Optional UX State Overrides (Loading / Empty / Error from ux.md §5) */}
        {uiStateMode === 'loading' && (
          <motion.section
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#EFE6D5] rounded-[28px] p-5 border border-[#E2D7C1] space-y-3"
          >
            <div className="flex items-center gap-3">
              <img
                src="/assets/pip-avatar.png"
                alt="Pip"
                className="w-11 h-11 rounded-full object-cover border border-white animate-pulse"
              />
              <div>
                <div className="text-[14px] font-semibold text-[#1C202B]">
                  Pip is crafting today’s scenario...
                </div>
                <div className="text-[11px] font-mono text-[#7A7265]">
                  Clustering 90 due reviews + 30 new words (est. 8s)
                </div>
              </div>
            </div>
            <div className="h-5 rounded-full skeleton-shimmer w-3/4" />
            <div className="h-14 rounded-2xl skeleton-shimmer w-full" />
            <button
              type="button"
              onClick={() => setUiStateMode('default')}
              className="w-full py-2.5 rounded-full bg-[#1C202B] text-white text-xs font-semibold press-scale"
            >
              Finish Generation Now
            </button>
          </motion.section>
        )}

        {uiStateMode === 'empty' && (
          <motion.section
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#EFE6D5] rounded-[28px] p-5 border border-[#E2D7C1] text-center space-y-3"
          >
            <img
              src="/assets/pip-avatar.png"
              alt="Pip"
              className="w-14 h-14 rounded-full object-cover mx-auto border-2 border-white shadow-sm"
            />
            <h2 className="font-headline text-[21px] font-semibold text-[#1C202B]">
              Welcome! Let’s plant your first wordbook
            </h2>
            <p className="text-xs text-[#5A554C] leading-relaxed">
              Import a JSON or CSV vocabulary deck so Pip can cluster your daily 120-word scenario.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate('06-wordbooks-tagging')}
                className="flex-1 py-3 rounded-full bg-[#1C202B] text-white text-xs font-semibold press-scale"
              >
                Import First Wordbook (.json / .csv) →
              </button>
              <button
                type="button"
                onClick={() => setUiStateMode('default')}
                className="px-4 py-3 rounded-full bg-white text-[#1C202B] text-xs font-semibold border border-[#DCD3C0] press-scale"
              >
                Demo
              </button>
            </div>
          </motion.section>
        )}

        {uiStateMode === 'error' && (
          <motion.section
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#FCECE8] rounded-[24px] p-4 border-[1.5px] border-[#E5735D] text-[#A83825] space-y-2.5"
          >
            <div className="flex items-center gap-2 font-semibold text-xs">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>Daily Planner LLM Connection Timeout</span>
            </div>
            <p className="text-[11.5px] leading-relaxed">
              Could not reach Stage 2 Text LLM endpoint. Check your API key in Engine Router or
              retry generation.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setUiStateMode('default')
                  void regenerateDailyPlan()
                }}
                className="px-4 py-2 rounded-full bg-[#1C202B] text-white text-xs font-semibold press-scale"
              >
                Retry Generation
              </button>
              <button
                type="button"
                onClick={() => navigate('14-engine-router')}
                className="px-4 py-2 rounded-full bg-white text-[#1C202B] text-xs font-semibold border border-[#E5735D]/40 press-scale"
              >
                Configure Model Router
              </button>
            </div>
          </motion.section>
        )}

        {/* 2. Weekly Vocal & Memory Rhythm Card */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', duration: 0.38, bounce: 0, delay: 0.04 }}
          className="bg-white rounded-[28px] p-4.5 border border-[#EBE4D8] shadow-[0_8px_24px_rgba(28,32,43,0.03)] hover-lift"
        >
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] text-[#8C857B] font-semibold tracking-wider uppercase font-mono">
              Oct 29 – Nov 4
            </span>
            <span className="text-[11px] font-mono text-[#58B37C] font-semibold bg-[#E6F5EC] px-2 py-0.5 rounded-full">
              Weekly Target 95%
            </span>
          </div>
          <h2 className="text-[17px] font-semibold text-[#1C202B] tracking-tight leading-snug mb-3">
            Six days in flow, one tricky Wednesday
          </h2>
          {/* 7-Day Mascot Mood Rhythm Row */}
          <div className="flex justify-between items-center px-1 pt-1 pb-1">
            {WEEK_RHYTHM.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  toast(item.summary)
                  if (item.day === 'W') navigate('12-memory-journal')
                }}
                className="flex flex-col items-center gap-1 press-scale-sm min-w-[38px] min-h-[44px]"
              >
                <div
                  className={`w-8 h-8 rounded-full ${item.bg} flex items-center justify-center text-xs shadow-inner`}
                >
                  <span className="text-sm">{item.emoji}</span>
                </div>
                <span className={`text-[11px] font-medium ${item.textClass ?? 'text-[#78716C]'}`}>
                  {item.day}
                </span>
              </button>
            ))}
            {/* Sunday (Today - Active Glowing Ring) */}
            <button
              type="button"
              onClick={() => toast('Sunday (Today) · Episode 14 in progress')}
              className="flex flex-col items-center gap-1 relative press-scale-sm min-w-[40px] min-h-[44px]"
            >
              <div className="w-9 h-9 rounded-full bg-[#FFF4D6] ring-2 ring-[#F4B844] ring-offset-2 flex items-center justify-center shadow-sm">
                <span className="text-base">☀️</span>
              </div>
              <span className="text-[11px] font-bold text-[#1C202B]">S</span>
              <span className="w-1 h-1 rounded-full bg-[#F4B844] -mt-0.5" />
            </button>
          </div>
        </motion.section>

        {/* 3. Featured Companion Briefing Card (Champagne Sand) */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', duration: 0.4, bounce: 0, delay: 0.08 }}
          className="bg-[#EFE6D5] rounded-[28px] p-5 border border-[#E2D7C1] shadow-[0_8px_20px_rgba(45,38,30,0.05)] relative overflow-hidden"
        >
          <div className="flex items-center gap-3">
            <div className="relative w-11 h-11 rounded-full overflow-hidden border border-white/80 shadow-sm flex-shrink-0">
              <img
                alt="Pip avatar"
                className="w-full h-full object-cover"
                src="/assets/pip-avatar.png"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-[15px] font-semibold text-[#1C202B]">A briefing from Pip</h3>
                <span className="w-2 h-2 rounded-full bg-[#58B37C]" />
              </div>
              <p className="text-[11px] text-[#7A7265] leading-tight mt-0.5 font-medium">
                Tailored to your Payment Microservice &amp; Agent profile
              </p>
            </div>
          </div>

          {/* Scenario Pill Badge */}
          <div className="mt-3.5 mb-2.5">
            <span className="bg-[#E2D7C1]/90 text-[#3B352B] text-[11px] font-mono font-medium px-3 py-1 rounded-full inline-flex items-center gap-1 border border-[#D5C9B0]">
              <span className="material-symbols-outlined text-[13px]">terminal</span>
              <span>
                {plan?.scenario_title ?? 'Episode 14: Production Post-Mortem & API Deprecation'}
              </span>
            </span>
          </div>

          {/* Editorial Serif Quote */}
          <p className="font-headline italic text-[19px] leading-snug text-[#1C202B] my-3">
            “Dear Alex, today we are prepping for Friday’s architecture sync. Let’s anchor 30 new
            engineering terms and 90 due reviews before our 25-minute live call tonight.”
          </p>

          {/* Progress Line */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#5E574B] mb-4 bg-white/40 px-3 py-1.5 rounded-xl border border-white/40 tabular-nums">
            <span className="material-symbols-outlined text-[14px] text-[#2B579A]">monitoring</span>
            <span>
              <AnimatedNumber value={doneCount} /> / {totalCount} FSRS Cards Done · 22 Voice Targets
              Queued (4-Word Window)
            </span>
          </div>

          {/* Dual Pill CTA Buttons */}
          <div className="flex items-center gap-2.5">
            {uiStateMode === 'voice_ready' ? (
              <button
                type="button"
                onClick={() => navigate('07-voice-studio-lobby')}
                className="flex-1 bg-[#1C202B] text-white text-[13px] font-semibold py-3 px-4 rounded-full text-center shadow-md press-scale flex items-center justify-center gap-1.5 min-h-[46px]"
              >
                <span className="material-symbols-outlined text-[16px] text-[#F4B844]">mic</span>
                <span>Start Live Voice Call →</span>
              </button>
            ) : uiStateMode === 'completed' ? (
              <button
                type="button"
                onClick={() => navigate('11-session-wrapped')}
                className="flex-1 bg-[#58B37C] text-white text-[13px] font-semibold py-3 px-4 rounded-full text-center shadow-md press-scale flex items-center justify-center gap-1.5 min-h-[46px]"
              >
                <span>🎉 View Session Wrapped Recap →</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => navigate('02-fsrs-sprint-question')}
                  className="flex-1 bg-[#1C202B] text-white text-[13px] font-semibold py-3 px-4 rounded-full text-center shadow-md press-scale flex items-center justify-center gap-1.5 min-h-[46px]"
                >
                  <span>Resume Sprint</span>
                  <span className="text-[11px] font-mono opacity-70">({remainingCount} left)</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('07-voice-studio-lobby')}
                  className="flex-1 bg-[#FDFBF7] text-[#1C202B] text-[13px] font-semibold py-3 px-4 rounded-full text-center border border-[#DCD3C0] press-scale flex items-center justify-center gap-1 min-h-[46px]"
                >
                  <span className="material-symbols-outlined text-[16px]">mic</span>
                  <span>Voice Studio</span>
                </button>
              </>
            )}
          </div>
        </motion.section>

        {/* 4. Section 'Today's Dual-Loop Pipeline' */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', duration: 0.4, bounce: 0, delay: 0.12 }}
        >
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="font-headline italic text-[17px] font-semibold text-[#1C202B]">
              Today&apos;s Dual-Loop Pipeline
            </h2>
            <span className="text-[11px] font-mono text-[#8C857B]">FSRS + Active Voice</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* Left Bento Card (Input Stage) */}
            <button
              type="button"
              onClick={() => navigate('02-fsrs-sprint-question')}
              className="bg-white rounded-[24px] p-3.5 border border-[#EBE4D8] shadow-xs flex flex-col justify-between text-left press-scale hover-lift"
            >
              <div>
                <div className="flex justify-between items-center">
                  <span className="bg-[#EEF4FF] text-[#3366CC] text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                    FSRS SPRINT
                  </span>
                  <span className="material-symbols-outlined text-[15px] text-[#6A9AE2]">
                    psychology
                  </span>
                </div>
                <div className="font-headline font-bold text-[22px] text-[#1C202B] mt-1.5 leading-none tabular-nums">
                  {doneCount} / {totalCount}
                </div>
                <p className="text-[11px] font-mono text-[#78716C] mt-1 tabular-nums">
                  {newDone}/{newTotal} New · {revDone}/{revTotal} Rev
                </p>
              </div>
              <div className="mt-3 w-full">
                <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#6A9AE2] rounded-full"
                    style={{ width: `${Math.round((doneCount / totalCount) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-1.5">
                  <span className="text-[10px] font-medium text-[#8C857B]">9 mins left</span>
                  <span className="text-[10px] font-mono text-[#58B37C] font-semibold">Ready</span>
                </div>
              </div>
            </button>

            {/* Right Bento Card (Output Stage) */}
            <button
              type="button"
              onClick={() => navigate('07-voice-studio-lobby')}
              className="bg-white rounded-[24px] p-3.5 border border-[#EBE4D8] shadow-xs flex flex-col justify-between text-left press-scale hover-lift"
            >
              <div>
                <div className="flex justify-between items-center">
                  <span className="bg-[#FFF9EB] text-[#C4820A] text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                    LIVE VOICE
                  </span>
                  <span className="material-symbols-outlined text-[15px] text-[#F4B844]">
                    graphic_eq
                  </span>
                </div>
                <div className="font-headline font-bold text-[22px] text-[#1C202B] mt-1.5 leading-none">
                  22 Words
                </div>
                <p className="text-[11px] font-medium text-[#78716C] mt-1">Qwen-Omni · Chelsie</p>
              </div>
              <div className="mt-3 w-full">
                <div className="w-full h-1.5 bg-[#FDE8B5] rounded-full overflow-hidden">
                  <div className="h-full bg-[#F4B844] rounded-full" style={{ width: '58%' }} />
                </div>
                <div className="flex justify-between items-center mt-1.5">
                  <span className="text-[10px] font-mono text-[#8C857B]">4-word window</span>
                  <span className="text-[10px] font-mono text-[#C4820A] font-semibold">
                    25 min call
                  </span>
                </div>
              </div>
            </button>
          </div>
        </motion.section>

        {/* 5. Section 'Target Words Ready to Bloom Tonight' */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', duration: 0.4, bounce: 0, delay: 0.16 }}
          className="pt-1"
        >
          <div className="flex justify-between items-center mb-2.5 px-1">
            <h2 className="font-headline italic text-[17px] font-semibold text-[#1C202B]">
              Target Words Ready to Bloom Tonight
            </h2>
            <button
              type="button"
              onClick={() => navigate('07-voice-studio-lobby')}
              className="text-[12px] font-medium text-[#8C857B] press-scale flex items-center gap-0.5 tap-target-expand"
            >
              <span>See all 22</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* Card 1: deprecate */}
            <button
              type="button"
              onClick={() =>
                void handlePlayWord(
                  'deprecate',
                  'We plan to deprecate the legacy webhook handler before v2 rollout.',
                )
              }
              className="bg-white rounded-[24px] p-3.5 border border-[#EBE4D8] shadow-xs flex flex-col justify-between text-left press-scale"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-headline italic font-bold text-[18px] text-[#1C202B]">
                    “deprecate”
                  </span>
                  <span
                    className={`material-symbols-outlined text-[16px] text-[#6A9AE2] ${
                      playingWord === 'deprecate' ? 'animate-bounce' : ''
                    }`}
                  >
                    volume_up
                  </span>
                </div>
                <p className="font-mono text-[11px] text-[#6A9AE2] font-medium mt-0.5">
                  /ˈdeprəkeɪt/ · v. 弃用
                </p>
                <div className="mt-2.5 bg-[#F9F6F0] p-2 rounded-xl border border-[#EFECE4] text-[11px] italic text-[#57534E] leading-relaxed">
                  “...deprecate the legacy webhook handler before v2 rollout...”
                </div>
              </div>
              <div className="mt-3 pt-1 border-t border-[#F5EFE6] flex items-center justify-between w-full">
                <span className="text-[10px] font-mono text-[#8C857B]">Window #1</span>
                <span className="text-[10px] font-medium text-[#6A9AE2] bg-[#EBF2FC] px-1.5 py-0.5 rounded">
                  High Prio
                </span>
              </div>
            </button>

            {/* Card 2: idempotent */}
            <button
              type="button"
              onClick={() =>
                void handlePlayWord(
                  'idempotent',
                  'Ensure payment retries are strictly idempotent.',
                )
              }
              className="bg-white rounded-[24px] p-3.5 border border-[#EBE4D8] shadow-xs flex flex-col justify-between text-left press-scale"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-headline italic font-bold text-[18px] text-[#1C202B]">
                    “idempotent”
                  </span>
                  <span
                    className={`material-symbols-outlined text-[16px] text-[#58B37C] ${
                      playingWord === 'idempotent' ? 'animate-bounce' : ''
                    }`}
                  >
                    volume_up
                  </span>
                </div>
                <p className="font-mono text-[11px] text-[#58B37C] font-medium mt-0.5 leading-tight">
                  /ˌaɪdemˈpoʊtənt/ · adj. 幂等的
                </p>
                <div className="mt-2.5 bg-[#F9F6F0] p-2 rounded-xl border border-[#EFECE4] text-[11px] italic text-[#57534E] leading-relaxed">
                  “...ensure payment retries are strictly idempotent...”
                </div>
              </div>
              <div className="mt-3 pt-1 border-t border-[#F5EFE6] flex items-center justify-between w-full">
                <span className="text-[10px] font-mono text-[#8C857B]">Window #2</span>
                <span className="text-[10px] font-medium text-[#58B37C] bg-[#E6F5EC] px-1.5 py-0.5 rounded">
                  Tech Dev
                </span>
              </div>
            </button>
          </div>
        </motion.section>
      </div>
    </div>
  )
}
