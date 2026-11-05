import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { useAppStore } from '../store/useAppStore'
import type { ScreenId } from '../lib/types'

export const VALID_SCREENS: Set<ScreenId> = new Set([
  '01-today-studio',
  '02-fsrs-sprint-question',
  '03-fsrs-sprint-reveal',
  '04-fsrs-sprint-wrong',
  '05-lexicon-planet',
  '06-wordbooks-tagging',
  '07-voice-studio-lobby',
  '08-voice-call-active',
  '09-voice-call-recast',
  '10-voice-call-hint',
  '11-session-wrapped',
  '12-memory-journal',
  '13-memory-editor',
  '14-engine-router',
])

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
  { tab: 5, screen: '14-engine-router', icon: 'person', label: 'Study Settings' },
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
