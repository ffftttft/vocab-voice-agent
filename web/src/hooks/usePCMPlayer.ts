/**
 * 24kHz PCM 流式播放（SPEC 7.2 第 3 点）。
 *
 * 核心是维护 nextStartTime 时间游标：每块音频都排在前一块结束的时刻开始，
 * 这样分片之间首尾相接，消除爆音（Pop/Click）。
 *
 * 打断时立即停止所有已排程的 source 并重置游标 —— 这是「毫秒级打断响应」的实现。
 */

const OUTPUT_SAMPLE_RATE = 24000

export class PCMPlayer {
  private ctx: AudioContext
  private nextStartTime = 0
  private sources = new Set<AudioBufferSourceNode>()
  private gain: GainNode

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.gain = ctx.createGain()
    this.gain.gain.value = 1
    this.gain.connect(ctx.destination)
  }

  get context(): AudioContext {
    return this.ctx
  }

  /** 推入一块 24kHz Int16 PCM。 */
  push(pcm16: ArrayBuffer): void {
    const int16 = new Int16Array(pcm16)
    if (int16.length === 0) return

    const float32 = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff)
    }

    const buffer = this.ctx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE)
    buffer.copyToChannel(float32, 0)

    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.connect(this.gain)

    // 游标落后于当前时刻说明播放断流了，从「现在」重新开始，避免一次性补播一堆
    const now = this.ctx.currentTime
    const startAt = Math.max(this.nextStartTime, now + 0.02)
    source.start(startAt)
    this.nextStartTime = startAt + buffer.duration

    this.sources.add(source)
    source.onended = () => this.sources.delete(source)
  }

  /** 立即停止并清空播放队列（用户开口打断时调用）。 */
  flush(): void {
    for (const s of this.sources) {
      try {
        s.stop()
      } catch {
        /* 已结束的 source 会抛错，忽略 */
      }
    }
    this.sources.clear()
    this.nextStartTime = 0
  }

  dispose(): void {
    this.flush()
    this.gain.disconnect()
  }
}

/** 播放一段一次性音频（如提示示例回答的 TTS）。返回播放完成的 Promise。 */
export async function playAudioBlob(ctx: AudioContext, blob: Blob): Promise<void> {
  const arrayBuffer = await blob.arrayBuffer()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
  const source = ctx.createBufferSource()
  source.buffer = audioBuffer
  source.connect(ctx.destination)
  return new Promise((resolve) => {
    source.onended = () => resolve()
    source.start()
  })
}
