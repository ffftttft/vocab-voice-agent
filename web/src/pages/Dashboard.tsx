/**
 * 首页仪表盘（SPEC 7.1-1）。
 *
 * 展示今日进度、场景预告、未来 7 天复习压力。
 * 首次进入自动拉取今日计划（后端有缓存，不会重复烧 LLM 费用）。
 */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { weekdayShort } from '../lib/format'
import type { PlanResponse, Stats } from '../lib/types'

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setStats(await api.stats())
      setPlan(await api.getPlan())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function regenerate() {
    setGenerating(true)
    setError(null)
    try {
      setPlan(await api.regeneratePlan())
      setStats(await api.stats())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setGenerating(false)
    }
  }

  const newTotal = plan?.progress.new.total ?? 0
  const newDone = plan?.progress.new.done ?? 0
  const revTotal = plan?.progress.review.total ?? 0
  const revDone = plan?.progress.review.done ?? 0
  const allDone = plan?.progress.all_done ?? false

  const maxCount = Math.max(1, ...(stats?.upcoming.map((d) => d.count) ?? [1]))

  return (
    <div className="screen">
      <div className="topbar">
        <div>
          <h1 className="title">今日学习</h1>
          <p className="subtitle">{new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</p>
        </div>
        {stats && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.total}</div>
            <div className="subtitle">累计词数</div>
          </div>
        )}
      </div>

      {loading && (
        <div className="loading-screen">
          <div className="spinner" style={{ margin: '0 auto' }} />
          <div>加载中…</div>
        </div>
      )}

      {error && (
        <>
          <div className="error-box">{error}</div>
          <div className="field-hint" style={{ marginTop: -6 }}>
            若提示模型配置问题，请到「设置」页填写 base_url 与 api_key，或在项目根目录配置 .env。
          </div>
          <button className="btn btn-secondary btn-block" onClick={() => void refresh()}>
            重试
          </button>
          {stats && stats.total > 0 && (
            <button className="btn btn-ghost btn-block" onClick={() => void regenerate()}>
              忽略并重新生成计划
            </button>
          )}
        </>
      )}

      {!loading && plan && (
        <>
          <div className="card">
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 6 }}>今日场景</div>
            <div style={{ fontSize: 18, fontWeight: 650, marginBottom: 8 }}>
              {plan.scenario_title ?? '尚未规划'}
            </div>
            {plan.scenario_brief && (
              <p style={{ fontSize: 14, color: 'var(--text-dim)', margin: 0, lineHeight: 1.6 }}>
                {plan.scenario_brief}
              </p>
            )}
            {plan.warnings?.map((w) => (
              <div key={w} className="notice-box" style={{ marginTop: 10 }}>
                {w}
              </div>
            ))}
          </div>

          <div className="stat-row">
            <div className="stat">
              <div className="stat-value" style={{ color: newDone >= newTotal && newTotal > 0 ? 'var(--success)' : undefined }}>
                {newDone}
                <span style={{ fontSize: 14, color: 'var(--text-faint)' }}>/{newTotal}</span>
              </div>
              <div className="stat-label">今日新学</div>
            </div>
            <div className="stat">
              <div className="stat-value" style={{ color: revDone >= revTotal && revTotal > 0 ? 'var(--success)' : undefined }}>
                {revDone}
                <span style={{ fontSize: 14, color: 'var(--text-faint)' }}>/{revTotal}</span>
              </div>
              <div className="stat-label">今日复习</div>
            </div>
            <div className="stat">
              <div className="stat-value">{stats?.due ?? 0}</div>
              <div className="stat-label">待复习</div>
            </div>
          </div>

          {allDone && (
            <Link to="/voice" className="btn btn-primary btn-block btn-lg" style={{ textDecoration: 'none' }}>
              ◉ 开始语音实战
            </Link>
          )}
          {!allDone && plan.progress.total > 0 && (
            <Link to="/study" className="btn btn-primary btn-block btn-lg" style={{ textDecoration: 'none' }}>
              开始背词
            </Link>
          )}
          {plan.progress.total === 0 && (
            <button className="btn btn-primary btn-block btn-lg" onClick={() => void regenerate()} disabled={generating}>
              {generating ? 'AI 正在规划今日场景…' : '生成今日学习计划'}
            </button>
          )}

          {stats && stats.upcoming.length > 0 && (
            <div className="card">
              <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>
                未来 7 天复习压力
              </div>
              <div className="bars">
                {stats.upcoming.map((day) => (
                  <div className="bar-col" key={day.offset}>
                    <div
                      className={`bar${day.offset === 0 ? ' bar-today' : ''}`}
                      style={{ height: `${Math.max(2, (day.count / maxCount) * 62)}px` }}
                      title={`${day.count} 个`}
                    />
                    <div className="bar-label">{weekdayShort(day.offset)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button className="btn btn-ghost btn-block" onClick={() => void regenerate()} disabled={generating}>
            {generating ? '重新规划中…' : '重新生成今日计划'}
          </button>
        </>
      )}
    </div>
  )
}
