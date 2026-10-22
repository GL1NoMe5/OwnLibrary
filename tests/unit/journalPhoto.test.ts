import { describe, expect, it } from 'vitest'
import type { ScrapbookItem } from '../../src/shared/types'
import {
  imagePlacement,
  moveImageCrop,
  photoImageBounds,
  photoPresentation,
} from '../../src/renderer/src/components/journalPhoto'

const legacy = {
  id: 'photo',
  side: 'left',
  type: 'polaroid',
  x: 40,
  y: 60,
  width: 240,
  height: 300,
  rotation: -5,
  zIndex: 1,
  content: 'sanctuary-media://photo.jpg',
  caption: 'Лето',
  bg: '#ffffff',
  fontFamily: 'Caveat',
  fontSize: 24,
  tapeStyle: 'plaid',
} satisfies ScrapbookItem

describe('Journal photo presentation', () => {
  it('keeps old photographs centered inside the original captioned polaroid frame', () => {
    expect(photoPresentation(legacy)).toEqual({
      shape: 'rectangle',
      frame: 'polaroid',
      crop: { x: 0.5, y: 0.5, zoom: 1 },
    })
    expect(photoImageBounds(legacy)).toEqual({ left: 12, top: 12, width: 216, height: 246 })
    expect(photoImageBounds({ ...legacy, imageFrame: 'none', imageShape: 'circle' })).toEqual({
      left: 0,
      top: 30,
      width: 240,
      height: 240,
    })
  })

  it('covers both portrait and landscape frames at every crop edge without empty borders', () => {
    for (const source of [
      { width: 1200, height: 800 },
      { width: 800, height: 1200 },
    ]) {
      for (const viewport of [
        { width: 220, height: 280 },
        { width: 300, height: 170 },
      ]) {
        for (const zoom of [1, 1.7, 4]) {
          for (const edge of [0, 0.5, 1]) {
            const placement = imagePlacement(source, viewport, { x: edge, y: edge, zoom })
            expect(placement.left).toBeLessThanOrEqual(0.0001)
            expect(placement.top).toBeLessThanOrEqual(0.0001)
            expect(placement.left + placement.width).toBeGreaterThanOrEqual(viewport.width - 0.0001)
            expect(placement.top + placement.height).toBeGreaterThanOrEqual(
              viewport.height - 0.0001,
            )
          }
        }
      }
    }
  })

  it('drags the image in the pointer direction, clamps overscroll, and leaves an unpannable axis centered', () => {
    const viewport = { width: 200, height: 200 }
    const crop = { x: 0.5, y: 0.5, zoom: 1 }
    const original = imagePlacement({ width: 800, height: 400 }, viewport, crop)
    const moved = moveImageCrop(crop, 40, -50, original, viewport)
    expect(moved).toEqual({ x: 0.3, y: 0.5, zoom: 1 })
    expect(imagePlacement({ width: 800, height: 400 }, viewport, moved).left - original.left).toBe(
      40,
    )
    expect(moveImageCrop(crop, -10000, 10000, original, viewport)).toEqual({
      x: 1,
      y: 0.5,
      zoom: 1,
    })
  })
})
