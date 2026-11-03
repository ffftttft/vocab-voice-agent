/** 显示层格式化工具。 */

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function weekdayShort(offset: number): string {
  if (offset === 0) return '今天'
  if (offset === 1) return '明天'
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
}

/** 把例句里出现的目标词包成高亮标签。 */
export function highlightWord(sentence: string, word: string): { text: string; hit: boolean }[] {
  if (!word) return [{ text: sentence, hit: false }]
  const stem = word.toLowerCase()
  const parts: { text: string; hit: boolean }[] = []
  const regex = new RegExp(`(${escapeRegex(stem)}\\w*)`, 'gi')
  let last = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(sentence)) !== null) {
    if (m.index > last) parts.push({ text: sentence.slice(last, m.index), hit: false })
    parts.push({ text: m[0], hit: true })
    last = m.index + m[0].length
  }
  if (last < sentence.length) parts.push({ text: sentence.slice(last), hit: false })
  return parts.length ? parts : [{ text: sentence, hit: false }]
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 把 **词** 标记转成 {text, strong} 片段，用于提示示例回答。 */
export function parseEmphasis(text: string): { text: string; strong: boolean }[] {
  const out: { text: string; strong: boolean }[] = []
  const regex = /\*\*(.+?)\*\*/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), strong: false })
    out.push({ text: m[1], strong: true })
    last = m.index + m[1].length + 4
  }
  if (last < text.length) out.push({ text: text.slice(last), strong: false })
  return out.length ? out : [{ text, strong: false }]
}
