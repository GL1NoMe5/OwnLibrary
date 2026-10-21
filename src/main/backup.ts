import { dialog, type BrowserWindow } from 'electron'
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'
import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { SanctuaryDatabase, atomicWrite } from './db'
import { bookInputSchema, spreadSchema } from '../shared/validation'

export async function exportBackup(db: SanctuaryDatabase, window: BrowserWindow): Promise<boolean> {
  const result = await dialog.showSaveDialog(window, {
    title: 'Резервная копия библиотеки',
    defaultPath: 'Моя библиотека.sanctuary.zip',
    filters: [{ name: 'Архив библиотеки', extensions: ['zip'] }],
  })
  if (result.canceled || !result.filePath) return false
  const files: Record<string, Uint8Array> = {
    'manifest.json': strToU8(
      JSON.stringify({ format: 'sanctuary', version: 1, createdAt: new Date().toISOString() }),
    ),
    'sanctuary.sqlite': await db.exportBytes(),
  }
  for (const file of await db.mediaFiles())
    files[`media/${file}`] = await readFile(join(db.directory, 'media', file))
  await writeFile(result.filePath, zipSync(files, { level: 6 }))
  return true
}
export async function importBackup(
  db: SanctuaryDatabase,
  window: BrowserWindow,
  wasmPath: string,
): Promise<SanctuaryDatabase | null> {
  const result = await dialog.showOpenDialog(window, {
    title: 'Восстановить библиотеку',
    properties: ['openFile'],
    filters: [{ name: 'Архив библиотеки', extensions: ['zip'] }],
  })
  if (result.canceled) return null
  const confirmation = await dialog.showMessageBox(window, {
    type: 'question',
    buttons: ['Отмена', 'Восстановить'],
    defaultId: 0,
    cancelId: 0,
    message: 'Заменить текущую библиотеку?',
    detail:
      'Текущая версия сохранится в файле sanctuary.sqlite.bak. Для переноса всех изображений предварительно создайте архив.',
  })
  if (confirmation.response !== 1) return null
  const bytes = await readFile(result.filePaths[0])
  if (bytes.length > 300 * 1024 * 1024) throw new Error('Архив превышает 300 МБ')
  let expanded = 0
  const files = unzipSync(bytes, {
    filter: (file) => {
      expanded += file.originalSize
      if (expanded > 600 * 1024 * 1024) throw new Error('Распакованный архив превышает 600 МБ')
      return true
    },
  })
  if (!files['manifest.json'] || !files['sanctuary.sqlite'])
    throw new Error('Это не архив библиотеки Sanctuary')
  const manifest = JSON.parse(strFromU8(files['manifest.json'])) as {
    format: string
    version: number
  }
  if (manifest.format !== 'sanctuary' || manifest.version !== 1)
    throw new Error('Неподдерживаемый формат архива')
  for (const name of Object.keys(files))
    if (
      name !== 'manifest.json' &&
      name !== 'sanctuary.sqlite' &&
      !/^media\/[0-9a-f-]{36}\.png$/i.test(name)
    )
      throw new Error('Архив содержит недопустимый путь')
  const token = randomUUID()
  const staging = join(db.directory, `.restore-${token}`)
  await mkdir(join(staging, 'media'), { recursive: true })
  let candidate: SanctuaryDatabase | undefined
  try {
    candidate = await SanctuaryDatabase.open(staging, {
      wasmPath,
      bytes: files['sanctuary.sqlite'],
    })
    for (const book of await candidate.books()) {
      bookInputSchema.parse(book)
      for (const spread of await candidate.spreads(book.id)) spreadSchema.parse(spread)
    }
    for (const file of await candidate.mediaFiles()) {
      const data = files[`media/${file}`]
      if (!data) throw new Error('В архиве отсутствует изображение')
      await writeFile(join(staging, 'media', file), data)
    }
    const restored = await candidate.exportBytes()
    await candidate.close()
    candidate = undefined
    const original = await db.exportBytes()
    const mediaRoot = join(db.directory, 'media')
    const oldMedia = join(db.directory, `.media-before-${token}`)
    await db.idle()
    let moved = false
    let installed = false
    try {
      if (existsSync(mediaRoot)) {
        await rename(mediaRoot, oldMedia)
        moved = true
      }
      await rename(join(staging, 'media'), mediaRoot)
      installed = true
      await atomicWrite(join(db.directory, 'sanctuary.sqlite'), restored)
      const replacement = await SanctuaryDatabase.open(db.directory, { wasmPath })
      await db.close()
      return replacement
    } catch (error) {
      if (installed) await rm(mediaRoot, { recursive: true, force: true })
      if (moved) await rename(oldMedia, mediaRoot)
      await atomicWrite(join(db.directory, 'sanctuary.sqlite'), original)
      throw error
    }
  } finally {
    if (candidate) await candidate.close()
    await rm(staging, { recursive: true, force: true })
  }
}
