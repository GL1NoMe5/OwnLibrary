export type BookStatus = 'READ' | 'WISHLIST'
export type PaperStyle = 'DOT_GRID' | 'VINTAGE_KRAFT' | 'DARK_ACADEMIA' | 'LINED_CREAM'
export type Side = 'left' | 'right'
export type DrawingTool = 'pen' | 'marker' | 'fountain' | 'eraser'
export type Tool = 'select' | DrawingTool
export type Book = {
  id: string
  title: string
  author: string
  status: BookStatus
  rating: number | null
  pages: number | null
  spineColor: string
  coverColor: string
  goldFoil: boolean
  coverUrl: string | null
  cabinet: number
  shelf: number
  slot: number
  collectionPage: number
  finishedAt: string | null
  favoriteQuote: string
  isDemo: boolean
}
export type BookInput = Omit<Book, 'id' | 'slot' | 'collectionPage' | 'isDemo'>
export type Stroke = {
  id: string
  tool: DrawingTool
  color: string
  size: number
  opacity: number
  points: [number, number][]
}
export type ScrapbookItem = {
  id: string
  side: Side
  type: 'note' | 'quote' | 'polaroid' | 'sticker' | 'tape'
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  content: string
  caption: string
  bg: string
  fontFamily: string
  fontSize: number
  tapeStyle: 'plaid' | 'botanical' | 'stars'
}
export type Spread = {
  id: string
  bookId: string
  spreadIndex: number
  paperStyle: PaperStyle
  leftStrokes: Stroke[]
  rightStrokes: Stroke[]
  items: ScrapbookItem[]
  version: number
  revision: number
}
export type RoomConfig = {
  woodTheme: 'WALNUT' | 'OAK' | 'MAHOGANY'
  catBreed: 'GINGER' | 'BLACK' | 'CALICO'
  fairyLights: boolean
  fireplaceActive: boolean
  quality: 'LOW' | 'MEDIUM' | 'HIGH'
  rain: boolean
  sound: boolean
  radioPlaying: boolean
  volume: number
  reducedMotion: boolean
}
export type Settings = { goals: Record<string, number>; room: RoomConfig }
export type SearchResult = {
  key: string
  title: string
  author: string
  coverId: number | null
  editionKey: string | null
}
export type Edition = {
  title: string
  author: string
  pages: number | null
  coverUrl: string | null
}
export type QuoteEntry = { bookId: string; bookTitle: string; text: string; type: 'quote' | 'note' }
export type BootData = { books: Book[]; settings: Settings }
export type ReadingStats = {
  books: Book[]
  count: number
  pages: number
  unrated: number
  average: number | null
  goal: number
  daily: number[]
  top: Book | null
}
export type SaveState = 'saved' | 'dirty' | 'saving' | 'error'
export interface SanctuaryAPI {
  bootstrap(): Promise<BootData>
  listBooks(): Promise<Book[]>
  createBook(input: BookInput): Promise<Book>
  updateBook(id: string, input: BookInput): Promise<Book>
  deleteBook(id: string): Promise<void>
  removeDemo(): Promise<void>
  searchBooks(query: string): Promise<SearchResult[]>
  resolveEdition(result: SearchResult): Promise<Edition>
  getSpreads(bookId: string): Promise<Spread[]>
  saveSpread(spread: Spread): Promise<Spread>
  addSpread(bookId: string): Promise<Spread>
  getQuotes(): Promise<QuoteEntry[]>
  importImage(): Promise<string | null>
  saveSettings(settings: Settings): Promise<Settings>
  savePng(dataUrl: string): Promise<boolean>
  exportBackup(): Promise<boolean>
  importBackup(): Promise<boolean>
  minimize(): void
  maximize(): void
  close(): void
  onBeforeClose(callback: () => Promise<boolean>): () => void
}
export const defaultRoom: RoomConfig = {
  woodTheme: 'WALNUT',
  catBreed: 'GINGER',
  fairyLights: true,
  fireplaceActive: true,
  quality: 'MEDIUM',
  rain: false,
  sound: false,
  radioPlaying: true,
  volume: 0.3,
  reducedMotion: false,
}
export const defaultSettings = (): Settings => ({ goals: {}, room: { ...defaultRoom } })
export const localDate = (date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export const stickers = [
  '🌿',
  '☕',
  '🕯️',
  '✨',
  '🐾',
  '🌙',
  '🍂',
  '🎻',
  '📜',
  '🗝️',
  '🦋',
  '🍄',
  '🫖',
  '🏛️',
  '💌',
  '⭐',
]
