import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

test('capture comprehensive documentation screenshots', async () => {
  test.skip(process.env.UPDATE_SCREENSHOTS !== '1', 'Manual documentation capture only')
  const directory = await mkdtemp(join(tmpdir(), 'sanctuary-screenshots-'))
  let app: ElectronApplication | undefined

  try {
    app = await electron.launch({
      args: [resolve('out/main/index.js')],
      env: { ...process.env, SANCTUARY_DATA_DIR: directory, ELECTRON_RENDERER_URL: '' },
    })

    const page = await app.firstWindow()
    await page.context().setOffline(true)

    // Wait for initial load and fonts
    await expect(page.getByRole('heading', { name: 'Моя библиотека', exact: true })).toBeVisible({
      timeout: 20000,
    })
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    await page.waitForTimeout(500)

    // 1. Add Book Modal screenshot & saving a completed book
    await page.getByRole('button', { name: 'Добавить книгу', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Ещё одна история', exact: true })).toBeVisible()
    await page.getByPlaceholder('Название книги', { exact: true }).fill('Сто лет одиночества')
    await page.getByPlaceholder('Имя автора').fill('Габриэль Гарсиа Маркес')
    await page.getByPlaceholder('Неизвестно').fill('480')
    await page.getByLabel('Ваша оценка').selectOption('5')
    await page
      .getByPlaceholder('Слова, которые остались с вами…')
      .fill(
        'Мир был ещё таким новым, что многие вещи не имели названия, и на них приходилось показывать пальцем.',
      )
    await page.waitForTimeout(400)
    await page.screenshot({ path: 'docs/screenshots/add-book.png' })
    await page.getByRole('button', { name: 'Сохранить книгу', exact: true }).click()
    await expect(page.locator('.book-card')).toHaveCount(9)

    // Wait for the save toast to dismiss so all subsequent screenshots are completely clean
    await expect(page.locator('.toast')).not.toBeVisible({ timeout: 6000 })
    await page.waitForTimeout(300)

    // 2. Library screenshot with active user statistics and added book
    await page.screenshot({ path: 'docs/screenshots/library.png' })

    // 3. 2D Wooden Shelves screenshot
    await page.getByRole('button', { name: 'Книжные полки', exact: true }).click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: 'docs/screenshots/shelf.png' })
    await page.getByRole('button', { name: /Прочитанные/ }).click()
    await page.waitForTimeout(300)

    // 4. Wishlist screenshot
    await page.getByRole('button', { name: 'Хочу прочитать', exact: true }).click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'docs/screenshots/wishlist.png' })

    // 5. Quotes & Notes screenshot (with top-rated books strip and all quote cards clearly visible)
    await page.getByRole('button', { name: 'Цитаты и заметки', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Между строк', exact: true })).toBeVisible()
    await page.waitForTimeout(600)
    await page.screenshot({ path: 'docs/screenshots/quotes.png' })

    // 6. Reading Progress screenshot (showing completed book, pages count, 5-star rating, and monthly rhythm)
    await page.getByRole('button', { name: 'Мой прогресс', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Маленькие шаги, большие миры', exact: true }),
    ).toBeVisible()
    await page.waitForTimeout(600)
    await page.screenshot({ path: 'docs/screenshots/progress.png' })

    // 7. Reading Story screenshot (1080x1920 card generator)
    await page.getByRole('button', { name: 'Итоги чтения', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Ваша история в одной карточке', exact: true }),
    ).toBeVisible()
    await page.waitForTimeout(600)
    await page.screenshot({ path: 'docs/screenshots/story.png' })

    // 8. Settings Modal screenshot (active ambient soundscapes, wood themes, graphics)
    await page.getByRole('button', { name: 'Настроение и настройки', exact: true }).click()
    await expect(
      page.getByRole('dialog', { name: 'Настроение и забота о библиотеке' }),
    ).toBeVisible()
    const soundSwitch = page.getByRole('switch', { name: /Звуки уюта/ })
    if (!(await soundSwitch.isChecked())) {
      await soundSwitch.check()
    }
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'docs/screenshots/settings.png' })
    await page.getByRole('button', { name: 'Закрыть', exact: true }).click()
    await page.waitForTimeout(300)

    // 9. Reader's Journal spread & Scrapbooking collage
    // Pre-populate spread 2 with a handcrafted collage spread showcasing decals, paper textures, and shapes
    await page.evaluate(async () => {
      const books = await window.sanctuaryAPI.listBooks()
      const pride = books.find((b) => b.title === 'Гордость и предубеждение')!
      const spreads = await window.sanctuaryAPI.getSpreads(pride.id)
      let collageSpread = spreads[1]
      if (!collageSpread) {
        collageSpread = await window.sanctuaryAPI.addSpread(pride.id)
      }
      collageSpread.paperStyle = 'VINTAGE_KRAFT'
      collageSpread.items = [
        {
          id: crypto.randomUUID(),
          side: 'left',
          type: 'paper',
          x: 50,
          y: 70,
          width: 340,
          height: 260,
          rotation: -2,
          zIndex: 1,
          content: '',
          caption: '',
          bg: '#d4b58e',
          paperTexture: 'print',
          fontFamily: 'Caveat',
          fontSize: 25,
          tapeStyle: 'botanical',
        },
        {
          id: crypto.randomUUID(),
          side: 'left',
          type: 'note',
          x: 60,
          y: 65,
          width: 320,
          height: 130,
          rotation: -1,
          zIndex: 2,
          content: 'Места, куда хочется\nвернуться',
          caption: '',
          bg: '#fdfbf7',
          fontFamily: 'Cormorant Garamond',
          fontSize: 32,
          textColor: '#4a3b32',
          tapeStyle: 'botanical',
        },
        {
          id: crypto.randomUUID(),
          side: 'left',
          type: 'polaroid',
          x: 65,
          y: 220,
          width: 220,
          height: 260,
          rotation: -3,
          zIndex: 2,
          content: './illustrations/forest.svg',
          caption: '',
          bg: '#f7f4ea',
          imageShape: 'torn',
          imageFrame: 'none',
          fontFamily: 'Caveat',
          fontSize: 25,
          tapeStyle: 'botanical',
        },
        {
          id: crypto.randomUUID(),
          side: 'left',
          type: 'tape',
          x: 85,
          y: 205,
          width: 140,
          height: 35,
          rotation: -5,
          zIndex: 4,
          content: '',
          caption: '',
          bg: '#eee0b8',
          fontFamily: 'Caveat',
          fontSize: 25,
          tapeStyle: 'plaid',
        },
        {
          id: crypto.randomUUID(),
          side: 'left',
          type: 'polaroid',
          x: 220,
          y: 290,
          width: 180,
          height: 180,
          rotation: 3,
          zIndex: 5,
          content: './illustrations/forest.svg',
          caption: '',
          bg: '#ffffff',
          imageShape: 'circle',
          imageFrame: 'paper',
          fontFamily: 'Caveat',
          fontSize: 25,
          tapeStyle: 'botanical',
        },
        {
          id: crypto.randomUUID(),
          side: 'left',
          type: 'decal',
          x: 45,
          y: 390,
          width: 90,
          height: 180,
          rotation: -15,
          zIndex: 6,
          content: './illustrations/decor-fern.svg',
          caption: '',
          bg: '#eee0b8',
          fontFamily: 'Caveat',
          fontSize: 25,
          tapeStyle: 'botanical',
        },
        {
          id: crypto.randomUUID(),
          side: 'left',
          type: 'note',
          x: 120,
          y: 470,
          width: 310,
          height: 110,
          rotation: 2,
          zIndex: 3,
          content: 'Тихий сад, старые письма\nи ещё одна любимая глава.',
          caption: '',
          bg: '#eedbb5',
          fontFamily: 'Caveat',
          fontSize: 28,
          textColor: '#3e342a',
          tapeStyle: 'botanical',
        },
        {
          id: crypto.randomUUID(),
          side: 'right',
          type: 'polaroid',
          x: 80,
          y: 60,
          width: 280,
          height: 290,
          rotation: -2,
          zIndex: 2,
          content: './illustrations/night.svg',
          caption: '',
          bg: '#ffffff',
          imageShape: 'torn',
          imageFrame: 'none',
          fontFamily: 'Caveat',
          fontSize: 25,
          tapeStyle: 'botanical',
        },
        {
          id: crypto.randomUUID(),
          side: 'right',
          type: 'tape',
          x: 150,
          y: 50,
          width: 130,
          height: 35,
          rotation: 1,
          zIndex: 4,
          content: '',
          caption: '',
          bg: '#eee0b8',
          fontFamily: 'Caveat',
          fontSize: 25,
          tapeStyle: 'botanical',
        },
        {
          id: crypto.randomUUID(),
          side: 'right',
          type: 'decal',
          x: 330,
          y: 180,
          width: 65,
          height: 90,
          rotation: 12,
          zIndex: 5,
          content: './illustrations/decor-moon.svg',
          caption: '',
          bg: '#eee0b8',
          fontFamily: 'Caveat',
          fontSize: 25,
          tapeStyle: 'botanical',
        },
        {
          id: crypto.randomUUID(),
          side: 'right',
          type: 'note',
          x: 75,
          y: 320,
          width: 250,
          height: 180,
          rotation: -4,
          zIndex: 3,
          content: 'Некоторые истории\nостаются с нами\nпосле последней страницы.',
          caption: '',
          bg: '#2b3a4a',
          fontFamily: 'Caveat',
          fontSize: 26,
          textColor: '#ffffff',
          tapeStyle: 'botanical',
        },
        {
          id: crypto.randomUUID(),
          side: 'right',
          type: 'decal',
          x: 295,
          y: 350,
          width: 95,
          height: 120,
          rotation: 5,
          zIndex: 5,
          content: './illustrations/decor-exlibris.svg',
          caption: '',
          bg: '#eee0b8',
          fontFamily: 'Caveat',
          fontSize: 25,
          tapeStyle: 'botanical',
        },
        {
          id: crypto.randomUUID(),
          side: 'right',
          type: 'decal',
          x: 100,
          y: 460,
          width: 110,
          height: 90,
          rotation: -8,
          zIndex: 6,
          content: './illustrations/decor-moth.svg',
          caption: '',
          bg: '#eee0b8',
          fontFamily: 'Caveat',
          fontSize: 25,
          tapeStyle: 'botanical',
        },
        {
          id: crypto.randomUUID(),
          side: 'right',
          type: 'note',
          x: 240,
          y: 495,
          width: 170,
          height: 60,
          rotation: 3,
          zIndex: 4,
          content: 'моя тихая глава',
          caption: '',
          bg: '#ebd8be',
          fontFamily: 'Caveat',
          fontSize: 24,
          textColor: '#4b3f33',
          tapeStyle: 'botanical',
        },
      ]
      await window.sanctuaryAPI.saveSpread(collageSpread)
    })

    await page.getByRole('button', { name: 'Моя библиотека', exact: true }).click()
    await page
      .getByRole('button', { name: 'Открыть дневник: Гордость и предубеждение', exact: true })
      .click()
    await expect(
      page.getByRole('dialog', { name: 'Дневник: Гордость и предубеждение' }),
    ).toBeVisible()
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'docs/screenshots/journal.png' })

    // Navigate to spread 2 to screenshot the photo crop editor and scrapbook collage
    await page.getByRole('button', { name: 'Следующий разворот', exact: true }).click()
    await page.waitForTimeout(800)

    // Open photo crop modal on the circular photo
    const circlePhoto = page.locator('.journal-photo-paper')
    await expect(circlePhoto).toBeVisible()
    await circlePhoto.click({ force: true })
    await page.getByRole('button', { name: 'Кадрировать', exact: true }).click()
    const cropDialog = page.getByRole('dialog', { name: 'Найти красивый кадр', exact: true })
    await expect(cropDialog).toBeVisible()
    const zoomSlider = page.getByLabel('Масштаб фотографии', { exact: true })
    await expect(zoomSlider).toBeEnabled()
    await zoomSlider.evaluate((el: HTMLInputElement) => {
      el.value = '1.8'
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await page.waitForTimeout(400)
    await page.screenshot({ path: 'docs/screenshots/journal-crop.png' })
    await cropDialog.getByRole('button', { name: 'Готово', exact: true }).click()
    await expect(cropDialog).toHaveCount(0)

    // Deselect object so inspector is clean and take the full scrapbook collage screenshot
    await page.getByRole('button', { name: 'Выбор', exact: true }).click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: 'docs/screenshots/journal-collage.png' })

    await page.getByRole('button', { name: 'В библиотеку', exact: true }).click()
    await page.waitForTimeout(400)

    // 10. 3D Room screenshots
    await page.getByRole('button', { name: 'Моя комната', exact: true }).click()
    const stage = page.getByTestId('room-canvas')
    await expect(stage).toHaveAttribute('data-status', 'ready', { timeout: 35000 })
    await page.waitForTimeout(2000)

    // Full room overview
    await page.screenshot({ path: 'docs/screenshots/room.png' })

    // Shelf close-up
    await page.getByRole('button', { name: 'Левый шкаф', exact: true }).click()
    await expect(stage).toHaveAttribute('data-camera-settled', 'true', { timeout: 10000 })
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'docs/screenshots/room-shelf.png' })

    // Fireplace & Cat detail (captured in matching 3:2 aspect ratio with full cushion & radio in view)
    await page.getByRole('button', { name: 'Общий вид', exact: true }).click()
    await expect(stage).toHaveAttribute('data-camera-settled', 'true', { timeout: 10000 })
    await page.waitForTimeout(1000)
    const stageBox = (await stage.boundingBox())!
    const clipWidth = Math.round(stageBox.width * 0.52)
    const clipHeight = Math.round(clipWidth * (2 / 3))
    await page.screenshot({
      path: 'docs/screenshots/fireplace-cat.png',
      clip: {
        x: Math.round(stageBox.x + stageBox.width * 0.24),
        y: Math.round(stageBox.y + stageBox.height * 0.355),
        width: clipWidth,
        height: clipHeight,
      },
    })
  } finally {
    await app?.close()
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 })
  }
})
