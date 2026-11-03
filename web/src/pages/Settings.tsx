/**
 * 设置与记忆管理页（SPEC 7.1-4）。
 *
 * 三个 tab：模型配置 / 记忆编辑 / 词书导入。
 * 模型配置支持热切换 —— 改完立即生效，不需要重启服务。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

type Tab = 'models' | 'memory' | 'wordbook'

interface StageFields {
  provider: string
  base_url: string
  api_key: string
  model_name: string
  ws_url: string
  voice_id: string
}

const emptyStage: StageFields = {
  provider: '',
  base_url: '',
  api_key: '',
  model_name: '',
  ws_url: '',
  voice_id: '',
}

export default function Settings() {
  const [tab, setTab] = useState<Tab>('models')
  const [textLlm, setTextLlm] = useState<StageFields>(emptyStage)
  const [voice, setVoice] = useState<StageFields>(emptyStage)
  const [tts, setTts] = useState<StageFields>(emptyStage)
  const [studyPlan, setStudyPlan] = useState<Record<string, number>>({})
  const [profile, setProfile] = useState('')
  const [errors, setErrors] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [cfg, mem] = await Promise.all([api.getConfig(), api.getMemory()])
      setTextLlm({ ...emptyStage, ...(cfg.models.text_llm as unknown as StageFields) })
      setVoice({ ...emptyStage, ...(cfg.models.realtime_voice as unknown as StageFields) })
      setTts({ ...emptyStage, ...(cfg.models.tts as unknown as StageFields) })
      setStudyPlan(cfg.study_plan)
      setProfile(mem.user_profile)
      setErrors(mem.error_patterns)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function flash(msg: string) {
    setMessage(msg)
    window.setTimeout(() => setMessage(null), 2500)
  }

  async function saveModels() {
    setSaving(true)
    setError(null)
    try {
      await api.updateConfig({
        text_llm: { ...textLlm, api_key: textLlm.api_key.includes('*') ? '' : textLlm.api_key },
        realtime_voice: {
          ...voice,
          api_key: voice.api_key.includes('*') ? '' : voice.api_key,
        },
        tts: { ...tts, api_key: tts.api_key.includes('*') ? '' : tts.api_key },
      })
      flash('模型配置已保存并热生效')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function saveMemory() {
    setSaving(true)
    setError(null)
    try {
      await api.updateMemory('user_profile', profile)
      await api.updateMemory('error_patterns', errors)
      flash('记忆文件已保存')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function uploadWordbook(file: File) {
    setError(null)
    try {
      const result = await api.importWordbook(file)
      flash(`导入成功：${result.imported} 个词（跳过 ${result.skipped} 个重复）`)
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (loading) {
    return (
      <div className="screen">
        <div className="topbar">
          <h1 className="title">设置</h1>
        </div>
        <div className="loading-screen">
          <div className="spinner" style={{ margin: '0 auto' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="topbar">
        <h1 className="title">设置</h1>
      </div>

      {message && <div className="notice-box">{message}</div>}
      {error && <div className="error-box">{error}</div>}

      <div className="tab-row">
        <button className={`tab${tab === 'models' ? ' tab-active' : ''}`} onClick={() => setTab('models')}>
          模型
        </button>
        <button className={`tab${tab === 'memory' ? ' tab-active' : ''}`} onClick={() => setTab('memory')}>
          记忆
        </button>
        <button
          className={`tab${tab === 'wordbook' ? ' tab-active' : ''}`}
          onClick={() => setTab('wordbook')}
        >
          词书
        </button>
      </div>

      {tab === 'models' && (
        <>
          <StageForm
            title="文本模型"
            hint="用于选词、造句、出题、实时提示、记忆提炼。推荐走中转站以降低成本。"
            value={textLlm}
            onChange={setTextLlm}
            showWs={false}
          />
          <StageForm
            title="实时语音模型"
            hint="用于全双工语音对话。走官方接口，延迟与音质优先。"
            value={voice}
            onChange={setVoice}
            showWs
          />
          <StageForm
            title="TTS 语音合成"
            hint="用于单词与例句朗读。默认 Edge-TTS 免费且带磁盘缓存。"
            value={tts}
            onChange={setTts}
            showWs={false}
          />

          <div className="section-title">学习计划</div>
          <div className="card">
            {Object.entries(studyPlan).map(([key, value]) => (
              <div className="field" key={key}>
                <label className="field-label">{planLabels[key] ?? key}</label>
                <input className="input" type="number" value={value} readOnly />
              </div>
            ))}
            <div className="field-hint">
              这些参数在 config.yaml 中修改。难度会随你的熟练度逐步上调。
            </div>
          </div>

          <button className="btn btn-primary btn-block" onClick={() => void saveModels()} disabled={saving}>
            {saving ? '保存中…' : '保存并热生效'}
          </button>
        </>
      )}

      {tab === 'memory' && (
        <>
          <div className="section-title">用户画像</div>
          <div className="field-hint" style={{ marginBottom: 8 }}>
            这份内容会注入每次造句和对话的 prompt。写得越具体，AI 说的话越像你。
          </div>
          <textarea
            className="input textarea"
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
          />

          <div className="section-title">语言病历</div>
          <div className="field-hint" style={{ marginBottom: 8 }}>
            由每日记忆提炼自动维护，也可以手动补充。次日对话时 AI 会重点留意这些点。
          </div>
          <textarea
            className="input textarea"
            value={errors}
            onChange={(e) => setErrors(e.target.value)}
          />

          <button className="btn btn-primary btn-block" onClick={() => void saveMemory()} disabled={saving}>
            {saving ? '保存中…' : '保存记忆'}
          </button>
        </>
      )}

      {tab === 'wordbook' && (
        <>
          <div className="card">
            <div style={{ fontWeight: 650, marginBottom: 8 }}>导入词书</div>
            <p className="field-hint" style={{ marginBottom: 14 }}>
              支持 JSON 或 CSV。JSON 结构：<code>{'{"words":[{"word":"...","definitions":"v. ..."}]}'}</code>
              <br />
              CSV 表头需要包含 <code>word</code>、<code>definitions</code> 列。重复词会自动跳过。
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".json,.csv,.txt"
              className="input"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void uploadWordbook(file)
              }}
            />
          </div>
          <div className="notice-box">
            导入后每个词会自动创建一张 FSRS 新卡。首日的学习计划会自动从新词池里挑选。
          </div>
        </>
      )}
    </div>
  )
}

const planLabels: Record<string, string> = {
  daily_new_words: '每日新词数',
  daily_review_limit: '每日复习上限',
  voice_target_words_count: '语音目标词数',
  voice_sliding_window_size: '语音滑动窗口大小',
  voice_session_target_minutes: '语音目标时长（分钟）',
}

function StageForm({
  title,
  hint,
  value,
  onChange,
  showWs,
}: {
  title: string
  hint: string
  value: StageFields
  onChange: (v: StageFields) => void
  showWs: boolean
}) {
  function set<K extends keyof StageFields>(key: K, v: string) {
    onChange({ ...value, [key]: v })
  }

  return (
    <>
      <div className="section-title">{title}</div>
      <div className="card">
        <div className="field-hint" style={{ marginBottom: 12 }}>
          {hint}
        </div>
        <div className="field">
          <label className="field-label">Provider</label>
          <input className="input" value={value.provider} onChange={(e) => set('provider', e.target.value)} />
        </div>
        {showWs ? (
          <div className="field">
            <label className="field-label">WebSocket URL</label>
            <input className="input" value={value.ws_url} onChange={(e) => set('ws_url', e.target.value)} />
          </div>
        ) : (
          <div className="field">
            <label className="field-label">Base URL</label>
            <input className="input" value={value.base_url} onChange={(e) => set('base_url', e.target.value)} />
          </div>
        )}
        <div className="field">
          <label className="field-label">API Key</label>
          <input
            className="input"
            type="password"
            placeholder="留空表示不修改"
            value={value.api_key}
            onChange={(e) => set('api_key', e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field-label">模型名</label>
          <input className="input" value={value.model_name} onChange={(e) => set('model_name', e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">{showWs ? '音色 ID' : 'voice_id'}</label>
          <input className="input" value={value.voice_id} onChange={(e) => set('voice_id', e.target.value)} />
        </div>
      </div>
    </>
  )
}
