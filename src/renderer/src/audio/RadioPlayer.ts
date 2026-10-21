import radioUrl from '../assets/audio/jingle-bells-radio.wav?url'
import { radioPosition } from '../../../shared/roomAudio'

/** A stopped buffer source is recreated at its saved offset; muting never rewinds it. */
export class RadioPlayer {
  private buffer: Promise<AudioBuffer> | null = null
  private source: AudioBufferSourceNode | null = null
  private gain: GainNode | null = null
  private offset = 0
  private started = 0
  private revision = 0
  private filter: BiquadFilterNode
  private panner: PannerNode

  constructor(
    private context: AudioContext,
    master: GainNode,
  ) {
    this.filter = context.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.frequency.value = 2400
    this.filter.Q.value = 0.45
    const bass = context.createBiquadFilter()
    bass.type = 'highpass'
    bass.frequency.value = 125
    this.panner = context.createPanner()
    this.panner.panningModel = 'HRTF'
    this.panner.distanceModel = 'inverse'
    this.panner.refDistance = 2.5
    this.panner.rolloffFactor = 0.45
    this.panner.positionX.value = radioPosition[0]
    this.panner.positionY.value = radioPosition[1]
    this.panner.positionZ.value = radioPosition[2]
    this.filter.connect(bass)
    bass.connect(this.panner)
    this.panner.connect(master)
  }

  async setPlaying(playing: boolean): Promise<void> {
    const revision = ++this.revision
    if (!playing) {
      if (!this.source) return
      const source = this.source
      const gain = this.gain!
      const time = this.context.currentTime
      const end = time + 0.04
      this.offset = (this.offset + end - this.started) % source.buffer!.duration
      gain.gain.cancelAndHoldAtTime(time)
      gain.gain.linearRampToValueAtTime(0, end)
      source.stop(end)
      source.onended = () => {
        source.disconnect()
        gain.disconnect()
      }
      this.source = null
      this.gain = null
      return
    }
    if (this.source) return
    this.buffer ??= fetch(radioUrl)
      .then((response) => {
        if (!response.ok) throw new Error('Не удалось загрузить музыку радио')
        return response.arrayBuffer()
      })
      .then((bytes) => this.context.decodeAudioData(bytes))
      .catch((error: unknown) => {
        this.buffer = null
        throw error
      })
    const buffer = await this.buffer
    if (revision !== this.revision) return
    const source = this.context.createBufferSource()
    source.buffer = buffer
    source.loop = true
    const gain = this.context.createGain()
    gain.gain.value = 0
    source.connect(gain)
    gain.connect(this.filter)
    this.started = this.context.currentTime
    source.start(this.started, this.offset)
    gain.gain.linearRampToValueAtTime(0.85, this.started + 0.08)
    this.source = source
    this.gain = gain
  }
}
