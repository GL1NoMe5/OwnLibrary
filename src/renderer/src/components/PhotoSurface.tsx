import { useEffect, useState } from 'react'
import type { ImageCrop, ScrapbookItem } from '../../../shared/types'
import {
  imagePlacement,
  imageShapeClip,
  photoImageBounds,
  photoPresentation,
  type Size,
} from './journalPhoto'
import './journal-media.css'

export type PhotoSource = { source: string; size: Size | null; failed: boolean }

export function PhotoSurface({
  item,
  crop,
  onSource,
}: {
  item: ScrapbookItem
  crop?: ImageCrop
  onSource?: (value: PhotoSource) => void
}) {
  const [loaded, setLoaded] = useState<PhotoSource>({
    source: item.content,
    size: null,
    failed: false,
  })
  const { shape, frame, crop: savedCrop } = photoPresentation(item)
  const bounds = photoImageBounds(item)
  const source =
    loaded.source === item.content ? loaded : { source: item.content, size: null, failed: false }
  const placement = source.size ? imagePlacement(source.size, bounds, crop ?? savedCrop) : null
  useEffect(() => {
    onSource?.(
      loaded.source === item.content ? loaded : { source: item.content, size: null, failed: false },
    )
  }, [loaded, item.content, onSource])
  const frameClip = frame === 'paper' ? imageShapeClip(shape) : undefined
  const paperCircle = frame === 'paper' && shape === 'circle'
  const diameter = Math.min(item.width, item.height)

  return (
    <div className={`journal-photo-surface photo-frame-${frame}`}>
      {frame !== 'none' && (
        <div
          className="journal-photo-paper"
          style={{
            clipPath: frameClip,
            backgroundColor: item.imageFrame === undefined ? '#fffdf6' : item.bg,
            ...(paperCircle
              ? {
                  left: `${((item.width - diameter) / item.width) * 50}%`,
                  top: `${((item.height - diameter) / item.height) * 50}%`,
                  width: `${(diameter / item.width) * 100}%`,
                  height: `${(diameter / item.height) * 100}%`,
                }
              : {}),
          }}
        />
      )}
      <div
        className="journal-photo-window"
        style={{
          left: `${(bounds.left / item.width) * 100}%`,
          top: `${(bounds.top / item.height) * 100}%`,
          width: `${(bounds.width / item.width) * 100}%`,
          height: `${(bounds.height / item.height) * 100}%`,
          clipPath: imageShapeClip(shape),
        }}
      >
        <img
          key={item.content}
          src={item.content}
          alt="Иллюстрация в дневнике"
          draggable={false}
          onLoad={(event) =>
            setLoaded({
              source: item.content,
              size: {
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              },
              failed: false,
            })
          }
          onError={() => setLoaded({ source: item.content, size: null, failed: true })}
          style={
            placement
              ? {
                  width: `${(placement.width / bounds.width) * 100}%`,
                  height: `${(placement.height / bounds.height) * 100}%`,
                  left: `${(placement.left / bounds.width) * 100}%`,
                  top: `${(placement.top / bounds.height) * 100}%`,
                }
              : undefined
          }
        />
        {source.failed && <span className="journal-photo-error">Фото недоступно</span>}
      </div>
    </div>
  )
}
