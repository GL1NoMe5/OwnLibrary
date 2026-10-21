import type { Book, ReadingStats } from '../../../shared/types'
export type StoryTheme = 'hearth' | 'academia' | 'botanical'
const colors: Record<
  StoryTheme,
  { paper: string; ink: string; accent: string; muted: string; card: string }
> = {
  hearth: {
    paper: '#efe3d0',
    ink: '#4c372d',
    accent: '#9d7355',
    muted: '#907a65',
    card: '#e3d1b9',
  },
  academia: {
    paper: '#292d2b',
    ink: '#e9dfc7',
    accent: '#bca57b',
    muted: '#b5ac96',
    card: '#3b403a',
  },
  botanical: {
    paper: '#e9eddf',
    ink: '#3c5140',
    accent: '#758866',
    muted: '#7a8a72',
    card: '#d9e0cb',
  },
}
function round(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
) {
  context.fillStyle = fill
  context.beginPath()
  context.roundRect(x, y, w, h, r)
  context.fill()
}
function lines(
  context: CanvasRenderingContext2D,
  text: string,
  width: number,
  max: number,
): string[] {
  const words = text.split(/\s+/)
  const output: string[] = []
  let current = ''
  for (const word of words) {
    if (current && context.measureText(`${current} ${word}`).width > width) {
      output.push(current)
      current = word
    } else current = current ? `${current} ${word}` : word
  }
  if (current) output.push(current)
  if (output.length > max) {
    output.length = max
    let end = output[max - 1]
    while (context.measureText(`${end}…`).width > width && end.length) end = end.slice(0, -1)
    output[max - 1] = `${end}…`
  }
  return output
}
async function cover(
  context: CanvasRenderingContext2D,
  book: Book,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  context.save()
  context.shadowColor = '#00000025'
  context.shadowBlur = 15
  context.shadowOffsetY = 10
  round(context, x, y, w, h, 5, book.coverColor)
  context.restore()
  if (book.coverUrl) {
    try {
      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.src = book.coverUrl
      await image.decode()
      context.save()
      context.beginPath()
      context.roundRect(x, y, w, h, 5)
      context.clip()
      const scale = Math.max(w / image.width, h / image.height)
      const dw = image.width * scale,
        dh = image.height * scale
      context.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
      context.restore()
      return
    } catch {
      /* Use the local typographic cover when an image cannot be decoded. */
    }
  }
  context.strokeStyle = '#eeddb780'
  context.lineWidth = 1
  context.strokeRect(x + 12, y + 12, w - 24, h - 24)
  context.fillStyle = '#f2e5ca'
  context.textAlign = 'center'
  context.font = `${Math.round(w * 0.12)}px "Cormorant Garamond"`
  const title = lines(context, book.title, w - 40, 4)
  const start = y + h * 0.44 - title.length * w * 0.07
  title.forEach((line, index) => context.fillText(line, x + w / 2, start + index * w * 0.14))
  context.font = `${Math.max(12, Math.round(w * 0.055))}px Nunito`
  const author = lines(context, book.author, w - 36, 2)
  author.forEach((line, index) => context.fillText(line, x + w / 2, y + h - 40 + index * 16))
  context.textAlign = 'left'
}
export async function createStory(
  stats: ReadingStats,
  period: string,
  theme: StoryTheme,
): Promise<string> {
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1920
  const c = canvas.getContext('2d')!
  const palette = colors[theme]
  c.fillStyle = palette.paper
  c.fillRect(0, 0, 1080, 1920)
  c.strokeStyle = palette.accent + '45'
  c.lineWidth = 2
  c.strokeRect(38, 38, 1004, 1844)
  c.strokeStyle = palette.accent + '55'
  c.lineWidth = 2
  for (const origin of [
    [80, 80],
    [1000, 1840],
  ])
    for (let i = 0; i < 7; i++) {
      c.beginPath()
      c.ellipse(
        origin[0] + (origin[0] < 500 ? 1 : -1) * i * 13,
        origin[1] + (origin[0] < 500 ? 1 : -1) * i * 16,
        8,
        21,
        -0.6,
        0,
        Math.PI * 2,
      )
      c.stroke()
    }
  c.textAlign = 'center'
  c.fillStyle = palette.muted
  c.font = '18px Nunito'
  c.letterSpacing = '5px'
  c.fillText('ТИХАЯ ГЛАВА', 540, 130)
  c.letterSpacing = '0px'
  c.fillStyle = palette.ink
  c.font = 'italic 76px "Cormorant Garamond"'
  c.fillText('Между строк', 540, 240)
  const title =
    period.length === 4
      ? `${period} год`
      : new Intl.DateTimeFormat('ru', { month: 'long', year: 'numeric' })
          .format(new Date(`${period}-15T12:00:00`))
          .replace(' г.', '')
  c.fillStyle = palette.muted
  c.font = '25px Nunito'
  c.fillText(title.charAt(0).toUpperCase() + title.slice(1), 540, 296)
  c.strokeStyle = palette.accent + '60'
  c.beginPath()
  c.moveTo(130, 340)
  c.lineTo(950, 340)
  c.stroke()
  const numbers = [
    String(stats.count),
    new Intl.NumberFormat('ru').format(stats.pages),
    stats.average === null ? '—' : stats.average.toFixed(1),
  ]
  const labels = ['книг прочитано', 'страниц прожито', 'средняя оценка']
  for (let i = 0; i < 3; i++) {
    const x = 220 + i * 320
    c.fillStyle = palette.ink
    c.font = '70px "Cormorant Garamond"'
    c.fillText(numbers[i], x, 449)
    c.fillStyle = palette.muted
    c.font = '20px Nunito'
    c.fillText(labels[i], x, 492)
  }
  c.fillStyle = palette.muted
  c.font = '17px Nunito'
  c.letterSpacing = '3px'
  c.fillText(
    stats.count ? 'ИСТОРИИ, КОТОРЫЕ ОСТАЛИСЬ СО МНОЙ' : 'У НОВОЙ ИСТОРИИ ЕЩЁ ВСЁ ВПЕРЕДИ',
    540,
    585,
  )
  c.letterSpacing = '0px'
  const selected = stats.books.slice(0, 9)
  if (!selected.length) {
    round(c, 140, 650, 800, 800, 20, palette.card)
    c.fillStyle = palette.accent
    c.font = '160px "Cormorant Garamond"'
    c.fillText('✧', 540, 980)
    c.font = 'italic 50px "Cormorant Garamond"'
    c.fillText('Здесь появятся книги,', 540, 1110)
    c.fillText('которые станут частью вас.', 540, 1175)
  } else {
    const width = 220,
      height = 305,
      gap = 70
    const count = Math.min(selected.length, 3)
    const origin = (1080 - (count * width + (count - 1) * gap)) / 2
    for (let i = 0; i < selected.length; i++)
      await cover(
        c,
        selected[i],
        origin + (i % 3) * (width + gap),
        640 + Math.floor(i / 3) * 355,
        width,
        height,
      )
  }
  const bottom = selected.length > 6 ? 1735 : selected.length > 3 ? 1390 : 1190
  if (stats.top) {
    round(c, 115, bottom, 850, 100, 10, palette.card)
    c.fillStyle = palette.accent
    c.textAlign = 'left'
    c.font = '17px Nunito'
    c.fillText('КНИГА В САМОМ СЕРДЦЕ', 145, bottom + 31)
    c.fillStyle = palette.ink
    c.font = '32px "Cormorant Garamond"'
    c.fillText(lines(c, stats.top.title, 660, 1)[0], 145, bottom + 72)
    c.textAlign = 'right'
    c.font = '25px Nunito'
    c.fillText(`★ ${stats.top.rating!.toFixed(1)}`, 935, bottom + 65)
  }
  c.textAlign = 'center'
  c.fillStyle = palette.muted
  c.font = 'italic 27px "Cormorant Garamond"'
  c.fillText('Ещё одна глава. Ещё один маленький мир.', 540, 1860)
  return canvas.toDataURL('image/png')
}
