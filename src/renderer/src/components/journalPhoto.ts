import type { ImageCrop, ImageShape, ScrapbookItem } from '../../../shared/types'

export type Size = { width: number; height: number }
export type ImageBounds = Size & { left: number; top: number }
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value))

export function photoPresentation(item: ScrapbookItem) {
  return {
    shape: item.imageShape ?? 'rectangle',
    frame: item.imageFrame ?? 'polaroid',
    crop: {
      x: clamp(item.imageCrop?.x ?? 0.5, 0, 1),
      y: clamp(item.imageCrop?.y ?? 0.5, 0, 1),
      zoom: clamp(item.imageCrop?.zoom ?? 1, 1, 4),
    },
  }
}

/** Bounds are in the same 600 × 800 page coordinates as the saved object. */
export function photoImageBounds(item: ScrapbookItem): ImageBounds {
  const { frame, shape } = photoPresentation(item)
  const inset = frame === 'polaroid' ? 12 : frame === 'paper' ? 8 : 0
  const bottom = frame === 'polaroid' ? item.fontSize + 18 : inset
  const bounds = {
    left: inset,
    top: inset,
    width: Math.max(1, item.width - inset * 2),
    height: Math.max(1, item.height - inset - bottom),
  }
  if (shape === 'circle') {
    const diameter = Math.min(bounds.width, bounds.height)
    bounds.left += (bounds.width - diameter) / 2
    bounds.top += (bounds.height - diameter) / 2
    bounds.width = bounds.height = diameter
  }
  return bounds
}

export function imagePlacement(source: Size, viewport: Size, crop: ImageCrop): ImageBounds {
  const scale = Math.max(viewport.width / source.width, viewport.height / source.height) * crop.zoom
  const width = source.width * scale
  const height = source.height * scale
  return {
    width,
    height,
    left: (viewport.width - width) * clamp(crop.x, 0, 1),
    top: (viewport.height - height) * clamp(crop.y, 0, 1),
  }
}

/** Pointer deltas are converted to logical image coordinates before this call. */
export function moveImageCrop(
  crop: ImageCrop,
  dx: number,
  dy: number,
  placement: Size,
  viewport: Size,
): ImageCrop {
  const overflowX = placement.width - viewport.width
  const overflowY = placement.height - viewport.height
  return {
    ...crop,
    x: overflowX > 0.001 ? clamp(crop.x - dx / overflowX, 0, 1) : 0.5,
    y: overflowY > 0.001 ? clamp(crop.y - dy / overflowY, 0, 1) : 0.5,
  }
}

const tornEdge =
  'polygon(0.7% 1.1%, 5% 0.4%, 9% 1.2%, 14% 0.3%, 19% 1%, 24% 0%, 30% 1.1%, 35% 0.5%, 40% 1.3%, 46% 0.2%, 52% 1%, 57% 0.3%, 63% 1.1%, 69% 0.2%, 75% 1%, 81% 0.4%, 87% 1.2%, 93% 0%, 99% 0.8%, 99.5% 8%, 98.8% 15%, 99.7% 22%, 98.9% 30%, 99.6% 39%, 99% 46%, 99.8% 54%, 98.8% 63%, 99.6% 71%, 99% 79%, 99.8% 88%, 99% 99%, 93% 99.5%, 87% 98.8%, 81% 99.8%, 75% 99%, 69% 99.6%, 63% 98.8%, 57% 99.8%, 52% 99%, 46% 99.5%, 40% 98.8%, 35% 99.7%, 30% 99%, 24% 99.5%, 19% 98.8%, 14% 99.7%, 9% 99%, 5% 99.6%, 0.5% 99%, 1.2% 91%, 0.3% 84%, 1% 76%, 0.2% 68%, 1.1% 60%, 0.4% 52%, 1.2% 44%, 0.3% 36%, 1% 28%, 0% 20%, 1% 12%)'
const cutoutEdge =
  'polygon(7% 3%, 27% 0%, 48% 4%, 73% 1%, 94% 8%, 100% 30%, 95% 51%, 98% 76%, 86% 95%, 62% 100%, 40% 96%, 17% 99%, 2% 85%, 5% 60%, 0% 37%)'

export function imageShapeClip(shape: ImageShape): string {
  switch (shape) {
    case 'rounded':
      return 'inset(0 round 7%)'
    case 'circle':
      return 'circle(closest-side at 50% 50%)'
    case 'oval':
      return 'ellipse(50% 50% at 50% 50%)'
    case 'torn':
      return tornEdge
    case 'cutout':
      return cutoutEdge
    default:
      return 'inset(0)'
  }
}
