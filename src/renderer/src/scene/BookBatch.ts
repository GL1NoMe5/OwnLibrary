import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Placement } from './layout'

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  lines: number,
) {
  const words = text.split(/\s+/)
  let line = '',
    row = 0
  for (const word of words) {
    if (ctx.measureText(`${line} ${word}`).width > width && line) {
      ctx.fillText(line, x, y + row++ * 21, width)
      line = word
      if (row === lines - 1) break
    } else line = line ? `${line} ${word}` : word
  }
  ctx.fillText(row === lines - 1 ? `${line}…` : line, x, y + row * 21, width)
}
async function cover(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    const timer = setTimeout(() => finish(null), 5000)
    const finish = (value: HTMLImageElement | null) => {
      clearTimeout(timer)
      image.onload = image.onerror = null
      resolve(value)
    }
    image.onload = () => finish(image)
    image.onerror = () => finish(null)
    image.src = url
  })
}

// One atlas and one draw call for all books on the current collection page.
export class BookBatch {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  private original: Float32Array
  private offsets: number[]
  private constructor(
    public placements: Placement[],
    geometry: THREE.BufferGeometry,
    texture: THREE.Texture,
  ) {
    this.mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 }),
    )
    this.mesh.name = 'LibraryBooks'
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
    this.original = new Float32Array(geometry.getAttribute('position').array)
    this.offsets = placements.map(() => 0)
    geometry.computeBoundingSphere()
    geometry.boundingSphere!.radius += 0.3
  }
  static async create(placements: Placement[]): Promise<BookBatch | null> {
    if (!placements.length) return null
    await document.fonts.ready
    const images = await Promise.all(
      placements.map(({ book }) => (book.coverUrl ? cover(book.coverUrl) : null)),
    )
    const columns = Math.ceil(Math.sqrt((placements.length * 256) / 192))
    const canvas = document.createElement('canvas')
    canvas.width = columns * 192
    canvas.height = Math.ceil(placements.length / columns) * 256
    const ctx = canvas.getContext('2d')!
    const parts: THREE.BufferGeometry[] = []
    placements.forEach((placement, i) => {
      const { book, width, height, depth, position } = placement
      const x = (i % columns) * 192,
        y = Math.floor(i / columns) * 256
      ctx.fillStyle = book.spineColor
      ctx.fillRect(x, y, 64, 256)
      ctx.fillStyle = book.goldFoil ? '#ead09a' : '#f5ebd8'
      ctx.fillRect(x + 9, y + 12, 46, 2)
      ctx.fillRect(x + 9, y + 228, 46, 2)
      ctx.save()
      ctx.translate(x + 34, y + 120)
      ctx.rotate(-Math.PI / 2)
      ctx.textAlign = 'center'
      ctx.font = '600 17px Nunito'
      ctx.fillText(book.title, 0, 0, 194)
      ctx.font = '11px Nunito'
      ctx.fillText(book.author, 0, 17, 185)
      ctx.restore()
      ctx.fillStyle = book.coverColor
      ctx.fillRect(x + 64, y, 128, 240)
      const image = images[i]
      if (image) ctx.drawImage(image, x + 64, y, 128, 240)
      else {
        ctx.strokeStyle = '#dcc59b'
        ctx.strokeRect(x + 73, y + 12, 110, 216)
        ctx.fillStyle = '#fff5df'
        ctx.textAlign = 'center'
        ctx.font = '600 19px Cormorant Garamond'
        wrap(ctx, book.title, x + 128, y + 78, 100, 4)
        ctx.font = '11px Nunito'
        ctx.fillText(book.author, x + 128, y + 200, 104)
      }
      ctx.fillStyle = '#e9dfc7'
      ctx.fillRect(x + 64, y + 240, 128, 16)
      ctx.strokeStyle = '#bdb095'
      for (let line = 243; line < 256; line += 3) {
        ctx.beginPath()
        ctx.moveTo(x + 64, y + line)
        ctx.lineTo(x + 192, y + line)
        ctx.stroke()
      }
      const geometry = new THREE.BoxGeometry(width, height, depth)
      const uv = geometry.getAttribute('uv')
      for (let vertex = 0; vertex < uv.count; vertex++) {
        const face = Math.floor(vertex / 4)
        const rect =
          face === 4
            ? [x, y, 64, 240]
            : face < 2
              ? [x + 64, y, 128, 240]
              : [x + 64, y + 240, 128, 16]
        uv.setXY(
          vertex,
          (rect[0] + uv.getX(vertex) * rect[2]) / canvas.width,
          1 - (rect[1] + (1 - uv.getY(vertex)) * rect[3]) / canvas.height,
        )
      }
      if (placement.rotation) {
        geometry.rotateZ(placement.rotation[2])
        geometry.rotateY(placement.rotation[1])
      }
      geometry.translate(...position)
      parts.push(geometry)
    })
    const geometry = mergeGeometries(parts, false)!
    parts.forEach((part) => part.dispose())
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return new BookBatch(placements, geometry, texture)
  }
  indexOfHit(hit: THREE.Intersection): number {
    return Math.floor((hit.faceIndex ?? -12) / 12)
  }
  animate(hovered: string | null, dt: number, reducedMotion: boolean): void {
    const position = this.mesh.geometry.getAttribute('position')
    let changed = false
    this.placements.forEach(({ book, position: center }, index) => {
      const target = book.id === hovered ? 1 : 0
      const previous = this.offsets[index]
      const offset = reducedMotion ? target : THREE.MathUtils.damp(previous, target, 14, dt)
      if (Math.abs(offset - previous) < 0.0001) return
      this.offsets[index] = offset
      const angle = book.status === 'OWNED' ? 0 : -offset * 0.035,
        sin = Math.sin(angle),
        cos = Math.cos(angle)
      for (let v = index * 24; v < (index + 1) * 24; v++) {
        const x = this.original[v * 3] - center[0],
          y = this.original[v * 3 + 1] - center[1]
        position.setXYZ(
          v,
          center[0] + x * cos - y * sin,
          center[1] + x * sin + y * cos,
          this.original[v * 3 + 2] + offset * (book.status === 'OWNED' ? 0.025 : 0.16),
        )
      }
      changed = true
    })
    if (changed) position.needsUpdate = true
  }
  dispose(): void {
    this.mesh.removeFromParent()
    this.mesh.geometry.dispose()
    this.mesh.material.map?.dispose()
    this.mesh.material.dispose()
  }
}
