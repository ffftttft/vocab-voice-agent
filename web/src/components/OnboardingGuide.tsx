import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { api } from '../lib/api'
import type { ScreenId } from '../lib/types'
import { useAppStore } from '../store/useAppStore'

export interface OnboardingStepConfig {
  id: string
  featureVersion: number
  tourSelector: string
  targetScreen: ScreenId
  actionScreen: ScreenId
  badgeZh: string
  badgeEn: string
  titleZh: string
  titleEn: string
  whyZh: string
  whyEn: string
  previewLabelZh: string
  previewLabelEn: string
  previewSnippetEn: string
  previewSnippetZh: string
  ctaZh: string
  ctaEn: string
}

/**
 * Extensible onboarding step registry.
 * Future features can append a new item with a bumped `featureVersion`
 * to surface a contextual coachmark only for the newly added capability.
 */
export const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  {
    id: 'core-1-wordbook',
    featureVersion: 1,
    tourSelector: '[data-tour="step-wordbook"]',
    targetScreen: '01-today-studio',
    actionScreen: '06-wordbooks-tagging',
    badgeZh: '核心闭环 1 / 3 · 导入词书',
    badgeEn: 'Core Loop 1 / 3 · Import Deck',
    titleZh: '先导入词书，告别按字母表死记硬背',
    titleEn: 'Import a wordbook to start scenario clustering',
    whyZh:
      '上传 JSON 或 CSV 词表后，Pip 会结合你的职业画像，把枯燥词表自动归类为真实对话场景并建立 FSRS 记忆曲线。',
    whyEn:
      'Upload a JSON or CSV deck so Pip can cluster words into realistic speaking scenarios and schedule FSRS reviews.',
    previewLabelZh: '导入后将在此生成（示例预览）：',
    previewLabelEn: 'What appears here after import (Sample Preview):',
    previewSnippetEn: 'Scenario: API Rate Limiting & Graceful Degradation · 18 words',
    previewSnippetZh: '今日场景：接口限流与服务平稳降级 · 已聚拢 18 个核心词',
    ctaZh: '去导入词书',
    ctaEn: 'Import Wordbook',
  },
  {
    id: 'core-2-sprint',
    featureVersion: 1,
    tourSelector: '[data-tour="step-sprint"]',
    targetScreen: '01-today-studio',
    actionScreen: '02-fsrs-sprint-question',
    badgeZh: '核心闭环 2 / 3 · 场景背词',
    badgeEn: 'Core Loop 2 / 3 · FSRS Sprint',
    titleZh: '在真实语境例句中四选一快刷',
    titleEn: 'Review words in context with speed-to-grade FSRS',
    whyZh:
      '每个单词都嵌在工作/生活例句中考察；系统根据你的作答耗时自动评定熟练度（<3.5秒直通秒杀），答错自动重排。',
    whyEn:
      'Every word is tested inside a contextual sentence; response speed automatically grades your FSRS stability.',
    previewLabelZh: '闪卡冲刺示例（可点击发音）：',
    previewLabelEn: 'Sample Sprint Card (Tap to listen):',
    previewSnippetEn: '“We need a resilient fallback when the upstream API times out.”',
    previewSnippetZh: 'resilient /rɪˈzɪliənt/ · adj. 有弹性的；能快速恢复的（自动评级：Easy 4）',
    ctaZh: '查看背词页',
    ctaEn: 'Preview Sprint',
  },
  {
    id: 'core-3-voice',
    featureVersion: 1,
    tourSelector: '[data-tour="step-voice"]',
    targetScreen: '01-today-studio',
    actionScreen: '07-voice-studio-lobby',
    badgeZh: '核心闭环 3 / 3 · 语音实战',
    badgeEn: 'Core Loop 3 / 3 · Live Voice',
    titleZh: '带着今日目标词，和 Pip 开口对练',
    titleEn: 'Activate target words in live full-duplex voice',
    whyZh:
      '背完词立即进入语音工作台。主动说出目标词可获记忆加成；卡壳随时点「提示」看地道例句，说错还有不打断对话的轻量纠错卡。',
    whyEn:
      'Speak target words proactively in live voice calls for an FSRS boost, tap Hint when stuck, and get non-blocking recasts.',
    previewLabelZh: '语音对练滑窗与提示示例：',
    previewLabelEn: 'Live Voice Target Window & Hint Preview:',
    previewSnippetEn: 'Hint: “Let’s add a **resilient** retry policy before Friday’s release.”',
    previewSnippetZh: '提示救急：自动静音防回声 + 第一人称地道表达示范 + 错题自动归档至记忆库',
    ctaZh: '开启学习之旅',
    ctaEn: 'Start Learning',
  },
]

