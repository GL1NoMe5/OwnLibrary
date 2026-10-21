import {
  test,
  expect,
  _electron as electron,
  chromium,
  type Page,
  type Browser,
} from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'

const executable = "dist/win-unpacked/Cozy Reader's Sanctuary.exe"
const version = JSON.parse(readFileSync('package.json', 'utf8')).version
const portable = `dist/Sanctuary-${version}-portable.exe`
function environment(directory: string) {
  return {
    ...process.env,
    PATH: `${process.env.SystemRoot}\\System32;${process.env.SystemRoot}`,
    SANCTUARY_DATA_DIR: directory,
    ELECTRON_RENDERER_URL: '',
  }
}
async function checkWindow(page: Page, screenshot?: string) {
  await page.context().setOffline(true)
  await expect(page.getByRole('heading', { name: 'Моя библиотека', exact: true })).toBeVisible()
  await expect(page.locator('.book-card')).toHaveCount(8)
  await page.getByRole('button', { name: 'Моя комната', exact: true }).click()
  await expect(page.getByTestId('room-canvas')).toHaveAttribute('data-status', 'ready', {
    timeout: 30000,
  })
  await expect(page.getByTestId('room-canvas')).toHaveAttribute('data-book-count', '8')
  if (screenshot) {
    await page.getByRole('button', { name: 'Настроение и настройки', exact: true }).click()
    await page.getByLabel('Качество графики комнаты', { exact: true }).selectOption('HIGH')
    await page.getByRole('button', { name: 'Закрыть', exact: true }).click()
    await expect(page.getByTestId('room-canvas')).toHaveAttribute('data-render-quality', 'HIGH')
    await page.screenshot({ path: screenshot })
  }
  await page.getByRole('button', { name: 'Список книг', exact: true }).click()
  await page
    .getByRole('button', { name: 'Открыть дневник: Гордость и предубеждение', exact: true })
    .click()
  await page
    .locator('.scrap-polaroid img')
    .evaluate((image) => (image as HTMLImageElement).decode())
  await expect(page.getByText('Сохранено в дневник', { exact: true })).toBeVisible()
}
test('packaged executable runs offline without Node on PATH', async () => {
  test.skip(!existsSync(executable), 'Run the Windows build before testing packaged targets')
  const directory = await mkdtemp(join(tmpdir(), 'sanctuary-packaged-'))
  const app = await electron.launch({
    executablePath: resolve(executable),
    args: [],
    env: environment(directory),
  })
  try {
    await checkWindow(await app.firstWindow())
  } finally {
    await app.close()
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  }
})
test('portable launcher runs offline without Node on PATH', async ({}, testInfo) => {
  test.skip(!existsSync(portable), 'Run the Windows build before testing portable')
  const directory = await mkdtemp(join(tmpdir(), 'sanctuary-portable-'))
  const port = await new Promise<number>((resolvePort, reject) => {
    const server = createServer()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') return reject(new Error('No local port'))
      server.close(() => resolvePort(address.port))
    })
  })
  // NSIS forwards arguments, but not its child's Electron inspector announcement on stderr.
  const child = spawn(
    resolve(portable),
    [`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1'],
    { env: environment(directory), windowsHide: true, stdio: 'ignore' },
  )
  let browser: Browser | undefined
  try {
    await expect
      .poll(
        async () => {
          try {
            return (
              await fetch(`http://127.0.0.1:${port}/json/version`, {
                signal: AbortSignal.timeout(1000),
              })
            ).ok
          } catch {
            return false
          }
        },
        { timeout: 45000 },
      )
      .toBe(true)
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
    const context = browser.contexts()[0]
    const page = context.pages()[0] ?? (await context.waitForEvent('page'))
    await checkWindow(page, testInfo.outputPath('room-high.png'))
    await page.evaluate(() => window.sanctuaryAPI.close())
  } finally {
    await browser?.close()
    if (child.exitCode === null && child.pid)
      await new Promise<void>((resolveKill) => {
        const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
        })
        killer.on('close', () => resolveKill())
        killer.on('error', () => resolveKill())
      })
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  }
})
