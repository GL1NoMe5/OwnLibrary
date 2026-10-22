/** Original, bundled cut-paper illustrations. Dimensions are insertion sizes on a spread. */
export interface DecorItem {
  id: string
  label: string
  src: string
  width: number
  height: number
}

export interface DecorSet {
  id: string
  label: string
  items: DecorItem[]
}

export interface PaperPiece {
  id: string
  label: string
  bg: string
  texture: 'plain' | 'kraft' | 'print' | 'ink'
  width: number
  height: number
  shape: 'rectangle' | 'torn' | 'cutout'
}

export const decorSets: DecorSet[] = [
  {
    id: 'herbarium',
    label: 'Гербарий',
    items: [
      {
        id: 'fern',
        label: 'Папоротник',
        src: './illustrations/decor-fern.svg',
        width: 112,
        height: 220,
      },
      {
        id: 'olive',
        label: 'Оливковая ветвь',
        src: './illustrations/decor-olive.svg',
        width: 124,
        height: 210,
      },
      {
        id: 'flower',
        label: 'Ботанический цветок',
        src: './illustrations/decor-flower.svg',
        width: 130,
        height: 210,
      },
    ],
  },
  {
    id: 'reading-room',
    label: 'Книжная лавка',
    items: [
      {
        id: 'exlibris',
        label: 'Экслибрис',
        src: './illustrations/decor-exlibris.svg',
        width: 160,
        height: 192,
      },
      {
        id: 'key',
        label: 'Старинный ключ',
        src: './illustrations/decor-key.svg',
        width: 76,
        height: 200,
      },
      {
        id: 'stamp',
        label: 'Почтовая марка',
        src: './illustrations/decor-stamp.svg',
        width: 106,
        height: 136,
      },
    ],
  },
  {
    id: 'after-dark',
    label: 'После заката',
    items: [
      {
        id: 'moon',
        label: 'Месяц и звёзды',
        src: './illustrations/decor-moon.svg',
        width: 150,
        height: 170,
      },
      {
        id: 'moth',
        label: 'Ночной мотылёк',
        src: './illustrations/decor-moth.svg',
        width: 190,
        height: 132,
      },
      {
        id: 'star-book',
        label: 'Книга со звёздами',
        src: './illustrations/decor-star-book.svg',
        width: 170,
        height: 170,
      },
    ],
  },
]

export const paperPieces: PaperPiece[] = [
  {
    id: 'cream',
    label: 'Слоновая кость',
    bg: '#e9ddc4',
    texture: 'plain',
    width: 270,
    height: 190,
    shape: 'torn',
  },
  {
    id: 'kraft',
    label: 'Крафтовая бумага',
    bg: '#b99568',
    texture: 'kraft',
    width: 240,
    height: 200,
    shape: 'torn',
  },
  {
    id: 'navy',
    label: 'Полуночный синий',
    bg: '#283b50',
    texture: 'plain',
    width: 250,
    height: 190,
    shape: 'cutout',
  },
  {
    id: 'burgundy',
    label: 'Бордо',
    bg: '#673b44',
    texture: 'plain',
    width: 250,
    height: 190,
    shape: 'cutout',
  },
  {
    id: 'newspaper',
    label: 'Старая газета',
    bg: '#d5c9ac',
    texture: 'print',
    width: 260,
    height: 210,
    shape: 'torn',
  },
  {
    id: 'black-ink',
    label: 'Чёрная тушь',
    bg: '#33312f',
    texture: 'ink',
    width: 250,
    height: 180,
    shape: 'torn',
  },
]
