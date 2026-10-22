import { useRef } from 'react'
import { RotateCw } from 'lucide-react'
import type { ScrapbookItem, Tool } from '../../../shared/types'
import { useSanctuaryStore } from '../store/useSanctuaryStore'
import { PhotoSurface } from './PhotoSurface'
import { imageShapeClip, photoPresentation } from './journalPhoto'
import './journal-media.css'
type Gesture = {
  mode: 'drag' | 'resize' | 'rotate'
  startX: number
  startY: number
  item: ScrapbookItem
  scale: number
  centerX: number
  centerY: number
  angle: number
}
export function ScrapbookObject({ item, tool }: { item: ScrapbookItem; tool: Tool }) {
  const { selectedItemId, selectItem, editSpread, checkpoint } = useSanctuaryStore()
  const selected = selectedItemId === item.id
  const showsCaption = item.type === 'polaroid' && photoPresentation(item).frame === 'polaroid'
  const gesture = useRef<Gesture | null>(null)
  const patch = (changes: Partial<ScrapbookItem>, record = false) =>
    editSpread((d) => {
      const target = d.items.find((i) => i.id === item.id)
      if (target) Object.assign(target, changes)
    }, record)
  return (
    <div
      className={`scrap-object scrap-${item.type} ${selected ? 'selected' : ''} ${item.type === 'tape' ? `tape-${item.tapeStyle}` : ''}`}
      style={{
        left: `${item.x / 6}%`,
        top: `${item.y / 8}%`,
        width: `${item.width / 6}%`,
        height: `${item.height / 8}%`,
        transform: `rotate(${item.rotation}deg)`,
        zIndex: item.zIndex + 2,
        backgroundColor: item.bg,
        fontFamily: item.fontFamily,
        fontSize: `${item.fontSize}px`,
        color: item.textColor,
        pointerEvents: tool === 'select' ? 'auto' : 'none',
      }}
      onPointerDown={(event) => {
        if (tool !== 'select' || event.button !== 0) return
        event.stopPropagation()
        selectItem(item.id)
        if ((event.target as HTMLElement).closest('textarea,input')) return
        event.preventDefault()
        const element = event.currentTarget
        const page = element.closest('[data-page-side]')!.getBoundingClientRect()
        const bounds = element.getBoundingClientRect()
        const centerX = bounds.left + bounds.width / 2
        const centerY = bounds.top + bounds.height / 2
        const handle = (event.target as HTMLElement).closest('[data-handle]') as HTMLElement | null
        gesture.current = {
          mode: (handle?.dataset.handle as Gesture['mode']) ?? 'drag',
          startX: event.clientX,
          startY: event.clientY,
          item: structuredClone(item),
          scale: page.width / 600,
          centerX,
          centerY,
          angle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
        }
        checkpoint()
        element.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        const current = gesture.current
        if (!current) return
        const dx = (event.clientX - current.startX) / current.scale
        const dy = (event.clientY - current.startY) / current.scale
        if (current.mode === 'drag')
          patch({
            x: Math.max(
              -current.item.width * 0.7,
              Math.min(600 - current.item.width * 0.3, current.item.x + dx),
            ),
            y: Math.max(
              -current.item.height * 0.7,
              Math.min(800 - current.item.height * 0.3, current.item.y + dy),
            ),
          })
        else if (current.mode === 'resize') {
          const angle = (current.item.rotation * Math.PI) / 180
          const cosine = Math.cos(angle)
          const sine = Math.sin(angle)
          const localX = dx * cosine + dy * sine
          const localY = -dx * sine + dy * cosine
          const keepsAspect = ['polaroid', 'sticker', 'decal'].includes(current.item.type)
          let width = Math.max(50, Math.min(590, current.item.width + localX))
          let height = Math.max(40, Math.min(760, current.item.height + localY))
          if (keepsAspect) {
            const scale = Math.max(
              Math.max(50 / current.item.width, 40 / current.item.height),
              Math.min(
                590 / current.item.width,
                760 / current.item.height,
                1 +
                  (localX * current.item.width + localY * current.item.height) /
                    (current.item.width ** 2 + current.item.height ** 2),
              ),
            )
            width = current.item.width * scale
            height = current.item.height * scale
          }
          const dw = width - current.item.width
          const dh = height - current.item.height
          patch({
            width,
            height,
            x: current.item.x + (dw * cosine - dh * sine - dw) / 2,
            y: current.item.y + (dw * sine + dh * cosine - dh) / 2,
          })
        } else
          patch({
            rotation: Math.max(
              -180,
              Math.min(
                180,
                current.item.rotation +
                  ((Math.atan2(event.clientY - current.centerY, event.clientX - current.centerX) -
                    current.angle) *
                    180) /
                    Math.PI,
              ),
            ),
          })
      }}
      onPointerUp={(event) => {
        const current = gesture.current
        if (!current) return
        if (current.mode === 'drag') {
          const other = document.querySelector<HTMLElement>(
            `[data-page-side="${item.side === 'left' ? 'right' : 'left'}"]`,
          )
          const bounds = other?.getBoundingClientRect()
          if (
            bounds &&
            event.clientX >= bounds.left &&
            event.clientX <= bounds.right &&
            event.clientY >= bounds.top &&
            event.clientY <= bounds.bottom
          )
            patch({
              side: item.side === 'left' ? 'right' : 'left',
              x: Math.max(
                0,
                Math.min(
                  600 - item.width,
                  ((event.clientX - bounds.left) * 600) / bounds.width - item.width / 2,
                ),
              ),
              y: Math.max(
                0,
                Math.min(
                  800 - item.height,
                  ((event.clientY - bounds.top) * 800) / bounds.height - item.height / 2,
                ),
              ),
            })
        }
        gesture.current = null
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId)
      }}
      onPointerCancel={() => {
        gesture.current = null
      }}
      onLostPointerCapture={() => {
        gesture.current = null
      }}
    >
      {item.type === 'polaroid' ? (
        <>
          <PhotoSurface item={item} />
          {showsCaption &&
            (selected ? (
              <input
                aria-label="Подпись к фотографии"
                value={item.caption}
                onFocus={checkpoint}
                onChange={(e) => patch({ caption: e.target.value })}
                maxLength={2000}
              />
            ) : (
              <span className="polaroid-caption">{item.caption}</span>
            ))}
        </>
      ) : item.type === 'decal' ? (
        <img
          className="journal-decal-image"
          src={item.content}
          alt="Наклейка в дневнике"
          draggable={false}
        />
      ) : item.type === 'paper' ? (
        <div className="journal-paper-shadow">
          <div
            className={`journal-paper-sheet paper-${item.paperTexture ?? 'plain'}`}
            style={{
              backgroundColor: item.bg,
              clipPath: imageShapeClip(item.imageShape ?? 'torn'),
            }}
          />
        </div>
      ) : item.type === 'sticker' ? (
        <span className="sticker-symbol" style={{ fontSize: item.fontSize }}>
          {item.content}
        </span>
      ) : item.type === 'tape' ? (
        <span />
      ) : (
        <>
          {item.type === 'quote' && <span className="quote-ornament">“</span>}
          {selected ? (
            <textarea
              aria-label={item.type === 'note' ? 'Текст заметки' : 'Текст цитаты'}
              value={item.content}
              onFocus={checkpoint}
              onChange={(e) => patch({ content: e.target.value })}
              maxLength={20000}
              spellCheck={false}
            />
          ) : (
            <div className="scrap-text">{item.content}</div>
          )}
        </>
      )}
      {selected && (
        <>
          <button className="rotation-handle" data-handle="rotate" aria-label="Повернуть предмет">
            <RotateCw size={15} />
          </button>
          <button className="resize-handle" data-handle="resize" aria-label="Изменить размер" />
        </>
      )}
    </div>
  )
}
