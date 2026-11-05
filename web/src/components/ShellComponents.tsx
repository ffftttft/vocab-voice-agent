import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import { useAppStore, type UiStateOverride } from '../store/useAppStore'
import type { ScreenId } from '../lib/types'

export const SCREEN_META: {
  id: ScreenId
  num: string
  title: string
  subtitle: string
  tab: 1 | 2 | 3 | 4 | 5
}[] = [
  { id: '01-today-studio', num: '01', title: 'Today Studio', subtitle: 'Daily Home & Briefing', tab: 1 },
  { id: '02-fsrs-sprint-question', num: '02', title: 'FSRS Sprint · Question', subtitle: '4-Choice Same-POS Prompt', tab: 1 },
  { id: '03-fsrs-sprint-reveal', num: '03', title: 'FSRS Sprint · Reveal', subtitle: 'Correct Answer & Auto-Grade', tab: 1 },
  { id: '04-fsrs-sprint-wrong', num: '04', title: 'FSRS Sprint · Wrong', subtitle: 'Confusable Note & Requeue', tab: 1 },
  { id: '05-lexicon-planet', num: '05', title: 'Lexicon Planet', subtitle: '3D Island & FSRS Ecosystem', tab: 2 },
  { id: '06-wordbooks-tagging', num: '06', title: 'Wordbooks & Tagging', subtitle: 'JSON/CSV Ingest & Clusters', tab: 2 },
  { id: '07-voice-studio-lobby', num: '07', title: 'Voice Studio Lobby', subtitle: 'Scenario Brief & 4-Word Window', tab: 3 },
  { id: '08-voice-call-active', num: '08', title: 'Live Call · Active', subtitle: 'Full-Duplex 24kHz PCM & HUD', tab: 3 },
  { id: '09-voice-call-recast', num: '09', title: 'Live Call · Recast Toast', subtitle: 'Non-Blocking Top Correction', tab: 3 },
  { id: '10-voice-call-hint', num: '10', title: 'Live Call · SSE Hint', subtitle: 'On-Demand Streaming Sheet', tab: 3 },
  { id: '11-session-wrapped', num: '11', title: 'Session Wrapped', subtitle: 'Bloom Recap & Memory Diff', tab: 3 },
  { id: '12-memory-journal', num: '12', title: 'Memory Journal', subtitle: '7-Day Flow & Mistake Clinic', tab: 4 },
  { id: '13-memory-editor', num: '13', title: 'Markdown Memory Editor', subtitle: 'user_profile & error_patterns', tab: 4 },
  { id: '14-engine-router', num: '14', title: 'Engine & Model Router', subtitle: 'FSRS Quotas & 3-Stage Swap', tab: 5 },
]

export const TOP_LEVEL_SCREENS: Set<ScreenId> = new Set([
  '01-today-studio',
  '05-lexicon-planet',
  '07-voice-studio-lobby',
  '12-memory-journal',
  '14-engine-router',
])

export const SINGLE_SCREEN_LOCKED: Set<ScreenId> = new Set([
  '02-fsrs-sprint-question',
  '03-fsrs-sprint-reveal',
  '04-fsrs-sprint-wrong',
  '08-voice-call-active',
  '09-voice-call-recast',
  '10-voice-call-hint',
])

