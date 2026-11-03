/**
 * 实时语音 WebSocket + 音频链路编排。
 *
 * 把 MicRecorder（16k 上行）、PCMPlayer（24k 下行）、WebSocket（双工）
 * 装配成一个 hook，页面只需要消费状态。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ServerEvent } from '../lib/types'
import { MicRecorder, type RecorderHandle } from './usePCMRecorder'
import { PCMPlayer } from './usePCMPlayer'

export type CallStatus = 'idle' | 'connecting' | 'live' | 'closed' | 'error'

export interface TranscriptLine {
  id: number
  role: 'user' | 'assistant'
  text: string
  isFinal: boolean
}

export interface MistakeCard {
  id: number
  category: string
  user_said: string
  suggested: string
  tip_zh: string
}

interface State {
  status: CallStatus
  error: string | null
  sessionId: number | null
  scenarioTitle: string
  scenarioBrief: string
  transcripts: TranscriptLine[]
  mistakes: MistakeCard[]
  activeWords: string[]
  completedWords: string[]
  totalTargets: number
  assistantSpeaking: boolean
  listening: boolean
  elapsed: number
}

const initialState: State = {
  status: 'idle',
  error: null,
  sessionId: null,
  scenarioTitle: '',
  scenarioBrief: '',
  transcripts: [],
  mistakes: [],
  activeWords: [],
  completedWords: [],
  totalTargets: 0,
  assistantSpeaking: false,
  listening: false,
  elapsed: 0,
}

let lineSeq = 1

export function useRealtimeVoice(planDate?: string) {
  const [state, setState] = useState<State>(initialState)

  const wsRef = useRef<WebSocket | null>(null)
  const recorderRef = useRef<RecorderHandle | null>(null)
  const playerRef = useRef<PCMPlayer | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const mutedRef = useRef(false)
  const timerRef = useRef<number | null>(null)

  const cleanup = useCallback(async () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    await recorderRef.current?.stop()
    recorderRef.current = null
    playerRef.current?.dispose()
    playerRef.current = null
    if (ctxRef.current && ctxRef.current.state !== 'closed') {
      await ctxRef.current.close().catch(() => undefined)
    }
    ctxRef.current = null
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
      wsRef.current.close()
    }
    wsRef.current = null
  }, [])

  const start = useCallback(async () => {
    await cleanup()
    setState({ ...initialState, status: 'connecting' })

    try {
      const ctx = new AudioContext()
      ctxRef.current = ctx
      playerRef.current = new PCMPlayer(ctx)
      if (ctx.state === 'suspended') await ctx.resume()

      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const query = planDate ? `?plan_date=${planDate}` : ''
      const ws = new WebSocket(`${proto}://${window.location.host}/api/v1/voice/ws${query}`)
      ws.binaryType = 'arraybuffer'
      wsRef.current = ws

      ws.onmessage = (event: MessageEvent) => {
        if (typeof event.data !== 'string') {
          playerRef.current?.push(event.data as ArrayBuffer)
          return
        }
        let payload: ServerEvent
        try {
          payload = JSON.parse(event.data)
        } catch {
          return
        }
        handleServerEvent(payload)
      }

      ws.onerror = () => {
        setState((s) => ({ ...s, status: 'error', error: '语音连接出错' }))
      }

      ws.onclose = () => {
        setState((s) => (s.status === 'error' ? s : { ...s, status: 'closed' }))
      }

      ws.onopen = async () => {
        setState((s) => ({ ...s, status: 'live' }))
        if (timerRef.current) window.clearInterval(timerRef.current)
        timerRef.current = window.setInterval(() => {
          setState((s) => ({ ...s, elapsed: s.elapsed + 1 }))
        }, 1000)

        try {
          const recorder = new MicRecorder((buf) => {
            if (ws.readyState === WebSocket.OPEN) ws.send(buf)
          })
          recorderRef.current = await recorder.start()
        } catch (err) {
          setState((s) => ({
            ...s,
            status: 'error',
            error: `无法获取麦克风：${err instanceof Error ? err.message : String(err)}`,
          }))
        }
      }
    } catch (err) {
      setState({
        ...initialState,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }, [cleanup, planDate])

  function handleServerEvent(payload: ServerEvent) {
    switch (payload.type) {
      case 'server.session_ready':
        setState((s) => ({
          ...s,
          sessionId: payload.session_id,
          scenarioTitle: payload.scenario_title,
          scenarioBrief: payload.scenario_brief,
          activeWords: payload.target_words,
          totalTargets: payload.progress.total,
        }))
        break

      case 'server.speech_started':
        // 用户抢话：立刻清空播放队列，实现毫秒级打断
        playerRef.current?.flush()
        setState((s) => ({ ...s, assistantSpeaking: false, listening: true }))
        break

      case 'server.transcript':
        setState((s) => {
          const lines = [...s.transcripts]
          const last = lines[lines.length - 1]
          const sameSpeaker = last && last.role === payload.role && !last.isFinal
          if (sameSpeaker) {
            lines[lines.length - 1] = { ...last, text: payload.text, isFinal: payload.is_final }
          } else if (payload.text) {
            lines.push({
              id: lineSeq++,
              role: payload.role,
              text: payload.text,
              isFinal: payload.is_final,
            })
          }
          if (lines.length > 40) lines.splice(0, lines.length - 40)
          return {
            ...s,
            transcripts: lines,
            assistantSpeaking: payload.role === 'assistant',
            listening: payload.role === 'user',
          }
        })
        break

      case 'server.word_used':
        setState((s) => ({
          ...s,
          activeWords:
            payload.used_correctly && payload.in_window
              ? s.activeWords.filter((w) => w.toLowerCase() !== payload.word.toLowerCase())
              : s.activeWords,
          completedWords: payload.used_correctly
            ? [...s.completedWords, payload.word]
            : s.completedWords,
        }))
        break

      case 'server.mistake_card':
        setState((s) => ({
          ...s,
          mistakes: [
            ...s.mistakes,
            {
              id: lineSeq++,
              category: payload.category,
              user_said: payload.user_said,
              suggested: payload.suggested,
              tip_zh: payload.tip_zh,
            },
          ].slice(-5),
        }))
        break

      case 'server.session_closed':
        setState((s) => ({ ...s, status: 'closed' }))
        break

      case 'server.error':
        setState((s) => ({ ...s, status: 'error', error: payload.message }))
        break
    }
  }

  const hangUp = useCallback(async () => {
    await cleanup()
    setState((s) => ({ ...s, status: 'closed' }))
  }, [cleanup])

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current
    recorderRef.current?.setMuted(mutedRef.current)
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'client.mute', muted: mutedRef.current }))
    }
    return mutedRef.current
  }, [])

  const interrupt = useCallback(() => {
    playerRef.current?.flush()
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'client.interrupt' }))
    }
  }, [])

  /** 播放提示音频期间自动静音麦克风（SPEC 5.4），避免提示音被录进去触发 VAD。 */
  const withMicMuted = useCallback(async (fn: () => Promise<void>) => {
    const wasMuted = mutedRef.current
    recorderRef.current?.setMuted(true)
    try {
      await fn()
    } finally {
      recorderRef.current?.setMuted(wasMuted)
    }
  }, [])

  useEffect(() => {
    return () => {
      void cleanup()
    }
  }, [cleanup])

  return {
    ...state,
    start,
    hangUp,
    toggleMute,
    interrupt,
    withMicMuted,
    get audioContext() {
      return ctxRef.current
    },
  }
}