interface SpotlightRect {
  top: number
  left: number
  width: number
  height: number
}

export function ContextualCoachmarkOverlay() {
  const onboardingOpen = useAppStore((s) => s.onboardingOpen)
  const onboardingStep = useAppStore((s) => s.onboardingStep)
  const setOnboardingStep = useAppStore((s) => s.setOnboardingStep)
  const closeOnboarding = useAppStore((s) => s.closeOnboarding)
  const currentScreen = useAppStore((s) => s.currentScreen)
  const navigate = useAppStore((s) => s.navigate)
  const lang = useAppStore((s) => s.lang)

  const [rect, setRect] = useState<SpotlightRect | null>(null)

  const stepIndex = Math.max(0, Math.min(ONBOARDING_STEPS.length - 1, onboardingStep))
  const step = ONBOARDING_STEPS[stepIndex]
  const isZh = lang === 'zh'

  useEffect(() => {
    if (!onboardingOpen || !step) return

    if (currentScreen !== step.targetScreen) {
      navigate(step.targetScreen)
    }

    const updatePosition = () => {
      const el = document.querySelector(step.tourSelector)
      if (!el) {
        setRect(null)
        return
      }
      const box = el.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) {
        setRect(null)
        return
      }
      setRect({
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
      })
    }

    const scrollTargetIntoView = () => {
      const el = document.querySelector(step.tourSelector)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      window.setTimeout(updatePosition, 160)
    }

    scrollTargetIntoView()
    updatePosition()

    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [onboardingOpen, stepIndex, currentScreen, step, navigate])

  if (!onboardingOpen || !step) return null

  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800
  const placeAbove = rect ? rect.top > viewportH * 0.52 : false

  return (
    <AnimatePresence>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isZh ? '新手核心流程引导' : 'Core Workflow Guide'}
        className="fixed inset-0 z-[80] pointer-events-auto select-none"
      >
        {/* Dim backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeOnboarding}
          className="absolute inset-0 bg-[#1C202B]/45 backdrop-blur-[1.5px]"
        />

        {/* Spotlight Highlight Ring around the actual UI element */}
        {rect && (
          <motion.div
            layoutId="coachmark-spotlight-ring"
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            style={{
              top: Math.max(6, rect.top - 6),
              left: Math.max(8, rect.left - 6),
              width: rect.width + 12,
              height: rect.height + 12,
            }}
            className="fixed z-[81] rounded-[28px] ring-4 ring-[#F4B844] bg-white/10 shadow-[0_0_0_9999px_rgba(28,32,43,0.42),0_0_28px_rgba(244,184,68,0.55)] pointer-events-none"
          />
        )}

        {/* Contextual Coachmark Card */}
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: placeAbove ? 10 : -10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
          style={
            rect
              ? placeAbove
                ? {
                    bottom: Math.max(16, viewportH - rect.top + 14),
                  }
                : {
                    top: Math.min(viewportH - 290, rect.top + rect.height + 14),
                  }
              : {
                  top: '50%',
                  transform: 'translateY(-50%)',
                }
          }
          className="fixed left-4 right-4 max-w-[390px] mx-auto z-[82] bg-[#FAF7F2] border-2 border-[#E5DAC6] rounded-[26px] p-4 shadow-[0_18px_42px_rgba(28,32,43,0.28)]"
        >
          {/* Top Row: Step Pill + Skip Button */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="inline-flex items-center gap-1.5 bg-[#FFF4D6] border border-[#F4E0A8] text-[#946300] px-2.5 py-1 rounded-full text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F4B844]" />
              <span>{isZh ? step.badgeZh : step.badgeEn}</span>
            </div>

            <button
              type="button"
              onClick={closeOnboarding}
              className="text-xs font-medium text-[#8C857B] hover:text-[#1C202B] px-2 py-1 rounded-full press-scale-sm"
            >
              {isZh ? '跳过引导' : 'Skip'}
            </button>
          </div>

          {/* Step Headline & Why */}
          <h3 className="font-headline font-semibold text-[18px] text-[#1C202B] leading-snug">
            {isZh ? step.titleZh : step.titleEn}
          </h3>
          <p className="text-[12.5px] text-[#5A554C] leading-relaxed mt-1">
            {isZh ? step.whyZh : step.whyEn}
          </p>

          {/* Mock Preview Box inside Coachmark */}
          <button
            type="button"
            onClick={() => void api.playSpeech('resilient')}
            className="w-full text-left mt-2.5 bg-[#EFE6D5]/85 border border-[#DFD4BE] rounded-2xl p-2.5 press-scale"
          >
            <div className="flex items-center justify-between text-[10.5px] font-mono text-[#7A7265] mb-1">
              <span>{isZh ? step.previewLabelZh : step.previewLabelEn}</span>
              <span className="material-symbols-outlined text-[13px] text-[#946300]">
                volume_up
              </span>
            </div>
            <p className="font-headline italic text-[13.5px] text-[#1C202B] leading-snug">
              {step.previewSnippetEn}
            </p>
            <p className="text-[11px] text-[#5A554C] mt-0.5 leading-snug">
              {isZh ? step.previewSnippetZh : step.previewSnippetEn}
            </p>
          </button>

          {/* Bottom Controls: Step Dots + Back / Next / Go */}
          <div className="mt-3.5 pt-2.5 border-t border-[#EAE2D3] flex items-center justify-between gap-2">
            {/* Progress Dots */}
            <div className="flex items-center gap-1.5">
              {ONBOARDING_STEPS.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Step ${idx + 1}`}
                  onClick={() => setOnboardingStep(idx)}
                  className={`h-2 rounded-full transition-all ${
                    idx === stepIndex ? 'w-5 bg-[#1C202B]' : 'w-2 bg-[#D5CBB8]'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {stepIndex > 0 && (
                <button
                  type="button"
                  onClick={() => setOnboardingStep(stepIndex - 1)}
                  className="px-3 py-2 min-h-[38px] rounded-full bg-[#EFECE4] text-[#5A554C] text-xs font-semibold press-scale"
                >
                  {isZh ? '上一步' : 'Back'}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  closeOnboarding()
                  navigate(step.actionScreen)
                }}
                className="px-3 py-2 min-h-[38px] rounded-full bg-white border border-[#DCD3C0] text-[#1C202B] text-xs font-semibold press-scale"
              >
                {isZh ? step.ctaZh : step.ctaEn}
              </button>

              {stepIndex < ONBOARDING_STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setOnboardingStep(stepIndex + 1)}
                  className="px-4 py-2 min-h-[38px] rounded-full bg-[#1C202B] text-white text-xs font-semibold press-scale flex items-center gap-1 shadow-sm"
                >
                  <span>{isZh ? '下一步' : 'Next'}</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={closeOnboarding}
                  className="px-4 py-2 min-h-[38px] rounded-full bg-[#58B37C] text-white text-xs font-semibold press-scale flex items-center gap-1 shadow-sm"
                >
                  <span>{isZh ? '完成引导 ✓' : 'Done ✓'}</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

/**
 * Inline interactive onboarding & mock sandbox card for TodayStudioPage.
 * Lets beginners interactively experience a sample FSRS card and voice hint
 * with mock preview data before importing a real wordbook.
 */
export function OnboardingCoreLoopCard() {
  const lang = useAppStore((s) => s.lang)
  const stats = useAppStore((s) => s.stats)
  const cards = useAppStore((s) => s.cards)
  const navigate = useAppStore((s) => s.navigate)
  const openOnboarding = useAppStore((s) => s.openOnboarding)
  const onboardingCardDismissed = useAppStore((s) => s.onboardingCardDismissed)
  const dismissOnboardingCard = useAppStore((s) => s.dismissOnboardingCard)

  const [activeTab, setActiveTab] = useState<'loop' | 'mock-sprint' | 'mock-voice'>('loop')
  const [mockAnswered, setMockAnswered] = useState<string | null>(null)

  const isZh = lang === 'zh'
  const hasWords = (stats?.total ?? 0) > 0
  const hasPlan = cards.length > 0

  if (onboardingCardDismissed) {
    return null
  }

  const mockOptions = [
    {
      label: 'A',
      pos: 'adj.',
      zh: '有弹性的；能快速恢复的（容错自愈）',
      en: 'Able to recover quickly from failures',
      correct: true,
    },
    {
      label: 'B',
      pos: 'adj.',
      zh: '冗余过时的；已被废弃的',
      en: 'Obsolete and no longer maintained',
      correct: false,
    },
    {
      label: 'C',
      pos: 'adj.',
      zh: '同步阻塞的；串行执行的',
      en: 'Blocking and strictly synchronous',
      correct: false,
    },
  ]

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', duration: 0.36, bounce: 0 }}
      className="bg-white rounded-[28px] p-4 border border-[#E5DAC6] shadow-[0_8px_24px_rgba(45,38,30,0.05)] space-y-3"
    >
      {/* Top Bar: Title + Spotlight Tour Trigger + Dismiss */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-[#FFF4D6] text-[#946300] flex items-center justify-center text-xs font-bold border border-[#F4E0A8]">
            ✦
          </span>
          <div>
            <h2 className="font-headline font-semibold text-[16px] text-[#1C202B] leading-tight">
              {isZh ? '新手引导 · 3 步玩转核心闭环' : 'Getting Started · 3-Step Core Loop'}
            </h2>
            <p className="text-[11px] text-[#8C857B]">
              {isZh
                ? '可随时点击体验内置模拟示例，或分步高亮查看功能位置'
                : 'Preview interactive sample cards or launch the 3-step spotlight guide'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => openOnboarding(0)}
            className="px-2.5 py-1 rounded-full bg-[#FFF4D6] text-[#946300] border border-[#F4E0A8] text-[11px] font-semibold press-scale-sm"
          >
            {isZh ? '实景指引' : 'Spotlight'}
          </button>
          <button
            type="button"
            aria-label={isZh ? '收起新手引导' : 'Dismiss guide'}
            onClick={dismissOnboardingCard}
            className="w-7 h-7 rounded-full bg-[#F4EFE6] text-[#8C857B] flex items-center justify-center press-scale-sm"
          >
            <span className="material-symbols-outlined text-[15px]">close</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher: 3-Step Checklist vs Mock Flashcard vs Mock Voice */}
      <div className="bg-[#F4EFE6] p-1 rounded-full flex items-center gap-1 text-[11.5px] font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('loop')}
          className={`flex-1 py-1.5 px-2 rounded-full press-scale ${
            activeTab === 'loop' ? 'bg-[#1C202B] text-white shadow-2xs' : 'text-[#5A554C]'
          }`}
        >
          {isZh ? '1. 核心三步' : '1. Core Steps'}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('mock-sprint')}
          className={`flex-1 py-1.5 px-2 rounded-full press-scale ${
            activeTab === 'mock-sprint' ? 'bg-[#1C202B] text-white shadow-2xs' : 'text-[#5A554C]'
          }`}
        >
          {isZh ? '2. 试刷示例卡' : '2. Sample Card'}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('mock-voice')}
          className={`flex-1 py-1.5 px-2 rounded-full press-scale ${
            activeTab === 'mock-voice' ? 'bg-[#1C202B] text-white shadow-2xs' : 'text-[#5A554C]'
          }`}
        >
          {isZh ? '3. 语音提示示例' : '3. Sample Voice'}
        </button>
      </div>

      {/* Tab 1: 3-Step Actionable Core Loop */}
      {activeTab === 'loop' && (
        <div className="space-y-2">
          {[
            {
              done: hasWords,
              num: '01',
              titleZh: '导入词书 (.json / .csv)',
              titleEn: 'Import a Wordbook (.json / .csv)',
              descZh: '初始化 FSRS 间隔重复卡片，按语境标签自动归类',
              descEn: 'Initialize FSRS memory cards and cluster by topic tags',
              btnZh: '去导入',
              btnEn: 'Import',
              screen: '06-wordbooks-tagging' as ScreenId,
            },
            {
              done: hasPlan,
              num: '02',
              titleZh: '生成今日场景并刷词',
              titleEn: 'Generate Scenario & Sprint',
              descZh: '在真实句子里四选一背词，按反应耗时自动打分',
              descEn: 'Answer 4-choice contextual cards with auto speed grading',
              btnZh: '试玩闪卡',
              btnEn: 'Try Card',
              onClick: () => setActiveTab('mock-sprint'),
              screen: '02-fsrs-sprint-question' as ScreenId,
            },
            {
              done: false,
              num: '03',
              titleZh: '实时语音开口激活目标词',
              titleEn: 'Speak Target Words Live with Pip',
              descZh: '主动用出目标词获记忆加成，卡壳点「提示」看地道回答',
              descEn: 'Use target words in live voice calls or tap Hint when stuck',
              btnZh: '看示例',
              btnEn: 'Preview',
              onClick: () => setActiveTab('mock-voice'),
              screen: '07-voice-studio-lobby' as ScreenId,
            },
          ].map((item) => (
            <div
              key={item.num}
              className="bg-[#F9F6F0] border border-[#EDE6D8] rounded-2xl p-2.5 px-3 flex items-center justify-between gap-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`w-6 h-6 rounded-full text-[11px] font-mono font-bold flex items-center justify-center shrink-0 ${
                    item.done
                      ? 'bg-[#58B37C] text-white'
                      : 'bg-[#EFE6D5] text-[#1C202B] border border-[#DFD4BE]'
                  }`}
                >
                  {item.done ? '✓' : item.num}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#1C202B] truncate">
                    {isZh ? item.titleZh : item.titleEn}
                  </div>
                  <div className="text-[11px] text-[#7A7265] truncate">
                    {isZh ? item.descZh : item.descEn}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (item.onClick) {
                    item.onClick()
                  } else {
                    navigate(item.screen)
                  }
                }}
                className="shrink-0 px-3 py-1.5 rounded-full bg-white border border-[#DCD3C0] text-[#1C202B] text-[11px] font-semibold press-scale-sm"
              >
                {isZh ? item.btnZh : item.btnEn}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Interactive Mock FSRS Card Sandbox */}
      {activeTab === 'mock-sprint' && (
        <div className="bg-[#F9F6F0] border border-[#EDE6D8] rounded-2xl p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="bg-[#F0EDFF] text-[#533FD1] text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full">
              {isZh ? '模拟闪卡体验 (Mock 数据)' : 'Interactive Sample Card (Mock)'}
            </span>
            <button
              type="button"
              onClick={() => void api.playSpeech('resilient')}
              className="text-[11px] font-semibold text-[#946300] bg-[#FFF4D6] px-2.5 py-0.5 rounded-full flex items-center gap-1 press-scale-sm"
            >
              <span className="material-symbols-outlined text-[13px]">volume_up</span>
              <span>resilient /rɪˈzɪliənt/</span>
            </button>
          </div>

          <p className="font-headline italic text-[14.5px] text-[#1C202B] leading-snug bg-[#EFE6D5] p-2.5 rounded-xl border border-[#E2D8C3]">
            “We designed a <strong className="underline decoration-[#F4B844]">resilient</strong>{' '}
            payment queue that recovers automatically after a network spike.”
          </p>

          <div className="space-y-1.5">
            {mockOptions.map((opt) => {
              const chosen = mockAnswered === opt.label
              const showRight = mockAnswered !== null && opt.correct
              const showWrong = chosen && !opt.correct
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    setMockAnswered(opt.label)
                    void api.playSpeech('resilient')
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between border press-scale-sm ${
                    showRight
                      ? 'bg-[#E6F5EC] border-[#58B37C] text-[#1E5E3A] font-semibold'
                      : showWrong
                        ? 'bg-[#FCECE8] border-[#E5735D] text-[#A83825] font-semibold'
                        : 'bg-white border-[#E6E0D4] text-[#1C202B]'
                  }`}
                >
                  <span className="truncate">
                    <strong className="font-mono mr-1.5">{opt.label}.</strong>
                    {opt.pos} {isZh ? opt.zh : opt.en}
                  </span>
                  {showRight && (
                    <span className="text-[10px] font-mono bg-[#58B37C] text-white px-2 py-0.5 rounded-full shrink-0 ml-1">
                      {isZh ? '正确 · FSRS +14d' : 'Correct · +14d'}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Mock Voice Window & Hint Preview */}
      {activeTab === 'mock-voice' && (
        <div className="bg-[#F9F6F0] border border-[#EDE6D8] rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="bg-[#FFF4D6] text-[#946300] text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full">
              {isZh ? '实时语音对练预览 (Mock 示例)' : 'Live Voice & Hint Preview (Mock)'}
            </span>
            <span className="text-[10.5px] font-mono text-[#236B42] bg-[#E6F5EC] px-2 py-0.5 rounded-full">
              {isZh ? '全双工防打断' : 'Full-Duplex'}
            </span>
          </div>

          <div className="bg-[#EFE6D5] rounded-xl p-2.5 border border-[#E2D8C3] text-xs space-y-1">
            <div className="font-semibold text-[#1C202B]">
              {isZh ? '💡 卡壳时点「提示」，流式生成第一人称示范句：' : '💡 Tap Hint anytime for a first-person example:'}
            </div>
            <p className="font-headline italic text-[14px] text-[#1C202B]">
              “To keep the service <strong className="bg-[#FFF4D6] px-1 rounded">resilient</strong>,
              let’s add a circuit breaker before calling the third-party API.”
            </p>
            <p className="text-[11px] text-[#5A554C]">
              {isZh
                ? '为了保持服务的高容错恢复能力，我们在调用第三方接口前加一层熔断机制吧。'
                : 'Automatically mutes mic during TTS demo playback to prevent echo interruption.'}
            </p>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[11px] text-[#8C857B]">
              {isZh
                ? '口语语法/发音偏差将自动收入「记忆 · 错题诊所」'
                : 'Spoken mistakes are saved to Memory Clinic'}
            </span>
            <button
              type="button"
              onClick={() => navigate('07-voice-studio-lobby')}
              className="px-3 py-1 rounded-full bg-[#1C202B] text-white text-[11px] font-semibold press-scale-sm"
            >
              {isZh ? '进入口语台 →' : 'Open Voice →'}
            </button>
          </div>
        </div>
      )}
    </motion.section>
  )
}
