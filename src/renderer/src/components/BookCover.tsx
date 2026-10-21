import { Leaf, Sparkles } from 'lucide-react'
import type { Book } from '../../../shared/types'

export function BookCover({
  book,
  className = '',
}: {
  book: Pick<Book, 'title' | 'author' | 'coverUrl' | 'coverColor' | 'goldFoil'>
  className?: string
}) {
  if (book.coverUrl)
    return (
      <div className={`book-cover ${className}`} style={{ background: book.coverColor }}>
        <img src={book.coverUrl} alt={`Обложка: ${book.title}`} draggable={false} />
      </div>
    )
  return (
    <div
      className={`book-cover generated-cover ${book.goldFoil ? 'foil' : ''} ${className}`}
      style={{ background: book.coverColor }}
    >
      <div className="cover-frame">
        <span className="cover-author">{book.author}</span>
        <Leaf size={29} strokeWidth={1} />
        <span className="cover-title">{book.title}</span>
        <span className="cover-flourish">✧</span>
        <span className="cover-edition">ЛИЧНАЯ БИБЛИОТЕКА</span>
      </div>
      <Sparkles className="cover-sparkle" size={16} />
    </div>
  )
}
export function Rating({ value }: { value: number | null }) {
  return (
    <span className="rating">
      {value !== null ? (
        <>
          <span aria-hidden>★</span> {value.toFixed(1)}
        </>
      ) : (
        <span className="muted">Без оценки</span>
      )}
    </span>
  )
}
