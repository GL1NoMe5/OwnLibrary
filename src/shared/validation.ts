import { z } from 'zod'

export const idSchema = z.uuid()
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/)
const mediaUrl = z
  .string()
  .max(250)
  .refine(
    (value) =>
      /^sanctuary-media:\/\/media\/[0-9a-f-]{36}\.png$/i.test(value) ||
      /^\.\/illustrations\/[a-z-]+\.svg$/.test(value),
  )
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(value + 'T12:00:00Z')
    return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  })
export const bookInputSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    author: z.string().trim().min(1).max(300),
    status: z.enum(['READ', 'WISHLIST']),
    rating: z.number().min(0).max(5).multipleOf(0.5).nullable(),
    pages: z.number().int().min(1).max(100000).nullable(),
    spineColor: color,
    coverColor: color,
    goldFoil: z.boolean(),
    coverUrl: mediaUrl.nullable(),
    cabinet: z.number().int().min(0).max(1),
    shelf: z.number().int().min(0).max(3),
    finishedAt: date.nullable(),
    favoriteQuote: z.string().max(10000),
  })
  .refine((value) => value.status !== 'READ' || value.finishedAt !== null, {
    message: 'Укажите дату завершения книги',
  })
const strokeSchema = z.object({
  id: idSchema,
  tool: z.enum(['pen', 'marker', 'fountain', 'eraser']),
  color,
  size: z.number().min(2).max(24),
  opacity: z.number().min(0).max(1),
  points: z
    .array(z.tuple([z.number().min(-100).max(700), z.number().min(-100).max(900)]))
    .min(1)
    .max(20000),
})
const itemSchema = z
  .object({
    id: idSchema,
    side: z.enum(['left', 'right']),
    type: z.enum(['note', 'quote', 'polaroid', 'sticker', 'tape']),
    x: z.number().min(-1000).max(1600),
    y: z.number().min(-1000).max(1800),
    width: z.number().min(20).max(1200),
    height: z.number().min(20).max(1600),
    rotation: z.number().min(-360).max(360),
    zIndex: z.number().int().min(0).max(100000),
    content: z.string().max(20000),
    caption: z.string().max(2000),
    bg: color,
    fontFamily: z.enum(['Caveat', 'Cormorant Garamond', 'Marck Script', 'Nunito']),
    fontSize: z.number().min(10).max(120),
    tapeStyle: z.enum(['plaid', 'botanical', 'stars']),
  })
  .refine((value) => value.type !== 'polaroid' || mediaUrl.safeParse(value.content).success, {
    message: 'Изображение не принадлежит библиотеке',
  })
export const spreadSchema = z.object({
  id: idSchema,
  bookId: idSchema,
  spreadIndex: z.number().int().min(0),
  paperStyle: z.enum(['DOT_GRID', 'VINTAGE_KRAFT', 'DARK_ACADEMIA', 'LINED_CREAM']),
  leftStrokes: z.array(strokeSchema).max(3000),
  rightStrokes: z.array(strokeSchema).max(3000),
  items: z.array(itemSchema).max(300),
  version: z.literal(1),
  revision: z.number().int().min(0),
})
export const settingsSchema = z.object({
  goals: z.record(z.string().regex(/^\d{4}-\d{2}$/), z.number().int().min(1).max(1000)),
  room: z.object({
    woodTheme: z.enum(['WALNUT', 'OAK', 'MAHOGANY']),
    catBreed: z.enum(['GINGER', 'BLACK', 'CALICO']),
    fairyLights: z.boolean(),
    fireplaceActive: z.boolean(),
    quality: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    rain: z.boolean(),
    sound: z.boolean(),
    radioPlaying: z.boolean().default(true),
    volume: z.number().min(0).max(1),
    reducedMotion: z.boolean(),
  }),
})
