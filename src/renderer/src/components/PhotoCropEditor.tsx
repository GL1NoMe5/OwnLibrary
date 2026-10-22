import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, RotateCcw, X } from 'lucide-react'
import type { ImageCrop, ScrapbookItem } from '../../../shared/types'
import { PhotoSurface, type PhotoSource } from './PhotoSurface'
import { imagePlacement, moveImageCrop, photoImageBounds, photoPresentation } from './journalPhoto'
import './journal-media.css'

export function PhotoCropEditor({
  item,
  onApply,
  onCancel,
}: {
  item: ScrapbookItem
  onApply: (crop: ImageCrop) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(() => photoPresentation(item).crop)
  const [source, setSource] = useState<PhotoSource>({
    source: item.content,
    size: null,
    failed: false,
  })
  const dialog = useRef<HTMLDivElement>(null)
  const preview = useRef<HTMLDivElement>(null)
  const pointer = useRef<{ x: number; y: number; scale: number; crop: ImageCrop } | null>(null)
  const latest = useRef({ source, onCancel })
  latest.current = { source, onCancel }
  const viewport = photoImageBounds(item)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.focus()
    const keyboard = (event: KeyboardEvent) => {
      // A crop draft owns the keyboard, including the journal's global undo/delete shortcuts.
      event.stopPropagation()
      if (event.key === 'Escape') {
        event.preventDefault()
        latest.current.onCancel()
      } else if (event.key === 'Tab') {
        const elements = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),[tabindex="0"]',
          ) ?? [],
        ).filter((element) => element.offsetParent !== null)
        const first = elements[0]
        const last = elements.at(-1)
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === dialog.current)
        ) {
          event.preventDefault()
          last?.focus()
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || document.activeElement === dialog.current)
        ) {
          event.preventDefault()
          first?.focus()
        }
      } else if (document.activeElement === preview.current && event.key.startsWith('Arrow')) {
        const size = latest.current.source.size
        if (!size) return
        event.preventDefault()
        const step = event.shiftKey ? 2 : 10
        const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
        const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0
        setDraft((current) =>
          moveImageCrop(current, dx, dy, imagePlacement(size, viewport, current), viewport),
        )
      }
    }
    document.addEventListener('keydown', keyboard, true)
    return () => {
      document.removeEventListener('keydown', keyboard, true)
      if (previous?.isConnected) previous.focus()
    }
  }, [item.id, item.width, item.height, item.fontSize, item.imageFrame, item.imageShape])

  const ready = Boolean(source.size) && !source.failed
  return createPortal(
    <div
      className="journal-crop-backdrop"
      onKeyDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => {
        event.stopPropagation()
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        className="journal-crop-dialog"
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="journal-crop-title"
        aria-describedby="journal-crop-help"
      >
        <header>
          <div>
            <h2 id="journal-crop-title">Найти красивый кадр</h2>
            <p id="journal-crop-help">
              Передвиньте фотографию и выберите масштаб. Оригинал сохранится.
            </p>
          </div>
          <button
            className="journal-crop-close"
            onClick={onCancel}
            aria-label="Закрыть кадрирование"
          >
            <X size={19} />
          </button>
        </header>
        <div className="journal-crop-stage">
          <div
            ref={preview}
            className={`journal-crop-preview ${ready ? 'is-ready' : ''}`}
            style={{
              aspectRatio: `${item.width} / ${item.height}`,
              maxWidth: `min(100%, ${(item.width / item.height) * 44}vh)`,
            }}
            tabIndex={ready ? 0 : -1}
            role="group"
            aria-label="Положение фотографии. Перетащите мышью или используйте стрелки; Shift для точной настройки."
            onPointerDown={(event) => {
              if (!ready || event.button !== 0) return
              event.preventDefault()
              event.currentTarget.focus()
              pointer.current = {
                x: event.clientX,
                y: event.clientY,
                scale: event.currentTarget.getBoundingClientRect().width / item.width,
                crop: { ...draft },
              }
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onPointerMove={(event) => {
              const start = pointer.current
              if (!start || !source.size) return
              setDraft(
                moveImageCrop(
                  start.crop,
                  (event.clientX - start.x) / start.scale,
                  (event.clientY - start.y) / start.scale,
                  imagePlacement(source.size, viewport, start.crop),
                  viewport,
                ),
              )
            }}
            onPointerUp={(event) => {
              pointer.current = null
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId)
            }}
            onPointerCancel={() => {
              pointer.current = null
            }}
            onLostPointerCapture={() => {
              pointer.current = null
            }}
          >
            <PhotoSurface item={item} crop={draft} onSource={setSource} />
          </div>
        </div>
        <div className="journal-crop-status" role="status">
          {source.failed
            ? 'Не удалось открыть изображение. Закройте кадрирование и выберите другое фото.'
            : !source.size
              ? 'Загружаем фотографию…'
              : 'Стрелки — переместить · Shift + стрелки — точнее'}
        </div>
        <label className="journal-crop-zoom">
          <span>Масштаб</span>
          <input
            type="range"
            min="1"
            max="4"
            step="0.01"
            value={draft.zoom}
            disabled={!ready}
            aria-label="Масштаб фотографии"
            onChange={(event) =>
              setDraft((current) => ({ ...current, zoom: Number(event.target.value) }))
            }
          />
          <output>{Math.round(draft.zoom * 100)}%</output>
        </label>
        <footer>
          <button
            className="journal-crop-reset"
            disabled={!ready}
            onClick={() => setDraft({ x: 0.5, y: 0.5, zoom: 1 })}
          >
            <RotateCcw size={15} /> Сбросить
          </button>
          <div>
            <button onClick={onCancel}>Отмена</button>
            <button className="journal-crop-apply" disabled={!ready} onClick={() => onApply(draft)}>
              <Check size={16} /> Готово
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
