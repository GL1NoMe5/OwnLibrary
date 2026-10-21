import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { PerspectiveCamera, Vector3, MathUtils } from 'three'
import { roomPlacements } from '../../src/renderer/src/scene/layout'
import manifest from '../../src/renderer/src/scene/manifest.json'
import { inflateSync } from 'node:zlib'

test('offline Blender room: real shelves, raycast journal, settings, pages and disposal', async ({}, testInfo) => {
  const directory = await mkdtemp(join(tmpdir(), 'sanctuary-room-'))
  const app = await electron.launch({
    args: [resolve('out/main/index.js')],
    env: { ...process.env, SANCTUARY_DATA_DIR: directory, ELECTRON_RENDERER_URL: '' },
  })
  try {
    const page = await app.firstWindow()
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    await page.context().setOffline(true)
    await page.getByRole('button', { name: 'Моя комната', exact: true }).click()
    const stage = page.getByTestId('room-canvas')
    await expect(stage).toHaveAttribute('data-status', 'ready', { timeout: 30000 })
    await expect(stage).toHaveAttribute('data-book-count', '8')
    await expect(stage).toHaveAttribute('data-look', 'winter-night')
    await expect(page.locator('.room-canvas canvas')).toHaveCount(1)
    await expect
      .poll(async () => Number(await stage.getAttribute('data-draw-calls')))
      .toBeGreaterThan(0)
    await page.screenshot({ path: testInfo.outputPath('room-overview.png') })
    expect(errors).toEqual([])
    await page.getByRole('button', { name: 'Настроение и настройки', exact: true }).click()
    await page.getByLabel('Качество графики комнаты', { exact: true }).selectOption('HIGH')
    await expect(stage).toHaveAttribute('data-render-quality', 'HIGH')
    await page.getByRole('button', { name: 'Закрыть', exact: true }).click()
    for (const label of ['Левый шкаф', 'Правый шкаф']) {
      await page.getByRole('button', { name: label, exact: true }).click()
      await expect(stage).toHaveAttribute('data-camera-settled', 'true')
      // A cleared WebGL surface still reports draw calls and correct camera data.
      // Check actual screenshot pixel variation in the centre, away from UI.
      await page.screenshot({ path: testInfo.outputPath(`${label}-high.png`) })
      const rectangle = (await stage.boundingBox())!
      const png = await page.screenshot({
        clip: {
          x: rectangle.x + rectangle.width / 2 - 80,
          y: rectangle.y + rectangle.height / 2 - 80,
          width: 160,
          height: 160,
        },
      })
      const chunks: Buffer[] = []
      for (let offset = 8; offset < png.length;) {
        const length = png.readUInt32BE(offset)
        if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT')
          chunks.push(png.subarray(offset + 8, offset + 8 + length))
        offset += length + 12
      }
      expect(new Set(inflateSync(Buffer.concat(chunks))).size).toBeGreaterThan(8)
    }
    await page.getByRole('button', { name: 'Общий вид', exact: true }).click()
    await expect(stage).toHaveAttribute('data-camera-settled', 'true')
    await page.getByRole('button', { name: 'Настроение и настройки', exact: true }).click()
    await page.getByLabel('Качество графики комнаты', { exact: true }).selectOption('LOW')
    await page.getByRole('switch', { name: /Уменьшить анимацию/ }).check()
    await page.getByRole('switch', { name: /Гирлянды/ }).uncheck()
    await page.getByRole('button', { name: 'Закрыть', exact: true }).click()
    await expect(stage).toHaveAttribute('data-render-quality', 'LOW')
    await expect(stage).toHaveAttribute('data-motion', 'reduced')
    await expect(stage).toHaveAttribute('data-holiday-lights', 'false')
    await expect
      .poll(async () => Number(await stage.getAttribute('data-draw-calls')))
      .toBeGreaterThan(0)
    expect(Number(await stage.getAttribute('data-draw-calls'))).toBeLessThan(100)
    await page.screenshot({ path: testInfo.outputPath('room-low.png') })

    const books = await page.evaluate(() => window.sanctuaryAPI.listBooks())
    const placement = roomPlacements(books, 0).find((p) => p.book.cabinet === 0)!
    await page.getByRole('button', { name: 'Левый шкаф', exact: true }).click()
    const box = (await stage.boundingBox())!
    const camera = new PerspectiveCamera(48, box.width / box.height, 0.05, 25)
    camera.fov = MathUtils.radToDeg(
      2 * Math.atan(Math.tan(MathUtils.degToRad(24)) * Math.max(1, 16 / 9 / camera.aspect)),
    )
    camera.position.fromArray(manifest.cameras.SHELF_0.position)
    camera.lookAt(new Vector3().fromArray(manifest.cameras.SHELF_0.target))
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
    const point = new Vector3(...placement.position)
      .add(new Vector3(0, 0, placement.depth / 2))
      .project(camera)
    await page.mouse.click(
      box.x + ((point.x + 1) / 2) * box.width,
      box.y + ((1 - point.y) / 2) * box.height,
    )
    await expect(
      page.getByRole('dialog', { name: `Дневник: ${placement.book.title}`, exact: true }),
    ).toBeVisible()
    await expect(stage).toHaveAttribute('data-paused', 'true')
    await page.getByRole('button', { name: 'В комнату', exact: true }).click()
    await expect(stage).toHaveAttribute('data-paused', 'false')
    await page.screenshot({ path: testInfo.outputPath('room-shelf.png') })

    await page.getByRole('button', { name: 'Список книг', exact: true }).click()
    await expect(page.locator('.room-canvas canvas')).toHaveCount(0)
    await page
      .locator('.book-card')
      .filter({ hasText: placement.book.title })
      .getByRole('button', { name: 'Найти на полке' })
      .click()
    await expect(stage).toHaveAttribute('data-status', 'ready')
    await expect(stage).toHaveAttribute('data-camera', 'SHELF_0')
    await expect(
      page.getByRole('article', { name: `Выбрана книга: ${placement.book.title}` }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Открыть дневник', exact: true }).click()
    await expect(
      page.getByRole('dialog', { name: `Дневник: ${placement.book.title}`, exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'В комнату', exact: true }).click()

    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] })
    }, resolve('resources/icon.png'))
    await page.evaluate(async () => {
      const [base] = await window.sanctuaryAPI.listBooks()
      const coverUrl = await window.sanctuaryAPI.importImage()
      await window.sanctuaryAPI.createBook({ ...base, title: 'Книга с обложкой', coverUrl })
      for (let i = 0; i < 48; i++)
        await window.sanctuaryAPI.createBook({ ...base, title: `Толстая книга ${i}`, pages: 2000 })
    })
    await page.reload()
    await page.getByRole('button', { name: 'Моя комната', exact: true }).click()
    await expect(stage).toHaveAttribute('data-status', 'ready')
    await page.getByRole('button', { name: 'Следующая страница шкафов', exact: true }).click()
    await expect(stage).not.toHaveAttribute('data-book-count', '0')
    await expect(page.getByRole('button', { name: 'Предыдущая страница шкафов' })).toBeEnabled()
    await page.getByRole('button', { name: 'Предыдущая страница шкафов' }).click()
    await expect(stage).toHaveAttribute('data-quality', 'LOW')
    await expect
      .poll(async () => Number(await stage.getAttribute('data-book-count')))
      .toBeGreaterThan(8)
    expect(Number(await stage.getAttribute('data-draw-calls'))).toBeLessThan(100)
    expect(errors).toEqual([])
    const forbidden = await page.evaluate(
      async () => (await fetch('sanctuary-scene://assets/not-an-asset.glb')).status,
    )
    expect(forbidden).toBe(404)
    await page.locator('.room-canvas canvas').dispatchEvent('webglcontextlost')
    await expect(page.getByRole('heading', { name: 'Продолжим в библиотеке' })).toBeVisible()
    await page.getByRole('button', { name: 'Открыть список книг', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Моя библиотека', exact: true })).toBeVisible()
  } finally {
    await app.close()
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 })
  }
})
