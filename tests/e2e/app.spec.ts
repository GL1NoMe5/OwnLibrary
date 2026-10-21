import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test'
import { mkdtemp, rm, readFile, copyFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
test('offline library, journal autosave, restart, image import, PNG and backup', async ({}, testInfo) => {
  const directory = await mkdtemp(join(tmpdir(), 'тихая глава '))
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
    await page.context().setOffline(true)
    await expect(page.getByRole('heading', { name: 'Моя библиотека', exact: true })).toBeVisible()
    await expect(page.locator('.book-card')).toHaveCount(8)
    await page.getByRole('button', { name: 'Свернуть меню', exact: true }).click()
    await expect(page.locator('.sidebar')).toHaveClass(/collapsed/)
    await page.getByRole('button', { name: 'Развернуть меню', exact: true }).click()
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    await page.screenshot({
      path:
        process.env.UPDATE_SCREENSHOTS === '1'
          ? 'docs/screenshots/library.png'
          : testInfo.outputPath('library.png'),
      fullPage: true,
    })
    await page.getByRole('button', { name: 'Добавить книгу', exact: true }).click()
    await page.getByPlaceholder('Название книги', { exact: true }).fill('Моя тестовая книга')
    await page.getByPlaceholder('Имя автора').fill('Тестовый читатель')
    const importedImage = join(directory, 'моя обложка.png')
    await copyFile(resolve('resources/icon.png'), importedImage)
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] })
    }, importedImage)
    await page.getByRole('button', { name: 'Своя обложка', exact: true }).click()
    await expect(page.locator('.book-form-cover img')).toHaveAttribute('src', /^sanctuary-media:/)
    await rm(importedImage)
    await page.getByRole('button', { name: 'Сохранить книгу', exact: true }).click()
    await expect(page.locator('.book-card')).toHaveCount(9)
    await page
      .getByRole('button', { name: 'Открыть дневник: Моя тестовая книга', exact: true })
      .click()
    await expect(page.getByRole('dialog', { name: 'Дневник: Моя тестовая книга' })).toBeVisible()
    await page.getByRole('button', { name: 'Заметка', exact: true }).click()
    await page
      .getByRole('textbox', { name: 'Текст заметки' })
      .fill('Эта запись должна пережить перезапуск.')
    await page.getByRole('textbox', { name: 'Текст заметки' }).blur()
    await page.getByLabel('Стиль бумаги', { exact: true }).selectOption('VINTAGE_KRAFT')
    await page.getByRole('button', { name: 'Карандаш', exact: true }).click()
    const canvas = page.getByLabel('Рисунок на левой странице')
    const box = (await canvas.boundingBox())!
    await page.mouse.move(box.x + 70, box.y + 220)
    await page.mouse.down()
    await page.mouse.move(box.x + 150, box.y + 250, { steps: 15 })
    await page.mouse.move(box.x + 200, box.y + 210, { steps: 15 })
    await page.mouse.up()
    await expect(page.getByText('Сохранено в дневник', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Выбор', exact: true }).click()
    await page.locator('.scrap-note').click()
    await page
      .getByRole('textbox', { name: 'Текст заметки' })
      .fill('Закрываем сразу после правки — запись сохранится.')
    const closed = app.waitForEvent('close')
    await page.getByRole('button', { name: 'Закрыть приложение', exact: true }).click()
    await closed
    app = await launch()
    page = await app.firstWindow()
    page.on('pageerror', (error) => errors.push(error.message))
    await page
      .getByRole('button', { name: 'Открыть дневник: Моя тестовая книга', exact: true })
      .click()
    await expect(
      page.getByText('Закрываем сразу после правки — запись сохранится.', { exact: true }),
    ).toBeVisible()
    await expect(page.getByLabel('Стиль бумаги', { exact: true })).toHaveValue('VINTAGE_KRAFT')
    const strokeCount = await page.evaluate(async () => {
      const book = (await window.sanctuaryAPI.listBooks()).find(
        (b) => b.title === 'Моя тестовая книга',
      )!
      return (await window.sanctuaryAPI.getSpreads(book.id))[0].leftStrokes.length
    })
    expect(strokeCount).toBe(1)
    await page.getByRole('button', { name: 'В библиотеку', exact: true }).click()
    await page
      .getByRole('button', { name: 'Открыть дневник: Гордость и предубеждение', exact: true })
      .click()
    await page
      .locator('.scrap-polaroid img')
      .evaluate((image) => (image as HTMLImageElement).decode())
    await expect(page.locator('.scrap-polaroid img')).toBeVisible()
    await page.screenshot({
      path:
        process.env.UPDATE_SCREENSHOTS === '1'
          ? 'docs/screenshots/journal.png'
          : testInfo.outputPath('journal.png'),
      fullPage: true,
    })
    await page.getByRole('button', { name: 'В библиотеку', exact: true }).click()
    const png = join(directory, 'мой итог.png')
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file })
    }, png)
    await page.getByRole('button', { name: 'Итоги чтения', exact: true }).click()
    await page.getByRole('button', { name: 'Скачать карточку PNG', exact: true }).click()
    await expect(page.getByText('Ваша история сохранена в PNG', { exact: true })).toBeVisible()
    const buffer = await readFile(png)
    expect(buffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(buffer.readUInt32BE(16)).toBe(1080)
    expect(buffer.readUInt32BE(20)).toBe(1920)
    await page.screenshot({
      path:
        process.env.UPDATE_SCREENSHOTS === '1'
          ? 'docs/screenshots/story.png'
          : testInfo.outputPath('story.png'),
      fullPage: true,
    })
    const backup = join(directory, 'библиотека.zip')
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file })
    }, backup)
    await page.getByRole('button', { name: 'Настроение и настройки', exact: true }).click()
    await page.getByRole('button', { name: 'Сохранить архив', exact: true }).click()
    await expect(page.getByText('Резервная копия сохранена', { exact: true })).toBeVisible()
    expect((await readFile(backup)).length).toBeGreaterThan(1000)
    await page.getByRole('button', { name: 'Закрыть', exact: true }).click()
    await page.evaluate(async () => {
      const [book] = await window.sanctuaryAPI.listBooks()
      await window.sanctuaryAPI.createBook({ ...book, title: 'После резервной копии' })
    })
    await page.reload()
    await expect(page.locator('.book-card')).toHaveCount(10)
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] })
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false })
    }, backup)
    await page.getByRole('button', { name: 'Настроение и настройки', exact: true }).click()
    await page.getByRole('button', { name: 'Восстановить', exact: true }).click()
    await expect(page.getByText('Библиотека восстановлена', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Закрыть', exact: true }).click()
    await expect(page.locator('.book-card')).toHaveCount(9)
    expect(errors).toEqual([])
  } finally {
    await app?.close()
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 })
  }
})
