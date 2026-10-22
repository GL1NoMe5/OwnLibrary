import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { join, resolve, relative } from 'node:path'
import { tmpdir } from 'node:os'

test('interface themes preserve artwork, respect reduced motion and survive restart', async ({}, testInfo) => {
  const directory = await mkdtemp(join(tmpdir(), 'sanctuary-themes-'))
  let app: ElectronApplication | undefined
  const launch = () =>
    electron.launch({
      args: [resolve('out/main/index.js')],
      env: { ...process.env, SANCTUARY_DATA_DIR: directory, ELECTRON_RENDERER_URL: '' },
    })
  try {
    app = await launch()
    let page = await app.firstWindow()
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width: 1440, height: 960 })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    const root = () => page.locator('html')
    const settings = () =>
      page.getByRole('button', { name: 'Настроение и настройки', exact: true }).click()
    const close = () => page.getByRole('button', { name: 'Закрыть', exact: true }).click()
    const screenshot = (name: string) =>
      page.screenshot({ path: testInfo.outputPath(name + '.png'), animations: 'disabled' })
    await expect(root()).toHaveAttribute('data-theme', 'light')
    expect(
      await page
        .locator('main')
        .evaluate((el) => parseFloat(getComputedStyle(el).animationDuration)),
    ).toBeGreaterThan(0)
    const covers = await page
      .locator('.book-cover')
      .evaluateAll((elements) => elements.map((el) => getComputedStyle(el).backgroundColor))
    const original = await page.evaluate(async () => {
      const book = (await window.sanctuaryAPI.listBooks()).find(
        (b) => b.title === 'Гордость и предубеждение',
      )!
      return (await window.sanctuaryAPI.getSpreads(book.id))[0]
    })
    for (const theme of [
      { id: 'dark', label: 'Тёмная' },
      { id: 'christmas', label: 'Рождественская' },
    ]) {
      await settings()
      await page.getByText(theme.label, { exact: true }).click()
      await expect(page.getByRole('radio', { name: new RegExp('^' + theme.label) })).toBeChecked()
      await expect(root()).toHaveAttribute('data-theme', theme.id)
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      await screenshot(theme.id + '-settings')
      await close()
      await screenshot(theme.id + '-library')
      expect(
        await page
          .locator('.book-cover')
          .evaluateAll((elements) => elements.map((el) => getComputedStyle(el).backgroundColor)),
      ).toEqual(covers)
      const contrast = await page.evaluate(() => {
        const styles = getComputedStyle(document.documentElement)
        const rgb = (value: string) => {
          const probe = document.createElement('span')
          probe.style.color = value
          document.body.append(probe)
          const numbers = getComputedStyle(probe)
            .color.match(/[\d.]+/g)!
            .slice(0, 3)
            .map(Number)
          probe.remove()
          const channel = numbers.map((n) =>
            n / 255 <= 0.04045 ? n / 255 / 12.92 : ((n / 255 + 0.055) / 1.055) ** 2.4,
          )
          return channel[0] * 0.2126 + channel[1] * 0.7152 + channel[2] * 0.0722
        }
        const panel = rgb(styles.getPropertyValue('--ui-panel'))
        return ['--ui-text', '--ui-muted'].map((token) => {
          const text = rgb(styles.getPropertyValue(token))
          return (Math.max(text, panel) + 0.05) / (Math.min(text, panel) + 0.05)
        })
      })
      expect(contrast.every((value) => value >= 4.5)).toBe(true)
      await page.getByRole('button', { name: 'Добавить книгу', exact: true }).click()
      await screenshot(theme.id + '-book-form')
      await close()
      for (const view of [
        { label: 'Цитаты и заметки', id: 'quotes' },
        { label: 'Мой прогресс', id: 'progress' },
        { label: 'Итоги чтения', id: 'story' },
      ]) {
        await page.getByRole('button', { name: view.label, exact: true }).click()
        await expect(page.locator('main')).toHaveAttribute('data-view', view.id)
        if (view.id === 'story') {
          await expect(page.locator('.story-preview img')).toBeVisible()
          await page
            .locator('.story-preview img')
            .evaluate((img) => (img as HTMLImageElement).decode())
        }
        await screenshot(theme.id + '-' + view.id)
      }
      await page.getByRole('button', { name: 'Моя библиотека', exact: true }).click()
      await page
        .getByRole('button', { name: 'Открыть дневник: Гордость и предубеждение', exact: true })
        .click()
      await page
        .locator('.scrap-polaroid img')
        .evaluate((img) => (img as HTMLImageElement).decode())
      await screenshot(theme.id + '-journal')
      await expect(page.locator('.journal-photo-paper')).toHaveCSS(
        'background-color',
        'rgb(255, 253, 246)',
      )
      await page.locator('.scrap-polaroid').click()
      await page.getByRole('button', { name: 'Кадрировать', exact: true }).click()
      await expect(page.getByLabel('Масштаб фотографии')).toBeEnabled()
      await screenshot(theme.id + '-crop')
      await page.getByRole('button', { name: 'Закрыть кадрирование', exact: true }).click()
      await page.getByRole('button', { name: 'Закрыть дневник', exact: true }).click()
    }
    await settings()
    const reduce = page.getByRole('switch', { name: /Уменьшить анимацию/ })
    await reduce.check()
    await expect(root()).toHaveAttribute('data-reduced-motion', 'true')
    expect(
      await page
        .locator('.modal')
        .evaluate((el) => parseFloat(getComputedStyle(el).animationDuration)),
    ).toBeLessThanOrEqual(0.001)
    await reduce.uncheck()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    expect(
      await page
        .locator('.modal')
        .evaluate((el) => parseFloat(getComputedStyle(el).animationDuration)),
    ).toBeLessThanOrEqual(0.001)
    await close()
    const closed = app.waitForEvent('close')
    await page.getByRole('button', { name: 'Закрыть приложение', exact: true }).click()
    await closed
    app = await launch()
    page = await app.firstWindow()
    page.on('pageerror', (error) => errors.push(error.message))
    await expect(root()).toHaveAttribute('data-theme', 'christmas')
    await expect(page.getByRole('heading', { name: 'Моя библиотека', exact: true })).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('sanctuary-interface-theme'))).toBe(
      'christmas',
    )
    const restored = await page.evaluate(
      async (id) => (await window.sanctuaryAPI.getSpreads(id))[0],
      original.bookId,
    )
    expect(restored).toEqual(original)
    expect(errors).toEqual([])
  } finally {
    await app?.close()
    if (!relative(tmpdir(), directory).startsWith('..') && directory !== resolve(tmpdir()))
      await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 })
  }
})
