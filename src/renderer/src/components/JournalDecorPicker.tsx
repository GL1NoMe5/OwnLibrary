import { useState } from 'react'
import { Upload } from 'lucide-react'
import { stickers, type ScrapbookItem } from '../../../shared/types'
import { decorSets, paperPieces } from '../journal/decorCatalog'
import './journal-collage.css'

export type InsertScrapbookItem = (
  type: ScrapbookItem['type'],
  content?: string,
  options?: Partial<ScrapbookItem>,
) => void

export function JournalDecorPicker({
  onInsert,
  onImport,
  importing,
}: {
  onInsert: InsertScrapbookItem
  onImport: () => void
  importing: boolean
}) {
  const [tab, setTab] = useState<'decals' | 'paper' | 'symbols'>('decals')
  const [family, setFamily] = useState(decorSets[0].id)
  return (
    <div className="insert-popover collage-picker" aria-label="Материалы для коллажа">
      <div className="collage-tabs" role="group" aria-label="Вид декора">
        {(
          [
            ['decals', 'Наклейки'],
            ['paper', 'Бумага'],
            ['symbols', 'Символы'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'decals' ? (
        <>
          <select
            aria-label="Набор наклеек"
            value={family}
            onChange={(event) => setFamily(event.target.value)}
          >
            {decorSets.map((set) => (
              <option key={set.id} value={set.id}>
                {set.label}
              </option>
            ))}
          </select>
          <div className="collage-decor-grid">
            {decorSets
              .find((set) => set.id === family)!
              .items.map((decor) => (
                <button
                  key={decor.id}
                  title={decor.label}
                  aria-label={`Добавить: ${decor.label}`}
                  onClick={() =>
                    onInsert('decal', decor.src, { width: decor.width, height: decor.height })
                  }
                >
                  <img src={decor.src} alt="" draggable={false} />
                  <span>{decor.label}</span>
                </button>
              ))}
          </div>
          <button
            className="button secondary small collage-import"
            disabled={importing}
            onClick={onImport}
          >
            <Upload size={14} /> {importing ? 'Загружаем…' : 'Своя наклейка'}
          </button>
          <p className="collage-picker-hint">PNG с прозрачным фоном сохранит свой контур.</p>
        </>
      ) : tab === 'paper' ? (
        <div className="collage-paper-grid">
          {paperPieces.map((paper) => (
            <button
              key={paper.id}
              aria-label={`Добавить бумагу: ${paper.label}`}
              onClick={() =>
                onInsert('paper', '', {
                  width: paper.width,
                  height: paper.height,
                  bg: paper.bg,
                  paperTexture: paper.texture,
                  imageShape: paper.shape,
                })
              }
            >
              <span
                className={`collage-paper-swatch collage-paper-${paper.texture}`}
                style={{ backgroundColor: paper.bg }}
              />
              <span>{paper.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="collage-symbol-grid">
          {stickers.map((symbol) => (
            <button
              key={symbol}
              aria-label={`Стикер ${symbol}`}
              onClick={() => onInsert('sticker', symbol)}
            >
              {symbol}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
