import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import { api } from '../lib/api'
import { useAppStore } from '../store/useAppStore'
import { StatusBar } from '../components/ShellComponents'

export default function VoiceStudioPage() {
  const currentScreen = useAppStore((s) => s.currentScreen)
  const navigate = useAppStore((s) => s.navigate)
  const voicePersona = useAppStore((s) => s.voicePersona)
  const setVoicePersona = useAppStore((s) => s.setVoicePersona)
  const isMuted = useAppStore((s) => s.isMuted)
  const toggleMicMute = useAppStore((s) => s.toggleMicMute)
  const hintStreaming = useAppStore((s) => s.hintStreaming)
  const hintTextEn = useAppStore((s) => s.hintTextEn)
  const hintTextZh = useAppStore((s) => s.hintTextZh)
  const playingHintDemo = useAppStore((s) => s.playingHintDemo)
  const triggerNewHintAngle = useAppStore((s) => s.triggerNewHintAngle)
  const playHintDemoWithAutoMute = useAppStore((s) => s.playHintDemoWithAutoMute)
  const completeLiveVoiceSession = useAppStore((s) => s.completeLiveVoiceSession)

  const [elapsedSec, setElapsedSec] = useState(868) // 14:28
  const [recastCountdown, setRecastCountdown] = useState(4)

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
    setRecastCountdown(4)
    const id = window.setInterval(() => {
      setRecastCountdown((c) => (c > 1 ? c - 1 : 4))
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

  // ============================================================================
  // SCREEN 07: VOICE STUDIO LOBBY (PRE-CALL)
  // ============================================================================
  if (currentScreen === '07-voice-studio-lobby') {
    const windowTiles = [
      {
        word: 'deprecate',
        pos: 'v. 弃用',
        phonetic: '/ˈdeprəkeɪt/',
        quote: '“deprecate the legacy webhook”',
      },
      {
        word: 'idempotent',
        pos: 'adj. 幂等',
        phonetic: '/ˌaɪdemˈpoʊtnt/',
        quote: '“keep retry calls idempotent”',
      },
      {
        word: 'bottleneck',
        pos: 'n. 瓶颈',
        phonetic: '/ˈbɑːtlnek/',
        quote: '“pinpoint the I/O bottleneck”',
      },
      {
        word: 'ratify',
        pos: 'v. 批准',
        phonetic: '/ˈrætɪfaɪ/',
        quote: '“ratify the migration RFC”',
      },
    ]

    return (
      <div className="min-h-dvh bg-[#F9F6F0] text-[#1C202B] flex flex-col pb-24">
        <StatusBar />

        {/* 2. Header Row: Title & Engine Ready Pill */}
        <div className="px-5 pt-2 pb-2 flex justify-between items-end">
          <div>
            <span className="font-body text-[11px] font-bold uppercase tracking-wider text-[#8C857B]">
              Live Scenario Brief
            </span>
            <h1 className="font-headline font-medium text-[34px] leading-tight text-[#1C202B] tracking-tight">
              Voice Studio
            </h1>
          </div>
          <button
            type="button"
            onClick={() => navigate('14-engine-router')}
            className="flex items-center gap-1.5 bg-[#E6F5EC] border border-[#C3E6D0] text-[#2E7D4E] font-mono text-[11px] font-semibold px-2.5 py-1.5 rounded-full mb-1 press-scale"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D4E] animate-pulse" />
            <span>Qwen-Omni Ready · 16k/24k PCM</span>
          </button>
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
                    alt="Chubby coral-pink clay mascot Pip avatar with warm glowing halo"
                    className="w-12 h-12 rounded-full border-2 border-white shadow-sm object-cover bg-[#FBE7DF]"
                    src="/assets/pip-avatar.png"
                  />
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#1C202B] text-white rounded-full flex items-center justify-center shadow-xs border border-white">
                    <span className="material-symbols-outlined text-[11px]">headphones</span>
                  </span>
                </div>
                <div>
                  <span className="font-body font-bold text-xs text-[#1C202B] block">
                    Pip · Tech Lead
                  </span>
                  <span className="font-body text-[10px] text-[#8C857B]">
                    Studio Headset Online
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={cyclePersona}
                  className="bg-white border border-[#E3D7C2] px-2.5 py-1.5 min-h-[36px] rounded-full text-[11px] font-semibold text-[#1C202B] flex items-center gap-1 press-scale shadow-2xs"
                >
                  <span>Voice: {voicePersona}</span>
                  <span className="material-symbols-outlined text-[13px] text-[#5A554C]">
                    expand_more
                  </span>
                </button>
                <div className="bg-[#FDF3DB] border border-[#F4E3B7] text-[#9A6700] px-2 py-1 rounded-full text-[11px] font-bold">
                  25 Min Target
                </div>
              </div>
            </div>

            {/* Scenario Title */}
            <h2 className="font-headline font-semibold text-[22px] leading-snug text-[#1C202B] mt-3.5 tracking-tight">
              Episode 14: Production Post-Mortem &amp; API Deprecation
            </h2>

            {/* Scenario Opening Brief */}
            <p className="font-body text-[13.5px] leading-relaxed text-[#5A554C] mt-2">
              Pip will open the call as your tech lead asking about today&apos;s payment webhook
              incident. Weave the active window words into your replies naturally—Pip will recast
              minor slips without interrupting your flow.
            </p>

            {/* 3-Stage Conversation Rhythm Strip */}
            <div className="mt-4 pt-3.5 border-t border-[#E5DAC6]/70">
              <div className="flex items-center justify-between gap-1 text-[11px] font-medium text-[#7A7366]">
                <div className="flex-1 text-center py-1.5 px-1 rounded-xl bg-[#E6DEC8]/60 border border-[#DDD3BC]">
                  <span className="block text-[10px] uppercase font-bold text-[#8C857B]">
                    Part 1
                  </span>
                  <span className="font-semibold text-[#5A554C] truncate block">
                    Icebreaker (0-2m)
                  </span>
                </div>
                <span className="material-symbols-outlined text-[12px] text-[#B0A798]">
                  chevron_right
                </span>
                <div className="flex-[1.3] text-center py-1.5 px-1 rounded-xl bg-white border border-[#DDD3BC] shadow-xs">
                  <span className="block text-[10px] uppercase font-bold text-[#6A9AE2]">
                    Core Focus
                  </span>
                  <span className="font-semibold text-[#1C202B] truncate block">
                    Deep Dive (2-22m)
                  </span>
                </div>
                <span className="material-symbols-outlined text-[12px] text-[#B0A798]">
                  chevron_right
                </span>
                <div className="flex-1 text-center py-1.5 px-1 rounded-xl bg-[#E6DEC8]/60 border border-[#DDD3BC]">
                  <span className="block text-[10px] uppercase font-bold text-[#8C857B]">
                    Part 3
                  </span>
                  <span className="font-semibold text-[#5A554C] truncate block">
                    Compact (22-25m)
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* 4. Sliding Window Target Pool Card */}
          <section className="bg-white border border-[#EBE5D8] rounded-[26px] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-body text-[#1C202B] font-bold text-[15px] tracking-tight">
                Initial Active Window (4 Words)
              </h3>
              <span className="bg-[#EBF2FC] text-[#3C6FB5] border border-[#D1E1FA] text-[10.5px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6A9AE2]" />
                Auto-rotates in dialogue
              </span>
            </div>
            <p className="font-body text-[#736E65] text-[12px] mt-1 leading-normal">
              Speak any word naturally without tapping Hint to earn an automatic FSRS Easy (+1)
              retention boost.
            </p>

            {/* 2x2 Grid of Initial 4 Active Window Target Chips */}
            <div className="grid grid-cols-2 gap-2.5 mt-3.5">
              {windowTiles.map((tile) => (
                <button
                  key={tile.word}
                  type="button"
                  onClick={() => void api.playSpeech(tile.word)}
                  className="bg-[#F9F6F0] rounded-2xl p-3 border border-[#EDE7DC] flex flex-col justify-between text-left press-scale"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <span className="font-headline font-semibold text-[17px] text-[#1C202B]">
                        {tile.word}
                      </span>
                      <span className="text-[9.5px] font-mono text-[#8C857B]">{tile.pos}</span>
                    </div>
                    <p className="font-mono text-[10.5px] text-[#736E65] mt-0.5">{tile.phonetic}</p>
                    <p className="text-[11.5px] italic text-[#3F3A32] font-headline mt-1.5 leading-snug">
                      {tile.quote}
                    </p>
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-[#EFECE4] flex items-center justify-between w-full">
                    <span className="bg-[#E6F5EC] text-[#2E7D4E] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[10px]">bolt</span>
                      +Easy Boost
                    </span>
                    <span className="material-symbols-outlined text-[14px] text-[#A69E90]">
                      volume_up
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Footer link row */}
            <button
              type="button"
              onClick={() => navigate('06-wordbooks-tagging')}
              className="w-full text-left block mt-3 pt-2.5 border-t border-[#F2ECE1] text-[11.5px] font-semibold text-[#8B6E32] press-scale"
            >
              <div className="flex items-center justify-between">
                <span className="truncate pr-2">
                  <strong className="font-bold text-[#1C202B]">+18 more queued:</strong> contingent,
                  ameliorate, latency, payload...
                </span>
                <span className="shrink-0 flex items-center text-[12px]">
                  View all 22{' '}
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </span>
              </div>
            </button>
          </section>

          {/* 5. Primary Launch Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => navigate('08-voice-call-active')}
              className="w-full h-14 rounded-full bg-[#1C202B] text-white font-body font-semibold text-[15px] shadow-xl press-scale flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px] text-[#EFE6D5]">mic</span>
              <span>Start 25-Min Live Voice Session</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
            <p className="font-body text-[11px] text-center text-[#8C857B] mt-2 px-3 leading-normal">
              Low-latency duplex voice via WebRTC · Auto-saves post-call lexicon analytics
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
    return (
      <div className="min-h-dvh bg-[#F9F6F0] text-[#1C202B] relative flex flex-col justify-between overflow-x-hidden pb-8">
        <div className="w-full select-none">
          <StatusBar />
          <div className="flex justify-between items-center px-6 py-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#8C857B] font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#58B37C] animate-pulse" />
              Live Session 14 · Wrap
            </span>
            <button
              type="button"
              aria-label="Dismiss recap"
              onClick={() => navigate('12-memory-journal')}
              className="w-11 h-11 rounded-full bg-[#EFECE4] press-scale flex items-center justify-center text-[#1C202B] shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
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
                alt="Chubby coral-pink clay mascot Pip avatar holding a warm blooming sunflower"
                className="w-32 h-32 object-contain drop-shadow-md select-none pointer-events-none"
                src="/assets/pip-sunflower.png"
              />
            </motion.div>

            <div className="bg-[#FFF4D6] text-[#946300] font-semibold text-xs px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 shadow-sm border border-[#FDE8B5]/60 mb-2.5">
              <span>🎉 Episode 14 Completed · 24m 18s</span>
            </div>

            <h1 className="font-headline font-bold text-[28px] leading-tight text-[#1C202B] tracking-tight px-1">
              Tonight&apos;s Talk Bloomed 19 Words
            </h1>

            <p className="font-body text-xs text-[#5A554C] mt-2 max-w-[320px] leading-relaxed">
              FSRS stability boosted · 3 pronunciation recasts logged · Nightly memory compaction
              finished.
            </p>
          </section>

          {/* 3. 3-Column Metrics Summary Card */}
          <section className="bg-white rounded-[26px] p-4 border border-[#EBE3D5] shadow-[0_8px_24px_rgba(45,38,30,0.04)]">
            <div className="grid grid-cols-3 divide-x divide-[#F0EAE1] text-center">
              <div className="px-1.5 flex flex-col items-center justify-between">
                <div>
                  <span className="font-headline font-bold text-[22px] leading-none text-[#236B42] block">
                    15 Words
                  </span>
                  <span className="text-[11px] font-medium text-[#5A554C] mt-1 block tracking-tight">
                    Used Proactively
                  </span>
                </div>
                <span className="bg-[#E6F5EC] text-[#1E7E44] text-[10px] font-semibold px-2 py-0.5 rounded-full mt-2 inline-block border border-[#CDE9D7]">
                  FSRS +Easy Boost
                </span>
              </div>

              <div className="px-1.5 flex flex-col items-center justify-between">
                <div>
                  <span className="font-headline font-bold text-[22px] leading-none text-[#946300] block">
                    4 Words
                  </span>
                  <span className="text-[11px] font-medium text-[#5A554C] mt-1 block tracking-tight">
                    Used with SSE Hint
                  </span>
                </div>
                <span className="bg-[#FFF4D6] text-[#A66E00] text-[10px] font-semibold px-2 py-0.5 rounded-full mt-2 inline-block border border-[#FBE7A8]">
                  Practiced
                </span>
              </div>

              <div className="px-1.5 flex flex-col items-center justify-between">
                <div>
                  <span className="font-headline font-bold text-[22px] leading-none text-[#A83825] block">
                    3 Items
                  </span>
                  <span className="text-[11px] font-medium text-[#5A554C] mt-1 block tracking-tight">
                    Saved to Clinic
                  </span>
                </div>
                <span className="bg-[#FCECE8] text-[#C0392B] text-[10px] font-semibold px-2 py-0.5 rounded-full mt-2 inline-block border border-[#F6D2CB]">
                  2 Pronun · 1 Gram
                </span>
              </div>
            </div>
          </section>

          {/* 4. Word Activation Breakdown Card */}
          <section className="bg-[#EFE6D5] rounded-[26px] p-5 border border-[#DFD5C2] shadow-[0_6px_20px_rgba(45,38,30,0.03)]">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-[#1C202B]">
                  local_florist
                </span>
                <h2 className="font-headline italic font-medium text-base text-[#1C202B]">
                  Word Activation Breakdown
                </h2>
              </div>
              <span className="font-mono text-[10px] text-[#8C857B] font-semibold">19 Logged</span>
            </div>

            {/* Group 1: Proactive Use */}
            <div className="mb-3">
              <div className="text-[10px] font-mono tracking-wider text-[#2D5A3C] font-semibold flex items-center gap-1.5 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#58B37C]" />
                PROACTIVE USE → FSRS STABILITY BOOSTED
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { w: 'deprecate', s: '(S: 11d → 26d)' },
                  { w: 'idempotent', s: '(S: 8d → 19d)' },
                  { w: 'payload', s: '(S: 14d → 31d)' },
                ].map((item) => (
                  <button
                    key={item.w}
                    type="button"
                    onClick={() => void api.playSpeech(item.w)}
                    className="bg-[#E6F5EC] text-[#1D6A3B] border border-[#CDE9D7] text-xs px-2.5 py-1 rounded-xl font-medium font-mono press-scale"
                  >
                    {item.w} <span className="opacity-75 text-[10px]">{item.s}</span>
                  </button>
                ))}
                <span className="bg-[#E6F5EC]/80 text-[#1D6A3B] text-xs px-2.5 py-1 rounded-xl font-semibold border border-[#CDE9D7]/80 flex items-center">
                  +12 more
                </span>
              </div>
            </div>

            {/* Group 2: Hint Assisted */}
            <div className="mb-3">
              <div className="text-[10px] font-mono tracking-wider text-[#8A5A00] font-semibold flex items-center gap-1.5 mb-2 mt-3.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F4B844]" />
                USED AFTER SSE HINT → RETAINED FOR REVIEW
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['ratify', 'contingent', 'bottleneck', 'ameliorate'].map((w) => (
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

            {/* Group 3: Missed Tonight */}
            <div>
              <div className="text-[10px] font-mono tracking-wider text-[#983424] font-semibold flex items-center gap-1.5 mb-2 mt-3.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E5735D]" />
                MISSED TONIGHT → PRIORITY TOMORROW
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['reconcile', 'latency', 'granularity'].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => void api.playSpeech(w)}
                    className="bg-[#FCECE8] text-[#9E3424] border border-[#F6D2CB] text-xs px-2.5 py-1 rounded-xl font-medium press-scale"
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* 5. Daily Memory Compaction Card */}
          <section className="bg-white rounded-[26px] p-5 border border-[#EBE3D5] shadow-[0_8px_24px_rgba(45,38,30,0.04)]">
            <div className="flex items-start justify-between gap-2 mb-3.5">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-[#1C202B]">
                  auto_awesome
                </span>
                <h2 className="font-headline font-bold text-base text-[#1C202B]">
                  Daily Memory Compaction Complete
                </h2>
              </div>
            </div>
            <div className="mb-3.5">
              <span className="bg-[#F0EDFF] text-[#533FD1] text-[10px] font-mono font-semibold px-2.5 py-1 rounded-full border border-[#DDD6FE] inline-flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-[#533FD1]" />
                Transcript Cleared · Context Clean
              </span>
            </div>

            <div className="mb-3">
              <div className="font-mono text-[11px] font-bold text-[#1C202B] mb-1.5 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px] text-[#5A554C]">
                  description
                </span>
                <span>user_profile.md · +1 New Work Fact Extracted</span>
              </div>
              <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#EDE7DD] text-xs italic font-headline text-[#4A4742] leading-relaxed">
                &ldquo;Shipping the new payment webhook microservice next Friday; coordinating
                rate-limit RFC with tech leads.&rdquo;
              </div>
            </div>

            <div>
              <div className="font-mono text-[11px] font-bold text-[#1C202B] mb-1.5 flex items-center gap-1.5 pt-1">
                <span className="material-symbols-outlined text-[14px] text-[#5A554C]">
                  fact_check
                </span>
                <span>error_patterns.md · Updated Top 15 Blindspots</span>
              </div>
              <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#EDE7DD] text-xs italic font-headline text-[#4A4742] leading-relaxed">
                &ldquo;Merged stress pattern reminder for 3-syllable verbs ending in -ate (e.g.,
                /ˈdeprəkeɪt/).&rdquo;
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
              <span>Inspect Memory (.md)</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('12-memory-journal')}
              className="bg-[#1C202B] text-white font-semibold text-xs py-3.5 px-4 min-h-[48px] rounded-full flex-[1.4] text-center shadow-md press-scale flex items-center justify-center gap-1.5"
            >
              <span>Done · Return to Journal</span>
              <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
            </button>
          </div>
          <div className="w-32 h-1 bg-[#1C202B]/20 rounded-full mx-auto mt-4" />
        </footer>
      </div>
    )
  }

  // ============================================================================
  // SCREENS 08, 09, 10: ACTIVE VOICE CALL / RECAST TOAST / SSE HINT SHEET
  // ============================================================================
  const isRecastScreen = currentScreen === '09-voice-call-recast'
  const isHintScreen = currentScreen === '10-voice-call-hint'

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full flex flex-col justify-between overflow-hidden sprint-shell bg-gradient-to-b from-[#DBD6F5] via-[#F5E2D4] via-40% to-[#F9F6F0] to-85% text-[#1C202B] relative select-none">
      {/* Top Status Bar & Live Header Area */}
      <div className="w-full shrink-0 z-20">
        <StatusBar compact />
        <div className="flex items-center justify-between gap-1.5 px-5 mt-1">
          {/* Left Pill: Stage & JetBrains Mono Timer */}
          <div className="flex items-center gap-1.5 bg-white/85 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-white/60 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-body text-[11px] font-semibold text-[#1C202B]">Pip</span>
            <span className="text-[#1C202B]/30 text-[10px]">·</span>
            <span className="font-mono text-[10px] font-medium text-[#5A554C] tracking-tight">
              {isRecastScreen
                ? '16:05 / 25:00'
                : isHintScreen
                ? '17:42 / 25:00'
                : `${formatClock(elapsedSec)} / 25:00`}
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
            <span className="font-body text-[11px] font-bold tracking-tight">
              {isRecastScreen || isHintScreen ? '11/22 Bloomed' : '9/22 Bloomed'}
            </span>
          </button>

          {/* Right Pill: Recasts logged */}
          <button
            type="button"
            onClick={() =>
              navigate(isRecastScreen ? '08-voice-call-active' : '09-voice-call-recast')
            }
            className="flex items-center gap-1 bg-[#FCECE8]/90 backdrop-blur-md text-[#C74834] px-2.5 py-1.5 rounded-full border border-[#E5735D]/30 shadow-sm press-scale"
          >
            <span className="material-symbols-outlined text-[12px]">spellcheck</span>
            <span className="font-body text-[11px] font-semibold">
              {isRecastScreen || isHintScreen ? '3 Recasts' : '2 Recasts'}
            </span>
          </button>
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
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-red-100">
                <div className="h-full bg-[#E5735D] w-[80%] rounded-r-full" />
              </div>

              <div className="flex items-center justify-between mt-0.5 mb-2">
                <span className="bg-[#FCECE8] text-[#A83825] font-mono text-[10px] font-bold tracking-wider px-2.5 py-0.5 rounded-full uppercase">
                  PRONUNCIATION &amp; STRESS RECAST
                </span>
                <button
                  type="button"
                  onClick={() => navigate('08-voice-call-active')}
                  className="text-[11px] text-[#8C857B] flex items-center gap-1 font-medium press-scale"
                >
                  Auto-saves to Clinic in {recastCountdown}s
                  <span className="material-symbols-outlined text-[14px] text-stone-400">
                    close
                  </span>
                </button>
              </div>

              <div className="space-y-1.5">
                <div className="bg-red-50/70 border border-red-100/80 rounded-xl px-2.5 py-1.5">
                  <p className="text-xs text-stone-700 leading-snug">
                    <span className="text-stone-500 font-medium">You said: </span>
                    &ldquo;we need to{' '}
                    <span className="text-red-600 font-bold underline decoration-red-300 decoration-2">
                      de-PRE-cate
                    </span>{' '}
                    <span className="font-mono text-[11px] text-red-700 font-medium">
                      (/dɪˈprekeɪt/)
                    </span>{' '}
                    the old API&rdquo;
                  </p>
                </div>

                <div className="bg-amber-50/80 border border-amber-200/70 rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-2">
                  <div className="text-xs text-[#1C202B] leading-tight">
                    <span className="text-amber-800 font-semibold">Try: </span>
                    <span className="font-bold text-[#1C202B]">deprecate</span>{' '}
                    <span className="font-mono text-[11px] text-[#1C202B]/90 font-medium">
                      (/ˈdeprəkeɪt/)
                    </span>
                    <span className="block text-[10px] text-amber-900/80 font-medium mt-0.5">
                      Primary stress on 1st syllable DEP
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void api.playSpeech('deprecate', 0.85)}
                    className="flex-shrink-0 bg-white text-[#1C202B] text-[11px] font-semibold px-2.5 py-1.5 rounded-full border border-stone-200/90 shadow-xs flex items-center gap-1 press-scale"
                  >
                    <span className="material-symbols-outlined text-[14px] text-amber-700 fill-icon">
                      volume_up
                    </span>
                    <span>Slow Demo</span>
                  </button>
                </div>
              </div>

              <div className="pt-1.5 border-t border-stone-100 mt-1.5 sprint-hide-compact">
                <p className="font-body text-[11px] text-[#5A554C] leading-snug">
                  <span className="font-semibold text-stone-800">中文提示：</span>deprecate
                  重音在第一音节{' '}
                  <span className="font-mono text-[#1C202B] font-semibold">/ˈdep/</span>
                  ，注意不要读成 depreciate 的重音位置。已静默收入错题诊所，不打断对话。
                </p>
              </div>
            </motion.section>

            {/* Compact 4-Word Active Window Strip */}
            <section className="shrink-0">
              <div className="flex items-center justify-between mb-1 px-0.5">
                <span className="font-mono text-[10px] text-stone-500 uppercase tracking-wider font-semibold">
                  ACTIVE TARGET WINDOW (4)
                </span>
                <span className="text-[10px] text-stone-400 font-medium">Sliding Context</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { w: 'bottleneck', zh: 'n. 瓶颈阶段', meta: 'S: 12d', active: false },
                  { w: 'ratify', zh: 'v. 批准确认', meta: 'Target #1', active: true },
                  { w: 'contingent', zh: 'adj. 依条件定', meta: 'R: 88%', active: false },
                  { w: 'ameliorate', zh: 'v. 改善缓解', meta: 'New', active: false },
                ].map((item) => (
                  <button
                    key={item.w}
                    type="button"
                    onClick={() => void api.playSpeech(item.w)}
                    className={`rounded-xl p-1.5 shadow-xs flex flex-col justify-between text-left press-scale ${
                      item.active
                        ? 'bg-[#FFF8E6] border border-amber-300/80 relative overflow-hidden'
                        : 'bg-white/90 border border-[#EBE4D8]'
                    }`}
                  >
                    <div>
                      <span className="font-semibold text-[11px] text-[#1C202B] truncate block">
                        {item.w}
                      </span>
                      <span className="text-[9.5px] text-[#5A554C] truncate block">{item.zh}</span>
                    </div>
                    <span className="font-mono text-[9px] text-[#8C857B] mt-0.5 bg-stone-100/70 rounded px-1 self-start">
                      {item.meta}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {/* Center 3D Companion Pip Avatar & Natural Recast Speech Bubble */}
            <section className="flex flex-col items-center gap-2 shrink-0">
              <div className="relative flex items-center justify-center py-0.5 sprint-hide-compact">
                <div className="relative w-16 h-16 rounded-full p-1 bg-gradient-to-tr from-amber-200 via-white to-[#E5735D]/30 shadow-[0_8px_20px_rgba(229,115,93,0.25)] flex items-center justify-center">
                  <img
                    alt="Chubby coral-pink clay mascot Pip avatar"
                    className="w-full h-full object-cover rounded-full"
                    src="/assets/pip-avatar.png"
                  />
                </div>
              </div>

              <div className="w-full bg-[#EFE6D5] rounded-2xl p-3 shadow-sm border border-[#E2D8C3] relative">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-body font-bold text-xs text-[#1C202B]">Pip</span>
                    <span className="text-[11px] text-[#5A554C] font-medium">· Tech Lead</span>
                    <span className="material-symbols-outlined text-[15px] text-stone-600 animate-pulse">
                      graphic_eq
                    </span>
                  </div>
                  <span className="bg-[#E5DEC7] text-stone-800 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[#D8CEB4]">
                    Natural Recast in Flow (No lecturing)
                  </span>
                </div>
                <p className="font-headline italic text-[15px] text-[#1C202B] leading-snug font-normal">
                  &ldquo;Right, once you{' '}
                  <span className="not-italic font-bold font-body text-[#A83825] underline decoration-[#E5735D]/70 decoration-2 bg-[#FCECE8] px-1 py-0.5 rounded">
                    deprecate (/ˈdeprəkeɪt/)
                  </span>{' '}
                  that old API, how will the team{' '}
                  <span className="not-italic font-bold font-body text-amber-900 bg-[#FBEBBE] px-1 py-0.5 rounded-md border border-amber-300">
                    ratify
                  </span>{' '}
                  the new rate-limiting rules before launch?&rdquo;
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
                  Active Target Window (4)
                </span>
                <button
                  type="button"
                  onClick={() => navigate('09-voice-call-recast')}
                  className="bg-[#E6F5EC] text-[#236B42] text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 border border-[#BEE4CD] press-scale"
                >
                  <span>✦ &ldquo;deprecate&rdquo; used → FSRS Easy (+1)</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void api.playSpeech('deprecate')}
                  className="bg-[#E6F5EC]/70 border border-[#BEE4CD] rounded-2xl p-2 flex flex-col justify-between text-left press-scale"
                >
                  <div className="flex items-start justify-between w-full">
                    <span className="font-headline font-semibold text-[13px] text-[#1C202B] tracking-tight">
                      deprecate
                    </span>
                    <span className="text-[9px] font-mono bg-[#236B42] text-white px-1.5 py-0.5 rounded-full leading-none font-semibold">
                      ✦ Easy
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1 text-[10px] text-[#236B42] w-full">
                    <span className="font-body">v. 弃用 / 贬低</span>
                    <span className="font-mono text-[9px] opacity-80">R: 96%</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => void api.playSpeech('idempotent')}
                  className="bg-[#FAF7F2] border border-[#EAE4D7] rounded-2xl p-2 flex flex-col justify-between text-left press-scale"
                >
                  <div className="flex items-start justify-between w-full">
                    <span className="font-headline font-semibold text-[13px] text-[#1C202B] tracking-tight">
                      idempotent
                    </span>
                    <span className="material-symbols-outlined text-[12px] text-[#1C202B]/40">
                      volume_up
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1 text-[10px] text-[#5A554C] w-full">
                    <span className="font-body">adj. 幂等的</span>
                    <span className="font-mono text-[9px] text-[#1C202B]/50">S: 8.4d</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => void api.playSpeech('bottleneck')}
                  className="bg-[#FAF7F2] border border-[#EAE4D7] rounded-2xl p-2 flex flex-col justify-between text-left press-scale"
                >
                  <div className="flex items-start justify-between w-full">
                    <span className="font-headline font-semibold text-[13px] text-[#1C202B] tracking-tight">
                      bottleneck
                    </span>
                    <span className="material-symbols-outlined text-[12px] text-[#1C202B]/40">
                      volume_up
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1 text-[10px] text-[#5A554C] w-full">
                    <span className="font-body">n. 瓶颈阶段</span>
                    <span className="font-mono text-[9px] text-[#1C202B]/50">S: 12d</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => void api.playSpeech('contingent')}
                  className="bg-[#F0EDFF]/80 border border-[#D9D2F8] rounded-2xl p-2 flex flex-col justify-between text-left press-scale"
                >
                  <div className="flex items-start justify-between w-full">
                    <span className="font-headline font-semibold text-[13px] text-[#1C202B] tracking-tight">
                      contingent
                    </span>
                    <span className="text-[9px] font-body bg-[#9B8AFB]/20 text-[#533FD1] font-semibold px-1 rounded">
                      New
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1 text-[10px] text-[#533FD1] w-full">
                    <span className="font-body">adj. 视情况而定</span>
                    <span className="font-mono text-[9px] opacity-80">Queue #5</span>
                  </div>
                </button>
              </div>
            </section>

            {/* Center 3D Companion Stage */}
            <section className="flex flex-col items-center justify-center py-0.5 relative shrink-0 sprint-hide-compact">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#F4B844]/30 via-[#E5735D]/20 to-[#9B8AFB]/30 animate-pulse-ring-outer" />
                <div className="absolute inset-2 rounded-full bg-gradient-to-br from-[#F5E2D4] via-[#FFEADB] to-[#DBD6F5]/40 animate-pulse-ring border border-white/60" />
                <div className="relative w-22 h-22 rounded-full overflow-hidden shadow-lg bg-gradient-to-b from-[#FFEADB] to-[#F5D5C6] p-1 border-2 border-white flex items-center justify-center">
                  <img
                    alt="Chubby coral-pink clay mascot Pip"
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
                  {isMuted
                    ? 'Microphone Muted · Tap Mic to Resume'
                    : 'Full-duplex 24kHz PCM · VAD Ready'}
                </span>
              </div>
            </section>

            {/* Dual-Track Editorial Live Transcript */}
            <section className="space-y-2 shrink-0">
              <article className="bg-[#EFE6D5] rounded-2xl p-3 shadow-sm border border-[#E4DAC7] relative">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-[#1C202B] text-white flex items-center justify-center text-[10px] font-headline italic font-bold">
                      P
                    </span>
                    <span className="font-body font-bold text-xs text-[#1C202B]">
                      Pip{' '}
                      <span className="font-normal text-[#5A554C]/70 text-[11px]">· Tech Lead</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void api.playSpeech(
                        'That makes total sense to deprecate the legacy endpoint first. What happens if a client retries the checkout twice during a network bottleneck?'
                      )
                    }
                    className="flex items-center gap-1 text-[#236B42] text-[10px] font-mono bg-white/70 px-2 py-0.5 rounded-full press-scale"
                  >
                    <span className="material-symbols-outlined text-[12px]">volume_up</span>
                    <span>Playing</span>
                  </button>
                </div>
                <p className="font-headline text-[14px] leading-snug text-[#1C202B] italic">
                  &ldquo;That makes total sense to{' '}
                  <span className="underline decoration-[#F4B844] decoration-2 font-medium not-italic bg-[#FFF4D6] px-1 rounded text-[#1C202B]">
                    deprecate
                  </span>{' '}
                  the legacy endpoint first. What happens if a client retries the checkout twice
                  during a network{' '}
                  <span className="underline decoration-[#F4B844] decoration-2 font-medium not-italic bg-[#FFF4D6] px-1 rounded text-[#1C202B]">
                    bottleneck
                  </span>
                  ?&rdquo;
                </p>
              </article>

              <article className="bg-white rounded-2xl p-3 shadow-sm border border-[#EDE8E0] relative">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-[#EFECE4] text-[#1C202B] flex items-center justify-center text-[10px] font-body font-bold">
                      You
                    </span>
                    <span className="font-body text-xs font-semibold text-[#1C202B]">
                      Speaking live...
                    </span>
                  </div>
                  <div className="flex items-end gap-0.5 h-4 px-1.5 py-0.5 bg-[#F9F6F0] rounded-full border border-black/5">
                    <span className="w-1 h-3.5 bg-[#236B42] rounded-full wave-bar-gpu-1" />
                    <span className="w-1 h-3.5 bg-[#1C202B] rounded-full wave-bar-gpu-2" />
                    <span className="w-1 h-3.5 bg-[#236B42] rounded-full wave-bar-gpu-3" />
                    <span className="w-1 h-3.5 bg-[#1C202B] rounded-full wave-bar-gpu-4" />
                    <span className="w-1 h-3.5 bg-[#58B37C] rounded-full wave-bar-gpu-5" />
                  </div>
                </div>
                <p className="font-body text-[13px] font-medium text-[#1C202B] leading-snug">
                  &ldquo;We designed the payment handler to be completely{' '}
                  <span className="bg-[#FAF7F2] border border-[#EAE4D7] px-1 rounded font-semibold text-[#1C202B]">
                    idempotent
                  </span>
                  , so duplicate retries won&apos;t trigger multiple charges
                  <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-[#1C202B] align-middle animate-pulse" />
                  &rdquo;
                </p>
              </article>
            </section>
          </>
        )}
      </div>

      {/* Bottom 3-Button Voice Control Bar */}
      <footer className="w-full pb-5 pt-2 px-6 flex items-center justify-between gap-3 bg-gradient-to-t from-[#F9F6F0] via-[#F9F6F0]/95 to-transparent shrink-0 z-20">
        {/* Left: Round Mute Toggle Button */}
        <button
          type="button"
          aria-label="Mute Microphone"
          onClick={toggleMicMute}
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
          aria-label="Request Hint Example Answer"
          onClick={() => navigate('10-voice-call-hint')}
          className="h-[54px] flex-1 rounded-full bg-[#1C202B] text-white font-body font-semibold text-[13.5px] tracking-tight flex items-center justify-center gap-2 shadow-lg press-scale"
        >
          <span className="material-symbols-outlined text-[#F4B844] text-[18px] fill-icon">
            auto_awesome
          </span>
          <span>Hint Example Answer</span>
        </button>

        {/* Right: Round Terracotta Coral End Call Button */}
        <button
          type="button"
          aria-label="End Voice Session"
          onClick={() => void completeLiveVoiceSession()}
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
              aria-label="On-Demand SSE Hint Drawer"
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

              {/* Header Row: Hint Tag + SSE Latency Pill + TTS Demo Button */}
              <div className="flex items-center justify-between mt-1 mb-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="bg-[#FFF4D6] text-[#946300] font-semibold text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1 border border-[#F4E0A8]">
                    <span className="material-symbols-outlined text-[13px] text-[#946300] fill-icon">
                      lightbulb
                    </span>
                    On-Demand SSE Hint
                  </span>
                  <span className="bg-[#F1ECE1] text-[#71695E] font-mono text-[10.5px] px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#58B37C] animate-ping" />
                    320ms stream
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => void playHintDemoWithAutoMute()}
                  className="bg-[#1C202B] text-white px-3 py-2 min-h-[38px] rounded-full flex items-center gap-2 shadow-sm press-scale"
                >
                  <div className="flex items-center gap-0.5 h-3.5">
                    <span className="w-[2.5px] h-3 bg-[#58B37C] rounded-full wave-bar-gpu-1" />
                    <span className="w-[2.5px] h-3 bg-white rounded-full wave-bar-gpu-2" />
                    <span className="w-[2.5px] h-3 bg-[#F4B844] rounded-full wave-bar-gpu-3" />
                    <span className="w-[2.5px] h-3 bg-white rounded-full wave-bar-gpu-4" />
                  </div>
                  <span className="font-body font-semibold text-[11px] tracking-tight">
                    {playingHintDemo ? 'Playing...' : 'Listen Demo'}
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
                  Mic input auto-muted while playing TTS demo so it never triggers Server VAD
                  interruption.
                </p>
              </div>

              {/* Streamed English Example Answer Card */}
              <div className="bg-[#EFE6D5] rounded-2xl p-3.5 border border-[#E4DAC6] relative shadow-xs mb-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9.5px] font-bold tracking-wider uppercase text-[#807664] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-[#946300]">
                      auto_awesome
                    </span>
                    EN · First-Person Example (Weaving 3 Targets)
                  </span>
                  <span className="text-[10px] font-mono text-[#807664]">C1 Fluent</span>
                </div>
                {hintStreaming ? (
                  <p className="font-headline text-[15px] text-[#1C202B] leading-[1.4]">
                    “{hintTextEn.replace(/\*\*/g, '')}”
                    <span className="inline-block w-1.5 h-3.5 bg-[#946300] ml-1 animate-pulse align-middle" />
                  </p>
                ) : (
                  <p className="font-headline text-[15px] text-[#1C202B] leading-[1.4] tracking-normal">
                    “Our leads will only{' '}
                    <span className="inline-flex items-baseline bg-[#FFF4D6] text-[#1C202B] px-1.5 py-0.5 rounded-md font-medium border border-[#EED79D] mx-0.5">
                      ratify
                      <span className="font-mono text-[9.5px] text-[#946300] ml-1">/ˈrætɪfaɪ/</span>
                    </span>{' '}
                    the rollout schedule{' '}
                    <span className="inline-flex items-baseline bg-[#FFF4D6] text-[#1C202B] px-1.5 py-0.5 rounded-md font-medium border border-[#EED79D] mx-0.5">
                      contingent
                      <span className="font-mono text-[9.5px] text-[#946300] ml-1">
                        /kənˈtɪndʒənt/
                      </span>
                    </span>{' '}
                    on our load-test proving the database{' '}
                    <span className="inline-flex items-baseline bg-[#FFF4D6] text-[#1C202B] px-1.5 py-0.5 rounded-md font-medium border border-[#EED79D] mx-0.5">
                      bottleneck
                      <span className="font-mono text-[9.5px] text-[#946300] ml-1">/ˈbɑːtlnek/</span>
                    </span>{' '}
                    is fully resolved.”
                  </p>
                )}
              </div>

              {/* Streamed Chinese Contextual Meaning Card */}
              <div className="bg-white rounded-xl p-3 border border-[#EAE4D7] shadow-xs mb-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#8B8375] mb-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px] text-[#8B8375]">
                    translate
                  </span>
                  ZH · 对应中文语境释义
                </div>
                <p className="font-body text-[12px] text-[#4A453C] leading-relaxed">{hintTextZh}</p>
              </div>

              {/* Fairness & Grading Transparency Caption Row */}
              <div className="flex items-center justify-center gap-1 px-2 mb-2 text-center">
                <span className="material-symbols-outlined text-[13px] text-[#8A8172]">
                  verified_user
                </span>
                <span className="text-[10px] text-[#8A8172] font-medium leading-none">
                  Marked as Hint-Assisted (
                  <code className="font-mono text-[9.5px] text-[#696154]">USED_WITH_HINT</code>) ·
                  counts toward bloom without extra FSRS Easy bonus.
                </span>
              </div>

              {/* Bottom Action Row */}
              <div className="flex items-center gap-2.5 pt-0.5">
                <button
                  type="button"
                  onClick={triggerNewHintAngle}
                  className="bg-[#EFECE4] text-[#524B40] font-body font-semibold text-xs py-3 px-4 min-h-[46px] rounded-full flex items-center justify-center gap-1.5 press-scale border border-[#E0D9CB]"
                >
                  <span className="material-symbols-outlined text-[16px]">cached</span>
                  New Angle
                </button>
                <button
                  type="button"
                  onClick={() => {
                    toast.success('Mic Unmuted · Ready for your response')
                    navigate('08-voice-call-active')
                  }}
                  className="flex-1 bg-[#1C202B] text-white font-body font-semibold text-xs py-3.5 px-4 min-h-[46px] rounded-full flex items-center justify-center gap-2 shadow-md press-scale"
                >
                  <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[15px] text-white">mic</span>
                  </span>
                  Unmute Mic &amp; Speak Now
                </button>
              </div>
            </motion.section>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
