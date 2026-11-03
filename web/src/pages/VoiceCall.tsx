/**
 * 实时语音实战页（SPEC 7.1-3）。
 *
 * 布局：顶部计时与目标词进度 / 中部光球与字幕 / 底部控制区。
 * 纠错卡片从顶部滑入、5 秒后自动收起，绝不打断语音。
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { formatDuration, parseEmphasis } from '../lib/format'
import { useRealtimeVoice } from '../hooks/useRealtimeVoice'
import { useSSEHint } from '../hooks/useSSEHint'
import { playAudioBlob } from '../hooks/usePCMPlayer'

export default function VoiceCall() {
  const call = useRealtimeVoice()
  const { hint, request: requestHint, reset: resetHint } = useSSEHint()
  const [showHint, setShowHint] = useState(false)
  const [showTargets, setShowTargets] = useState(false)
  const [muted, setMuted] = useState(false)
  const [playingHint, setPlayingHint] = useState(false)
  const [visibleMistakes, setVisibleMistakes] = useState<number[]>([])
  const captionEndRef = useRef<HTMLDivElement | null>(null)

  // 纠错卡片：出现 5 秒后自动收起（SPEC 7.1-3）
  useEffect(() => {
    const newest = call.mistakes[call.mistakes.length - 1]
    if (!newest) return
    setVisibleMistakes((ids) => (ids.includes(newest.id) ? ids : [...ids, newest.id]))
    const timer = window.setTimeout(() => {
      setVisibleMistakes((ids) => ids.filter((id) => id !== newest.id))
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [call.mistakes])

  useEffect(() => {
    captionEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [call.transcripts])

  const orbClass = useMemo(() => {
    if (call.status !== 'live') return 'orb orb-idle'
    if (call.assistantSpeaking) return 'orb orb-speaking'
    if (call.listening) return 'orb orb-listening'
    return 'orb orb-idle'
  }, [call.status, call.assistantSpeaking, call.listening])

  const activeMistakes = call.mistakes.filter((m) => visibleMistakes.includes(m.id))
  const doneCount = call.completedWords.length
  const totalCount = Math.max(call.totalTargets, doneCount)

  async function handleHint() {
    if (!call.sessionId) return
    setShowHint(true)
    await requestHint(call.sessionId)
  }

  async function playHintAudio() {
    const ctx = call.audioContext
    if (!ctx || !hint.en) return
    setPlayingHint(true)
    try {
      // 播放提示音期间自动静音麦克风，防止被录进去触发 VAD 误打断
      await call.withMicMuted(async () => {
        const blob = await api.speak(hint.en.replace(/\*\*/g, ''))
        await playAudioBlob(ctx, blob)
      })
    } catch {
      /* 播放失败不阻塞对话 */
    } finally {
      setPlayingHint(false)
    }
  }

  const mistakeToasts = (
    <div className="toast-layer">
      {activeMistakes.map((m) => (
        <div key={m.id} className="toast toast-mistake">
          <div className="toast-title">{mistakeTitle(m.category)}</div>
          <div className="toast-body">
            {m.user_said && m.suggested ? (
              <>
                <div style={{ textDecoration: 'line-through', opacity: 0.7 }}>{m.user_said}</div>
                <div style={{ color: 'var(--text)' }}>→ {m.suggested}</div>
              </>
            ) : (
              <div>{m.suggested || m.user_said}</div>
            )}
            {m.tip_zh && <div style={{ marginTop: 3, color: 'var(--text-faint)' }}>{m.tip_zh}</div>}
          </div>
        </div>
      ))}
    </div>
  )

  if (call.status === 'idle') {
    return (
      <>
        <div className="screen voice-screen">
          <div className="topbar">
            <h1 className="title">口语实战</h1>
            <Link to="/" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
              返回
            </Link>
          </div>
          <div className="call-orb">
            <div className="orb orb-idle">◉</div>
            <div style={{ fontSize: 17, fontWeight: 600 }}>准备好了吗</div>
            <p className="subtitle" style={{ maxWidth: 300, lineHeight: 1.6 }}>
              点击下方按钮开始。AI 会先开口打招呼，然后把今天的词自然地聊出来。
              <br />
              卡壳时随时点「提示示例回答」。
            </p>
            <div className="notice-box" style={{ maxWidth: 320, textAlign: 'left' }}>
              移动端浏览器只允许在 HTTPS 页面使用麦克风。若按钮无反应，先确认访问地址是 https。
            </div>
          </div>
          <button className="btn btn-primary btn-block btn-lg" onClick={() => void call.start()}>
            ◉ 开始对话
          </button>
        </div>
        {mistakeToasts}
      </>
    )
  }

  if (call.status === 'error') {
    return (
      <div className="screen">
        <div className="topbar">
          <h1 className="title">口语实战</h1>
        </div>
        <div className="error-box">{call.error}</div>
        <button className="btn btn-primary btn-block" onClick={() => void call.start()}>
          重试
        </button>
        <Link to="/" className="btn btn-secondary btn-block" style={{ textDecoration: 'none' }}>
          返回首页
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="screen voice-screen">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 15, fontWeight: 600 }}>
              {formatDuration(call.elapsed)}
            </span>
            {call.status === 'connecting' && <span className="subtitle">连接中…</span>}
          </div>
          <button
            className={`target-pill${doneCount >= totalCount && totalCount > 0 ? ' target-pill-done' : ''}`}
            onClick={() => setShowTargets((v) => !v)}
          >
            <span>
              核心词 {doneCount} / {totalCount}
            </span>
            <span style={{ color: 'var(--text-faint)' }}>{showTargets ? '▴' : '▾'}</span>
          </button>
        </div>

        {showTargets && (
          <div className="card card-tight">
            <div className="target-list">
              {call.activeWords.length === 0 && call.completedWords.length === 0 && (
                <span className="subtitle">暂无待激活词</span>
              )}
              {call.completedWords.map((w) => (
                <span key={`done-${w}`} className="target-chip target-chip-done">
                  {w}
                </span>
              ))}
              {call.activeWords.map((w) => (
                <span key={`active-${w}`} className="target-chip target-chip-active">
                  {w}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="call-orb">
          <div className={orbClass} onClick={() => call.interrupt()} role="button" aria-label="打断">
            {call.assistantSpeaking ? '🔊' : call.listening ? '🎙' : '◉'}
          </div>
          {call.scenarioTitle && (
            <div className="subtitle" style={{ maxWidth: 300 }}>
              {call.scenarioTitle}
            </div>
          )}
        </div>

        <div className="caption-stream">
          {call.transcripts.map((line) => (
            <div
              key={line.id}
              className={`caption ${line.role === 'user' ? 'caption-user' : 'caption-ai'}${
                line.isFinal ? '' : ' caption-interim'
              }`}
            >
              {line.text}
            </div>
          ))}
          <div ref={captionEndRef} />
        </div>

        <div className="call-controls">
          <div style={{ display: 'grid', placeItems: 'center', gap: 4 }}>
            <button
              className={`ctrl-btn${muted ? ' ctrl-btn-active' : ''}`}
              onClick={() => setMuted(call.toggleMute())}
            >
              {muted ? '🔇' : '🎙'}
            </button>
            <span className="ctrl-label">{muted ? '已静音' : '麦克风'}</span>
          </div>

          <div style={{ display: 'grid', placeItems: 'center', gap: 4 }}>
            <button className="ctrl-btn ctrl-btn-primary" onClick={() => void handleHint()}>
              💡
            </button>
            <span className="ctrl-label">提示示例</span>
          </div>

          <div style={{ display: 'grid', placeItems: 'center', gap: 4 }}>
            <button className="ctrl-btn" onClick={() => void call.hangUp()}>
              ⏹
            </button>
            <span className="ctrl-label">结束</span>
          </div>
        </div>
      </div>

      {mistakeToasts}

      {showHint && (
        <>
          <div
            className="drawer-backdrop"
            onClick={() => {
              setShowHint(false)
              resetHint()
            }}
          />
          <div className="drawer">
            <div className="drawer-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 650 }}>示例回答</div>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowHint(false)
                  resetHint()
                }}
              >
                关闭
              </button>
            </div>

            {hint.loading && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--text-dim)' }}>
                <div className="spinner" />
                <span style={{ fontSize: 14 }}>正在想一个自然的说法…</span>
              </div>
            )}

            {hint.error && <div className="error-box">{hint.error}</div>}

            {(hint.en || hint.streaming) && (
              <div>
                <div className={`hint-en${hint.streaming ? ' cursor-blink' : ''}`}>
                  {parseEmphasis(hint.en).map((part, i) =>
                    part.strong ? (
                      <span key={i} className="target-word">
                        {part.text}
                      </span>
                    ) : (
                      <span key={i}>{part.text}</span>
                    ),
                  )}
                </div>
                {hint.zh && <div className="hint-zh">{hint.zh}</div>}
              </div>
            )}

            {!hint.streaming && hint.en && (
              <button
                className="btn btn-primary btn-block btn-lg"
                onClick={() => void playHintAudio()}
                disabled={playingHint}
              >
                {playingHint ? '播放中…（麦克风已暂时静音）' : '🔊 听标准发音'}
              </button>
            )}
          </div>
        </>
      )}
    </>
  )
}

function mistakeTitle(category: string): string {
  switch (category) {
    case 'PRONUNCIATION':
      return '发音提示'
    case 'GRAMMAR':
      return '语法提示'
    case 'WORD_CHOICE':
      return '用词提示'
    default:
      return '提示'
  }
}
