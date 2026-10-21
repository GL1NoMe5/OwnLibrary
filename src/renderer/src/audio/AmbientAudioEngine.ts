import type { RoomConfig } from '../../../shared/types'

export class AmbientAudioEngine {
  private context: AudioContext | null = null
  private sources: AudioScheduledSourceNode[] = []
  private master: GainNode | null = null
  private crackle: ReturnType<typeof setInterval> | null = null
  async update(config: RoomConfig): Promise<void> {
    this.stop()
    if (!config.sound) return
    if (!this.context) this.context = new AudioContext()
    await this.context.resume()
    this.master = this.context.createGain()
    this.master.gain.value = config.volume * 0.35
    this.master.connect(this.context.destination)
    if (config.rain) this.noise(0.5, 650)
    if (config.fireplaceActive) {
      this.noise(0.32, 180)
      this.crackle = setInterval(() => {
        if (Math.random() > 0.3) this.tone(90 + Math.random() * 450, 0.018, 0.12)
      }, 140)
    }
  }
  private noise(gain: number, cutoff: number): void {
    const context = this.context!
    const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate)
    const channel = buffer.getChannelData(0)
    let brown = 0
    for (let i = 0; i < channel.length; i++) {
      brown = (brown + Math.random() * 0.04 - 0.02) / 1.02
      channel[i] = brown * 8
    }
    const source = context.createBufferSource()
    source.buffer = buffer
    source.loop = true
    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = cutoff
    const volume = context.createGain()
    volume.gain.value = gain
    source.connect(filter)
    filter.connect(volume)
    volume.connect(this.master!)
    source.start()
    this.sources.push(source)
  }
  private tone(frequency: number, duration: number, volume: number): void {
    if (!this.context || !this.master) return
    const osc = this.context.createOscillator()
    const gain = this.context.createGain()
    const time = this.context.currentTime
    osc.type = 'triangle'
    osc.frequency.value = frequency
    gain.gain.setValueAtTime(volume, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start()
    osc.stop(time + duration)
    osc.onended = () => {
      osc.disconnect()
      gain.disconnect()
    }
  }
  pageFlip(): void {
    this.tone(380, 0.11, 0.05)
    this.tone(620, 0.075, 0.035)
  }
  purr(): void {
    for (let i = 0; i < 8; i++)
      setTimeout(() => this.tone(28 + Math.random() * 5, 0.12, 0.15), i * 105)
  }
  stop(): void {
    if (this.crackle) clearInterval(this.crackle)
    this.crackle = null
    for (const source of this.sources) {
      source.stop()
      source.disconnect()
    }
    this.sources = []
    this.master?.disconnect()
    this.master = null
  }
  dispose(): void {
    this.stop()
    void this.context?.close()
  }
}
export const audio = new AmbientAudioEngine()