export function AnimatedNumber({
  value,
  className = '',
  suffix = '',
}: {
  value: number
  className?: string
  suffix?: string
}) {
  const [display, setDisplay] = useState(value)

  useEffect(() => {
    const start = display
    const diff = value - start
    if (diff === 0) return
    const duration = 240
    const startTime = performance.now()
    let raf = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(start + diff * eased))
      if (t < 1) {
        raf = requestAnimationFrame(step)
      }
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return (
    <motion.span
      key={value}
      initial={{ y: -3, opacity: 0.75 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', duration: 0.28, bounce: 0 }}
      className={`tabular-nums inline-block ${className}`}
    >
      {display.toLocaleString()}
      {suffix}
    </motion.span>
  )
}

export function StatusBar({ compact = false }: { compact?: boolean }) {
  const currentScreen = useAppStore((s) => s.currentScreen)
  const setDirectoryOpen = useAppStore((s) => s.setDirectoryOpen)
  const meta = SCREEN_META.find((m) => m.id === currentScreen) ?? SCREEN_META[0]

  return (
    <header
      className={`w-full pt-2.5 px-6 pb-1 flex items-center justify-between z-40 select-none shrink-0 ${
        compact ? 'sprint-status-bar' : ''
      }`}
    >
      <span className="text-[14px] font-semibold tracking-tight text-[#1C202B] font-body tabular-nums">
        9:41
      </span>

      {/* Interactive Dynamic Island / 14-Screen Studio Switcher Pill */}
      <button
        type="button"
        onClick={() => setDirectoryOpen(true)}
        aria-label="Open 14-Screen Studio Switcher"
        className="tap-target-expand h-6 px-3 bg-[#1C202B] text-white rounded-full flex items-center gap-1.5 shadow-sm press-scale text-[10.5px] font-mono"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#58B37C] animate-pulse" />
        <span>{meta.num}/14</span>
        <span className="opacity-75 hidden xs:inline">· Studio</span>
      </button>

      <div className="flex items-center gap-1.5 text-[#1C202B]">
        <span className="material-symbols-outlined text-[16px] fill-icon">
          signal_cellular_4_bar
        </span>
        <span className="material-symbols-outlined text-[16px]">wifi</span>
        <span className="material-symbols-outlined text-[19px] fill-icon">battery_full</span>
      </div>
    </header>
  )
}

const NAV_TABS: {
  tab: 1 | 2 | 3 | 4 | 5
  screen: ScreenId
  icon: string
  label: string
}[] = [
  { tab: 1, screen: '01-today-studio', icon: 'home', label: 'Today Home' },
  { tab: 2, screen: '05-lexicon-planet', icon: 'public', label: 'Lexicon Planet' },
  { tab: 3, screen: '07-voice-studio-lobby', icon: 'chat_bubble', label: 'Voice Studio' },
  { tab: 4, screen: '12-memory-journal', icon: 'auto_stories', label: 'Memory Journal' },
  { tab: 5, screen: '14-engine-router', icon: 'person', label: 'Engine Router' },
]

export function FloatingBottomDock() {
  const currentScreen = useAppStore((s) => s.currentScreen)
  const navigate = useAppStore((s) => s.navigate)

  if (!TOP_LEVEL_SCREENS.has(currentScreen)) {
    return null
  }

  return (
    <nav
      aria-label="Primary Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 w-full z-50 flex justify-center items-center pb-4 pt-1 px-6 max-w-[390px] mx-auto pointer-events-none select-none"
      style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))' }}
    >
      <div className="pointer-events-auto bg-white/95 backdrop-blur-md border border-[#E6DFD3] rounded-full p-1.5 shadow-[0_12px_30px_rgba(28,32,43,0.12)] flex items-center justify-between gap-2 w-full max-w-[336px]">
        {NAV_TABS.map((item) => {
          const isActive = currentScreen === item.screen
          return (
            <button
              key={item.screen}
              type="button"
              aria-label={item.label}
              onClick={() => navigate(item.screen)}
              className={`relative w-12 h-12 rounded-full flex items-center justify-center press-scale-sm transition-colors duration-150 ${
                isActive ? 'text-white' : 'bg-[#F4F0E8] text-[#1C202B]/70'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="active-dock-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.85 }}
                  className="absolute inset-0 rounded-full bg-[#1C202B] shadow-sm"
                />
              )}
              <span
                className={`material-symbols-outlined text-[22px] relative z-10 ${
                  isActive ? 'fill-icon text-white' : ''
                }`}
              >
                {item.icon}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export function ScreenDirectorySheet() {
  const directoryOpen = useAppStore((s) => s.directoryOpen)
  const setDirectoryOpen = useAppStore((s) => s.setDirectoryOpen)
  const currentScreen = useAppStore((s) => s.currentScreen)
  const navigate = useAppStore((s) => s.navigate)
  const uiStateMode = useAppStore((s) => s.uiStateMode)
  const setUiStateMode = useAppStore((s) => s.setUiStateMode)
  const darkMode = useAppStore((s) => s.darkMode)
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode)

  const stateModes: { id: UiStateOverride; label: string }[] = [
    { id: 'default', label: 'Default' },
    { id: 'loading', label: 'Loading' },
    { id: 'empty', label: 'Empty' },
    { id: 'error', label: 'Error' },
    { id: 'voice_ready', label: 'Voice Ready' },
    { id: 'completed', label: 'Completed' },
  ]

  return (
    <AnimatePresence>
      {directoryOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setDirectoryOpen(false)}
            className="fixed inset-0 bg-[#1C202B]/35 backdrop-blur-[2px] z-[70]"
          />
          <motion.section
            role="dialog"
            aria-label="14-Screen Argon4 Directory"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', duration: 0.42, bounce: 0.05 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.35 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 450) {
                setDirectoryOpen(false)
              }
            }}
            className="fixed bottom-0 left-0 right-0 max-w-[390px] mx-auto bg-[#FAF7F2] rounded-t-[32px] border-t border-white/80 shadow-[0_-16px_48px_rgba(28,32,43,0.22)] z-[80] max-h-[84dvh] flex flex-col overflow-hidden"
          >
            <div className="w-10 h-1.5 bg-[#DED6C7] rounded-full mx-auto mt-2.5 mb-1 shrink-0 cursor-grab" />
            <div className="px-5 py-2.5 flex items-center justify-between border-b border-[#EBE4D8] shrink-0">
              <div>
                <h2 className="font-headline font-semibold text-[18px] text-[#1C202B]">
                  Argon4 · 14 Screens &amp; States
                </h2>
                <p className="text-[11px] text-[#8C857B] font-mono">
                  Drag down or tap any screen to jump immediately
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    toggleDarkMode()
                    toast(darkMode ? 'Daylight Alabaster Mode' : 'Nocturnal Parchment Dark Mode')
                  }}
                  aria-label="Toggle Dark Mode"
                  className="w-11 h-11 rounded-full bg-white border border-[#EBE4D8] flex items-center justify-center text-[#1C202B] press-scale"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {darkMode ? 'light_mode' : 'dark_mode'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setDirectoryOpen(false)}
                  aria-label="Close Directory"
                  className="w-11 h-11 rounded-full bg-white border border-[#EBE4D8] flex items-center justify-center text-[#1C202B] press-scale"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>

            {/* UI State Simulation Strip (Dev Only) */}
            {import.meta.env.DEV && (
              <div className="px-5 py-2.5 bg-[#EFE6D5]/60 border-b border-[#E5DAC8] shrink-0">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[#5A554C] font-semibold mb-1.5">
                  UX State Inspector (Empty / Loading / Error / Ready)
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {stateModes.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setUiStateMode(m.id)
                        toast.success(`UX State → ${m.label}`)
                      }}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap press-scale ${
                        uiStateMode === m.id
                          ? 'bg-[#1C202B] text-white shadow-xs'
                          : 'bg-white text-[#5A554C] border border-[#E2D8C3]'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 14 Screens List */}
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-2.5 no-scrollbar">
              {SCREEN_META.map((item) => {
                const active = item.id === currentScreen
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.id)}
                    className={`p-3 rounded-2xl text-left border press-scale flex flex-col justify-between min-h-[68px] ${
                      active
                        ? 'bg-[#1C202B] text-white border-[#1C202B] shadow-md'
                        : 'bg-white text-[#1C202B] border-[#EBE4D8]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          active ? 'bg-white/20 text-white' : 'bg-[#F4EFE6] text-[#5A554C]'
                        }`}
                      >
                        #{item.num}
                      </span>
                      <span
                        className={`text-[10px] font-mono ${
                          active ? 'text-[#F4B844]' : 'text-[#8C857B]'
                        }`}
                      >
                        Tab {item.tab}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <div className="text-[12.5px] font-semibold leading-tight truncate">
                        {item.title}
                      </div>
                      <div
                        className={`text-[10px] truncate mt-0.5 ${
                          active ? 'text-white/75' : 'text-[#8C857B]'
                        }`}
                      >
                        {item.subtitle}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  )
}
