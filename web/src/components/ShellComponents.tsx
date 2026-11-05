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

export function LangTogglePill({ className = '' }: { className?: string }) {
  const lang = useAppStore((s) => s.lang)
  const toggleLang = useAppStore((s) => s.toggleLang)

  return (
    <button
      type="button"
      data-tour="lang-toggle"
      aria-label={lang === 'zh' ? '切换为英文界面' : 'Switch to Chinese UI'}
      onClick={toggleLang}
      className={`h-9 px-2.5 rounded-full bg-white/90 border border-[#E6DFD3] shadow-2xs flex items-center gap-1 text-[11px] font-mono font-semibold text-[#1C202B] press-scale-sm ${className}`}
    >
      <span
        className={`px-1.5 py-0.5 rounded-full transition-colors ${
          lang === 'zh' ? 'bg-[#1C202B] text-white' : 'text-[#8C857B]'
        }`}
      >
        中
      </span>
      <span
        className={`px-1.5 py-0.5 rounded-full transition-colors ${
          lang === 'en' ? 'bg-[#1C202B] text-white' : 'text-[#8C857B]'
        }`}
      >
        EN
      </span>
    </button>
  )
}

const NAV_TABS: {
  tab: 1 | 2 | 3 | 4 | 5
  tourId: string
  screen: ScreenId
  icon: string
  labelZh: string
  labelEn: string
}[] = [
  {
    tab: 1,
    tourId: 'tab-today',
    screen: '01-today-studio',
    icon: 'home',
    labelZh: '今日',
    labelEn: 'Today',
  },
  {
    tab: 2,
    tourId: 'tab-lexicon',
    screen: '05-lexicon-planet',
    icon: 'public',
    labelZh: '词书',
    labelEn: 'Words',
  },
  {
    tab: 3,
    tourId: 'tab-voice',
    screen: '07-voice-studio-lobby',
    icon: 'chat_bubble',
    labelZh: '口语',
    labelEn: 'Voice',
  },
  {
    tab: 4,
    tourId: 'tab-memory',
    screen: '12-memory-journal',
    icon: 'auto_stories',
    labelZh: '记忆',
    labelEn: 'Memory',
  },
  {
    tab: 5,
    tourId: 'tab-engine',
    screen: '14-engine-router',
    icon: 'person',
    labelZh: '设置',
    labelEn: 'Settings',
  },
]

export function FloatingBottomDock() {
  const currentScreen = useAppStore((s) => s.currentScreen)
  const navigate = useAppStore((s) => s.navigate)
  const lang = useAppStore((s) => s.lang)

  if (!TOP_LEVEL_SCREENS.has(currentScreen)) {
    return null
  }

  return (
    <nav
      aria-label={lang === 'zh' ? '底部主导航' : 'Primary Bottom Navigation'}
      className="fixed bottom-0 left-0 right-0 w-full z-50 flex justify-center items-center pb-3.5 pt-1 px-4 max-w-[410px] mx-auto pointer-events-none select-none"
      style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom, 14px))' }}
    >
      <div className="pointer-events-auto bg-white/95 backdrop-blur-md border border-[#E6DFD3] rounded-[30px] p-1.5 shadow-[0_12px_30px_rgba(28,32,43,0.12)] flex items-center justify-between gap-1 w-full max-w-[368px]">
        {NAV_TABS.map((item) => {
          const isActive = currentScreen === item.screen
          const label = lang === 'zh' ? item.labelZh : item.labelEn
          return (
            <button
              key={item.screen}
              type="button"
              data-tour={item.tourId}
              aria-label={label}
              onClick={() => navigate(item.screen)}
              className={`relative flex-1 min-w-0 h-[50px] rounded-[24px] flex flex-col items-center justify-center gap-0.5 press-scale-sm transition-colors duration-150 ${
                isActive ? 'text-white' : 'bg-[#F4F0E8]/75 text-[#1C202B]/75'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="active-dock-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.85 }}
                  className="absolute inset-0 rounded-[24px] bg-[#1C202B] shadow-sm"
                />
              )}
              <span
                className={`material-symbols-outlined text-[20px] leading-none relative z-10 ${
                  isActive ? 'fill-icon text-white' : ''
                }`}
              >
                {item.icon}
              </span>
              <span
                className={`text-[10.5px] font-semibold leading-none tracking-tight whitespace-nowrap relative z-10 ${
                  isActive ? 'text-white' : 'text-[#5A554C]'
                }`}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
