import { useEffect } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { Toaster } from 'sonner'
import { ContextualCoachmarkOverlay } from './components/OnboardingGuide'
import {
  FloatingBottomDock,
  SINGLE_SCREEN_LOCKED,
  VALID_SCREENS,
} from './components/ShellComponents'
import type { ScreenId } from './lib/types'
import EngineRouterPage from './pages/EngineRouterPage'
import FsrsSprintPage from './pages/FsrsSprintPage'
import LexiconPlanetPage from './pages/LexiconPlanetPage'
import MemoryJournalPage from './pages/MemoryJournalPage'
import TodayStudioPage from './pages/TodayStudioPage'
import VoiceStudioPage from './pages/VoiceStudioPage'
import { type UiStateOverride, useAppStore } from './store/useAppStore'

export default function App() {
  const currentScreen = useAppStore((s) => s.currentScreen)
  const navigate = useAppStore((s) => s.navigate)
  const setUiStateMode = useAppStore((s) => s.setUiStateMode)
  const initBackendData = useAppStore((s) => s.initBackendData)
  const darkMode = useAppStore((s) => s.darkMode)
  const lang = useAppStore((s) => s.lang)

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  }, [lang])

  useEffect(() => {
    void initBackendData()

    const applyUrlParams = () => {
      const params = new URLSearchParams(window.location.search)
      const rawScreen = params.get('screen')
      const screenParam = (
        rawScreen === '07-voice-lobby' ? '07-voice-studio-lobby' : rawScreen
      ) as ScreenId | null
      if (screenParam && VALID_SCREENS.has(screenParam)) {
        navigate(screenParam)
      }
      if (import.meta.env.DEV) {
        const stateParam = params.get('state') as UiStateOverride | null
        if (
          stateParam &&
          ['default', 'loading', 'empty', 'error', 'voice_ready', 'completed'].includes(stateParam)
        ) {
          setUiStateMode(stateParam)
        }
      }
    }

    applyUrlParams()
    window.addEventListener('popstate', applyUrlParams)
    return () => window.removeEventListener('popstate', applyUrlParams)
  }, [initBackendData, navigate, setUiStateMode])

  const isLockedSingleScreen = SINGLE_SCREEN_LOCKED.has(currentScreen)

  const renderScreenContent = () => {
    switch (currentScreen) {
      case '01-today-studio':
        return <TodayStudioPage />
      case '02-fsrs-sprint-question':
      case '03-fsrs-sprint-reveal':
      case '04-fsrs-sprint-wrong':
        return <FsrsSprintPage />
      case '05-lexicon-planet':
      case '06-wordbooks-tagging':
        return <LexiconPlanetPage />
      case '07-voice-studio-lobby':
      case '08-voice-call-active':
      case '09-voice-call-recast':
      case '10-voice-call-hint':
      case '11-session-wrapped':
        return <VoiceStudioPage />
      case '12-memory-journal':
      case '13-memory-editor':
        return <MemoryJournalPage />
      case '14-engine-router':
        return <EngineRouterPage />
      default:
        return <TodayStudioPage />
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div
        style={{ paddingTop: 'max(6px, env(safe-area-inset-top, 6px))' }}
        className={`w-full max-w-[430px] mx-auto bg-[#F9F6F0] text-[#1C202B] relative ${
          isLockedSingleScreen
            ? 'h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col'
            : 'min-h-[100dvh] flex flex-col'
        } ${darkMode ? 'dark' : ''}`}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={currentScreen}
            initial={{ opacity: 0, y: isLockedSingleScreen ? 3 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: isLockedSingleScreen ? -2 : -4 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className={
              isLockedSingleScreen
                ? 'flex-1 flex flex-col min-h-0 overflow-hidden'
                : 'flex-1 flex flex-col'
            }
          >
            {renderScreenContent()}
          </motion.main>
        </AnimatePresence>

        <FloatingBottomDock />
        <ContextualCoachmarkOverlay />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              borderRadius: '18px',
              background: '#1C202B',
              color: '#F9F6F0',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '13px',
              border: '1px solid rgba(255,255,255,0.12)',
            },
          }}
        />
      </div>
    </MotionConfig>
  )
}
