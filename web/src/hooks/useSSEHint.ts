/**
 * 按需 SSE 提示（SPEC 5.4）。
 *
 * **绝不预生成**：只有用户点按钮时才建立连接。
 * 用 fetch + ReadableStream 手工解析 SSE，而不是 EventSource ——
 * EventSource 不支持自定义 header，也不便于中途 abort。
 */

import { useCallback, useRef, useState } from 'react'

export interface HintState {
  loading: boolean
  streaming: boolean
  en: string
  zh: string
  error: string | null
}

const empty: HintState = { loading: false, streaming: false, en: '', zh: '', error: null }

export function useSSEHint() {
  const [hint, setHint] = useState<HintState>(empty)
  const abortRef = useRef<AbortController | null>(null)

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setHint(empty)
  }, [])

  const request = useCallback(async (sessionId: number) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setHint({ ...empty, loading: true })

    try {
      const res = await fetch(`/api/v1/voice/${sessionId}/hint-stream`, {
        signal: controller.signal,
        headers: { Accept: 'text/event-stream' },
      })
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.detail ?? `提示请求失败 (${res.status})`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let en = ''

      setHint((h) => ({ ...h, loading: false, streaming: true }))

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // SSE 以空行分隔事件
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data:')) continue
          const raw = line.slice(5).trim()
          if (!raw) continue
          let payload: { type: string; chunk?: string; en?: string; zh?: string; message?: string }
          try {
            payload = JSON.parse(raw)
          } catch {
            continue
          }
          if (payload.type === 'hint' && payload.chunk) {
            en += payload.chunk
            setHint((h) => ({ ...h, en }))
          } else if (payload.type === 'done') {
            setHint({
              loading: false,
              streaming: false,
              en: payload.en ?? en,
              zh: payload.zh ?? '',
              error: null,
            })
          } else if (payload.type === 'error') {
            setHint({ ...empty, error: payload.message ?? '提示生成失败' })
          }
        }
      }

      setHint((h) => (h.streaming ? { ...h, streaming: false } : h))
    } catch (err) {
      if (controller.signal.aborted) return
      setHint({ ...empty, error: err instanceof Error ? err.message : String(err) })
    }
  }, [])

  return { hint, request, reset }
}
