/** 与后端 API 对齐的类型定义（Argon4 完整版）。 */

export type ScreenId =
  | '01-today-studio'
  | '02-fsrs-sprint-question'
  | '03-fsrs-sprint-reveal'
  | '04-fsrs-sprint-wrong'
  | '05-lexicon-planet'
  | '06-wordbooks-tagging'
  | '07-voice-studio-lobby'
  | '08-voice-call-active'
  | '09-voice-call-recast'
  | '10-voice-call-hint'
  | '11-session-wrapped'
  | '12-memory-journal'
  | '13-memory-editor'
  | '14-engine-router'

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
  collocations?: string[]
  confusable_note?: string
  topic_tag?: string
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
  scenario_title?: string | null
  scenario_brief?: string | null
  status?: string | null
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
  learning?: number
  review?: number
  relearning?: number
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

export interface WordRecord {
  id: number
  word: string
  phonetic_us: string
  pos_defs: { pos?: string; def?: string }[]
  topic_tags: string[]
  book_name: string
  state: number
  stability: number | null
  difficulty: number | null
  reps: number
  lapses: number
}

export interface LinguisticMistakeRecord {
  id: number
  plan_date: string
  mistake_type: 'PRONUNCIATION' | 'GRAMMAR' | 'WORD_CHOICE' | string
  user_original: string
  corrected_version: string
  explanation: string
}

export interface WordsAndMistakesResponse {
  words: WordRecord[]
  mistakes: LinguisticMistakeRecord[]
  tag_counts?: Record<string, number>
  books?: string[]
}

export interface TargetWord {
  word_id: number
  word: string
  sentence_en: string
  pos_defs: { pos?: string; def?: string }[]
  voice_used_status: string
}

export type ServerEvent =
  | {
      type: 'server.session_ready'
      session_id: number
      scenario_title: string
      scenario_brief: string
      target_words: string[]
      progress: ServerProgress
    }
  | { type: 'server.speech_started' }
  | { type: 'server.transcript'; role: 'user' | 'assistant'; text: string; is_final: boolean }
  | {
      type: 'server.word_used'
      word: string
      used_correctly: boolean
      in_window: boolean
      active_words: string[]
      completed_words: string[]
    }
  | {
      type: 'server.mistake_card'
      category: string
      user_said: string
      suggested: string
      tip_zh: string
    }
  | { type: 'server.session_closed'; reason: string }
  | { type: 'server.error'; message: string }

export interface ServerProgress {
  total: number
  completed: number
  remaining: number
  failed: number
}
