import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { roomPlacements } from '../../src/renderer/src/scene/layout'
import manifest from '../../src/renderer/src/scene/manifest.json'
import { bookWidth, placeBook } from '../../src/shared/statistics'
import type { Book } from '../../src/shared/types'

const base: Book = {
  id: 'a',
  title: 'Книга',
  author: 'Автор',
  status: 'READ',
  rating: null,
  pages: null,
  spineColor: '#654321',
  coverColor: '#654321',
  goldFoil: true,
  coverUrl: null,
  cabinet: 0,
  shelf: 0,
  slot: 0,
  collectionPage: 0,
  finishedAt: null,
  favoriteQuote: '',
  isDemo: false,
}
describe('Blender room contract', () => {
  it('uses the application width, sorted sparse slots, and a separate page for the same shelves', () => {
    const books = [
      { ...base, id: 'late', slot: 12, pages: 1000 },
      { ...base, id: 'early', slot: 2 },
      { ...base, id: 'other-page', collectionPage: 1 },
      { ...base, id: 'wishlist', status: 'WISHLIST' as const },
    ]
    const result = roomPlacements(books, 0)
    expect(result.map((p) => p.book.id)).toEqual(['early', 'late'])
    expect(result[0].width).toBeCloseTo(bookWidth(null) * 0.5)
    expect(result[1].position[0] - result[1].width / 2).toBeCloseTo(
      result[0].position[0] + result[0].width / 2 + 0.015 * 0.5,
    )
    expect(roomPlacements(books, 1).map((p) => p.book.id)).toEqual(['other-page'])
  })
  it('keeps 1000 allocated books inside their actual Blender niches without overlap', () => {
    const books: Book[] = []
    for (let i = 0; i < 1000; i++) {
      const pages = i % 8 === 0 ? null : (i * 71) % 2000
      books.push({ ...base, id: String(i), pages, ...placeBook(books, i % 2, i % 4, pages) })
    }
    for (let page = 0; page <= Math.max(...books.map((b) => b.collectionPage)); page++) {
      const placements = roomPlacements(books, page)
      for (const zone of manifest.shelfZones) {
        let previousRight = zone.origin[0]
        for (const p of placements.filter(
          (p) => p.book.cabinet === zone.cabinet && p.book.shelf === zone.shelf,
        )) {
          const left = p.position[0] - p.width / 2,
            right = p.position[0] + p.width / 2
          expect(left + 1e-8).toBeGreaterThanOrEqual(previousRight)
          expect(right).toBeLessThanOrEqual(zone.origin[0] + zone.widthMeters + 1e-8)
          expect(p.position[1] - p.height / 2).toBeCloseTo(zone.bookBaselineY)
          expect(p.height).toBeLessThan(zone.heightMeters)
          expect(p.position[2] - p.depth / 2).toBeGreaterThan(zone.origin[2] - zone.depthMeters)
          expect(p.position[2] + p.depth / 2).toBeLessThan(zone.origin[2])
          previousRight = right
        }
      }
    }
  })
  it('exports one fireplace frame instead of intersecting piers and lintel', () => {
    const bytes = readFileSync('src/renderer/public/room/sanctuary-room.glb')
    const jsonLength = bytes.readUInt32LE(12)
    const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength))
    const node = gltf.nodes.find(
      (node: { name: string }) => node.name === 'Fireplace_StoneSurround',
    )
    const primitives = gltf.meshes[node.mesh].primitives
    expect(primitives).toHaveLength(1)
    const primitive = primitives[0]
    const positions = gltf.accessors[primitive.attributes.POSITION]
    const positionView = gltf.bufferViews[positions.bufferView]
    const indices = gltf.accessors[primitive.indices]
    const indexView = gltf.bufferViews[indices.bufferView]
    expect(positions.componentType).toBe(5126)
    expect([5123, 5125]).toContain(indices.componentType)
    const binaryStart = 28 + jsonLength
    const parent: number[] = []
    const welded = new Map<string, number>()
    const vertices: number[] = []
    for (let i = 0; i < positions.count; i++) {
      const offset =
        binaryStart +
        positionView.byteOffset +
        (positions.byteOffset ?? 0) +
        i * (positionView.byteStride ?? 12)
      // UV seams and hard normals split GLB vertices at the same position.
      const key = [0, 4, 8].map((axis) => bytes.readFloatLE(offset + axis).toFixed(5)).join(',')
      if (!welded.has(key)) {
        welded.set(key, parent.length)
        parent.push(parent.length)
      }
      vertices.push(welded.get(key)!)
    }
    function root(index: number): number {
      while (parent[index] !== index) index = parent[index]
      return index
    }
    const indexSize = indices.componentType === 5123 ? 2 : 4
    const indexStart = binaryStart + indexView.byteOffset + (indices.byteOffset ?? 0)
    const readIndex = (index: number) =>
      vertices[
        indexSize === 2
          ? bytes.readUInt16LE(indexStart + index * indexSize)
          : bytes.readUInt32LE(indexStart + index * indexSize)
      ]
    for (let i = 0; i < indices.count; i += 3) {
      const a = root(readIndex(i))
      parent[root(readIndex(i + 1))] = a
      parent[root(readIndex(i + 2))] = a
    }
    // Hearth, unified U-shaped frame, chimney. The old overlapping model had five.
    expect(new Set(parent.map((_, index) => root(index))).size).toBe(3)
  })
  it('packages real GLB files with the required named nodes, textures and cat clips', () => {
    function glb(name: string) {
      const bytes = readFileSync(`src/renderer/public/room/sanctuary-${name}.glb`)
      expect(bytes.toString('ascii', 0, 4)).toBe('glTF')
      expect(bytes.readUInt32LE(8)).toBe(bytes.length)
      return JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)))
    }
    const room = glb('room'),
      cat = glb('cat')
    const nodes = room.nodes.map((node: { name: string }) => node.name)
    for (const zone of manifest.shelfZones) expect(nodes).toContain(zone.nodeName)
    for (const name of Object.keys(manifest.anchors)) expect(nodes).toContain(name)
    expect(nodes).not.toContain('PreviewBooks')
    expect(cat.animations.map((clip: { name: string }) => clip.name)).toEqual(
      expect.arrayContaining(['CAT_BREATH', 'CAT_EAR_TWITCH']),
    )
    for (const image of [...room.images, ...cat.images]) expect(image.uri).toBeUndefined()
  })
})
