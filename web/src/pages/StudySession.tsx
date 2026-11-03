/**
 * 沉浸式背词页（SPEC 5.2 + 7.1-2）。
 *
 * 单卡状态机：
 *   A 出题态  → 自动播单词音 + 延迟 600ms 播例句音 + 4 选项（隐藏中文）
 *   B 揭晓态  → 答对展开译文与释义，浮出手动评级栏；答错强制停留，重播音频
 *
 * 自动评级由后端按耗时映射，前端只负责上报 duration_ms 与选中项。
 * 用户点手动评级时，用 manual_rating 覆盖。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'
import { highlightWord } from '../lib/format'
import type { ReviewResult, StudyCard } from '../lib/types'

type Phase = 'question' | 'revealed'

const AUTO_ADVANCE_MS = 1500

export default function StudySession() {
  const [cards, setCards] = useState<StudyCard[]>([])
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('question')
  const [selected, setSelected] = useState<string | null>(null)
  const [result, setResult] = useState<ReviewResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [autoSentence, setAutoSentence] = useState(true)
  const [busy, setBusy] = useState(false)

  const shownAt = useRef<number>(0)
  const advanceTimer = useRef<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const sentenceAudioRef = useRef<HTMLAudioElement | null>(null)

  const card = cards[index] ?? null

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.queue()
      setCards(res.cards)
      setProgress({ done: res.progress.done, total: res.progress.total })
      setIndex(0)
      setPhase('question')
      setSelected(null)
      setResult(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // 进入新卡片：重置状态并自动播放
  useEffect(() => {
    if (!card) return
    setPhase('question')
    setSelected(null)
    setResult(null)
    shownAt.current = performance.now()
    if (advanceTimer.current) {
      window.clearTimeout(advanceTimer.current)
      advanceTimer.current = null
    }
    void playWordAudio(card)
    if (autoSentence && card.sentence_en) {
      const t = window.setTimeout(() => void playSentenceAudio(card), 600)
      return () => window.clearTimeout(t)
    }
  }, [card, autoSentence])

  useEffect(() => {
    return () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current)
    }
  }, [])

  async function playWordAudio(c: StudyCard) {
    // 单词发音走后端 TTS 并缓存；同一词第二次起是磁盘命中，几乎无延迟
    try {
      const blob = await api.speak(c.word)
      const url = URL.createObjectURL(blob)
      audioRef.current?.pause()
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => URL.revokeObjectURL(url)
      await audio.play().catch(() => undefined)
    } catch {
      /* 发音失败不阻塞答题 */
    }
  }

  async function playSentenceAudio(c: StudyCard) {
    if (!c.sentence_en) return
    try {
      const blob = await api.speak(c.sentence_en)
      const url = URL.createObjectURL(blob)
      sentenceAudioRef.current?.pause()
      const audio = new Audio(url)
      sentenceAudioRef.current = audio
      audio.onended = () => URL.revokeObjectURL(url)
      await audio.play().catch(() => undefined)
    } catch {
      /* 忽略 */
    }
  }

  async function choose(label: string) {
    if (!card || phase === 'revealed' || busy) return
    setBusy(true)
    setSelected(label)

    const duration = Math.round(performance.now() - shownAt.current)
    try {
      const res = await api.reviewCard({
        word_id: card.word_id,
        selected_label: label,
        duration_ms: duration,
      })
      setResult(res)
      setPhase('revealed')
      setProgress({ done: res.progress.done, total: res.progress.total })

      if (!res.is_correct) {
        // 答错：强制停留，重播单词与例句，让用户记住正确读音
        void playWordAudio(card)
        if (card.sentence_en) {
          window.setTimeout(() => void playSentenceAudio(card), 700)
        }
      } else {
        // 答对：1.5 秒后自动进入下一词（用户也可手动点下一词或点评级）
        if (advanceTimer.current) window.clearTimeout(advanceTimer.current)
        advanceTimer.current = window.setTimeout(() => void next(), AUTO_ADVANCE_MS)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function overrideRating(rating: number) {
    if (!card || !result || busy) return
    if (advanceTimer.current) {
      window.clearTimeout(advanceTimer.current)
      advanceTimer.current = null
    }
    setBusy(true)
    try {
      const duration = Math.round(performance.now() - shownAt.current)
      await api.reviewCard({
        word_id: card.word_id,
        selected_label: selected,
        duration_ms: duration,
        manual_rating: rating,
      })
      void next()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  function next() {
    if (advanceTimer.current) {
      window.clearTimeout(advanceTimer.current)
      advanceTimer.current = null
    }
    setIndex((i) => {
      const nextIndex = i + 1
      if (nextIndex < cards.length) return nextIndex
      void load()
      return i
    })
  }

  const sentenceParts = useMemo(() => {
    if (!card?.sentence_en) return []
    return highlightWord(card.sentence_en, card.word)
  }, [card])

  if (loading) {
    return (
      <div className="screen">
        <div className="loading-screen">
          <div className="spinner" style={{ margin: '0 auto' }} />
          <div>加载今日单词…</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="screen">
        <div className="topbar">
          <h1 className="title">背词</h1>
        </div>
        <div className="error-box">{error}</div>
        <button className="btn btn-primary btn-block" onClick={() => void load()}>
          重试
        </button>
      </div>
    )
  }

  if (!card) {
    return (
      <div className="screen">
        <div className="topbar">
          <h1 className="title">背词</h1>
        </div>
        <div className="empty">
          <div className="empty-icon">✓</div>
          <div style={{ fontSize: 17, color: 'var(--text)' }}>
            {progress.total > 0 ? '今日单词已全部完成' : '今日还没有学习计划'}
          </div>
          <div className="subtitle">
            {progress.total > 0 ? '去「口语」页开始今天的对话实战' : '回首页生成今日计划'}
          </div>
        </div>
      </div>
    )
  }

  const correctLabels = result?.correct_labels ?? []

  return (
    <div className="screen">
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
        />
      </div>
      <div className="progress-meta">
        <span>
          {progress.done} / {progress.total}
        </span>
        <span>
          {card.item_type === 'NEW' ? '新词' : '复习'}
          {card.requeue_count > 0 && ` · 已重排 ${card.requeue_count} 次`}
        </span>
      </div>

      <div className="word-hero">
        <div className="word-text">{card.word}</div>
        {card.phonetic_us && <div className="phonetic">{card.phonetic_us}</div>}
        <button className="btn btn-ghost" onClick={() => void playWordAudio(card)}>
          🔊 重播
        </button>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <p className="sentence">
            {sentenceParts.map((part, i) =>
              part.hit ? (
                <span key={i} className="target-word">
                  {part.text}
                </span>
              ) : (
                <span key={i}>{part.text}</span>
              ),
            )}
          </p>
          <button
            className="btn btn-ghost"
            style={{ flexShrink: 0 }}
            onClick={() => void playSentenceAudio(card)}
            aria-label="播放例句"
          >
            🔊
          </button>
        </div>
        {phase === 'revealed' && card.sentence_zh && (
          <p className="sentence-zh">{card.sentence_zh}</p>
        )}
      </div>

      <div className="options">
        {card.options.map((opt) => {
          const isCorrect = phase === 'revealed' && correctLabels.includes(opt.label)
          const isWrong = phase === 'revealed' && selected === opt.label && !isCorrect
          const muted = phase === 'revealed' && !isCorrect && !isWrong
          return (
            <button
              key={opt.label}
              className={`option${isCorrect ? ' option-correct' : ''}${isWrong ? ' option-wrong' : ''}${
                muted ? ' option-muted' : ''
              }`}
              disabled={phase === 'revealed' || busy}
              onClick={() => void choose(opt.label)}
            >
              <span className="option-label">{opt.label}</span>
              {opt.pos && <span className="option-pos">{opt.pos}</span>}
              <span>{opt.text}</span>
            </button>
          )
        })}
      </div>

      {phase === 'revealed' && result && (
        <div className="card card-tight">
          {result.is_correct ? (
            <>
              <div style={{ fontSize: 14, color: 'var(--success)', marginBottom: 8 }}>
                答对了 · 已按 {ratingLabel(result.rating)} 记入记忆曲线
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => void overrideRating(2)}>
                  模糊
                </button>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => void overrideRating(3)}>
                  良好
                </button>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => void overrideRating(4)}>
                  太简单
                </button>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 14, color: 'var(--danger)' }}>
              答错了 · 这个词会排到队尾，今天需要再过一遍
            </div>
          )}
          <button className="btn btn-primary btn-block" style={{ marginTop: 10 }} onClick={next}>
            下一词
          </button>
        </div>
      )}

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          color: 'var(--text-faint)',
        }}
      >
        <input
          type="checkbox"
          checked={autoSentence}
          onChange={(e) => setAutoSentence(e.target.checked)}
        />
        进入卡片时自动联播例句发音
      </label>
    </div>
  )
}

function ratingLabel(rating: number): string {
  return ['', 'Again', 'Hard', 'Good', 'Easy'][rating] ?? String(rating)
}
