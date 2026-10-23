import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join, resolve, relative } from 'node:path'
import { tmpdir } from 'node:os'

test('fireplace photos keep portrait and landscape proportions and survive moving the original', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sanctuary-picture-'))
  const screenshots = resolve('.local/room-picture')
  const errors: string[] = []
  let app: ElectronApplication | undefined
  const launch = () =>
    electron.launch({
      args: [resolve('out/main/index.js')],
      env: { ...process.env, SANCTUARY_DATA_DIR: directory, ELECTRON_RENDERER_URL: '' },
    })
  try {
    await mkdir(screenshots, { recursive: true })
    app = await launch()
    let page = await app.firstWindow()
    const prepareWindow = async () => {
      page.on('pageerror', (error) => errors.push(error.message))
      await page.setViewportSize({ width: 1440, height: 960 })
      await expect(page.getByRole('heading', { name: 'Моя библиотека', exact: true })).toBeVisible()
    }
    const settings = () =>
      page.getByRole('button', { name: 'Настроение и настройки', exact: true }).click()
    const closeSettings = () => page.getByRole('button', { name: 'Закрыть', exact: true }).click()
    const pictureControls = () =>
      page.getByRole('group', { name: 'Картина над камином', exact: true })
    const stage = () => page.getByTestId('room-canvas')
    const savedPicture = () =>
      page.evaluate(async () => (await window.sanctuaryAPI.bootstrap()).settings.room.pictureUrl)
    const enterRoom = async () => {
      await page.getByRole('button', { name: 'Моя комната', exact: true }).click()
      await expect(stage()).toHaveAttribute('data-status', 'ready', { timeout: 60000 })
      await expect(stage()).toHaveAttribute('data-camera-settled', 'true')
    }
    const checkAspect = async (aspect: number) => {
      await expect(stage()).toHaveAttribute('data-picture', 'custom')
      await expect
        .poll(async () => Number(await stage().getAttribute('data-picture-aspect')))
        .toBeCloseTo(aspect, 3)
    }
    const choosePhoto = async (file: string, replace: boolean) => {
      await settings()
      await app!.evaluate(({ dialog }, path) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] })
      }, file)
      await pictureControls()
        .getByRole('button', { name: replace ? 'Заменить фото' : 'Выбрать фото', exact: true })
        .click()
      await expect(pictureControls().getByRole('button', { name: 'Вернуть картину' })).toBeEnabled()
      await expect(pictureControls().getByRole('img')).toHaveAttribute('src', /^sanctuary-media:/)
      const url = await savedPicture()
      expect(url).toMatch(/^sanctuary-media:/)
      await closeSettings()
      return url
    }
    await prepareWindow()
    const photos: Record<string, string> = {}
    for (const [name, width, height] of [
      ['portrait', 600, 900],
      ['landscape', 1600, 900],
    ] as const) {
      const data = await page.evaluate(
        ({ width, height }) => {
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')!
          const sky = ctx.createLinearGradient(0, 0, 0, height)
          sky.addColorStop(0, '#4d6680')
          sky.addColorStop(0.7, '#f2c7a0')
          sky.addColorStop(1, '#d7b7ab')
          ctx.fillStyle = sky
          ctx.fillRect(0, 0, width, height)
          ctx.fillStyle = '#fff1c7'
          ctx.beginPath()
          ctx.arc(width * 0.65, height * 0.35, height * 0.1, 0, Math.PI * 2)
          ctx.fill()
          for (let layer = 0; layer < 3; layer++) {
            ctx.fillStyle = ['#8a9491', '#58736f', '#314e49'][layer]
            ctx.beginPath()
            ctx.moveTo(0, height)
            for (let i = 0; i <= 8; i++)
              ctx.lineTo(
                (i / 8) * width,
                height * (0.58 + layer * 0.1 + Math.sin(i * 2 + layer) * 0.08),
              )
            ctx.lineTo(width, height)
            ctx.fill()
          }
          // The complete border should remain visible in either orientation.
          ctx.strokeStyle = '#f6eee1'
          ctx.lineWidth = 12
          ctx.strokeRect(12, 12, width - 24, height - 24)
          return canvas.toDataURL('image/png').split(',')[1]
        },
        { width, height },
      )
      photos[name] = join(directory, name + '.png')
      await writeFile(photos[name], Buffer.from(data, 'base64'))
    }
    await enterRoom()
    await expect(stage()).toHaveAttribute('data-picture', 'original')
    const portraitUrl = await choosePhoto(photos.portrait, false)
    await checkAspect(2 / 3)
    await page.mouse.move(10, 10)
    await page.screenshot({ path: join(screenshots, 'portrait.png') })
    await rm(photos.portrait)
    const closed = app.waitForEvent('close')
    await page.getByRole('button', { name: 'Закрыть приложение', exact: true }).click()
    await closed
    app = await launch()
    page = await app.firstWindow()
    await prepareWindow()
    expect(await savedPicture()).toBe(portraitUrl)
    await enterRoom()
    await checkAspect(2 / 3)
    const landscapeUrl = await choosePhoto(photos.landscape, true)
    expect(landscapeUrl).not.toBe(portraitUrl)
    await checkAspect(16 / 9)
    await page.mouse.move(10, 10)
    await page.screenshot({ path: join(screenshots, 'landscape.png') })
    await settings()
    await pictureControls().getByRole('button', { name: 'Вернуть картину', exact: true }).click()
    await expect(
      pictureControls().getByRole('button', { name: 'Выбрать фото', exact: true }),
    ).toBeEnabled()
    expect(await savedPicture()).toBeNull()
    await closeSettings()
    await expect(stage()).toHaveAttribute('data-picture', 'original')
    await expect(stage()).not.toHaveAttribute('data-picture-aspect')
    expect(errors).toEqual([])
  } finally {
    await app?.close()
    const relativeDirectory = relative(resolve(tmpdir()), resolve(directory))
    if (
      relativeDirectory &&
      !relativeDirectory.startsWith('..') &&
      !relativeDirectory.includes(':')
    )
      await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 })
  }
})
