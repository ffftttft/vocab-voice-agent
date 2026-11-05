import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import { useAppStore } from '../store/useAppStore'
import { AnimatedNumber, LangTogglePill } from '../components/ShellComponents'

export default function EngineRouterPage() {
  const navigate = useAppStore((s) => s.navigate)
  const studyPlanQuotas = useAppStore((s) => s.studyPlanQuotas)
  const adjustQuota = useAppStore((s) => s.adjustQuota)
  const activeRouterStage = useAppStore((s) => s.activeRouterStage)
  const setActiveRouterStage = useAppStore((s) => s.setActiveRouterStage)
  const modelStages = useAppStore((s) => s.modelStages)
  const updateStageField = useAppStore((s) => s.updateStageField)
  const saveAndHotReloadConfig = useAppStore((s) => s.saveAndHotReloadConfig)
  const voicePersona = useAppStore((s) => s.voicePersona)
  const setVoicePersona = useAppStore((s) => s.setVoicePersona)
  const autoAudio = useAppStore((s) => s.autoAudio)
  const setAutoAudio = useAppStore((s) => s.setAutoAudio)
  const darkMode = useAppStore((s) => s.darkMode)
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode)
  const lang = useAppStore((s) => s.lang)
  const setLang = useAppStore((s) => s.setLang)
  const openOnboarding = useAppStore((s) => s.openOnboarding)
  const zh = lang === 'zh'

  const [reloading, setReloading] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showCustomOverride, setShowCustomOverride] = useState(false)

  const stageKey =
    activeRouterStage === 1
      ? 'realtime_voice'
      : activeRouterStage === 2
        ? 'text_llm'
        : 'tts'
  const currentStageConfig = modelStages[stageKey]

  const candidates =
    activeRouterStage === 1
      ? [
          {
            id: 'qwen_omni',
            title: 'Qwen-Omni',
            sub: zh ? '24kHz 实时语音' : '24kHz S2S',
            icon: 'hub',
            model: 'qwen-omni-turbo-realtime',
          },
          {
            id: 'doubao',
            title: 'Doubao',
            sub: zh ? '双工语音流' : 'SeedDuplex',
            icon: 'waves',
            model: 'doubao-realtime-voice-v2',
          },
          {
            id: 'openai_realtime',
            title: 'OpenAI S2S',
            sub: zh ? '实时语音接口' : 'Realtime API',
            icon: 'cloud_sync',
            model: 'gpt-4o-realtime-preview',
          },
        ]
      : activeRouterStage === 2
        ? [
            {
              id: 'openai_compatible',
              title: 'DeepSeek',
              sub: zh ? '兼容接口' : 'OpenAI Compat',
              icon: 'neurology',
              model: 'deepseek-chat',
            },
            {
              id: 'qwen_max',
              title: 'Qwen-Max',
              sub: zh ? '结构化造句' : 'Structured',
              icon: 'hub',
              model: 'qwen-max-latest',
            },
            {
              id: 'openai_gpt4o',
              title: 'GPT-4o',
              sub: zh ? '深度推理' : 'Reasoning',
              icon: 'auto_awesome',
              model: 'gpt-4o-2024-11-20',
            },
          ]
        : [
            {
              id: 'edge_tts',
              title: 'Edge-TTS',
              sub: zh ? '自然语音流' : 'Neural Stream',
              icon: 'graphic_eq',
              model: 'en-US-AndrewMultilingualNeural',
            },
            {
              id: 'cosyvoice',
              title: 'CosyVoice',
              sub: zh ? '24kHz 神经音色' : '24kHz Neural',
              icon: 'record_voice_over',
              model: 'cosyvoice-v2',
            },
            {
              id: 'openai_tts',
              title: 'OpenAI TTS',
              sub: 'tts-1-hd',
              icon: 'volume_up',
              model: 'tts-1-hd',
            },
          ]

  const handleSavePreferences = async () => {
    setReloading(true)
    await saveAndHotReloadConfig()
    window.setTimeout(() => setReloading(false), 500)
  }

  return (
    <div
      className="min-h-dvh bg-[#F9F6F0] text-[#1C202B] relative overflow-x-hidden flex flex-col pb-28"
      style={{ paddingTop: 'max(14px, env(safe-area-inset-top, 14px))' }}
    >
      {/* Header Row */}
      <header className="w-full px-6 pt-1 pb-2 max-w-md mx-auto flex justify-between items-center z-10">
        <div>
          <h1 className="font-headline italic text-[28px] leading-tight font-normal text-[#1C202B] tracking-tight">
            {zh ? '学习与语音设置' : 'Study & Voice'}
          </h1>
          <p className="text-[12px] font-medium text-[#8C857B] tracking-wide mt-0.5">
            {zh ? '每日配额、语伴音色与界面偏好' : 'Daily Pacing, Companion Voice & Preferences'}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="bg-[#E6F5EC] text-[#227248] text-xs font-semibold px-2.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm border border-[#58B37C]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#58B37C] animate-pulse" />
            <span className="font-mono text-[11px] font-medium">
              {zh ? '算法就绪' : 'FSRS Active'}
            </span>
          </div>
          <LangTogglePill />
        </div>
      </header>

      {/* Main Scrollable Canvas */}
      <div className="flex-1 px-5 pt-2 space-y-4">
        {/* 1. Daily Study Plan & FSRS Quotas Card */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', duration: 0.36, bounce: 0 }}
          className="bg-[#EFE6D5] rounded-[26px] p-4 border border-[#E4D9C4]/80 shadow-sm relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-sm flex-shrink-0 bg-[#F5E2D4]">
                <img
                  alt={zh ? '语伴头像' : 'Pip companion avatar'}
                  className="w-full h-full object-cover"
                  src="/assets/pip-avatar.png"
                />
              </div>
              <div>
                <h2 className="font-body font-bold text-[14px] text-[#1C202B] leading-tight flex items-center gap-1">
                  {zh ? '间隔重复与每日配额' : 'FSRS Scheduler & Daily Quotas'}
                </h2>
                <p className="text-[12px] text-[#5A554C] font-medium">
                  {zh ? '按记忆衰减曲线智能安排每日复习量' : 'Deterministic spaced repetition pacing'}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-white/80 text-[12px] font-mono text-[#5A554C] border border-[#DDD3C0]">
              v5.2
            </span>
          </div>

          {/* 2x2 Tactile Metric Steppers Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Tile 1: Daily New Words */}
            <div className="bg-white rounded-[18px] p-3 shadow-sm border border-[#E9E1D2] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-semibold text-[#8C857B]">
                  {zh ? '每日新词数' : 'Daily New Words'}
                </span>
                <span className="material-symbols-outlined text-[15px] text-[#F4B844]">
                  add_circle
                </span>
              </div>
              <div className="flex items-end justify-between mt-1">
                <span className="text-2xl font-bold font-body text-[#1C202B] tracking-tight tabular-nums">
                  <AnimatedNumber value={studyPlanQuotas.daily_new_words} />
                </span>
                <div className="flex items-center gap-1.5 bg-[#F9F6F0] p-1 rounded-full border border-[#EBE4D8]">
                  <button
                    type="button"
                    aria-label={zh ? '减少每日新词数' : 'Decrease Daily New Words'}
                    onClick={() => adjustQuota('daily_new_words', -5, 5, 100)}
                    className="tap-target-expand w-7 h-7 rounded-full bg-white shadow-xs flex items-center justify-center text-xs font-bold text-[#1C202B] press-scale-sm"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    aria-label={zh ? '增加每日新词数' : 'Increase Daily New Words'}
                    onClick={() => adjustQuota('daily_new_words', 5, 5, 100)}
                    className="tap-target-expand w-7 h-7 rounded-full bg-white shadow-xs flex items-center justify-center text-xs font-bold text-[#1C202B] press-scale-sm"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Tile 2: Daily Review Cap */}
            <div className="bg-white rounded-[18px] p-3 shadow-sm border border-[#E9E1D2] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-semibold text-[#8C857B]">
                  {zh ? '每日复习上限' : 'Daily Review Cap'}
                </span>
                <span className="material-symbols-outlined text-[15px] text-[#6A9AE2]">repeat</span>
              </div>
              <div className="flex items-end justify-between mt-1">
                <span className="text-2xl font-bold font-body text-[#1C202B] tracking-tight tabular-nums">
                  <AnimatedNumber value={studyPlanQuotas.daily_review_limit} />
                </span>
                <div className="flex items-center gap-1.5 bg-[#F9F6F0] p-1 rounded-full border border-[#EBE4D8]">
                  <button
                    type="button"
                    aria-label={zh ? '减少每日复习上限' : 'Decrease Daily Review Cap'}
                    onClick={() => adjustQuota('daily_review_limit', -10, 10, 300)}
                    className="tap-target-expand w-7 h-7 rounded-full bg-white shadow-xs flex items-center justify-center text-xs font-bold text-[#1C202B] press-scale-sm"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    aria-label={zh ? '增加每日复习上限' : 'Increase Daily Review Cap'}
                    onClick={() => adjustQuota('daily_review_limit', 10, 10, 300)}
                    className="tap-target-expand w-7 h-7 rounded-full bg-white shadow-xs flex items-center justify-center text-xs font-bold text-[#1C202B] press-scale-sm"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Tile 3: Voice Target Pool */}
            <div className="bg-white rounded-[18px] p-3 shadow-sm border border-[#E9E1D2] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-semibold text-[#8C857B]">
                  {zh ? '口语目标词数' : 'Voice Target Pool'}
                </span>
                <span className="material-symbols-outlined text-[15px] text-[#E5735D]">
                  record_voice_over
                </span>
              </div>
              <div className="mt-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold font-body text-[#1C202B]">
                    {studyPlanQuotas.voice_target_words_count}
                  </span>
                  <span className="text-[12px] text-[#5A554C] font-medium">
                    {zh ? '词' : 'words'}
                  </span>
                </div>
                <div className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-md bg-[#EBF2FC] text-[#2B579A] text-[12px] font-mono font-medium">
                  {zh
                    ? `每组 ${studyPlanQuotas.voice_sliding_window_size} 词`
                    : `Window: ${studyPlanQuotas.voice_sliding_window_size} active`}
                </div>
              </div>
            </div>

            {/* Tile 4: FSRS Target Ret. */}
            <div className="bg-white rounded-[18px] p-3 shadow-sm border border-[#E9E1D2] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-semibold text-[#8C857B]">
                  {zh ? '目标记忆留存率' : 'Target Retention'}
                </span>
                <span className="material-symbols-outlined text-[15px] text-[#58B37C]">
                  verified
                </span>
              </div>
              <div className="mt-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold font-body text-[#1C202B]">90%</span>
                  <span className="text-[12px] text-[#5A554C]">
                    {zh ? '回忆率' : 'recall'}
                  </span>
                </div>
                <div className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-md bg-[#E6F5EC] text-[#236B42] text-[12px] font-mono font-medium">
                  {zh ? '平滑离散：开启' : 'Fuzzing: ON'}
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* 2. Voice Companion & Study Experience Card */}
        <section className="bg-white rounded-[26px] p-4.5 shadow-sm border border-[#ECE5D8] space-y-4">
          <div>
            <div className="text-[12px] font-semibold text-[#8C857B] mb-1.5 flex justify-between items-center">
              <span>{zh ? 'Pip 语伴音色' : "Pip's Vocal Persona"}</span>
              <span className="text-[11px] font-mono text-[#2B579A] bg-[#EBF2FC] px-2 py-0.5 rounded">
                {zh ? '全双工语音' : 'Full-Duplex Voice'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(['Chelsie', 'Ethan', 'Serena'] as const).map((persona) => {
                const active = voicePersona === persona
                return (
                  <button
                    key={persona}
                    type="button"
                    onClick={() => {
                      setVoicePersona(persona)
                      updateStageField('realtime_voice', 'voice_id', persona)
                    }}
                    className={`py-2.5 px-2 min-h-[44px] rounded-xl text-[12px] flex items-center justify-center gap-1.5 press-scale tap-target-expand ${
                      active
                        ? 'bg-[#1C202B] text-white font-semibold shadow-xs'
                        : 'bg-[#F9F6F0] border border-[#EBE3D3] text-[#5A554C] font-medium'
                    }`}
                  >
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-[#58B37C]" />}
                    <span>{persona}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Sprint Auto-Audio & Appearance & UI Language Toggles */}
          <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[#F2ECE1]">
            <button
              type="button"
              onClick={() => {
                setAutoAudio(!autoAudio)
                toast(
                  zh
                    ? autoAudio
                      ? '已关闭例句自动朗读'
                      : '已开启例句自动朗读'
                    : autoAudio
                      ? 'Auto Sentence Audio OFF'
                      : 'Auto Sentence Audio ON',
                )
              }}
              className="bg-[#F9F6F0] border border-[#EBE3D3] rounded-2xl p-3 text-left flex items-center justify-between press-scale min-h-[54px]"
            >
              <div>
                <div className="text-xs font-bold text-[#1C202B]">
                  {zh ? '背词自动朗读' : 'Sprint Audio'}
                </div>
                <div className="text-[11px] text-[#8C857B]">
                  {zh
                    ? autoAudio
                      ? '自动播放开启'
                      : '手动点击播放'
                    : autoAudio
                      ? 'Auto-play ON'
                      : 'Manual tap'}
                </div>
              </div>
              <span className="material-symbols-outlined text-[18px] text-[#1C202B]">
                {autoAudio ? 'volume_up' : 'volume_off'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                toggleDarkMode()
                toast(
                  zh
                    ? darkMode
                      ? '已切换为暖白日间主题'
                      : '已切换为夜间护眼主题'
                    : darkMode
                      ? 'Daylight Alabaster Theme'
                      : 'Nocturnal Parchment Theme',
                )
              }}
              className="bg-[#F9F6F0] border border-[#EBE3D3] rounded-2xl p-3 text-left flex items-center justify-between press-scale min-h-[54px]"
            >
              <div>
                <div className="text-xs font-bold text-[#1C202B]">
                  {zh ? '界面外观' : 'Appearance'}
                </div>
                <div className="text-[11px] text-[#8C857B]">
                  {zh
                    ? darkMode
                      ? '夜间护眼'
                      : '暖白纸张'
                    : darkMode
                      ? 'Nocturnal Dark'
                      : 'Warm Daylight'}
                </div>
              </div>
              <span className="material-symbols-outlined text-[18px] text-[#1C202B]">
                {darkMode ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                const next = zh ? 'en' : 'zh'
                setLang(next)
                toast(next === 'zh' ? '已切换为纯中文界面' : 'Switched to English UI')
              }}
              className="bg-[#F9F6F0] border border-[#EBE3D3] rounded-2xl p-3 text-left flex items-center justify-between press-scale min-h-[54px]"
            >
              <div>
                <div className="text-xs font-bold text-[#1C202B]">
                  {zh ? '界面语言' : 'UI Language'}
                </div>
                <div className="text-[11px] text-[#8C857B]">
                  {zh ? '当前：纯中文' : 'Current: English'}
                </div>
              </div>
              <span className="material-symbols-outlined text-[18px] text-[#1C202B]">
                translate
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                navigate('01-today-studio')
                window.setTimeout(() => openOnboarding(0), 120)
              }}
              className="bg-[#F9F6F0] border border-[#EBE3D3] rounded-2xl p-3 text-left flex items-center justify-between press-scale min-h-[54px]"
            >
              <div>
                <div className="text-xs font-bold text-[#1C202B]">
                  {zh ? '新手引导' : 'User Guide'}
                </div>
                <div className="text-[11px] text-[#8C857B]">
                  {zh ? '查看核心三步' : 'Replay 3-step tour'}
                </div>
              </div>
              <span className="material-symbols-outlined text-[18px] text-[#2B579A]">
                explore
              </span>
            </button>
          </div>

          {/* Quick Study Shortcuts */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => navigate('13-memory-editor')}
              className="bg-[#EFE6D5]/70 border border-[#E2D7C2] rounded-2xl p-2.5 px-3 min-h-[44px] flex items-center justify-between text-xs font-semibold text-[#1C202B] press-scale"
            >
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#5A554C]">
                  description
                </span>
                <span>{zh ? '记忆文档' : 'Memory (.md)'}</span>
              </span>
              <span className="material-symbols-outlined text-[14px] text-[#8C857B]">
                chevron_right
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigate('06-wordbooks-tagging')}
              className="bg-[#EFE6D5]/70 border border-[#E2D7C2] rounded-2xl p-2.5 px-3 min-h-[44px] flex items-center justify-between text-xs font-semibold text-[#1C202B] press-scale"
            >
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#5A554C]">
                  upload_file
                </span>
                <span>{zh ? '词书导入' : 'Wordbooks'}</span>
              </span>
              <span className="material-symbols-outlined text-[14px] text-[#8C857B]">
                chevron_right
              </span>
            </button>
          </div>
        </section>

        {/* 3. Primary Save Action Button */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => void handleSavePreferences()}
            className="w-full h-[52px] rounded-full bg-[#1C202B] text-white font-semibold text-[14.5px] shadow-md flex items-center justify-center gap-2 press-scale cursor-pointer"
          >
            <span
              className={`material-symbols-outlined text-[19px] transition-transform duration-300 ${
                reloading ? 'rotate-180' : ''
              }`}
            >
              check_circle
            </span>
            <span>
              {reloading
                ? zh
                  ? '正在保存设置...'
                  : 'Saving Study Preferences...'
                : zh
                  ? '保存学习与语音设置'
                  : 'Save Study & Voice Preferences'}
            </span>
          </button>
        </div>

        {/* 4. Collapsible Advanced / Developer Engine Settings (Default Closed) */}
        <section className="pt-2">
          <button
            type="button"
            aria-expanded={showAdvanced}
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full bg-[#EFECE4] border border-[#E2DACB] rounded-2xl px-4 py-3 min-h-[46px] flex items-center justify-between text-left press-scale"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[17px] text-[#5A554C]">
                developer_board
              </span>
              <div>
                <span className="text-xs font-semibold text-[#1C202B] block">
                  {zh ? '高级模型路由设置（开发者）' : 'Advanced / Developer Model Routing'}
                </span>
                <span className="text-[10.5px] text-[#8C857B] font-mono">
                  {zh
                    ? '三阶段引擎（实时语音 · 文本推理 · 语音合成）'
                    : '3-Stage AI Pipeline (S2S · Text LLM · TTS)'}
                </span>
              </div>
            </div>
            <span className="material-symbols-outlined text-[18px] text-[#5A554C]">
              {showAdvanced ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2.5 bg-white rounded-[24px] p-4 border border-[#ECE5D8] shadow-xs space-y-3.5">
                  {/* Stage Filter Tabs */}
                  <div className="bg-[#ECE4D4] p-1 rounded-full flex items-center justify-between gap-1 text-[12px] font-semibold">
                    {[
                      { stage: 1 as const, label: zh ? '1. 实时语音' : '1. S2S Duplex' },
                      { stage: 2 as const, label: zh ? '2. 文本推理' : '2. Text LLM' },
                      { stage: 3 as const, label: zh ? '3. 语音合成' : '3. TTS Audio' },
                    ].map((tab) => {
                      const active = activeRouterStage === tab.stage
                      return (
                        <button
                          key={tab.stage}
                          type="button"
                          onClick={() => setActiveRouterStage(tab.stage)}
                          className={`flex-1 py-2 px-2 min-h-[38px] rounded-full flex items-center justify-center press-scale ${
                            active ? 'bg-[#1C202B] text-white shadow-sm' : 'text-[#5A554C]'
                          }`}
                        >
                          <span>{tab.label}</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Provider Candidates */}
                  <div className="grid grid-cols-3 gap-2">
                    {candidates.map((cand) => {
                      const selected = currentStageConfig.provider === cand.id
                      return (
                        <button
                          key={cand.id}
                          type="button"
                          onClick={() => {
                            updateStageField(stageKey, 'provider', cand.id)
                            updateStageField(stageKey, 'model_name', cand.model)
                            toast.success(
                              zh
                                ? `已选择 ${cand.title} (${cand.model})`
                                : `Selected ${cand.title} (${cand.model})`,
                            )
                          }}
                          className={`relative rounded-[16px] p-2.5 flex flex-col justify-between h-[84px] text-left press-scale ${
                            selected
                              ? 'bg-[#FFF7F4] border-2 border-[#E5735D] shadow-xs'
                              : 'bg-[#FBF9F5] border border-[#E8E1D3] opacity-85'
                          }`}
                        >
                          <div className="flex items-start justify-between w-full">
                            <span
                              className={`material-symbols-outlined text-[16px] ${
                                selected ? 'text-[#E5735D]' : 'text-[#8C857B]'
                              }`}
                            >
                              {cand.icon}
                            </span>
                            {selected && (
                              <span className="inline-flex items-center bg-[#58B37C] text-white text-[9.5px] font-bold px-1.5 py-0.5 rounded-full">
                                {zh ? '当前' : 'Active'}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="text-[11.5px] font-bold text-[#1C202B] leading-tight">
                              {cand.title}
                            </div>
                            <div className="text-[10px] font-mono text-[#8C857B] mt-0.5">
                              {cand.sub}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {/* Active Model Name */}
                  <div className="bg-[#F9F6F0] rounded-[14px] px-3 py-2 flex items-center justify-between border border-[#EBE3D3]">
                    <span className="text-[11px] font-semibold text-[#8C857B]">
                      {zh ? '当前模型' : 'Active Model'}
                    </span>
                    <span className="font-mono text-[12px] text-[#1C202B] font-medium truncate">
                      {currentStageConfig.model_name}
                    </span>
                  </div>

                  {/* Optional Custom Override Toggle (Hidden by default) */}
                  <div className="pt-1 border-t border-[#F2ECE1]">
                    <button
                      type="button"
                      onClick={() => setShowCustomOverride(!showCustomOverride)}
                      className="text-[11px] font-mono text-[#8C857B] underline decoration-dotted press-scale"
                    >
                      {showCustomOverride
                        ? zh
                          ? '收起自定义接口与密钥覆盖'
                          : 'Hide custom endpoint / key override'
                        : zh
                          ? '覆盖服务端默认接口或密钥（可选）'
                          : 'Override server .env endpoint or key (optional)'}
                    </button>

                    {showCustomOverride && (
                      <div className="mt-2.5 space-y-2">
                        <input
                          type="text"
                          placeholder={
                            zh
                              ? '自定义接口地址（留空则使用服务端默认）'
                              : 'Custom Base / WS URL (leave blank for server default)'
                          }
                          value={
                            activeRouterStage === 1
                              ? currentStageConfig.ws_url
                              : currentStageConfig.base_url
                          }
                          onChange={(e) =>
                            updateStageField(
                              stageKey,
                              activeRouterStage === 1 ? 'ws_url' : 'base_url',
                              e.target.value,
                            )
                          }
                          className="w-full font-mono text-[16px] text-[#1C202B] bg-[#F9F6F0] rounded-xl px-3 py-2 border border-[#EBE3D3] focus:outline-none"
                        />
                        <input
                          type="password"
                          placeholder={
                            zh
                              ? '自定义密钥（默认由服务端环境变量管理）'
                              : 'Custom API Key (managed via server .env)'
                          }
                          value={currentStageConfig.api_key}
                          onChange={(e) => updateStageField(stageKey, 'api_key', e.target.value)}
                          className="w-full font-mono text-[16px] text-[#1C202B] bg-[#F9F6F0] rounded-xl px-3 py-2 border border-[#EBE3D3] focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </div>
  )
}
