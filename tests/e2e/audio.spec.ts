import { test, expect, _electron as electron, type Page } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

declare global {
  interface Window {
    audioProbe: {
      sources: AudioBufferSourceNode[]
      gains: GainNode[]
      starts: number
      stops: number
      decoded: number
      requests: number
      release: () => void
    }
  }
}

async function instrument(page: Page, delay = false) {
  await page.evaluate((delay) => {
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const probe = (window.audioProbe = {
      sources: [] as AudioBufferSourceNode[],
      gains: [] as GainNode[],
      starts: 0,
      stops: 0,
      decoded: 0,
      requests: 0,
      release,
    })
    const fetchOriginal = window.fetch.bind(window)
    window.fetch = async (...args) => {
      if (/\.(mp3|ogg)(\?|$)/.test(String(args[0]))) {
        probe.requests++
        if (delay) await gate
      }
      return fetchOriginal(...args)
    }
    const prototype = AudioContext.prototype
    const create = prototype.createBufferSource
    prototype.createBufferSource = function () {
      const source = create.call(this)
      const start = source.start.bind(source)
      const stop = source.stop.bind(source)
      source.start = (...args) => {
        probe.starts++
        start(...args)
      }
      source.stop = (...args) => {
        probe.stops++
        stop(...args)
      }
      probe.sources.push(source)
      return source
    }
    const createGain = prototype.createGain
    prototype.createGain = function () {
      const gain = createGain.call(this)
      probe.gains.push(gain)
      return gain
    }
    const decode = prototype.decodeAudioData
    prototype.decodeAudioData = function (data) {
      return decode.call(this, data).then((buffer) => {
        probe.decoded++
        return buffer
      })
    }
  }, delay)
}

for (const delayed of [false, true]) {
  test(
    delayed
      ? 'muting during loading cannot resurrect ambient audio'
      : 'packaged field recordings loop offline and volume changes preserve playback',
    async () => {
      const directory = await mkdtemp(join(tmpdir(), 'sanctuary-audio-'))
      const app = await electron.launch({
        executablePath: resolve("dist/win-unpacked/Cozy Reader's Sanctuary.exe"),
        args: [],
        env: { ...process.env, SANCTUARY_DATA_DIR: directory, ELECTRON_RENDERER_URL: '' },
      })
      try {
        const page = await app.firstWindow()
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(message.text())
        })
        await expect(
          page.getByRole('heading', { name: 'Моя библиотека', exact: true }),
        ).toBeVisible()
        await page.context().setOffline(true)
        await instrument(page, delayed)
        await page.getByRole('button', { name: 'Включить звуки уюта', exact: true }).click()
        if (delayed) {
          await expect.poll(() => page.evaluate(() => window.audioProbe.requests)).toBe(1)
          await page.getByRole('button', { name: 'Выключить звук', exact: true }).click()
          await page.evaluate(() => window.audioProbe.release())
          await expect.poll(() => page.evaluate(() => window.audioProbe.decoded)).toBe(1)
          expect(await page.evaluate(() => window.audioProbe.starts)).toBe(0)
          await page.getByRole('button', { name: 'Включить звуки уюта', exact: true }).click()
          await expect.poll(() => page.evaluate(() => window.audioProbe.starts)).toBe(1)
        } else {
          await expect.poll(() => page.evaluate(() => window.audioProbe.starts)).toBe(1)
          await page.getByRole('button', { name: 'Настроение и настройки', exact: true }).click()
          await page.getByLabel('Дождь за окном', { exact: true }).check()
          await expect.poll(() => page.evaluate(() => window.audioProbe.starts)).toBe(2)
          const recordings = await page.evaluate(async () => {
            return Promise.all(
              window.audioProbe.sources.map(async (source) => {
                const buffer = source.buffer!
                const context = new OfflineAudioContext(
                  buffer.numberOfChannels,
                  buffer.length + 4096,
                  buffer.sampleRate,
                )
                const loop = context.createBufferSource()
                loop.buffer = buffer
                loop.loop = true
                loop.connect(context.destination)
                loop.start()
                const rendered = await context.startRendering()
                const samples = rendered.getChannelData(0)
                let energy = 0
                for (let i = buffer.length - 2048; i < buffer.length + 2048; i++)
                  energy += samples[i] ** 2
                return {
                  duration: buffer.duration,
                  looping: source.loop,
                  boundaryRms: Math.sqrt(energy / 4096),
                  seam: Math.abs(samples[buffer.length] - samples[buffer.length - 1]),
                }
              }),
            )
          })
          expect(recordings).toHaveLength(2)
          for (const recording of recordings) {
            expect(recording.duration).toBeGreaterThan(20)
            expect(recording.looping).toBe(true)
            expect(recording.boundaryRms).toBeGreaterThan(0.005)
            expect(recording.seam).toBeLessThan(0.12)
          }
          await page.getByLabel('Громкость', { exact: false }).fill('0.7')
          await page.getByRole('switch', { name: /Гирлянды/ }).uncheck()
          await expect
            .poll(() => page.evaluate(() => window.audioProbe.gains[0].gain.value))
            .toBeCloseTo(0.49, 2)
          expect(
            await page.evaluate(() => ({
              starts: window.audioProbe.starts,
              requests: window.audioProbe.requests,
            })),
          ).toEqual({ starts: 2, requests: 2 })
          await page.getByLabel('Дождь за окном', { exact: true }).uncheck()
          await expect
            .poll(() => page.evaluate(() => window.audioProbe.gains[2].gain.value))
            .toBe(0)
          await page.getByLabel('Дождь за окном', { exact: true }).check()
          await expect
            .poll(() => page.evaluate(() => window.audioProbe.gains[2].gain.value))
            .toBe(1)
          expect(await page.evaluate(() => window.audioProbe.starts)).toBe(2)
          await page.getByRole('button', { name: 'Закрыть', exact: true }).click()
        }
        await page.getByRole('button', { name: 'Выключить звук', exact: true }).click()
        await expect.poll(() => page.evaluate(() => window.audioProbe.stops)).toBe(delayed ? 1 : 2)
        expect(errors).toEqual([])
      } finally {
        await app.close()
        await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 })
      }
    },
  )
}
