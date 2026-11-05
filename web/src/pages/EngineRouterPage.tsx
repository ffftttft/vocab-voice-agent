import { useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { useAppStore } from '../store/useAppStore'
import { AnimatedNumber, StatusBar } from '../components/ShellComponents'

export default function EngineRouterPage() {
  const studyPlanQuotas = useAppStore((s) => s.studyPlanQuotas)
  const adjustQuota = useAppStore((s) => s.adjustQuota)
  const activeRouterStage = useAppStore((s) => s.activeRouterStage)
  const setActiveRouterStage = useAppStore((s) => s.setActiveRouterStage)
  const modelStages = useAppStore((s) => s.modelStages)
  const updateStageField = useAppStore((s) => s.updateStageField)
  const saveAndHotReloadConfig = useAppStore((s) => s.saveAndHotReloadConfig)
  const voicePersona = useAppStore((s) => s.voicePersona)
  const setVoicePersona = useAppStore((s) => s.setVoicePersona)

  const [editingKey, setEditingKey] = useState(false)
  const [reloading, setReloading] = useState(false)

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
            sub: '24kHz S2S',
            icon: 'hub',
            ws: 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime',
            model: 'qwen-omni-turbo-realtime',
          },
          {
            id: 'doubao',
            title: 'Doubao',
            sub: 'SeedDuplex',
            icon: 'waves',
            ws: 'wss://openspeech.bytedance.com/api/v3/realtime',
            model: 'doubao-realtime-voice-v2',
          },
          {
            id: 'openai_realtime',
            title: 'OpenAI S2S',
            sub: 'Realtime API',
            icon: 'cloud_sync',
            ws: 'wss://api.openai.com/v1/realtime',
            model: 'gpt-4o-realtime-preview',
          },
        ]
      : activeRouterStage === 2
        ? [
            {
              id: 'openai_compatible',
              title: 'DeepSeek',
              sub: 'OpenAI Compat',
              icon: 'neurology',
              ws: 'https://api.deepseek.com/v1',
              model: 'deepseek-v4.1-flash',
            },
            {
              id: 'qwen_max',
              title: 'Qwen-Max',
              sub: 'DashScope',
              icon: 'hub',
              ws: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
              model: 'qwen-max-latest',
            },
            {
              id: 'openai_gpt4o',
              title: 'GPT-4o',
              sub: 'Structured',
              icon: 'auto_awesome',
              ws: 'https://api.openai.com/v1',
              model: 'gpt-4o-2024-11-20',
            },
          ]
        : [
            {
              id: 'edge_tts',
              title: 'Edge-TTS',
              sub: 'Zero-Cost Neural',
              icon: 'graphic_eq',
              ws: 'edge-tts://neural-voice-stream',
              model: 'en-US-AndrewMultilingualNeural',
            },
            {
              id: 'cosyvoice',
              title: 'CosyVoice',
              sub: 'DashScope 24k',
              icon: 'record_voice_over',
              ws: 'https://dashscope.aliyuncs.com/api/v1/tts',
              model: 'cosyvoice-v2',
            },
            {
              id: 'openai_tts',
              title: 'OpenAI TTS',
              sub: 'tts-1-hd',
              icon: 'volume_up',
              ws: 'https://api.openai.com/v1/audio/speech',
              model: 'tts-1-hd',
            },
          ]

  const handleHotReload = async () => {
    setReloading(true)
    await saveAndHotReloadConfig()
    window.setTimeout(() => setReloading(false), 600)
  }

  return (
    <div className="min-h-dvh bg-[#F9F6F0] text-[#1C202B] relative overflow-x-hidden flex flex-col pb-28">
      <StatusBar />

      {/* Header Row */}
      <header className="w-full px-6 pt-2 pb-2 max-w-md mx-auto flex justify-between items-center z-10">
        <div>
          <h1 className="font-headline italic text-[30px] leading-tight font-normal text-[#1C202B] tracking-tight">
            Engine &amp; Studio
          </h1>
          <p className="text-[12px] font-medium text-[#8C857B] tracking-wide mt-0.5">
            Runtime Model Hub &amp; FSRS Allocator
          </p>
        </div>
        <div className="bg-[#E6F5EC] text-[#227248] text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm border border-[#58B37C]/20">
          <span className="w-1.5 h-1.5 rounded-full bg-[#58B37C] animate-pulse" />
          <span className="font-mono text-[12px] font-medium">Registry Active</span>
        </div>
      </header>

      {/* Main Scrollable Canvas */}
      <div className="flex-1 px-5 pt-2 space-y-5">
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
                  alt="Chubby coral-pink clay mascot Pip avatar"
                  className="w-full h-full object-cover"
                  src="/assets/pip-avatar.png"
                />
              </div>
              <div>
                <h2 className="font-body font-bold text-[14px] text-[#1C202B] leading-tight flex items-center gap-1">
                  FSRS Scheduler &amp; Daily Quotas
                </h2>
                <p className="text-[12px] text-[#5A554C] font-medium">
                  Deterministic spaced repetition pacing
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
                <span className="text-[12px] font-semibold text-[#8C857B]">Daily New Words</span>
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
                    aria-label="Decrease Daily New Words"
                    onClick={() => adjustQuota('daily_new_words', -5, 5, 100)}
                    className="tap-target-expand w-7 h-7 rounded-full bg-white shadow-xs flex items-center justify-center text-xs font-bold text-[#1C202B] press-scale-sm"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    aria-label="Increase Daily New Words"
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
                <span className="text-[12px] font-semibold text-[#8C857B]">Daily Review Cap</span>
                <span className="material-symbols-outlined text-[15px] text-[#6A9AE2]">repeat</span>
              </div>
              <div className="flex items-end justify-between mt-1">
                <span className="text-2xl font-bold font-body text-[#1C202B] tracking-tight tabular-nums">
                  <AnimatedNumber value={studyPlanQuotas.daily_review_limit} />
                </span>
                <div className="flex items-center gap-1.5 bg-[#F9F6F0] p-1 rounded-full border border-[#EBE4D8]">
                  <button
                    type="button"
                    aria-label="Decrease Daily Review Cap"
                    onClick={() => adjustQuota('daily_review_limit', -10, 10, 300)}
                    className="tap-target-expand w-7 h-7 rounded-full bg-white shadow-xs flex items-center justify-center text-xs font-bold text-[#1C202B] press-scale-sm"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    aria-label="Increase Daily Review Cap"
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
                <span className="text-[12px] font-semibold text-[#8C857B]">Voice Target Pool</span>
                <span className="material-symbols-outlined text-[15px] text-[#E5735D]">
                  record_voice_over
                </span>
              </div>
              <div className="mt-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold font-body text-[#1C202B]">
                    {studyPlanQuotas.voice_target_words_count}
                  </span>
                  <span className="text-[12px] text-[#5A554C] font-medium">words</span>
                </div>
                <div className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-md bg-[#EBF2FC] text-[#2B579A] text-[12px] font-mono font-medium">
                  Window: {studyPlanQuotas.voice_sliding_window_size} active
                </div>
              </div>
            </div>

            {/* Tile 4: FSRS Target Ret. */}
            <div className="bg-white rounded-[18px] p-3 shadow-sm border border-[#E9E1D2] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-semibold text-[#8C857B]">FSRS Target Ret.</span>
                <span className="material-symbols-outlined text-[15px] text-[#58B37C]">
                  verified
                </span>
              </div>
              <div className="mt-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold font-body text-[#1C202B]">90%</span>
                  <span className="text-[12px] text-[#5A554C]">retention</span>
                </div>
                <div className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-md bg-[#E6F5EC] text-[#236B42] text-[12px] font-mono font-medium">
                  Fuzzing: ON
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* 2. Zero-Hardcode 3-Stage Model Router Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-headline italic text-[20px] text-[#1C202B] leading-tight">
                ProviderRegistry Hot-Swap
              </h2>
              <p className="text-[12px] text-[#8C857B] font-medium">
                Multi-engine fallback &amp; zero hardcode
              </p>
            </div>
            <span className="text-[12px] font-mono bg-[#EFE6D5] px-2.5 py-1 rounded-full text-[#5A554C] font-medium">
              Stage {activeRouterStage} of 3
            </span>
          </div>

          {/* Stage Filter Tabs */}
          <div className="bg-[#ECE4D4] p-1 rounded-full flex items-center justify-between gap-1 text-[12px] font-semibold shadow-inner">
            {[
              { stage: 1 as const, label: '1. S2S Duplex', icon: 'graphic_eq' },
              { stage: 2 as const, label: '2. Text LLM', icon: '' },
              { stage: 3 as const, label: '3. TTS Audio', icon: '' },
            ].map((tab) => {
              const active = activeRouterStage === tab.stage
              return (
                <button
                  key={tab.stage}
                  type="button"
                  onClick={() => setActiveRouterStage(tab.stage)}
                  className={`flex-1 py-2 px-2 min-h-[40px] rounded-full flex items-center justify-center gap-1 press-scale tap-target-expand ${
                    active ? 'bg-[#1C202B] text-white shadow-sm' : 'text-[#5A554C]'
                  }`}
                >
                  {tab.icon && (
                    <span className="material-symbols-outlined text-[14px]">{tab.icon}</span>
                  )}
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Active Stage Configuration Card */}
          <motion.div
            key={activeRouterStage}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="bg-white rounded-[26px] p-4.5 shadow-sm border border-[#ECE5D8] space-y-4"
          >
            {/* Provider Selector Row */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold text-[#8C857B] uppercase tracking-wider">
                  Engine Provider Candidate
                </span>
                <span className="text-[12px] font-mono text-[#5A554C]">
                  fallback_priority: [1, 2, 3]
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {candidates.map((cand) => {
                  const selected = currentStageConfig.provider === cand.id
                  return (
                    <button
                      key={cand.id}
                      type="button"
                      onClick={() => {
                        updateStageField(stageKey, 'provider', cand.id)
                        updateStageField(
                          stageKey,
                          activeRouterStage === 1 ? 'ws_url' : 'base_url',
                          cand.ws,
                        )
                        updateStageField(stageKey, 'model_name', cand.model)
                        toast.success(`Selected ${cand.title} (${cand.model})`)
                      }}
                      className={`relative rounded-[18px] p-2.5 flex flex-col justify-between h-[92px] text-left press-scale ${
                        selected
                          ? 'bg-[#FFF7F4] border-2 border-[#E5735D] shadow-xs'
                          : 'bg-[#FBF9F5] border border-[#E8E1D3] opacity-85'
                      }`}
                    >
                      <div className="flex items-start justify-between w-full">
                        <span
                          className={`material-symbols-outlined text-[18px] ${
                            selected ? 'text-[#E5735D]' : 'text-[#8C857B]'
                          }`}
                        >
                          {cand.icon}
                        </span>
                        {selected && (
                          <span className="inline-flex items-center gap-0.5 bg-[#58B37C] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            <span className="material-symbols-outlined text-[10px]">check</span>
                            Active
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="text-[12px] font-bold text-[#1C202B] leading-tight">
                          {cand.title}
                        </div>
                        <div
                          className={`text-[11px] font-mono mt-0.5 ${
                            selected ? 'text-[#E5735D]' : 'text-[#8C857B]'
                          }`}
                        >
                          {cand.sub}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Clean Form Fields */}
            <div className="space-y-2.5 pt-1 border-t border-[#F2ECE1]">
              {/* WS / Base Endpoint */}
              <div>
                <div className="text-[12px] font-semibold text-[#8C857B] mb-1 flex items-center justify-between">
                  <span>{activeRouterStage === 1 ? 'WS Endpoint' : 'Endpoint Base URL'}</span>
                  <span className="text-[12px] text-[#58B37C] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#58B37C]" /> Connected
                  </span>
                </div>
                <div className="bg-[#F9F6F0] rounded-[14px] px-3 py-2 flex items-center justify-between border border-[#EBE3D3]">
                  <span className="font-mono text-[12px] text-[#1C202B] truncate pr-2 min-w-0">
                    {activeRouterStage === 1
                      ? currentStageConfig.ws_url ||
                        'wss://dashscope.aliyuncs.com/api-ws/v1/realtime'
                      : currentStageConfig.base_url || 'https://api.deepseek.com/v1'}
                  </span>
                  <button
                    type="button"
                    aria-label="Copy endpoint"
                    onClick={() => {
                      const val =
                        activeRouterStage === 1
                          ? currentStageConfig.ws_url
                          : currentStageConfig.base_url
                      void navigator.clipboard?.writeText(val)
                      toast.success('Endpoint URL copied to clipboard')
                    }}
                    className="tap-target-expand text-[#8C857B] p-1 press-scale-sm"
                  >
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  </button>
                </div>
              </div>

              {/* Model Name */}
              <div>
                <div className="block text-[12px] font-semibold text-[#8C857B] mb-1">
                  Model Name
                </div>
                <div className="bg-[#F9F6F0] rounded-[14px] px-3 py-2 flex items-center justify-between border border-[#EBE3D3]">
                  <span className="font-mono text-[12px] text-[#1C202B] font-medium truncate">
                    {currentStageConfig.model_name}
                  </span>
                  <span className="px-2 py-0.5 bg-[#E6DEC8]/60 text-[#5A554C] rounded text-[11px] font-mono shrink-0">
                    duplex_native
                  </span>
                </div>
              </div>

              {/* API Key */}
              <div>
                <div className="block text-[12px] font-semibold text-[#8C857B] mb-1">API Key</div>
                <div className="bg-[#F9F6F0] rounded-[14px] px-3 py-2 flex items-center justify-between border border-[#EBE3D3]">
                  {editingKey ? (
                    <input
                      type="text"
                      value={currentStageConfig.api_key}
                      onChange={(e) => updateStageField(stageKey, 'api_key', e.target.value)}
                      className="font-mono text-[16px] text-[#1C202B] bg-transparent w-full focus:outline-none"
                    />
                  ) : (
                    <span className="font-mono text-[12px] text-[#1C202B] tracking-widest">
                      {currentStageConfig.api_key || 'sk-8f••••••••••••••••9a2c'}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditingKey(!editingKey)}
                    className="tap-target-expand text-xs font-semibold text-[#E5735D] bg-[#FCECE8] px-2.5 py-1 rounded-md press-scale shrink-0 ml-2"
                  >
                    {editingKey ? 'Done' : 'Edit'}
                  </button>
                </div>
              </div>

              {/* Voice Persona Selector */}
              <div>
                <div className="text-[12px] font-semibold text-[#8C857B] mb-1.5 flex justify-between items-center">
                  <span>Voice Persona &amp; Sampling</span>
                  <span className="text-[11px] font-mono text-[#2B579A] bg-[#EBF2FC] px-2 py-0.5 rounded">
                    16kHz In / 24kHz Out
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
                        className={`py-2 px-2 min-h-[42px] rounded-xl text-[12px] flex items-center justify-center gap-1.5 press-scale tap-target-expand ${
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
            </div>
          </motion.div>
        </section>

        {/* 3. Quick Peek Summary Strip for Stage 2 & Stage 3 */}
        <section className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[12px] font-semibold text-[#8C857B]">
              Secondary Pipeline Stages
            </span>
            <button
              type="button"
              onClick={() => toast('Fallback pipeline priority verified: [1 → 2 → 3]')}
              className="tap-target-expand text-[12px] text-[#5A554C] underline decoration-dotted press-scale"
            >
              Reorder pipelines
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setActiveRouterStage(2)}
              className="w-full bg-[#EFE6D5]/80 border border-[#E2D7C2] rounded-2xl p-2.5 px-3 min-h-[44px] flex items-center justify-between press-scale"
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white/80 text-[11px] font-bold text-[#1C202B] flex items-center justify-center">
                  2
                </span>
                <span className="text-xs font-semibold text-[#1C202B]">Text LLM</span>
              </div>
              <div className="font-mono text-[12px] text-[#5A554C] flex items-center gap-1">
                <span>{modelStages.text_llm.model_name}</span>
                <span className="text-[#8C857B]">· T:0.7</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveRouterStage(3)}
              className="w-full bg-[#EFE6D5]/80 border border-[#E2D7C2] rounded-2xl p-2.5 px-3 min-h-[44px] flex items-center justify-between press-scale"
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white/80 text-[11px] font-bold text-[#1C202B] flex items-center justify-center">
                  3
                </span>
                <span className="text-xs font-semibold text-[#1C202B]">TTS Audio</span>
              </div>
              <div className="font-mono text-[12px] text-[#5A554C] flex items-center gap-1">
                <span>edge_tts · AndrewNeural</span>
                <span className="text-[#8C857B]">· 1,240 c</span>
              </div>
            </button>
          </div>
        </section>

        {/* 4. Full-Width Primary Action Button */}
        <div className="pt-1 pb-2">
          <button
            type="button"
            onClick={() => void handleHotReload()}
            className="w-full h-[54px] rounded-full bg-[#1C202B] text-white font-semibold text-[15px] shadow-md flex items-center justify-center gap-2 press-scale cursor-pointer"
          >
            <span
              className={`material-symbols-outlined text-[20px] transition-transform duration-300 ${
                reloading ? 'rotate-180' : ''
              }`}
            >
              sync
            </span>
            <span>
              {reloading
                ? 'Reloading Router Registry...'
                : 'Save & Hot-Reload ProviderRegistry'}
            </span>
          </button>
          <p className="text-center text-[12px] font-mono text-[#8C857B] mt-2">
            Zero-downtime hot swap via WebSocket handshake
          </p>
        </div>
      </div>
    </div>
  )
}
