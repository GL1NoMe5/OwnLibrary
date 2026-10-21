import { randomUUID } from 'node:crypto'
import type { Book, ScrapbookItem, Spread, Side } from '../shared/types'
import { localDate } from '../shared/types'

const titles = [
  [
    'Гордость и предубеждение',
    'Джейн Остин',
    '#69745c',
    'Остроумие, прогулки и письма, которые хочется перечитывать.',
    'garden',
  ],
  [
    'Мастер и Маргарита',
    'Михаил Булгаков',
    '#71535e',
    'Город, полный тайн. И любовь, которой не страшно время.',
    'night',
  ],
  [
    'Имя ветра',
    'Патрик Ротфусс',
    '#6e755e',
    'История, звучащая как музыка у вечернего костра.',
    'forest',
  ],
  [
    'Ходячий замок',
    'Диана Уинн Джонс',
    '#b9845d',
    'Иногда дом — это тот, кто всегда рядом.',
    'garden',
  ],
  [
    'Ночной цирк',
    'Эрин Моргенштерн',
    '#455260',
    'Чёрное, белое и немного невозможного волшебства.',
    'night',
  ],
  [
    'Тайная история',
    'Донна Тартт',
    '#815b4b',
    'Осенние страницы, древние языки, тревожная красота.',
    'forest',
  ],
  ['Дюна', 'Фрэнк Герберт', '#a47a4e', 'Песок, тишина и огромный мир за горизонтом.', 'desert'],
  [
    'Маленькие женщины',
    'Луиза Мэй Олкотт',
    '#8b6059',
    'Сёстры, маленькие радости и большое сердце.',
    'garden',
  ],
]
function item(
  type: ScrapbookItem['type'],
  side: Side,
  x: number,
  y: number,
  content: string,
  overrides: Partial<ScrapbookItem> = {},
): ScrapbookItem {
  return {
    id: randomUUID(),
    type,
    side,
    x,
    y,
    width: 270,
    height: 190,
    rotation: -3,
    zIndex: 1,
    content,
    caption: 'маленькие моменты',
    bg: '#eee0b8',
    fontFamily: 'Caveat',
    fontSize: 25,
    tapeStyle: 'botanical',
    ...overrides,
  }
}
export function emptySpread(bookId: string, index = 0): Spread {
  return {
    id: randomUUID(),
    bookId,
    spreadIndex: index,
    paperStyle: 'DOT_GRID',
    leftStrokes: [],
    rightStrokes: [],
    items: [],
    version: 1,
    revision: 0,
  }
}
export function seedBooks(): { book: Book; spread: Spread }[] {
  return titles.map(([title, author, color, note, image], index) => {
    const day = new Date()
    day.setDate(Math.max(1, day.getDate() - index * 2))
    const book: Book = {
      id: randomUUID(),
      title,
      author,
      status: 'READ',
      rating: index % 3 === 0 ? 5 : 4.5,
      pages: [416, 480, 672, 320, 512, 592, 768, 544][index],
      spineColor: color,
      coverColor: color,
      goldFoil: true,
      coverUrl: null,
      cabinet: index % 2,
      shelf: Math.floor(index / 2) % 4,
      slot: 0,
      collectionPage: 0,
      finishedAt: localDate(day),
      favoriteQuote: '',
      isDemo: true,
    }
    const spread = emptySpread(book.id)
    spread.paperStyle = index % 2 === 0 ? 'DOT_GRID' : 'LINED_CREAM'
    spread.items = [
      item(
        'note',
        'left',
        55,
        65,
        `Мои впечатления\n\n${note}\n\nЧитать медленно. Замечать детали.`,
        { width: 330, height: 260 },
      ),
      item('polaroid', 'right', 90, 90, `./illustrations/${image}.svg`, {
        width: 340,
        height: 390,
        rotation: 5,
        bg: '#ffffff',
        caption: 'настроение этой книги',
      }),
      item('tape', 'right', 190, 65, '', { width: 150, height: 40, rotation: -8, zIndex: 3 }),
      item('quote', 'left', 75, 410, note, {
        width: 380,
        height: 190,
        rotation: 0,
        fontFamily: 'Cormorant Garamond',
        fontSize: 26,
        bg: '#f4eddc',
      }),
      item('sticker', 'right', 390, 520, ['🌿', '🌙', '🎻', '☕'][index % 4], {
        width: 95,
        height: 100,
        rotation: 12,
        fontSize: 70,
        bg: '#ffffff',
      }),
      item('note', 'right', 100, 585, 'Чашка чая. Тихий вечер.\nИ ещё одна глава.', {
        width: 330,
        height: 125,
        rotation: -2,
        bg: '#dce1ce',
        fontSize: 27,
      }),
    ]
    spread.leftStrokes = [
      {
        id: randomUUID(),
        tool: 'pen',
        color: '#7c9070',
        size: 3,
        opacity: 0.8,
        points: [
          [80, 650],
          [130, 640],
          [180, 655],
          [230, 640],
          [280, 650],
          [330, 640],
        ],
      },
    ]
    return { book, spread }
  })
}
export function seedWishlist(): Book[] {
  return [
    ['Дом в лазурном море', 'Ти Джей Клун', '#688982'],
    ['Легенды и латте', 'Трэвис Болдри', '#94735a'],
    ['Энн из Зелёных Крыш', 'Люси Мод Монтгомери', '#70835a'],
  ].map(([title, author, color]) => ({
    id: randomUUID(),
    title,
    author,
    status: 'WISHLIST',
    rating: null,
    pages: null,
    spineColor: color,
    coverColor: color,
    goldFoil: true,
    coverUrl: null,
    cabinet: 0,
    shelf: 0,
    slot: 0,
    collectionPage: 0,
    finishedAt: null,
    favoriteQuote: '',
    isDemo: true,
  }))
}
