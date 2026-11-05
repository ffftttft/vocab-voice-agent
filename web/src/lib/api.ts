/** 后端 API 客户端与 TTS 音频播放器。 */

import type {
  PlanResponse,
  QueueResponse,
  ReviewResult,
  Stats,
  WordsAndMistakesResponse,
} from './types'

const BASE = ''

class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) {
    let detail = `请求失败 (${res.status})`
    try {
      const body = await res.json()
      if (typeof body?.detail === 'string') detail = body.detail
      else if (Array.isArray(body?.detail))
        detail = body.detail.map((d: { msg?: string }) => d.msg).join('; ')
    } catch {
      /* 响应不是 JSON，保留默认文案 */
    }
    throw new ApiError(detail, res.status)
  }
  return res.json() as Promise<T>
}

let activeAudio: HTMLAudioElement | null = null

export const api = {
  health: () => request<{ status: string; today: string }>('/api/v1/health'),

  stats: () => request<Stats>('/api/v1/study/stats'),

  wordsAndMistakes: (tag?: string) =>
    request<WordsAndMistakesResponse>(
      `/api/v1/study/words${tag && tag !== 'all' ? `?tag=${encodeURIComponent(tag)}` : ''}`,
    ),

  getPlan: () => request<PlanResponse>('/api/v1/study/daily-plan', { method: 'POST' }),

  regeneratePlan: () =>
    request<PlanResponse>('/api/v1/study/daily-plan?regenerate=true', { method: 'POST' }),

  queue: (includeDone = false) =>
    request<QueueResponse>(`/api/v1/study/queue?include_done=${includeDone}`),

  reviewCard: (payload: {
    word_id: number
    selected_label?: string | null
    duration_ms: number
    manual_rating?: number | null
  }) =>
    request<ReviewResult>('/api/v1/study/review-card', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  speak: async (text: string): Promise<Blob> => {
    const res = await fetch(`${BASE}/api/v1/tts/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) throw new ApiError(`发音合成失败 (${res.status})`, res.status)
    return res.blob()
  },

  /**
   * 播放单词或句子发音（优先调用后端 Edge-TTS 缓存接口，离线或无声卡时回退 Web Speech API）。
   */
  playSpeech: async (text: string, rate = 1.0): Promise<void> => {
    if (!text.trim()) return
    try {
      if (activeAudio) {
        activeAudio.pause()
        activeAudio = null
      }
      const blob = await api.speak(text)
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.playbackRate = rate
      activeAudio = audio
      await new Promise<void>((resolve) => {
        audio.onended = () => {
          URL.revokeObjectURL(url)
          resolve()
        }
        audio.onerror = () => {
          URL.revokeObjectURL(url)
          resolve()
        }
        audio.play().catch(() => {
          URL.revokeObjectURL(url)
          resolve()
        })
      })
      return
    } catch {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel()
          const utter = new SpeechSynthesisUtterance(text)
          utter.lang = 'en-US'
          utter.rate = rate
          window.speechSynthesis.speak(utter)
        } catch {
          /* ignore */
        }
      }
    }
  },

  importWordbook: async (file: File, bookName?: string) => {
    const form = new FormData()
    form.append('file', file)
    if (bookName) form.append('book_name', bookName)
    const res = await fetch(`${BASE}/api/v1/wordbooks/import`, { method: 'POST', body: form })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new ApiError(body?.detail ?? '导入失败', res.status)
    }
    return res.json() as Promise<{
      book_name: string
      parsed: number
      imported: number
      skipped: number
    }>
  },

  completeVoiceSession: (payload: {
    proactive_words: string[]
    hint_words: string[]
    mistakes: { category: string; user_said: string; suggested: string; tip_zh: string }[]
  }) =>
    request<{ status: string; proactive_count: number; hint_count: number; fsrs_boosted: number }>(
      '/api/v1/voice/complete-session',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  getConfig: () =>
    request<{
      study_plan: Record<string, number>
      models: Record<string, Record<string, unknown>>
    }>('/api/v1/admin/config'),

  updateConfig: (patch: unknown) =>
    request<{ status: string; reloaded?: boolean }>('/api/v1/admin/config', {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),

  getMemory: () => request<{ user_profile: string; error_patterns: string }>('/api/v1/admin/memory'),

  updateMemory: (doc: 'user_profile' | 'error_patterns', content: string) =>
    request<{ status: string; doc: string; bytes: number }>(`/api/v1/admin/memory/${doc}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),

  compactMemory: () =>
    request<{ status: string; user_profile: string; error_patterns: string }>(
      '/api/v1/admin/compact',
      { method: 'POST' },
    ),
}

export { ApiError }
