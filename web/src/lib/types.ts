/** 与后端 API 对齐的类型定义。 */

export interface McqOption {
  label: string
  pos: string
  text: string
}

export interface StudyCard {
  item_id: number
  word_id: number
  word: string
  phonetic_us: string | null
  item_type: 'NEW' | 'REVIEW'
  sentence_en: string | null
  sentence_zh: string | null
  sentence_audio_path: string | null
  options: McqOption[]
  pos_defs: { pos?: string; def?: string }[]
  is_voice_target: boolean
  requeue_count: number
}

export interface Progress {
  new: { total: number; done: number }
  review: { total: number; done: number }
  total: number
  done: number
  remaining: number
  all_done: boolean
}

export interface QueueResponse {
  plan_date: string
  progress: Progress
  cards: StudyCard[]
}

export interface ReviewResult {
  word_id: number
  is_correct: boolean
  correct_labels: string[]
  rating: number
  rating_source: 'auto' | 'manual'
  requeued: boolean
  requeue_count: number
  next_due: string | null
  progress: Progress
}

export interface UpcomingDay {
  date: string
  offset: number
  count: number
}

export interface Stats {
  new: number
  due: number
  total: number
  upcoming: UpcomingDay[]
}

export interface PlanResponse {
  plan_date: string
  cached: boolean
  scenario_title: string | null
  scenario_brief: string | null
  status?: string
  new_count?: number
  review_count?: number
  voice_target_count?: number
  audio_ready?: number
  warnings?: string[]
  progress: Progress
}

export interface TargetWord {
  word_id: number
  word: string
  sentence_en: string
  pos_defs: { pos?: string; def?: string }[]
  voice_used_status: string
}

export type ServerEvent =
  | { type: 'server.session_ready'; session_id: number; scenario_title: string; scenario_brief: string; target_words: string[]; progress: ServerProgress }
  | { type: 'server.speech_started' }
  | { type: 'server.transcript'; role: 'user' | 'assistant'; text: string; is_final: boolean }
  | { type: 'server.word_used'; word: string; used_correctly: boolean; in_window: boolean; active_words: string[]; completed_words: string[] }
  | { type: 'server.mistake_card'; category: string; user_said: string; suggested: string; tip_zh: string }
  | { type: 'server.session_closed'; reason: string }
  | { type: 'server.error'; message: string }

export interface ServerProgress {
  total: number
  completed: number
  remaining: number
  failed: number
}
