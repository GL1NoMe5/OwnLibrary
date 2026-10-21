import type { RoomConfig } from '../../../shared/types'
import fireplaceUrl from '../assets/audio/fireplace.mp3?url'
import rainUrl from '../assets/audio/rain-window.ogg?url'

type Layer = 'rain' | 'fireplace'
type PlayingLayer = { source: AudioBufferSourceNode; gain: GainNode }
const recordings: Record<Layer, string> = { rain: rainUrl, fireplace: fireplaceUrl }

export class AmbientAudioEngine {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private buffers = new Map<Layer, Promise<AudioBuffer>>()
  private playing = new Map<Layer, PlayingLayer>()
  private revision = 0
  private enabled = false
  private muteTimer: ReturnType<typeof setTimeout> | null = null
  private effectTimers = new Set<ReturnType<typeof setTimeout>>()

  async update(config: RoomConfig): Promise<void> {
    const revision = ++this.revision
    this.enabled = config.sound
    if (this.muteTimer) clearTimeout(this.muteTimer)
    this.muteTimer = null
    if (!config.sound) {
      this.clearEffects()
      if (this.context && this.master) {
        this.fade(this.master, 0, 0.3)
        this.muteTimer = setTimeout(() => this.stopLayers(), 350)
      }
      return
    }
    if (!this.context) {
      this.context = new AudioContext()
      this.master = this.context.createGain()
      this.master.gain.value = 0
      this.master.connect(this.context.destination)
    }
    const context = this.context
    await context.resume()
    if (revision !== this.revision) return
    this.fade(this.master!, Math.max(0, Math.min(1, config.volume)) * 0.7, 0.3)
    const active: Record<Layer, boolean> = {
      rain: config.rain,
      fireplace: config.fireplaceActive,
    }
    await Promise.all(
      (Object.keys(recordings) as Layer[]).map(async (layer) => {
        const existing = this.playing.get(layer)
        if (existing) {
          this.fade(existing.gain, active[layer] ? 1 : 0, 0.6)
          return
        }
        if (!active[layer]) return
        const buffer = await this.load(layer)
        if (revision !== this.revision) return
        const source = context.createBufferSource()
        source.buffer = buffer
        source.loop = true
        const gain = context.createGain()
        gain.gain.value = 0
        source.connect(gain)
        gain.connect(this.master!)
        this.playing.set(layer, { source, gain })
        source.start()
        this.fade(gain, 1, 0.8)
      }),
    )
  }

  private load(layer: Layer): Promise<AudioBuffer> {
    const cached = this.buffers.get(layer)
    if (cached) return cached
    const context = this.context!
    const loading = (async () => {
      const response = await fetch(recordings[layer])
      if (!response.ok) throw new Error('Не удалось загрузить запись звуков уюта')
      const original = await context.decodeAudioData(await response.arrayBuffer())
      // Join the field recording on the audio clock without a gap or a click.
      const trim = Math.round(original.sampleRate * 0.08)
      const length = original.length - trim * 2
      const overlap = Math.min(Math.round(original.sampleRate * 1.5), Math.floor(length / 4))
      const loop = context.createBuffer(
        original.numberOfChannels,
        length - overlap,
        original.sampleRate,
      )
      let energy = 0
      let peak = 0
      for (let channel = 0; channel < loop.numberOfChannels; channel++) {
        const input = original.getChannelData(channel).subarray(trim, original.length - trim)
        const output = loop.getChannelData(channel)
        output.set(input.subarray(overlap, length - overlap))
        for (let i = 0; i < overlap; i++) {
          const angle = (i / (overlap - 1)) * Math.PI * 0.5
          output[length - 2 * overlap + i] =
            input[length - overlap + i] * Math.cos(angle) + input[i] * Math.sin(angle)
        }
        for (const value of output) {
          energy += value * value
          peak = Math.max(peak, Math.abs(value))
        }
      }
      const rms = Math.sqrt(energy / (loop.length * loop.numberOfChannels))
      // Leave room for both layers and preserve natural fire transients.
      const scale = Math.min(
        (layer === 'rain' ? 0.12 : 0.1) / Math.max(rms, 0.0001),
        0.65 / Math.max(peak, 0.0001),
      )
      for (let channel = 0; channel < loop.numberOfChannels; channel++) {
        const output = loop.getChannelData(channel)
        for (let i = 0; i < output.length; i++) output[i] *= scale
      }
      return loop
    })().catch((error: unknown) => {
      this.buffers.delete(layer)
      throw error
    })
    this.buffers.set(layer, loading)
    return loading
  }

  private fade(node: GainNode, value: number, seconds: number): void {
    const time = this.context!.currentTime
    node.gain.cancelAndHoldAtTime(time)
    node.gain.linearRampToValueAtTime(value, time + seconds)
  }

  private tone(frequency: number, duration: number, volume: number): void {
    if (!this.enabled || !this.context || !this.master) return
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
    if (!this.enabled) return
    for (let i = 0; i < 8; i++) {
      const timer = setTimeout(() => {
        this.effectTimers.delete(timer)
        this.tone(28 + Math.random() * 5, 0.12, 0.15)
      }, i * 105)
      this.effectTimers.add(timer)
    }
  }
  private clearEffects(): void {
    for (const timer of this.effectTimers) clearTimeout(timer)
    this.effectTimers.clear()
  }
  private stopLayers(): void {
    for (const { source, gain } of this.playing.values()) {
      source.stop()
      source.disconnect()
      gain.disconnect()
    }
    this.playing.clear()
  }
  stop(): void {
    ++this.revision
    this.enabled = false
    this.clearEffects()
    if (this.muteTimer) clearTimeout(this.muteTimer)
    this.muteTimer = null
    this.stopLayers()
    if (this.master) {
      this.master.gain.cancelScheduledValues(this.context!.currentTime)
      this.master.gain.value = 0
    }
  }
  dispose(): void {
    this.stop()
    void this.context?.close()
    this.context = null
    this.master = null
    this.buffers.clear()
  }
}
export const audio = new AmbientAudioEngine()
