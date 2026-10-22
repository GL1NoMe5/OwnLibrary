import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { join, resolve, relative } from 'node:path'
import { tmpdir } from 'node:os'

test('journal collage crop, cancel, undo, local PNG and restart', async ({}, testInfo) => {
  const directory = await mkdtemp(join(tmpdir(), 'sanctuary-collage-'))
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
    const open = () =>
      page
        .getByRole('button', { name: 'Открыть дневник: Гордость и предубеждение', exact: true })
        .click()
    await open()
    await page.locator('.scrap-polaroid').click()
    await expect(page.getByLabel('Рамка изображения')).toHaveValue('polaroid')
    await expect(
      page.locator('.polaroid-caption, [aria-label="Подпись к фотографии"]'),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Новый разворот', exact: true }).click()
    await expect(page.locator('.scrap-object')).toHaveCount(0)
    await page.getByRole('button', { name: 'Декор', exact: true }).click()
    await page.getByRole('button', { name: 'Бумага', exact: true }).click()
    await page
      .getByRole('button', { name: 'Добавить бумагу: Крафтовая бумага', exact: true })
      .click()
    await expect(page.locator('.scrap-paper')).toHaveCount(1)
    await page.getByLabel('Фактура бумаги').selectOption('print')
    await page.getByRole('button', { name: 'Изображение', exact: true }).click()
    await page
      .getByRole('button')
      .filter({ has: page.getByAltText('forest', { exact: true }) })
      .click()
    await page.getByLabel('Форма изображения').selectOption('circle')
    await page.getByLabel('Рамка изображения').selectOption('paper')
    await expect(page.locator('.journal-photo-paper')).toHaveCSS(
      'background-color',
      'rgb(255, 255, 255)',
    )
    await page.getByRole('button', { name: 'Кадрировать', exact: true }).click()
    const crop = page.getByRole('dialog', { name: 'Найти красивый кадр', exact: true })
    const zoom = page.getByLabel('Масштаб фотографии', { exact: true })
    await expect(zoom).toBeEnabled()
    await zoom.focus()
    await zoom.press('End')
    await expect(zoom).toHaveValue('4')
    const preview = page.locator('.journal-crop-preview')
    const bounds = (await preview.boundingBox())!
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    await page.mouse.down()
    await page.mouse.move(bounds.x + bounds.width / 2 + 45, bounds.y + bounds.height / 2 - 20, {
      steps: 8,
    })
    await page.mouse.up()
    await page.screenshot({ path: testInfo.outputPath('journal-crop.png') })
    await crop.getByRole('button', { name: 'Готово', exact: true }).click()
    await expect(crop).toHaveCount(0)
    const read = () =>
      page.evaluate(async () => {
        const book = (await window.sanctuaryAPI.listBooks()).find(
          (b) => b.title === 'Гордость и предубеждение',
        )!
        return (await window.sanctuaryAPI.getSpreads(book.id))[1]
      })
    await expect(page.getByText('Сохранено в дневник', { exact: true })).toBeVisible()
    const saved = (await read()).items.find((i) => i.type === 'polaroid')!
    expect(saved.imageCrop?.zoom).toBe(4)
    expect(saved.imageCrop?.x).toBeLessThan(0.5)
    await page.getByRole('button', { name: 'Отменить', exact: true }).click()
    await expect(page.getByText('Сохранено в дневник', { exact: true })).toBeVisible()
    expect((await read()).items.find((i) => i.type === 'polaroid')!.imageCrop).toBeUndefined()
    await page.getByRole('button', { name: 'Повторить', exact: true }).click()
    await page.getByRole('button', { name: 'Кадрировать', exact: true }).click()
    await expect(zoom).toHaveValue('4')
    await zoom.focus()
    await zoom.press('Home')
    await zoom.press('Escape')
    await expect(crop).toHaveCount(0)
    await expect(page.getByText('Сохранено в дневник', { exact: true })).toBeVisible()
    expect((await read()).items.find((i) => i.type === 'polaroid')!.imageCrop).toEqual(
      saved.imageCrop,
    )
    await page.getByRole('button', { name: 'Копия', exact: true }).click()
    await expect(page.locator('.scrap-polaroid')).toHaveCount(2)
    await page.getByLabel('Форма изображения').selectOption('torn')
    await page.getByLabel('Рамка изображения').selectOption('none')
    await page.getByRole('button', { name: 'Декор', exact: true }).click()
    await page.getByRole('button', { name: 'Добавить: Папоротник', exact: true }).click()
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] })
    }, resolve('resources/icon.png'))
    await page.getByRole('button', { name: 'Декор', exact: true }).click()
    await page.getByRole('button', { name: 'Своя наклейка', exact: true }).click()
    await expect(page.locator('.scrap-decal')).toHaveCount(2)
    await expect(page.locator('.journal-decal-image').last()).toHaveAttribute(
      'src',
      /^sanctuary-media:/,
    )
    await expect(page.getByText('Сохранено в дневник', { exact: true })).toBeVisible()
    const beforeRestart = await read()
    const closed = app.waitForEvent('close')
    await page.getByRole('button', { name: 'В библиотеку', exact: true }).click()
    await page.getByRole('button', { name: 'Закрыть приложение', exact: true }).click()
    await closed
    app = await launch()
    page = await app.firstWindow()
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width: 1440, height: 960 })
    await open()
    await expect(page.locator('.scrap-object')).toHaveCount(5)
    expect((await read()).items).toEqual(beforeRestart.items)
    await page
      .locator('.journal-decal-image')
      .last()
      .evaluate((image) => (image as HTMLImageElement).decode())
    await page.screenshot({ path: testInfo.outputPath('journal-collage.png') })
    expect(errors).toEqual([])
  } finally {
    await app?.close()
    if (!relative(tmpdir(), directory).startsWith('..') && directory !== resolve(tmpdir())) {
      await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 })
    }
  }
})
