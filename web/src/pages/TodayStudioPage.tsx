import { useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { api } from '../lib/api'
import { useAppStore } from '../store/useAppStore'
import { AnimatedNumber } from '../components/ShellComponents'

const DAY_EMOJIS = ['☀️', '🌱', '💧', '✨', '🌸', '🍯', '🌿']
const DAY_BGS = [
  'bg-[#FFF4D6] ring-2 ring-[#F4B844] ring-offset-2',
  'bg-[#CDE8D6]',
  'bg-[#D2E0F8]',
  'bg-[#E7DEFC]',
  'bg-[#FCDED2]',
  'bg-[#FCE5B4]',
  'bg-[#E6F5EC]',
]

function formatShortRange(upcoming?: { date: string; offset: number; count: number }[]) {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (upcoming && upcoming.length >= 2) {
    const first = new Date(`${upcoming[0].date}T00:00:00`)
    const last = new Date(`${upcoming[upcoming.length - 1].date}T00:00:00`)
    if (!Number.isNaN(first.getTime()) && !Number.isNaN(last.getTime())) {
      return `${fmt(first)} – ${fmt(last)}`
    }
  }
  const start = new Date()
  const end = new Date()
  end.setDate(start.getDate() + 6)
  return `${fmt(start)} – ${fmt(end)}`
}

export default function TodayStudioPage() {
  const navigate = useAppStore((s) => s.navigate)
  const plan = useAppStore((s) => s.plan)
  const stats = useAppStore((s) => s.stats)
  const cards = useAppStore((s) => s.cards)
  const loading = useAppStore((s) => s.loading)
  const voicePersona = useAppStore((s) => s.voicePersona)
  const studyPlanQuotas = useAppStore((s) => s.studyPlanQuotas)
  const userProfileMd = useAppStore((s) => s.userProfileMd)
  const uiStateMode = useAppStore((s) => s.uiStateMode)
  const setUiStateMode = useAppStore((s) => s.setUiStateMode)
  const regenerateDailyPlan = useAppStore((s) => s.regenerateDailyPlan)
  const [modePill, setModePill] = useState<'sprint' | 'voice'>('sprint')
  const [playingWord, setPlayingWord] = useState<string | null>(null)

  const totalWords = stats?.total ?? 0
  const voiceTargets = cards.filter((c) => c.is_voice_target)
  const targetPreviewCards = (voiceTargets.length > 0 ? voiceTargets : cards).slice(0, 2)
  const voiceTargetCount = voiceTargets.length

  const totalCount = plan?.progress.total ?? cards.length
  const doneCount =
    uiStateMode === 'voice_ready' || uiStateMode === 'completed'
      ? totalCount
      : (plan?.progress.done ?? 0)
  const remainingCount = Math.max(0, totalCount - doneCount)
  const newTotal = plan?.progress.new.total ?? 0
  const newDone =
    uiStateMode === 'voice_ready' || uiStateMode === 'completed'
      ? newTotal
      : (plan?.progress.new.done ?? 0)
  const revTotal = plan?.progress.review.total ?? 0
  const revDone =
    uiStateMode === 'voice_ready' || uiStateMode === 'completed'
      ? revTotal
      : (plan?.progress.review.done ?? 0)

  const upcomingDays =
    stats?.upcoming && stats.upcoming.length === 7
      ? stats.upcoming.map((u, idx) => {
          const dt = new Date(`${u.date}T00:00:00`)
          const dayLetter = Number.isNaN(dt.getTime())
            ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'][(new Date().getDay() + idx) % 7]
            : ['S', 'M', 'T', 'W', 'T', 'F', 'S'][dt.getDay()]
          return {
            day: dayLetter,
            date: u.date,
            count: u.count,
            emoji: DAY_EMOJIS[idx % DAY_EMOJIS.length],
            bg: DAY_BGS[idx % DAY_BGS.length],
            isToday: idx === 0,
          }
        })
      : Array.from({ length: 7 }, (_, idx) => {
          const dt = new Date()
          dt.setDate(dt.getDate() + idx)
          return {
            day: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][dt.getDay()],
            date: dt.toISOString().slice(0, 10),
            count: 0,
            emoji: DAY_EMOJIS[idx % DAY_EMOJIS.length],
            bg: DAY_BGS[idx % DAY_BGS.length],
            isToday: idx === 0,
          }
        })

  const totalUpcomingDue = upcomingDays.reduce((acc, d) => acc + d.count, 0)

  const profileSummaryLine =
    userProfileMd
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('- '))
      ?.replace(/^-\s*/, '') || 'Synced with /data/memory/user_profile.md'

  async function handlePlayWord(word: string, sentence: string) {
    setPlayingWord(word)
    toast(`Playing "${word}"`, { description: sentence })
    await api.playSpeech(word)
    setPlayingWord(null)
  }

  return (
    <div
      className="flex-1 flex flex-col bg-[#F9F6F0] text-[#1C202B] min-h-[100dvh]"
      style={{ paddingTop: 'max(14px, env(safe-area-inset-top, 14px))' }}
    >
      {/* Top Navigation Anchor */}
      <div className="flex justify-between items-center w-full px-6 pt-1 pb-1.5 max-w-md mx-auto">
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
          aria-label="Open Study & Voice Settings"
          onClick={() => navigate('14-engine-router')}
          className="w-11 h-11 rounded-full flex items-center justify-center text-[#1C202B] press-scale-sm"
        >
          <span className="material-symbols-outlined text-[22px]">tune</span>
        </button>
      </div>

      {/* Scrollable Content Canvas */}
      <div className="flex-1 overflow-y-auto px-5 pt-1 pb-28 space-y-4 no-scrollbar">
        {/* 1. Header Row & Deck Status Row */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', duration: 0.36, bounce: 0 }}
          className="flex items-end justify-between pt-0.5"
        >
          <div>
            <span className="text-[12px] font-medium text-[#8C857B] tracking-wide block">
              {plan?.plan_date ?? new Date().toISOString().slice(0, 10)} · Daily Plan
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
            {/* Honey Gold Real FSRS Stats Badge */}
            <button
              type="button"
              onClick={() => navigate('05-lexicon-planet')}
              className="bg-[#FFF4D6] text-[#B87A04] border border-[#F4E1A6]/80 text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs press-scale"
            >
              <span className="material-symbols-outlined text-[13px] fill-icon text-[#F4B844]">
                auto_stories
              </span>
              <span>
                {totalWords} words · {stats?.due ?? 0} due
              </span>
            </button>
          </div>
        </motion.div>

        {/* Optional UX State Overrides */}
        {(uiStateMode === 'loading' || loading) && (
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
                  Clustering due reviews + new words from your wordbook
                </div>
              </div>
            </div>
            <div className="h-5 rounded-full skeleton-shimmer w-3/4" />
            <div className="h-14 rounded-2xl skeleton-shimmer w-full" />
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
              Import a JSON or CSV vocabulary deck so Pip can cluster your daily scenario.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate('06-wordbooks-tagging')}
                className="flex-1 py-3 rounded-full bg-[#1C202B] text-white text-xs font-semibold press-scale"
              >
                Import Wordbook (.json / .csv) →
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
              Could not reach Stage 2 Text LLM endpoint. Check your configuration or retry.
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
                Open Settings
              </button>
            </div>
          </motion.section>
        )}

        {/* 2. Weekly Vocal & Memory Rhythm Card (Real 7-Day Schedule) */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', duration: 0.38, bounce: 0, delay: 0.04 }}
          className="bg-white rounded-[28px] p-4.5 border border-[#EBE4D8] shadow-[0_8px_24px_rgba(28,32,43,0.03)] hover-lift"
        >
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] text-[#8C857B] font-semibold tracking-wider uppercase font-mono">
              {formatShortRange(stats?.upcoming)}
            </span>
            <span className="text-[11px] font-mono text-[#58B37C] font-semibold bg-[#E6F5EC] px-2 py-0.5 rounded-full">
              7d Due: {totalUpcomingDue}
            </span>
          </div>
          <h2 className="text-[17px] font-semibold text-[#1C202B] tracking-tight leading-snug mb-3">
            {totalWords === 0
              ? 'Import a wordbook to start your 7-day FSRS schedule'
              : totalCount > 0
                ? `Today’s progress: ${doneCount} / ${totalCount} cards completed`
                : `${stats?.due ?? 0} due reviews · ${stats?.new ?? 0} new words available`}
          </h2>
          {/* 7-Day Schedule Row */}
          <div className="flex justify-between items-center px-1 pt-1 pb-1">
            {upcomingDays.map((item, idx) => (
              <button
                key={item.date + idx}
                type="button"
                onClick={() => toast(`${item.date} · ${item.count} FSRS reviews scheduled`)}
                className="flex flex-col items-center gap-1 relative press-scale-sm min-w-[38px] min-h-[44px]"
              >
                <div
                  className={`${
                    item.isToday ? 'w-9 h-9' : 'w-8 h-8'
                  } rounded-full ${item.bg} flex items-center justify-center text-xs shadow-inner`}
                >
                  <span className={item.isToday ? 'text-base' : 'text-sm'}>{item.emoji}</span>
                </div>
                <span
                  className={`text-[11px] ${
                    item.isToday ? 'font-bold text-[#1C202B]' : 'font-medium text-[#78716C]'
                  }`}
                >
                  {item.day}
                </span>
                {item.count > 0 && (
                  <span className="text-[9.5px] font-mono text-[#8C857B] -mt-0.5">
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </motion.section>

        {/* 3. Featured Companion Briefing Card (Champagne Sand) */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', duration: 0.4, bounce: 0, delay: 0.08 }}
          className="bg-[#EFE6D5] rounded-[28px] p-5 border border-[#E2D7C1] shadow-[0_8px_20px_rgba(45,38,30,0.05)] relative overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-11 h-11 rounded-full overflow-hidden border border-white/80 shadow-sm flex-shrink-0">
                <img
                  alt="Pip avatar"
                  className="w-full h-full object-cover"
                  src="/assets/pip-avatar.png"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-[15px] font-semibold text-[#1C202B]">A briefing from Pip</h3>
                  <span className="w-2 h-2 rounded-full bg-[#58B37C]" />
                </div>
                <p className="text-[11px] text-[#7A7265] leading-tight mt-0.5 font-medium truncate">
                  {profileSummaryLine}
                </p>
              </div>
            </div>
            {totalWords > 0 && (
              <button
                type="button"
                onClick={() => void regenerateDailyPlan()}
                className="w-9 h-9 rounded-full bg-white/75 border border-[#D5C9B0] flex items-center justify-center text-[#3B352B] press-scale-sm shrink-0"
                title="Generate or refresh today's plan"
              >
                <span className="material-symbols-outlined text-[17px]">refresh</span>
              </button>
            )}
          </div>

          {/* Scenario Pill Badge */}
          <div className="mt-3.5 mb-2.5">
            <span className="bg-[#E2D7C1]/90 text-[#3B352B] text-[11px] font-mono font-medium px-3 py-1 rounded-full inline-flex items-center gap-1 border border-[#D5C9B0]">
              <span className="material-symbols-outlined text-[13px]">terminal</span>
              <span>
                {plan?.scenario_title ||
                  (totalWords > 0 ? '今日场景待生成' : '尚未导入词书')}
              </span>
            </span>
          </div>

          {/* Editorial Serif Quote */}
          <p className="font-headline italic text-[18px] leading-snug text-[#1C202B] my-3">
            “
            {plan?.scenario_brief ||
              (totalWords > 0
                ? '词库已就绪。点击下方按钮，由 Pip 结合你的用户画像将今日待复习与新学词汇聚类为实战对话场景。'
                : '欢迎来到 Today Studio！请先导入一份 JSON 或 CSV 词书，Pip 会为你初始化 FSRS 记忆卡片并规划每日口语场景。')}
            ”
          </p>

          {/* Progress Line */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#5E574B] mb-4 bg-white/40 px-3 py-1.5 rounded-xl border border-white/40 tabular-nums">
            <span className="material-symbols-outlined text-[14px] text-[#2B579A]">monitoring</span>
            <span>
              <AnimatedNumber value={doneCount} /> / {totalCount} FSRS Cards Done ·{' '}
              {voiceTargetCount} Voice Targets Queued
            </span>
          </div>

          {/* Dual Pill CTA Buttons */}
          <div className="flex items-center gap-2.5">
            {totalWords === 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => navigate('06-wordbooks-tagging')}
                  className="flex-1 bg-[#1C202B] text-white text-[13px] font-semibold py-3 px-4 rounded-full text-center shadow-md press-scale flex items-center justify-center gap-1.5 min-h-[46px]"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#F4B844]">
                    upload_file
                  </span>
                  <span>导入词书 (.json / .csv)</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('13-memory-editor')}
                  className="bg-[#FDFBF7] text-[#1C202B] text-[13px] font-semibold py-3 px-4 rounded-full text-center border border-[#DCD3C0] press-scale flex items-center justify-center gap-1 min-h-[46px]"
                >
                  <span>记忆画像</span>
                </button>
              </>
            ) : totalCount === 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => void regenerateDailyPlan()}
                  disabled={loading}
                  className="flex-1 bg-[#1C202B] text-white text-[13px] font-semibold py-3 px-4 rounded-full text-center shadow-md press-scale flex items-center justify-center gap-1.5 min-h-[46px]"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#F4B844]">
                    auto_awesome
                  </span>
                  <span>{loading ? '生成中…' : '生成今日学习计划'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('06-wordbooks-tagging')}
                  className="bg-[#FDFBF7] text-[#1C202B] text-[13px] font-semibold py-3 px-4 rounded-full text-center border border-[#DCD3C0] press-scale flex items-center justify-center gap-1 min-h-[46px]"
                >
                  <span>词库管理</span>
                </button>
              </>
            ) : uiStateMode === 'voice_ready' ? (
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
                  <span>Start Sprint</span>
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
              onClick={() =>
                totalCount > 0
                  ? navigate('02-fsrs-sprint-question')
                  : navigate('06-wordbooks-tagging')
              }
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
                    style={{
                      width: `${totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between items-center mt-1.5">
                  <span className="text-[10px] font-medium text-[#8C857B]">
                    {remainingCount} remaining
                  </span>
                  <span className="text-[10px] font-mono text-[#58B37C] font-semibold">
                    {totalCount > 0 ? 'Ready' : 'No Queue'}
                  </span>
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
                  {voiceTargetCount} Words
                </div>
                <p className="text-[11px] font-medium text-[#78716C] mt-1">
                  Realtime · {voicePersona}
                </p>
              </div>
              <div className="mt-3 w-full">
                <div className="w-full h-1.5 bg-[#FDE8B5] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#F4B844] rounded-full"
                    style={{ width: voiceTargetCount > 0 ? '100%' : '0%' }}
                  />
                </div>
                <div className="flex justify-between items-center mt-1.5">
                  <span className="text-[10px] font-mono text-[#8C857B]">
                    {studyPlanQuotas.voice_sliding_window_size}-word window
                  </span>
                  <span className="text-[10px] font-mono text-[#C4820A] font-semibold">
                    {voiceTargetCount > 0 ? 'Active' : 'Standby'}
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
              <span>See all {voiceTargetCount}</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>

          {targetPreviewCards.length === 0 ? (
            <div className="bg-white rounded-[24px] p-5 border border-[#EBE4D8] shadow-xs text-center space-y-2">
              <p className="font-headline italic text-[16px] text-[#1C202B]">
                今日暂无待激活的口语目标词
              </p>
              <p className="text-xs text-[#8C857B] leading-relaxed">
                导入词书并生成今日场景计划后，系统会自动挑选核心目标词供晚间实时语音对话实战使用。
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {targetPreviewCards.map((item, idx) => {
                const isFirst = idx === 0
                const posDef = item.pos_defs?.[0]
                  ? `${item.pos_defs[0].pos ?? ''} ${item.pos_defs[0].def?.split('（')[0] ?? ''}`.trim()
                  : ''
                return (
                  <button
                    key={item.word}
                    type="button"
                    onClick={() =>
                      void handlePlayWord(
                        item.word,
                        item.sentence_en ?? `Practice "${item.word}" in tonight's voice call.`,
                      )
                    }
                    className="bg-white rounded-[24px] p-3.5 border border-[#EBE4D8] shadow-xs flex flex-col justify-between text-left press-scale"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-headline italic font-bold text-[18px] text-[#1C202B]">
                          “{item.word}”
                        </span>
                        <span
                          className={`material-symbols-outlined text-[16px] ${
                            isFirst ? 'text-[#6A9AE2]' : 'text-[#58B37C]'
                          } ${playingWord === item.word ? 'animate-bounce' : ''}`}
                        >
                          volume_up
                        </span>
                      </div>
                      <p
                        className={`font-mono text-[11px] font-medium mt-0.5 leading-tight ${
                          isFirst ? 'text-[#6A9AE2]' : 'text-[#58B37C]'
                        }`}
                      >
                        {item.phonetic_us} {posDef ? `· ${posDef}` : ''}
                      </p>
                      {item.sentence_en && (
                        <div className="mt-2.5 bg-[#F9F6F0] p-2 rounded-xl border border-[#EFECE4] text-[11px] italic text-[#57534E] leading-relaxed line-clamp-2">
                          “{item.sentence_en}”
                        </div>
                      )}
                    </div>
                    <div className="mt-3 pt-1 border-t border-[#F5EFE6] flex items-center justify-between w-full">
                      <span className="text-[10px] font-mono text-[#8C857B]">
                        {item.item_type === 'NEW' ? 'New Target' : 'Review Target'}
                      </span>
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          isFirst
                            ? 'text-[#6A9AE2] bg-[#EBF2FC]'
                            : 'text-[#58B37C] bg-[#E6F5EC]'
                        }`}
                      >
                        {item.is_voice_target ? 'Voice Target' : 'Sprint'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </motion.section>
      </div>
    </div>
  )
}
