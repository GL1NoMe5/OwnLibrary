import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { PerspectiveCamera, Vector3 } from 'three'
import { unreadPlacements } from '../../src/renderer/src/scene/layout'
test('owned books appear in a clickable stack and keep their journal when completed', async ({}, info) => {
  const dir = await mkdtemp(join(tmpdir(), 'sanctuary-stack-'))
  const app = await electron.launch({
    args: [resolve('out/main/index.js')],
    env: { ...process.env, SANCTUARY_DATA_DIR: dir, ELECTRON_RENDERER_URL: '' },
  })
  try {
    const page = await app.firstWindow()
    await page.setViewportSize({ width: 1440, height: 960 })
    await expect(page.getByRole('heading', { name: 'Моя библиотека', exact: true })).toBeVisible()
    const books = await page.evaluate(async () => {
      const base = (await window.sanctuaryAPI.listBooks())[0]
      for (let i = 0; i < 5; i++)
        await window.sanctuaryAPI.createBook({
          ...base,
          title: `Ждёт чтения ${i}`,
          status: 'OWNED',
          finishedAt: null,
        })
      return window.sanctuaryAPI.listBooks()
    })
    await page.reload()
    await page.getByRole('button', { name: /^Ждут чтения/ }).click()
    await expect(page.locator('.book-card')).toHaveCount(5)
    await page.getByRole('button', { name: 'Найти в стопке' }).first().click()
    const stage = page.getByTestId('room-canvas')
    await expect(stage).toHaveAttribute('data-status', 'ready', { timeout: 30000 })
    await expect(stage).toHaveAttribute('data-camera', 'STACK')
    await expect(stage).toHaveAttribute('data-camera-settled', 'true')
    await page.mouse.move(10, 10)
    await page.screenshot({ path: info.outputPath('unread-stack.png') })
    const p = unreadPlacements(books, 0).at(-1)!
    const box = (await stage.boundingBox())!
    const camera = new PerspectiveCamera(42, box.width / box.height, 0.05, 25)
    camera.position.set(0.55, 1.05, 1.05)
    camera.lookAt(0.55, 0.18, -0.48)
    camera.updateMatrixWorld()
    const hit = new Vector3(...p.position).project(camera)
    await page.mouse.click(
      box.x + ((hit.x + 1) * box.width) / 2,
      box.y + ((1 - hit.y) * box.height) / 2,
    )
    await expect(
      page.getByRole('dialog', { name: `Дневник: ${p.book.title}`, exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Заметка', exact: true }).click()
    await page.getByLabel('Текст заметки').fill('На очереди — эта история.')
    await page.getByRole('button', { name: 'Закрыть дневник', exact: true }).click()
    await page.getByRole('button', { name: 'Моя библиотека', exact: true }).click()
    await page.getByRole('button', { name: /^Ждут чтения/ }).click()
    await page
      .locator('.book-card')
      .filter({ hasText: p.book.title })
      .getByRole('button', { name: /Прочитано/ })
      .click()
    await expect(page.locator('.book-card')).toHaveCount(4)
    const result = await page.evaluate(
      async (id) => ({
        book: (await window.sanctuaryAPI.listBooks()).find((b) => b.id === id),
        spreads: await window.sanctuaryAPI.getSpreads(id),
      }),
      p.book.id,
    )
    expect(result.book?.status).toBe('READ')
    expect(result.spreads[0].items[0].content).toBe('На очереди — эта история.')
  } finally {
    await app.close()
    await rm(dir, { recursive: true, force: true })
  }
})
