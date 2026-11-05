import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import { LangTogglePill } from '../components/ShellComponents'
import { useRealtimeVoice } from '../hooks/useRealtimeVoice'
import { useSSEHint } from '../hooks/useSSEHint'
import { api } from '../lib/api'
import { parseEmphasis } from '../lib/format'
import { useAppStore } from '../store/useAppStore'

export default function VoiceStudioPage() {
  const currentScreen = useAppStore((s) => s.currentScreen)
  const navigate = useAppStore((s) => s.navigate)
  const lang = useAppStore((s) => s.lang)
  const plan = useAppStore((s) => s.plan)
  const cards = useAppStore((s) => s.cards)
  const words = useAppStore((s) => s.words)
  const mistakes = useAppStore((s) => s.mistakes)
  const studyPlanQuotas = useAppStore((s) => s.studyPlanQuotas)
  const userProfileMd = useAppStore((s) => s.userProfileMd)
  const errorPatternsMd = useAppStore((s) => s.errorPatternsMd)
  const voicePersona = useAppStore((s) => s.voicePersona)
  const setVoicePersona = useAppStore((s) => s.setVoicePersona)
  const isMuted = useAppStore((s) => s.isMuted)
  const toggleMicMute = useAppStore((s) => s.toggleMicMute)
  const hintStreaming = useAppStore((s) => s.hintStreaming)
  const hintTextEn = useAppStore((s) => s.hintTextEn)
  const hintTextZh = useAppStore((s) => s.hintTextZh)
  const playingHintDemo = useAppStore((s) => s.playingHintDemo)
  const proactiveWords = useAppStore((s) => s.proactiveWords)
  const hintAssistedWords = useAppStore((s) => s.hintAssistedWords)
  const triggerNewHintAngle = useAppStore((s) => s.triggerNewHintAngle)
  const playHintDemoWithAutoMute = useAppStore((s) => s.playHintDemoWithAutoMute)
  const completeLiveVoiceSession = useAppStore((s) => s.completeLiveVoiceSession)

  const voiceCall = useRealtimeVoice(plan?.plan_date)
  const { hint: sseHint, request: requestSseHint } = useSSEHint()

  const [elapsedSec, setElapsedSec] = useState(0)
  const [recastCountdown, setRecastCountdown] = useState(5)

  const isZh = lang === 'zh'

  useEffect(() => {
    if (
      currentScreen !== '08-voice-call-active' &&
      currentScreen !== '09-voice-call-recast' &&
      currentScreen !== '10-voice-call-hint'
    ) {
      return
    }
    const id = window.setInterval(() => {
      setElapsedSec((s) => s + 1)
    }, 1000)
    return () => window.clearInterval(id)
  }, [currentScreen])

  useEffect(() => {
    if (currentScreen !== '09-voice-call-recast') return
    setRecastCountdown(5)
    const id = window.setInterval(() => {
      setRecastCountdown((c) => (c > 1 ? c - 1 : 5))
    }, 1000)
    return () => window.clearInterval(id)
  }, [currentScreen])

  const formatClock = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const cyclePersona = () => {
    const order: ('Chelsie' | 'Ethan' | 'Serena')[] = ['Chelsie', 'Ethan', 'Serena']
    const next = order[(order.indexOf(voicePersona) + 1) % order.length]
    setVoicePersona(next)
  }

  const windowSize = studyPlanQuotas.voice_sliding_window_size || 4
  const targetCards = cards.filter((c) => c.is_voice_target)
  const poolCards = targetCards.length > 0 ? targetCards : cards
  const windowTiles = poolCards.slice(0, windowSize).map((c) => ({
    word: c.word,
    pos: c.pos_defs?.[0]?.pos
      ? `${c.pos_defs[0].pos} ${(c.pos_defs[0].def ?? '').split('（')[0].slice(0, 6)}`.trim()
      : c.item_type,
    phonetic: c.phonetic_us || '',
    quote: c.sentence_en ? `“${c.sentence_en}”` : '',
  }))
  const extraQueuedCards = poolCards.slice(windowSize)

  const activeCallSec = voiceCall.elapsed > 0 ? voiceCall.elapsed : elapsedSec
  const completedList =
    voiceCall.completedWords.length > 0 ? voiceCall.completedWords : proactiveWords
  const totalTargetCount = voiceCall.totalTargets || poolCards.length
  const liveMistakes =
    voiceCall.mistakes.length > 0
      ? voiceCall.mistakes.map((m) => ({
          id: m.id,
          category: m.category,
          user_said: m.user_said,
          suggested: m.suggested,
          tip_zh: m.tip_zh,
        }))
      : mistakes.map((m) => ({
          id: m.id,
          category: m.mistake_type,
          user_said: m.user_original,
          suggested: m.corrected_version,
          tip_zh: m.explanation,
        }))
  const latestMistake = liveMistakes[0] ?? null

  // ============================================================================
  // SCREEN 07: VOICE STUDIO LOBBY (PRE-CALL)
  // ============================================================================
  if (currentScreen === '07-voice-studio-lobby') {
    return (
      <div className="min-h-dvh bg-[#F9F6F0] text-[#1C202B] flex flex-col pb-24">
        {/* 2. Header Row: Title & Engine Ready Pill */}
        <div className="px-5 pt-2 pb-2 flex justify-between items-end">
          <div>
            <span className="font-body text-[11px] font-bold uppercase tracking-wider text-[#8C857B]">
              {isZh ? '实时口语演练简报' : 'Live Scenario Brief'}
            </span>
            <h1 className="font-headline font-medium text-[34px] leading-tight text-[#1C202B] tracking-tight">
              {isZh ? '口语工作台' : 'Voice Studio'}
            </h1>
          </div>
          <div className="flex items-center gap-1.5 mb-1">
            <LangTogglePill />
            <button
              type="button"
              onClick={() => navigate('14-engine-router')}
              className="flex items-center gap-1.5 bg-[#E6F5EC] border border-[#C3E6D0] text-[#2E7D4E] font-mono text-[11px] font-semibold px-2.5 py-1.5 rounded-full press-scale"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D4E] animate-pulse" />
              <span>{isZh ? '语音就绪' : 'PCM Ready'}</span>
            </button>
          </div>
        </div>

        {/* Main Content Canvas */}
        <div className="px-4 space-y-4 pt-1 flex-1">
          {/* 3. Companion Roleplay Briefing Card (Warm Champagne Sand #EFE6D5) */}
          <section className="bg-[#EFE6D5] border border-[#E5DAC6] rounded-[28px] p-5 shadow-sm relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-36 h-36 bg-[#FFF9ED]/60 rounded-full blur-2xl pointer-events-none" />

            {/* Top Meta Row */}
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <img
                    alt="Pip avatar"
                    className="w-12 h-12 rounded-full border-2 border-white shadow-sm object-cover bg-[#FBE7DF]"
                    src="/assets/pip-avatar.png"
                  />
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#1C202B] text-white rounded-full flex items-center justify-center shadow-xs border border-white">
                    <span className="material-symbols-outlined text-[11px]">headphones</span>
                  </span>
                </div>
                <div>
                  <span className="font-body font-bold text-xs text-[#1C202B] block">
                    {isZh ? 'Pip · 口语陪练搭档' : 'Pip · Speaking Companion'}
                  </span>
                  <span className="font-body text-[10px] text-[#8C857B]">
                    {isZh ? '全双工实时语音对话' : 'Full-Duplex Voice Session'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={cyclePersona}
                  className="bg-white border border-[#E3D7C2] px-2.5 py-1.5 min-h-[36px] rounded-full text-[11px] font-semibold text-[#1C202B] flex items-center gap-1 press-scale shadow-2xs"
                >
                  <span>
                    {isZh ? `音色: ${voicePersona}` : `Voice: ${voicePersona}`}
                  </span>
                  <span className="material-symbols-outlined text-[13px] text-[#5A554C]">
                    expand_more
                  </span>
                </button>
              </div>
            </div>

            {/* Scenario Title */}
            <h2 className="font-headline font-semibold text-[22px] leading-snug text-[#1C202B] mt-3.5 tracking-tight">
              {plan?.scenario_title ||
                (isZh ? '每日英语情景实战对话' : 'Daily Spoken English Roleplay')}
            </h2>

            {/* Scenario Opening Brief */}
            <p className="font-body text-[13.5px] leading-relaxed text-[#5A554C] mt-2">
              {plan?.scenario_brief ||
                (isZh
                  ? '点击下方按钮启动实时全双工语音对话。Pip 会先开口打招呼，并引导你在自然对话中用出今日目标词；卡壳时可随时点击提示查看地道示例回答。'
                  : 'Tap below to launch a live full-duplex voice session. Pip greets you first and guides you to weave today’s target words into natural conversation.')}
            </p>

            {/* 3-Stage Conversation Rhythm Strip */}
            <div className="mt-4 pt-3.5 border-t border-[#E5DAC6]/70">
              <div className="flex items-center justify-between gap-1 text-[11px] font-medium text-[#7A7366]">
                <div className="flex-1 text-center py-1.5 px-1 rounded-xl bg-[#E6DEC8]/60 border border-[#DDD3BC]">
                  <span className="block text-[10px] uppercase font-bold text-[#8C857B]">
                    {isZh ? '阶段 1' : 'Step 1'}
                  </span>
                  <span className="font-semibold text-[#5A554C] truncate block">
                    {isZh ? '破冰开场' : 'Warmup'}
                  </span>
                </div>
                <span className="material-symbols-outlined text-[12px] text-[#B0A798]">
                  chevron_right
                </span>
                <div className="flex-[1.3] text-center py-1.5 px-1 rounded-xl bg-white border border-[#DDD3BC] shadow-xs">
                  <span className="block text-[10px] uppercase font-bold text-[#6A9AE2]">
                    {isZh ? '阶段 2' : 'Step 2'}
                  </span>
                  <span className="font-semibold text-[#1C202B] truncate block">
                    {isZh ? '滑窗目标词实战' : 'Sliding Window'}
                  </span>
                </div>
                <span className="material-symbols-outlined text-[12px] text-[#B0A798]">
                  chevron_right
                </span>
                <div className="flex-1 text-center py-1.5 px-1 rounded-xl bg-[#E6DEC8]/60 border border-[#DDD3BC]">
                  <span className="block text-[10px] uppercase font-bold text-[#8C857B]">
                    {isZh ? '阶段 3' : 'Step 3'}
                  </span>
                  <span className="font-semibold text-[#5A554C] truncate block">
                    {isZh ? '复盘沉淀' : 'Compaction'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* 4. Sliding Window Target Pool Card */}
          <section className="bg-white border border-[#EBE5D8] rounded-[26px] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-body text-[#1C202B] font-bold text-[15px] tracking-tight">
                {isZh
                  ? `当前活跃目标词窗口（${windowTiles.length} 词）`
                  : `Active Target Window (${windowTiles.length} Words)`}
              </h3>
              <span className="bg-[#EBF2FC] text-[#3C6FB5] border border-[#D1E1FA] text-[10.5px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6A9AE2]" />
                {isZh ? '随对话自动轮换' : 'Auto-rotates in dialogue'}
              </span>
            </div>
            <p className="font-body text-[#736E65] text-[12px] mt-1 leading-normal">
              {isZh
                ? '在对话中主动说出目标词（无需点击提示），系统会自动判定并给予 FSRS 记忆加成。'
                : 'Use target words proactively without hints to earn an automatic FSRS stability boost.'}
            </p>

            {windowTiles.length === 0 ? (
              <div className="mt-3.5 bg-[#F9F6F0] rounded-2xl p-4 border border-[#EDE7DC] text-center space-y-2">
                <p className="font-headline italic text-[15px] text-[#1C202B]">
                  {isZh ? '今日暂未分配口语目标词' : 'No voice target words assigned yet'}
                </p>
                <p className="text-xs text-[#8C857B]">
                  {isZh
                    ? '可先导入词书并生成今日计划，或直接点击下方按钮开始自由英语对话。'
                    : 'Import a wordbook and generate a daily plan, or tap below to start free conversation.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 mt-3.5">
                {windowTiles.map((tile) => (
                  <button
                    key={tile.word}
                    type="button"
                    onClick={() => void api.playSpeech(tile.word)}
                    className="bg-[#F9F6F0] rounded-2xl p-3 border border-[#EDE7DC] flex flex-col justify-between text-left press-scale"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-headline font-semibold text-[17px] text-[#1C202B] truncate">
                          {tile.word}
                        </span>
                        <span className="text-[9.5px] font-mono text-[#8C857B] shrink-0">
                          {tile.pos}
                        </span>
                      </div>
                      {tile.phonetic && (
                        <p className="font-mono text-[10.5px] text-[#736E65] mt-0.5">
                          {tile.phonetic}
                        </p>
                      )}
                      {tile.quote && (
                        <p className="text-[11.5px] italic text-[#3F3A32] font-headline mt-1.5 leading-snug line-clamp-2">
                          {tile.quote}
                        </p>
                      )}
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-[#EFECE4] flex items-center justify-between w-full">
                      <span className="bg-[#E6F5EC] text-[#2E7D4E] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[10px]">bolt</span>
                        {isZh ? '目标词' : 'Target'}
                      </span>
                      <span className="material-symbols-outlined text-[14px] text-[#A69E90]">
                        volume_up
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Footer link row */}
            {extraQueuedCards.length > 0 && (
              <button
                type="button"
                onClick={() => navigate('06-wordbooks-tagging')}
                className="w-full text-left block mt-3 pt-2.5 border-t border-[#F2ECE1] text-[11.5px] font-semibold text-[#8B6E32] press-scale"
              >
                <div className="flex items-center justify-between">
                  <span className="truncate pr-2">
                    <strong className="font-bold text-[#1C202B]">
                      {isZh
                        ? `+${extraQueuedCards.length} 个后续候补词：`
                        : `+${extraQueuedCards.length} more queued:`}
                    </strong>{' '}
                    {extraQueuedCards
                      .slice(0, 4)
                      .map((c) => c.word)
                      .join(', ')}
                  </span>
                  <span className="shrink-0 flex items-center text-[12px]">
                    {isZh ? `全部 ${poolCards.length}` : `View all ${poolCards.length}`}{' '}
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </span>
                </div>
              </button>
            )}
          </section>

          {/* 5. Primary Launch Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                setElapsedSec(0)
                void voiceCall.start()
                navigate('08-voice-call-active')
              }}
              className="w-full h-14 rounded-full bg-[#1C202B] text-white font-body font-semibold text-[15px] shadow-xl press-scale flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px] text-[#EFE6D5]">mic</span>
              <span>{isZh ? '开启实时语音对话' : 'Start Live Voice Session'}</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
            <p className="font-body text-[11px] text-center text-[#8C857B] mt-2 px-3 leading-normal">
              {isZh
                ? '全双工实时音频流 · 不打断对话的轻量纠错卡与按需提示'
                : 'Full-duplex WebSocket PCM audio · Non-blocking mistake cards & on-demand SSE hints'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ============================================================================
  // SCREEN 11: SESSION WRAPPED & MEMORY COMPACTION
  // ============================================================================
  if (currentScreen === '11-session-wrapped') {
    const profileLines = userProfileMd
      .replace(/<!--[\s\S]*?-->/g, '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('- '))
    const errorLines = errorPatternsMd
      .replace(/<!--[\s\S]*?-->/g, '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('- ') || /^\d+\./.test(l))

    return (
      <div className="min-h-dvh bg-[#F9F6F0] text-[#1C202B] relative flex flex-col justify-between overflow-x-hidden pb-8">
        <div className="w-full select-none">
          <div className="flex justify-between items-center px-6 py-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#8C857B] font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#58B37C] animate-pulse" />
              {isZh ? '语音练习 · 本轮小结' : 'Live Session · Wrap'}
            </span>
            <div className="flex items-center gap-1.5">
              <LangTogglePill />
              <button
                type="button"
                aria-label={isZh ? '关闭总结' : 'Dismiss recap'}
                onClick={() => navigate('12-memory-journal')}
                className="w-10 h-10 rounded-full bg-[#EFECE4] press-scale flex items-center justify-center text-[#1C202B] shadow-sm cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Container */}
        <div className="flex-1 px-5 pt-1 space-y-4">
          {/* 2. Celebration Hero Section */}
          <section className="flex flex-col items-center text-center pt-1 pb-1">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              className="relative w-36 h-36 flex items-center justify-center mb-2.5"
            >
              <div className="absolute inset-0 bg-[#F5E2D4]/60 rounded-full blur-2xl transform scale-90 -z-10" />
              <img
                alt="Pip holding a sunflower"
                className="w-32 h-32 object-contain drop-shadow-md select-none pointer-events-none"
                src="/assets/pip-sunflower.png"
              />
            </motion.div>

            <div className="bg-[#FFF4D6] text-[#946300] font-semibold text-xs px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 shadow-sm border border-[#FDE8B5]/60 mb-2.5">
              <span>
                {isZh
                  ? `🎉 语音练习已完成 · ${formatClock(activeCallSec)}`
                  : `🎉 Voice Session Completed · ${formatClock(activeCallSec)}`}
              </span>
            </div>

            <h1 className="font-headline font-bold text-[26px] leading-tight text-[#1C202B] tracking-tight px-1">
              {completedList.length > 0
                ? isZh
                  ? `本轮成功激活 ${completedList.length} 个目标词`
                  : `Activated ${completedList.length} Target Words`
                : isZh
                  ? '本轮口语练习总结'
                  : 'Voice Practice Session Summary'}
            </h1>

            <p className="font-body text-xs text-[#5A554C] mt-2 max-w-[320px] leading-relaxed">
              {isZh
                ? '本次语音练习的词汇激活状态与纠错记录已同步至本地学习档案。'
                : 'Your vocabulary activation status and spoken recasts have been synced to your journal.'}
            </p>
          </section>

          {/* 3. 3-Column Metrics Summary Card */}
          <section className="bg-white rounded-[26px] p-4 border border-[#EBE3D5] shadow-[0_8px_24px_rgba(45,38,30,0.04)]">
            <div className="grid grid-cols-3 divide-x divide-[#F0EAE1] text-center">
              <div className="px-1.5 flex flex-col items-center justify-between">
                <div>
                  <span className="font-headline font-bold text-[22px] leading-none text-[#236B42] block">
                    {isZh ? `${completedList.length} 词` : `${completedList.length} Words`}
                  </span>
                  <span className="text-[11px] font-medium text-[#5A554C] mt-1 block tracking-tight">
                    {isZh ? '主动说出' : 'Used Proactively'}
                  </span>
                </div>
                <span className="bg-[#E6F5EC] text-[#1E7E44] text-[10px] font-semibold px-2 py-0.5 rounded-full mt-2 inline-block border border-[#CDE9D7]">
                  {isZh ? '记忆加成' : 'FSRS Boost'}
                </span>
              </div>

              <div className="px-1.5 flex flex-col items-center justify-between">
                <div>
                  <span className="font-headline font-bold text-[22px] leading-none text-[#946300] block">
                    {isZh
                      ? `${hintAssistedWords.length} 词`
                      : `${hintAssistedWords.length} Words`}
                  </span>
                  <span className="text-[11px] font-medium text-[#5A554C] mt-1 block tracking-tight">
                    {isZh ? '提示辅助' : 'Used with Hint'}
                  </span>
                </div>
                <span className="bg-[#FFF4D6] text-[#A66E00] text-[10px] font-semibold px-2 py-0.5 rounded-full mt-2 inline-block border border-[#FBE7A8]">
                  {isZh ? '已演练' : 'Practiced'}
                </span>
              </div>

              <div className="px-1.5 flex flex-col items-center justify-between">
                <div>
                  <span className="font-headline font-bold text-[22px] leading-none text-[#A83825] block">
                    {isZh ? `${liveMistakes.length} 条` : `${liveMistakes.length} Items`}
                  </span>
                  <span className="text-[11px] font-medium text-[#5A554C] mt-1 block tracking-tight">
                    {isZh ? '收入诊所' : 'Saved to Clinic'}
                  </span>
                </div>
                <span className="bg-[#FCECE8] text-[#C0392B] text-[10px] font-semibold px-2 py-0.5 rounded-full mt-2 inline-block border border-[#F6D2CB]">
                  {isZh ? '纠错记录' : 'Recasts'}
                </span>
              </div>
            </div>
          </section>

          {/* 4. Word Activation Breakdown Card */}
          <section className="bg-[#EFE6D5] rounded-[26px] p-5 border border-[#DFD5C2] shadow-[0_6px_20px_rgba(45,38,30,0.03)]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-[#1C202B]">
                  local_florist
                </span>
                <h2 className="font-headline italic font-medium text-base text-[#1C202B]">
                  {isZh ? '目标词激活明细' : 'Word Activation Breakdown'}
                </h2>
              </div>
              <span className="font-mono text-[10px] text-[#8C857B] font-semibold">
                {isZh
                  ? `已记录 ${completedList.length + hintAssistedWords.length} 词`
                  : `${completedList.length + hintAssistedWords.length} Logged`}
              </span>
            </div>

            {completedList.length === 0 && hintAssistedWords.length === 0 ? (
              <p className="text-xs text-[#5A554C] leading-relaxed">
                {isZh
                  ? '本次通话暂未触发目标词命中记录。生成今日计划并在对话中主动说出目标词后，将在此展示激活明细。'
                  : 'No target words were triggered in this call. Generate a daily plan and use target words during your conversation to see activation details here.'}
              </p>
            ) : (
              <>
                {completedList.length > 0 && (
                  <div className="mb-3">
                    <div className="text-[10px] font-mono tracking-wider text-[#2D5A3C] font-semibold flex items-center gap-1.5 mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#58B37C]" />
                      {isZh
                        ? '主动运用 → FSRS 记忆稳定度提升'
                        : 'PROACTIVE USE → FSRS STABILITY BOOSTED'}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {completedList.map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => void api.playSpeech(w)}
                          className="bg-[#E6F5EC] text-[#1D6A3B] border border-[#CDE9D7] text-xs px-2.5 py-1 rounded-xl font-medium font-mono press-scale"
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {hintAssistedWords.length > 0 && (
                  <div>
                    <div className="text-[10px] font-mono tracking-wider text-[#8A5A00] font-semibold flex items-center gap-1.5 mb-2 mt-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#F4B844]" />
                      {isZh ? '查看提示后运用' : 'USED AFTER SSE HINT'}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {hintAssistedWords.map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => void api.playSpeech(w)}
                          className="bg-[#FFF4D6] text-[#8C5D00] border border-[#FBE7A8] text-xs px-2.5 py-1 rounded-xl font-medium press-scale"
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {/* 5. Daily Memory Compaction Card */}
          <section className="bg-white rounded-[26px] p-5 border border-[#EBE3D5] shadow-[0_8px_24px_rgba(45,38,30,0.04)]">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-[#1C202B]">
                  auto_awesome
                </span>
                <h2 className="font-headline font-bold text-base text-[#1C202B]">
                  {isZh ? 'Markdown 记忆档案快照' : 'Markdown Memory Snapshot'}
                </h2>
              </div>
            </div>

            <div className="mb-3">
              <div className="font-mono text-[11px] font-bold text-[#1C202B] mb-1.5 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px] text-[#5A554C]">
                  description
                </span>
                <span>user_profile.md</span>
              </div>
              <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#EDE7DD] text-xs italic font-headline text-[#4A4742] leading-relaxed">
                “
                {profileLines[0]?.replace(/^-\s*/, '') ||
                  (isZh
                    ? '点击下方按钮查看或编辑 user_profile.md'
                    : 'Tap below to inspect or edit user_profile.md')}
                ”
              </div>
            </div>

            <div>
              <div className="font-mono text-[11px] font-bold text-[#1C202B] mb-1.5 flex items-center gap-1.5 pt-1">
                <span className="material-symbols-outlined text-[14px] text-[#5A554C]">
                  fact_check
                </span>
                <span>error_patterns.md</span>
              </div>
              <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#EDE7DD] text-xs italic font-headline text-[#4A4742] leading-relaxed">
                “
                {errorLines[0]?.replace(/^-\s*/, '') ||
                  (isZh
                    ? '暂无顽疾记录，完成语音整理后将自动归档'
                    : 'No recurring patterns logged yet; auto-archived after compaction')}
                ”
              </div>
            </div>
          </section>
        </div>

        {/* 6. Bottom Dual Action CTAs */}
        <footer className="px-5 pt-4 pb-2 mt-4 select-none">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate('13-memory-editor')}
              className="bg-[#EFECE4] text-[#1C202B] font-semibold text-xs py-3.5 px-3 min-h-[48px] rounded-full flex-1 text-center press-scale flex items-center justify-center gap-1 shadow-sm border border-[#E2DDD3]"
            >
              <span className="material-symbols-outlined text-[15px]">data_object</span>
              <span>{isZh ? '查看记忆文件 (.md)' : 'Inspect Memory (.md)'}</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('12-memory-journal')}
              className="bg-[#1C202B] text-white font-semibold text-xs py-3.5 px-4 min-h-[48px] rounded-full flex-[1.4] text-center shadow-md press-scale flex items-center justify-center gap-1.5"
            >
              <span>{isZh ? '完成 · 返回记忆页' : 'Done · Return to Journal'}</span>
              <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
            </button>
          </div>
        </footer>
      </div>
    )
  }

  // ============================================================================
  // SCREENS 08, 09, 10: ACTIVE VOICE CALL / RECAST TOAST / SSE HINT SHEET
  // ============================================================================
  const isRecastScreen = currentScreen === '09-voice-call-recast'
  const isHintScreen = currentScreen === '10-voice-call-hint'

  const activeWindowWords =
    voiceCall.activeWords.length > 0
      ? voiceCall.activeWords.slice(0, windowSize).map((w) => {
          const found = cards.find((c) => c.word.toLowerCase() === w.toLowerCase())
          return {
            word: w,
            def: found?.pos_defs?.[0]
              ? `${found.pos_defs[0].pos ?? ''} ${found.pos_defs[0].def ?? ''}`.trim()
              : isZh
                ? '目标词汇'
                : 'Target Word',
            done: completedList.some((cw) => cw.toLowerCase() === w.toLowerCase()),
          }
        })
      : windowTiles.map((t) => ({
          word: t.word,
          def: t.pos,
          done: completedList.some((cw) => cw.toLowerCase() === t.word.toLowerCase()),
        }))

  const effectiveHintEn = sseHint.en || hintTextEn
  const effectiveHintZh = sseHint.zh || hintTextZh
  const effectiveHintStreaming = sseHint.streaming || sseHint.loading || hintStreaming

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full flex flex-col justify-between overflow-hidden sprint-shell bg-gradient-to-b from-[#DBD6F5] via-[#F5E2D4] via-40% to-[#F9F6F0] to-85% text-[#1C202B] relative select-none">
      {/* Top Live Header Area */}
      <div className="w-full shrink-0 z-20 pt-1">
        <div className="flex items-center justify-between gap-1.5 px-4 mt-1">
          {/* Left Pill: Stage & JetBrains Mono Timer */}
          <div className="flex items-center gap-1.5 bg-white/85 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-white/60 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-body text-[11px] font-semibold text-[#1C202B]">Pip</span>
            <span className="text-[#1C202B]/30 text-[10px]">·</span>
            <span className="font-mono text-[10px] font-medium text-[#5A554C] tracking-tight tabular-nums">
              {formatClock(activeCallSec)}
            </span>
          </div>

          {/* Center Pill: Bloomed count */}
          <button
            type="button"
            onClick={() =>
              navigate(isRecastScreen ? '08-voice-call-active' : '09-voice-call-recast')
            }
            className="flex items-center gap-1 bg-[#FFF4D6]/90 backdrop-blur-md text-[#926A18] px-2.5 py-1.5 rounded-full border border-[#F4B844]/30 shadow-sm press-scale"
          >
            <span className="material-symbols-outlined text-[13px] fill-icon text-[#F4B844]">
              wb_sunny
            </span>
            <span className="font-body text-[11px] font-bold tracking-tight tabular-nums">
              {isZh
                ? `${completedList.length}/${totalTargetCount} 已激活`
                : `${completedList.length}/${totalTargetCount} Bloomed`}
            </span>
          </button>

          {/* Right Pill: Recasts logged + Lang toggle */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                navigate(isRecastScreen ? '08-voice-call-active' : '09-voice-call-recast')
              }
              className="flex items-center gap-1 bg-[#FCECE8]/90 backdrop-blur-md text-[#C74834] px-2.5 py-1.5 rounded-full border border-[#E5735D]/30 shadow-sm press-scale"
            >
              <span className="material-symbols-outlined text-[12px]">spellcheck</span>
              <span className="font-body text-[11px] font-semibold tabular-nums">
                {isZh ? `${liveMistakes.length} 纠错` : `${liveMistakes.length} Recasts`}
              </span>
            </button>
            <LangTogglePill />
          </div>
        </div>
      </div>

      {/* Middle Call Content */}
      <div className="flex-1 flex flex-col justify-between px-4 pt-2 pb-1 min-h-0 overflow-hidden z-10">
        {isRecastScreen ? (
          <>
            {/* SCREEN 09 HERO: Non-Blocking Floating Linguistic Recast Card */}
            <motion.section
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="relative bg-white rounded-[24px] border-l-[5px] border-[#E5735D] shadow-[0_12px_28px_rgba(45,38,30,0.09)] border-y border-r border-[#EBE4D8] p-3 overflow-hidden shrink-0"
            >
              <div className="flex items-center justify-between mt-0.5 mb-2">
                <span className="bg-[#FCECE8] text-[#A83825] font-mono text-[10px] font-bold tracking-wider px-2.5 py-0.5 rounded-full uppercase">
                  {latestMistake?.category || (isZh ? '口语轻量纠错' : 'LINGUISTIC RECAST')}
                </span>
                <button
                  type="button"
                  onClick={() => navigate('08-voice-call-active')}
                  className="text-[11px] text-[#8C857B] flex items-center gap-1 font-medium press-scale"
                >
                  {isZh
                    ? `自动收入错题诊所 (${recastCountdown}秒)`
                    : `Auto-saves to Clinic (${recastCountdown}s)`}
                  <span className="material-symbols-outlined text-[14px] text-stone-400">
                    close
                  </span>
                </button>
              </div>

              {latestMistake ? (
                <div className="space-y-1.5">
                  <div className="bg-red-50/70 border border-red-100/80 rounded-xl px-2.5 py-1.5">
                    <p className="text-xs text-stone-700 leading-snug">
                      <span className="text-stone-500 font-medium">
                        {isZh ? '原句：' : 'You said: '}
                      </span>
                      &ldquo;{latestMistake.user_said}&rdquo;
                    </p>
                  </div>

                  <div className="bg-amber-50/80 border border-amber-200/70 rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-2">
                    <div className="text-xs text-[#1C202B] leading-tight">
                      <span className="text-amber-800 font-semibold">
                        {isZh ? '地道表达：' : 'Suggested: '}
                      </span>
                      <span className="font-bold text-[#1C202B]">{latestMistake.suggested}</span>
                      {latestMistake.tip_zh && (
                        <span className="block text-[10px] text-amber-900/80 font-medium mt-0.5">
                          {latestMistake.tip_zh}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void api.playSpeech(latestMistake.suggested, 0.9)}
                      className="flex-shrink-0 bg-white text-[#1C202B] text-[11px] font-semibold px-2.5 py-1.5 rounded-full border border-stone-200/90 shadow-xs flex items-center gap-1 press-scale"
                    >
                      <span className="material-symbols-outlined text-[14px] text-amber-700 fill-icon">
                        volume_up
                      </span>
                      <span>{isZh ? '朗读' : 'Demo'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-[#F9F6F0] border border-[#EBE4D8] rounded-xl px-3 py-3 text-xs text-[#5A554C] leading-relaxed">
                  {isZh
                    ? '当前通话暂未产生发音或语法纠错记录。当你在实时对话中出现发音重音、时态或选词偏差时，系统会在此处非阻塞浮现修正提示并自动归档至错题诊所。'
                    : 'No spoken mistakes logged in this call yet. Non-blocking recast suggestions appear here automatically when pronunciation or grammar slips occur.'}
                </div>
              )}
            </motion.section>

            {/* Compact Active Window Strip */}
            <section className="shrink-0">
              <div className="flex items-center justify-between mb-1 px-0.5">
                <span className="font-mono text-[10px] text-stone-500 uppercase tracking-wider font-semibold">
                  {isZh
                    ? `当前目标词滑窗 (${activeWindowWords.length})`
                    : `ACTIVE TARGET WINDOW (${activeWindowWords.length})`}
                </span>
                <span className="text-[10px] text-stone-400 font-medium">
                  {isZh ? '随对话自动轮换' : 'Sliding Context'}
                </span>
              </div>
              {activeWindowWords.length === 0 ? (
                <div className="bg-white/80 border border-[#EBE4D8] rounded-xl p-2.5 text-center text-xs text-[#8C857B]">
                  {isZh ? '暂无活跃窗口目标词' : 'No active target words in window'}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-1.5">
                  {activeWindowWords.map((item) => (
                    <button
                      key={item.word}
                      type="button"
                      onClick={() => void api.playSpeech(item.word)}
                      className="rounded-xl p-1.5 shadow-xs flex flex-col justify-between text-left press-scale bg-white/90 border border-[#EBE4D8]"
                    >
                      <div>
                        <span className="font-semibold text-[11px] text-[#1C202B] truncate block">
                          {item.word}
                        </span>
                        <span className="text-[9.5px] text-[#5A554C] truncate block">
                          {item.def}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Center 3D Companion Pip Avatar */}
            <section className="flex flex-col items-center gap-2 shrink-0">
              <div className="relative flex items-center justify-center py-0.5 sprint-hide-compact">
                <div className="relative w-16 h-16 rounded-full p-1 bg-gradient-to-tr from-amber-200 via-white to-[#E5735D]/30 shadow-[0_8px_20px_rgba(229,115,93,0.25)] flex items-center justify-center">
                  <img
                    alt="Pip avatar"
                    className="w-full h-full object-cover rounded-full"
                    src="/assets/pip-avatar.png"
                  />
                </div>
              </div>

              <div className="w-full bg-[#EFE6D5] rounded-2xl p-3 shadow-sm border border-[#E2D8C3] relative">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-body font-bold text-xs text-[#1C202B]">Pip</span>
                    <span className="material-symbols-outlined text-[15px] text-stone-600 animate-pulse">
                      graphic_eq
                    </span>
                  </div>
                  <span className="bg-[#E5DEC7] text-stone-800 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[#D8CEB4]">
                    {isZh ? '不打断轻量纠错' : 'Non-Blocking Recast Mode'}
                  </span>
                </div>
                <p className="font-headline italic text-[14px] text-[#1C202B] leading-snug font-normal">
                  {voiceCall.transcripts.filter((t) => t.role === 'assistant').slice(-1)[0]?.text ||
                    (isZh
                      ? '纠错卡片仅在顶部短暂浮现 5 秒，绝不打断你的实时口语表达流。'
                      : 'Recast cards float at the top for 5 seconds without interrupting your speaking flow.')}
                </p>
              </div>
            </section>
          </>
        ) : (
          /* SCREEN 08 & UPPER CONTEXT OF SCREEN 10 */
          <>
            {/* Active Sliding Window HUD Card */}
            <section className="bg-white/95 backdrop-blur-md rounded-3xl p-3 shadow-sm border border-[#EBE4D8]/80 shrink-0">
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="font-mono text-[9px] uppercase tracking-wider text-[#1C202B]/60 font-semibold">
                  {isZh
                    ? `当前目标词窗口 (${activeWindowWords.length})`
                    : `Active Target Window (${activeWindowWords.length})`}
                </span>
                <span className="text-[10px] font-mono text-[#5A554C]">
                  {voiceCall.status === 'live'
                    ? isZh
                      ? '实时语音已连接'
                      : 'WebSocket Connected'
                    : voiceCall.status === 'connecting'
                      ? isZh
                        ? '正在连接…'
                        : 'Connecting...'
                      : isZh
                        ? '已就绪'
                        : 'Ready'}
                </span>
              </div>

              {activeWindowWords.length === 0 ? (
                <div className="bg-[#FAF7F2] border border-[#EAE4D7] rounded-2xl p-3 text-center text-xs text-[#8C857B]">
                  {isZh
                    ? '自由英语口语对话模式（今日未指定目标词窗口）'
                    : 'Free conversation mode (no target word window assigned)'}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {activeWindowWords.map((item) => (
                    <button
                      key={item.word}
                      type="button"
                      onClick={() => void api.playSpeech(item.word)}
                      className={`rounded-2xl p-2 flex flex-col justify-between text-left press-scale border ${
                        item.done
                          ? 'bg-[#E6F5EC]/70 border-[#BEE4CD]'
                          : 'bg-[#FAF7F2] border-[#EAE4D7]'
                      }`}
                    >
                      <div className="flex items-start justify-between w-full">
                        <span className="font-headline font-semibold text-[13px] text-[#1C202B] tracking-tight truncate">
                          {item.word}
                        </span>
                        {item.done ? (
                          <span className="text-[9px] font-mono bg-[#236B42] text-white px-1.5 py-0.5 rounded-full leading-none font-semibold">
                            {isZh ? '✦ 已用' : '✦ Used'}
                          </span>
                        ) : (
                          <span className="material-symbols-outlined text-[12px] text-[#1C202B]/40">
                            volume_up
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline justify-between mt-1 text-[10px] text-[#5A554C] w-full">
                        <span className="font-body truncate">{item.def}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Center 3D Companion Stage */}
            <section className="flex flex-col items-center justify-center py-0.5 relative shrink-0 sprint-hide-compact">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#F4B844]/30 via-[#E5735D]/20 to-[#9B8AFB]/30 animate-pulse-ring-outer" />
                <div className="absolute inset-2 rounded-full bg-gradient-to-br from-[#F5E2D4] via-[#FFEADB] to-[#DBD6F5]/40 animate-pulse-ring border border-white/60" />
                <div className="relative w-22 h-22 rounded-full overflow-hidden shadow-lg bg-gradient-to-b from-[#FFEADB] to-[#F5D5C6] p-1 border-2 border-white flex items-center justify-center">
                  <img
                    alt="Pip companion"
                    className="w-full h-full object-cover rounded-full"
                    src="/assets/pip-avatar.png"
                  />
                </div>
                <div className="absolute bottom-0 right-1 w-6 h-6 rounded-full bg-[#1C202B] text-white flex items-center justify-center shadow-md border-2 border-white">
                  <span className="material-symbols-outlined text-[13px]">graphic_eq</span>
                </div>
              </div>
              <div className="mt-1 flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/60 backdrop-blur-sm border border-black/5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-[10px] text-[#5A554C]/90 tracking-tight">
                  {voiceCall.error
                    ? voiceCall.error
                    : isMuted
                      ? isZh
                        ? '麦克风已静音 · 点击左下角恢复'
                        : 'Microphone Muted · Tap Mic to Resume'
                      : isZh
                        ? '全双工 24kHz 实时音频 · 正在聆听'
                        : 'Full-duplex 24kHz PCM · VAD Ready'}
                </span>
              </div>
            </section>

            {/* Dual-Track Editorial Live Transcript */}
            <section className="space-y-2 shrink-0">
              {voiceCall.transcripts.length > 0 ? (
                voiceCall.transcripts.slice(-2).map((line) => (
                  <article
                    key={line.id}
                    className={`rounded-2xl p-3 shadow-sm border relative ${
                      line.role === 'assistant'
                        ? 'bg-[#EFE6D5] border-[#E4DAC7]'
                        : 'bg-white border-[#EDE8E0]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            line.role === 'assistant'
                              ? 'bg-[#1C202B] text-white font-headline italic'
                              : 'bg-[#EFECE4] text-[#1C202B] font-body'
                          }`}
                        >
                          {line.role === 'assistant' ? 'P' : isZh ? '我' : 'You'}
                        </span>
                        <span className="font-body font-bold text-xs text-[#1C202B]">
                          {line.role === 'assistant' ? 'Pip' : isZh ? '你' : 'You'}
                        </span>
                      </div>
                    </div>
                    <p className="font-headline text-[14px] leading-snug text-[#1C202B] line-clamp-3">
                      “{line.text}”
                    </p>
                  </article>
                ))
              ) : (
                <article className="bg-[#EFE6D5] rounded-2xl p-3.5 shadow-sm border border-[#E4DAC7] relative">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-[#1C202B] text-white flex items-center justify-center text-[10px] font-headline italic font-bold">
                        P
                      </span>
                      <span className="font-body font-bold text-xs text-[#1C202B]">Pip</span>
                    </div>
                  </div>
                  <p className="font-headline text-[14px] leading-snug text-[#1C202B] italic">
                    {voiceCall.error
                      ? isZh
                        ? `“连接提示：${voiceCall.error}”`
                        : `“Connection note: ${voiceCall.error}”`
                      : plan?.scenario_brief
                        ? `“${plan.scenario_brief}”`
                        : isZh
                          ? '“实时语音通道已准备就绪，请直接开口用英语交流；需要表达灵感时可点击下方「提示示范回答」。”'
                          : '“Live voice channel is ready—speak freely in English, or tap Hint Example Answer below whenever you want phrasing ideas.”'}
                  </p>
                </article>
              )}
            </section>
          </>
        )}
      </div>

      {/* Bottom 3-Button Voice Control Bar */}
      <footer className="w-full pb-5 pt-2 px-6 flex items-center justify-between gap-3 bg-gradient-to-t from-[#F9F6F0] via-[#F9F6F0]/95 to-transparent shrink-0 z-20">
        {/* Left: Round Mute Toggle Button */}
        <button
          type="button"
          aria-label={isZh ? '静音麦克风' : 'Mute Microphone'}
          onClick={() => {
            voiceCall.toggleMute()
            toggleMicMute()
          }}
          className={`w-[52px] h-[52px] rounded-full shadow-md border flex items-center justify-center press-scale ${
            isMuted
              ? 'bg-[#E5735D] text-white border-[#E5735D]'
              : 'bg-white text-[#1C202B] border-stone-200/80'
          }`}
        >
          <span className="material-symbols-outlined text-[24px]">
            {isMuted ? 'mic_off' : 'mic'}
          </span>
        </button>

        {/* Center: Deep Obsidian Ink Prominent CTA Button */}
        <button
          type="button"
          aria-label={isZh ? '获取提示示范回答' : 'Request Hint Example Answer'}
          onClick={() => {
            if (voiceCall.sessionId) {
              void requestSseHint(voiceCall.sessionId)
            } else {
              triggerNewHintAngle()
            }
            navigate('10-voice-call-hint')
          }}
          className="h-[54px] flex-1 rounded-full bg-[#1C202B] text-white font-body font-semibold text-[13.5px] tracking-tight flex items-center justify-center gap-2 shadow-lg press-scale"
        >
          <span className="material-symbols-outlined text-[#F4B844] text-[18px] fill-icon">
            auto_awesome
          </span>
          <span>{isZh ? '提示示范回答' : 'Hint Example Answer'}</span>
        </button>

        {/* Right: Round Terracotta Coral End Call Button */}
        <button
          type="button"
          aria-label={isZh ? '结束语音通话' : 'End Voice Session'}
          onClick={async () => {
            await voiceCall.hangUp()
            await completeLiveVoiceSession()
          }}
          className="w-[52px] h-[52px] rounded-full bg-[#E5735D] text-white shadow-md flex items-center justify-center press-scale"
        >
          <span className="material-symbols-outlined text-[24px] fill-icon">call_end</span>
        </button>
      </footer>

      {/* ============================================================================
          SCREEN 10: ON-DEMAND SSE HINT DRAWER (Modal Bottom Sheet)
          ============================================================================ */}
      <AnimatePresence>
        {isHintScreen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => navigate('08-voice-call-active')}
              className="absolute inset-0 bg-[#1C202B]/20 backdrop-blur-[2px] z-30"
            />
            <motion.section
              role="dialog"
              aria-label={isZh ? '按需提示抽屉' : 'On-Demand SSE Hint Drawer'}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', duration: 0.28, bounce: 0 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.05, bottom: 0.3 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 80 || info.velocity.y > 420) {
                  navigate('08-voice-call-active')
                }
              }}
              className="absolute bottom-0 left-0 right-0 z-40 w-full bg-[#FAF7F2] rounded-t-[32px] pt-2 pb-5 px-5 shadow-[0_-12px_40px_rgba(28,32,43,0.16)] border-t border-white/70 flex flex-col justify-between"
            >
              <div className="w-10 h-1.5 bg-[#DED6C7] rounded-full mx-auto my-1 cursor-grab" />

              {/* Header Row: Hint Tag + TTS Demo Button */}
              <div className="flex items-center justify-between mt-1 mb-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="bg-[#FFF4D6] text-[#946300] font-semibold text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1 border border-[#F4E0A8]">
                    <span className="material-symbols-outlined text-[13px] text-[#946300] fill-icon">
                      lightbulb
                    </span>
                    {isZh ? '实时口语提示' : 'On-Demand SSE Hint'}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={!effectiveHintEn}
                  onClick={() => void playHintDemoWithAutoMute()}
                  className="bg-[#1C202B] text-white px-3 py-2 min-h-[38px] rounded-full flex items-center gap-2 shadow-sm press-scale disabled:opacity-40"
                >
                  <div className="flex items-center gap-0.5 h-3.5">
                    <span className="w-[2.5px] h-3 bg-[#58B37C] rounded-full wave-bar-gpu-1" />
                    <span className="w-[2.5px] h-3 bg-white rounded-full wave-bar-gpu-2" />
                    <span className="w-[2.5px] h-3 bg-[#F4B844] rounded-full wave-bar-gpu-3" />
                    <span className="w-[2.5px] h-3 bg-white rounded-full wave-bar-gpu-4" />
                  </div>
                  <span className="font-body font-semibold text-[11px] tracking-tight">
                    {playingHintDemo
                      ? isZh
                        ? '正在播放…'
                        : 'Playing...'
                      : isZh
                        ? '听示范发音'
                        : 'Listen Demo'}
                  </span>
                </button>
              </div>

              {/* Auto-Mute Safety Banner (Periwinkle Blue) */}
              <div className="bg-[#EBF2FC] rounded-xl p-2.5 flex items-center gap-2 border border-[#D5E3F7] mb-2.5">
                <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 shadow-2xs">
                  <span className="material-symbols-outlined text-[#2B579A] text-[15px]">
                    mic_off
                  </span>
                </div>
                <p className="text-[10.5px] leading-tight text-[#2B579A] font-medium">
                  {isZh
                    ? '播放示范音频期间自动静音麦克风，防止扬声器回声误触发服务端语音打断。'
                    : 'Automatically mutes microphone during TTS playback to prevent speaker echo from triggering server VAD.'}
                </p>
              </div>

              {/* Streamed English Example Answer Card */}
              <div className="bg-[#EFE6D5] rounded-2xl p-3.5 border border-[#E4DAC6] relative shadow-xs mb-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9.5px] font-bold tracking-wider uppercase text-[#807664] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-[#946300]">
                      auto_awesome
                    </span>
                    {isZh ? '英文 · 第一人称示范回答' : 'EN · Example Response'}
                  </span>
                </div>
                {effectiveHintStreaming ? (
                  <p className="font-headline text-[15px] text-[#1C202B] leading-[1.4]">
                    “{effectiveHintEn.replace(/\*\*/g, '')}”
                    <span className="inline-block w-1.5 h-3.5 bg-[#946300] ml-1 animate-pulse align-middle" />
                  </p>
                ) : effectiveHintEn ? (
                  <p className="font-headline text-[15px] text-[#1C202B] leading-[1.4] tracking-normal">
                    “
                    {parseEmphasis(effectiveHintEn).map((seg, idx) =>
                      seg.strong ? (
                        <span
                          key={idx}
                          className="inline-flex items-baseline bg-[#FFF4D6] text-[#1C202B] px-1.5 py-0.5 rounded-md font-medium border border-[#EED79D] mx-0.5"
                        >
                          {seg.text}
                        </span>
                      ) : (
                        <span key={idx}>{seg.text}</span>
                      ),
                    )}
                    ”
                  </p>
                ) : (
                  <p className="font-body text-xs text-[#5A554C]">
                    {sseHint.error ||
                      (words.length === 0
                        ? isZh
                          ? '请先导入词书并开启实时语音会话，即可在通话中按需流式生成包含目标词的第一人称示例回答。'
                          : 'Import a wordbook and start a live voice session to stream first-person example answers on demand.'
                        : isZh
                          ? '点击下方「换个角度」生成包含当前目标词的示例句。'
                          : 'Tap New Angle below to generate an example sentence with your target words.')}
                  </p>
                )}
              </div>

              {/* Streamed Chinese Contextual Meaning Card */}
              {effectiveHintZh && (
                <div className="bg-white rounded-xl p-3 border border-[#EAE4D7] shadow-xs mb-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#8B8375] mb-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-[#8B8375]">
                      translate
                    </span>
                    {isZh ? '中文 · 对应语境释义' : 'ZH · Contextual Meaning'}
                  </div>
                  <p className="font-body text-[12px] text-[#4A453C] leading-relaxed">
                    {effectiveHintZh}
                  </p>
                </div>
              )}

              {/* Fairness & Grading Transparency Caption Row */}
              <div className="flex items-center justify-center gap-1 px-2 mb-2 text-center">
                <span className="material-symbols-outlined text-[13px] text-[#8A8172]">
                  verified_user
                </span>
                <span className="text-[10px] text-[#8A8172] font-medium leading-none">
                  {isZh ? (
                    <>
                      使用提示后记为辅助运用（
                      <code className="font-mono text-[9.5px] text-[#696154]">USED_WITH_HINT</code>
                      ）
                    </>
                  ) : (
                    <>
                      Marked as Hint-Assisted (
                      <code className="font-mono text-[9.5px] text-[#696154]">USED_WITH_HINT</code>)
                    </>
                  )}
                </span>
              </div>

              {/* Bottom Action Row */}
              <div className="flex items-center gap-2.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (voiceCall.sessionId) {
                      void requestSseHint(voiceCall.sessionId)
                    } else {
                      triggerNewHintAngle()
                    }
                  }}
                  className="bg-[#EFECE4] text-[#524B40] font-body font-semibold text-xs py-3 px-4 min-h-[46px] rounded-full flex items-center justify-center gap-1.5 press-scale border border-[#E0D9CB]"
                >
                  <span className="material-symbols-outlined text-[16px]">cached</span>
                  {isZh ? '换个角度' : 'New Angle'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    toast.success(
                      isZh ? '麦克风已就绪 · 请继续开口' : 'Mic Ready · Continue speaking',
                    )
                    navigate('08-voice-call-active')
                  }}
                  className="flex-1 bg-[#1C202B] text-white font-body font-semibold text-xs py-3.5 px-4 min-h-[46px] rounded-full flex items-center justify-center gap-2 shadow-md press-scale"
                >
                  <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[15px] text-white">mic</span>
                  </span>
                  {isZh ? '返回通话继续说' : 'Return to Call'}
                </button>
              </div>
            </motion.section>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
