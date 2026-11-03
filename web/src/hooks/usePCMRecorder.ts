/**
 * 麦克风 PCM 采集（SPEC 7.2）。
 *
 * 关键工程点：
 * 1. 显式开启硬件级回声消除/降噪/自动增益，否则 AI 的声音会被录回去触发误打断。
 * 2. 手机浏览器（尤其 iOS Safari）硬件采样率常见 44.1k/48k，必须在 Worklet 内
 *    线性插值降到 16kHz，再转成小端序 Int16 发送。
 * 3. 麦克风采集与播放必须共用一个 AudioContext，否则 iOS 上会出现采样率不一致
 *    导致的音高错误。
 */

const TARGET_SAMPLE_RATE = 16000
const CHUNK_MS = 100

const workletCode = `
class PCMRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.targetRate = ${TARGET_SAMPLE_RATE}
    this.sourceRate = sampleRate
    this.ratio = this.sourceRate / this.targetRate
    this.buffer = []
    this.tail = new Float32Array(0)
    this.chunkSamples = Math.round(this.targetRate * ${CHUNK_MS} / 1000)
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || !input.length) return true
    const channel = input[0]
    if (!channel || !channel.length) return true

    // 拼接上次残留 + 本次输入，保证插值连续，避免块边界爆音
    const merged = new Float32Array(this.tail.length + channel.length)
    merged.set(this.tail)
    merged.set(channel, this.tail.length)

    // 线性插值重采样
    const outLen = Math.floor((merged.length - 1) / this.ratio)
    for (let i = 0; i < outLen; i++) {
      const srcPos = i * this.ratio
      const i0 = Math.floor(srcPos)
      const i1 = Math.min(i0 + 1, merged.length - 1)
      const frac = srcPos - i0
      const sample = merged[i0] * (1 - frac) + merged[i1] * frac
      this.buffer.push(sample)
    }

    // 保留最后一个样本用于下一块插值
    const consumed = Math.floor(outLen * this.ratio)
    this.tail = merged.slice(consumed)

    while (this.buffer.length >= this.chunkSamples) {
      const chunk = this.buffer.splice(0, this.chunkSamples)
      const pcm = new Int16Array(chunk.length)
      for (let i = 0; i < chunk.length; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]))
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
      }
      this.port.postMessage(pcm.buffer, [pcm.buffer])
    }
    return true
  }
}
registerProcessor('pcm-recorder', PCMRecorderProcessor)
`

export interface RecorderHandle {
  stop: () => Promise<void>
  setMuted: (muted: boolean) => void
  readonly sampleRate: number
}

export class MicRecorder {
  private stream: MediaStream | null = null
  private ctx: AudioContext | null = null
  private node: AudioWorkletNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private muted = false
  private onChunk: (buf: ArrayBuffer) => void

  constructor(onChunk: (buf: ArrayBuffer) => void) {
    this.onChunk = onChunk
  }

  async start(): Promise<RecorderHandle> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    })

    this.ctx = new AudioContext()
    const blob = new Blob([workletCode], { type: 'application/javascript' })
    const url = URL.createObjectURL(blob)
    try {
      await this.ctx.audioWorklet.addModule(url)
    } finally {
      URL.revokeObjectURL(url)
    }

    this.source = this.ctx.createMediaStreamSource(this.stream)
    this.node = new AudioWorkletNode(this.ctx, 'pcm-recorder')
    this.node.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      if (!this.muted) this.onChunk(event.data)
    }
    this.source.connect(this.node)
    // 不连到 destination，避免把自己录到的声音再放出来形成啸叫

    if (this.ctx.state === 'suspended') await this.ctx.resume()

    return {
      stop: () => this.stop(),
      setMuted: (m: boolean) => {
        this.muted = m
      },
      sampleRate: this.ctx.sampleRate,
    }
  }

  async stop(): Promise<void> {
    this.node?.port.close()
    this.node?.disconnect()
    this.source?.disconnect()
    this.stream?.getTracks().forEach((t) => t.stop())
    if (this.ctx && this.ctx.state !== 'closed') await this.ctx.close()
    this.node = null
    this.source = null
    this.stream = null
    this.ctx = null
  }
}
