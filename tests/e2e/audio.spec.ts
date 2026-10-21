import { test, expect, _electron as electron, type Page } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { PerspectiveCamera, Vector3, MathUtils } from 'three'
import manifest from '../../src/renderer/src/scene/manifest.json'

declare global {
  interface Window {
    audioProbe: {
      sources: AudioBufferSourceNode[]
      gains: GainNode[]
      starts: number
      stops: number
      decoded: number
      requests: number
      offsets: number[]
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
      offsets: [] as number[],
      release,
    })
    const fetchOriginal = window.fetch.bind(window)
    window.fetch = async (...args) => {
      if (/\.(mp3|ogg|wav)(\?|$)/.test(String(args[0]))) {
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
        probe.offsets.push(args[1] ?? 0)
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
      : 'offline rain and physical radio: seamless loops, silent pause and resume at saved offset',
    async () => {
      test.skip(
        !existsSync("dist/win-unpacked/Cozy Reader's Sanctuary.exe"),
        'Run the Windows build before testing packaged audio',
      )
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
          await page.getByRole('switch', { name: /Гирлянды/ }).check()
          await page.getByLabel('Качество графики комнаты', { exact: true }).selectOption('HIGH')
          await page.getByRole('button', { name: 'Закрыть', exact: true }).click()
          await page.getByRole('button', { name: 'Моя комната', exact: true }).click()
          const stage = page.getByTestId('room-canvas')
          await expect(stage).toHaveAttribute('data-status', 'ready', { timeout: 30000 })
          await expect(stage).toHaveAttribute('data-camera-settled', 'true')
          await expect.poll(() => page.evaluate(() => window.audioProbe.starts)).toBe(3)
          await expect(stage).toHaveAttribute('data-radio-playing', 'true')
          const canvas = page.locator('.room-canvas canvas')
          const box = (await canvas.boundingBox())!
          const definition = manifest.cameras.OVERVIEW
          const camera = new PerspectiveCamera(45, box.width / box.height, 0.05, 25)
          camera.fov = MathUtils.radToDeg(
            2 *
              Math.atan(
                Math.tan(MathUtils.degToRad(definition.fovDegrees / 2)) *
                  Math.max(1, 16 / 9 / camera.aspect),
              ),
          )
          camera.position.fromArray(definition.position)
          camera.lookAt(new Vector3().fromArray(definition.target))
          camera.updateProjectionMatrix()
          camera.updateMatrixWorld(true)
          const radio = new Vector3(0.95, 0.56, -0.025).project(camera)
          const clickRadio = () =>
            page.mouse.click(
              box.x + ((radio.x + 1) * box.width) / 2,
              box.y + ((1 - radio.y) * box.height) / 2,
            )
          await page.screenshot({ path: 'test-results/radio-room.png' })
          await clickRadio()
          await expect(stage).toHaveAttribute('data-radio-playing', 'false')
          await expect.poll(() => page.evaluate(() => window.audioProbe.stops)).toBe(1)
          const position = await page.evaluate(() => {
            const source = window.audioProbe.sources[2]
            return { duration: source.buffer!.duration, time: source.context.currentTime }
          })
          expect(position.duration).toBeCloseTo(53.333, 2)
          await expect(page.locator('.toast')).toHaveCount(0)
          await clickRadio()
          await expect.poll(() => page.evaluate(() => window.audioProbe.starts)).toBe(4)
          const offset = await page.evaluate(() => window.audioProbe.offsets[3])
          expect(offset).toBeGreaterThan(0.1)
          expect(offset).toBeLessThan(position.time + 0.1)
          const musicLoop = await page.evaluate(async () => {
            const buffer = window.audioProbe.sources[3].buffer!
            const offline = new OfflineAudioContext(1, buffer.length + 4096, buffer.sampleRate)
            const source = offline.createBufferSource()
            source.buffer = buffer
            source.loop = true
            source.connect(offline.destination)
            source.start()
            const samples = (await offline.startRendering()).getChannelData(0)
            let energy = 0
            for (let i = buffer.length - 2048; i < buffer.length + 2048; i++)
              energy += samples[i] ** 2
            return {
              seam: Math.abs(samples[buffer.length] - samples[buffer.length - 1]),
              rms: Math.sqrt(energy / 4096),
            }
          })
          expect(musicLoop.seam).toBeLessThan(0.04)
          expect(musicLoop.rms).toBeGreaterThan(0.001)
          await expect(page.locator('.toast')).toHaveCount(0)
        }
        await page.getByRole('button', { name: 'Выключить звук', exact: true }).click()
        await expect.poll(() => page.evaluate(() => window.audioProbe.stops)).toBe(delayed ? 1 : 4)
        expect(errors).toEqual([])
      } finally {
        await app.close()
        await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 })
      }
    },
  )
}
