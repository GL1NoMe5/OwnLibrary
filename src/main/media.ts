import { nativeImage } from 'electron'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { SanctuaryDatabase } from './db'

export async function storeImage(bytes: Uint8Array, db: SanctuaryDatabase): Promise<string> {
  if (bytes.length > 20 * 1024 * 1024) throw new Error('Изображение должно быть меньше 20 МБ')
  const image = nativeImage.createFromBuffer(Buffer.from(bytes))
  if (image.isEmpty())
    throw new Error('Не удалось прочитать изображение. Используйте PNG, JPEG или WebP.')
  const size = image.getSize()
  if (size.width * size.height > 50_000_000)
    throw new Error('Изображение слишком большое: максимум 50 мегапикселей')
  const resized =
    Math.max(size.width, size.height) > 2048
      ? image.resize(size.width >= size.height ? { width: 2048 } : { height: 2048 })
      : image
  const id = randomUUID()
  const directory = join(db.directory, 'media')
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, `${id}.png`), resized.toPNG())
  await db.registerMedia(id)
  return `sanctuary-media://media/${id}.png`
}
