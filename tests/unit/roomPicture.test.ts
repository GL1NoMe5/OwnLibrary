import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { RoomPicture } from '../../src/renderer/src/scene/RoomPicture'

// Read the production geometry: the frame shares a mesh with the mantel, and
// synthetic boxes would not catch accidentally deforming that unrelated wood.
function sourceGeometry() {
  const bytes = readFileSync('src/renderer/public/room/sanctuary-room.glb')
  const jsonLength = bytes.readUInt32LE(12)
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength))
  const names = ['Mantel_PaintingCanvas', 'Mantel_PaintingMatboard', 'Fireplace_MantelWood']
  const readAccessor = (id: number) => {
    const accessor = gltf.accessors[id]
    const view = gltf.bufferViews[accessor.bufferView]
    const itemSize = ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 } as Record<string, number>)[
      accessor.type
    ]
    const componentSize = accessor.componentType === 5123 ? 2 : 4
    const start = 28 + jsonLength + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
    const values: number[] = []
    for (let i = 0; i < accessor.count; i++)
      for (let component = 0; component < itemSize; component++) {
        const offset =
          start + i * (view.byteStride ?? itemSize * componentSize) + component * componentSize
        values.push(
          accessor.componentType === 5126
            ? bytes.readFloatLE(offset)
            : componentSize === 2
              ? bytes.readUInt16LE(offset)
              : bytes.readUInt32LE(offset),
        )
      }
    return { values, itemSize }
  }
  return names.map((name) => {
    const node = gltf.nodes.find((node: { name: string }) => node.name === name)
    const primitive = gltf.meshes[node.mesh].primitives[0]
    const geometry = new THREE.BufferGeometry()
    for (const [semantic, name] of [
      ['POSITION', 'position'],
      ['NORMAL', 'normal'],
      ['TEXCOORD_0', 'uv'],
      ['TANGENT', 'tangent'],
    ]) {
      const { values, itemSize } = readAccessor(primitive.attributes[semantic])
      geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, itemSize))
    }
    geometry.setIndex(readAccessor(primitive.indices).values)
    return { name, geometry }
  })
}
const originals = sourceGeometry()

function fixture() {
  const room = new THREE.Group()
  const meshes = originals.map(({ name, geometry }) => {
    const mesh = new THREE.Mesh(
      geometry.clone(),
      new THREE.MeshStandardMaterial({ map: new THREE.Texture() }),
    )
    mesh.name = name
    room.add(mesh)
    return mesh
  })
  const [canvas, matboard, wood] = meshes
  const originalMaterial = canvas.material
  const originalTextureDisposal = vi.spyOn(originalMaterial.map!, 'dispose')
  const originalMaterialDisposal = vi.spyOn(originalMaterial, 'dispose')
  const expectOriginal = () => {
    expect(canvas.material).toBe(originalMaterial)
    meshes.forEach((mesh, i) => {
      for (const name of ['position', 'normal', 'uv', 'tangent'])
        expect(mesh.geometry.getAttribute(name).array).toEqual(
          originals[i].geometry.getAttribute(name).array,
        )
    })
    expect(originalTextureDisposal).not.toHaveBeenCalled()
    expect(originalMaterialDisposal).not.toHaveBeenCalled()
  }
  return { room, meshes, canvas, matboard, wood, originalMaterial, expectOriginal }
}

function photo(width: number, height: number) {
  const texture = new THREE.Texture({ width, height })
  const disposed = vi.spyOn(texture, 'dispose')
  return { texture, disposed }
}

function bounds(mesh: THREE.Mesh, frameOnly = false) {
  const box = new THREE.Box3()
  const positions = mesh.geometry.getAttribute('position')
  for (let i = 0; i < positions.count; i++) {
    const point = new THREE.Vector3().fromBufferAttribute(positions, i)
    if (!frameOnly || point.y > 1.4) box.expandByPoint(point)
  }
  return box
}

describe('personal fireplace picture', () => {
  it('fits portrait and landscape photos without cropping or moving the actual mantel and restores the GLB exactly', async () => {
    const f = fixture()
    const portrait = photo(900, 1600),
      landscape = photo(2400, 1000)
    const load = vi
      .fn()
      .mockResolvedValueOnce(portrait.texture)
      .mockResolvedValueOnce(landscape.texture)
    const picture = new RoomPicture(f.room, { load, anisotropy: 8 })
    const woodPositions = originals[2].geometry.getAttribute('position')
    const frameIndices = Array.from({ length: woodPositions.count }, (_, i) => i).filter(
      (i) => woodPositions.getY(i) > 1.4,
    )
    expect(frameIndices).toHaveLength(448)
    const indices = f.wood.geometry.index!
    for (let i = 0; i < indices.count; i += 3) {
      const mask = [0, 1, 2].map((offset) => woodPositions.getY(indices.getX(i + offset)) > 1.4)
      expect(mask.every(Boolean) || mask.every((value) => !value)).toBe(true)
    }
    const originalBox = bounds(f.canvas)
    const originalSize = originalBox.getSize(new THREE.Vector3())
    for (const [url, image] of [
      ['portrait', portrait],
      ['landscape', landscape],
    ] as const) {
      await picture.setPhoto(url)
      const canvasBox = bounds(f.canvas),
        size = canvasBox.getSize(new THREE.Vector3())
      expect(size.x / size.y).toBeCloseTo(image.texture.image.width / image.texture.image.height, 5)
      expect(size.x).toBeLessThanOrEqual(originalSize.x + 1e-6)
      expect(size.y).toBeLessThanOrEqual(originalSize.y + 1e-6)
      expect(
        canvasBox
          .getCenter(new THREE.Vector3())
          .distanceTo(originalBox.getCenter(new THREE.Vector3())),
      ).toBeLessThan(1e-6)
      expect(bounds(f.wood, true).getSize(new THREE.Vector3()).x - size.x).toBeCloseTo(0.2, 5)
      expect(bounds(f.wood, true).getSize(new THREE.Vector3()).y - size.y).toBeCloseTo(0.165, 5)
      expect(bounds(f.matboard).getSize(new THREE.Vector3()).x - size.x).toBeCloseTo(0.12, 5)
      expect(bounds(f.matboard).getSize(new THREE.Vector3()).y - size.y).toBeCloseTo(0.08, 5)
      const positions = f.wood.geometry.getAttribute('position')
      for (let i = 0; i < woodPositions.count; i++)
        if (woodPositions.getY(i) <= 1.4)
          expect(Array.from(positions.array.slice(i * 3, i * 3 + 3))).toEqual(
            Array.from(woodPositions.array.slice(i * 3, i * 3 + 3)),
          )
      f.meshes.forEach((mesh, i) => {
        for (const name of ['normal', 'uv', 'tangent'])
          expect(mesh.geometry.getAttribute(name).array).toEqual(
            originals[i].geometry.getAttribute(name).array,
          )
      })
      expect(f.canvas.material).not.toBe(f.originalMaterial)
      expect(f.canvas.material.map).toBe(image.texture)
      expect(image.texture.flipY).toBe(false)
      expect(image.texture.colorSpace).toBe(THREE.SRGBColorSpace)
      expect(image.texture.anisotropy).toBe(8)
    }
    expect(portrait.disposed).toHaveBeenCalledTimes(1)
    await picture.setPhoto(null)
    expect(landscape.disposed).toHaveBeenCalledTimes(1)
    f.expectOriginal()
    picture.dispose()
    f.expectOriginal()
  })

  it('disposes late loads after reset, replacement, or scene disposal without showing stale photographs', async () => {
    const f = fixture()
    const pending = new Map<string, (texture: THREE.Texture) => void>()
    const changed = vi.fn(),
      error = vi.fn()
    const picture = new RoomPicture(f.room, {
      load: (url) => new Promise((resolve) => pending.set(url, resolve)),
      changed,
      error,
    })
    const reset = photo(2, 3),
      older = photo(3, 2),
      latest = photo(4, 3),
      closed = photo(2, 3)
    const resetLoad = picture.setPhoto('reset')
    await picture.setPhoto(null)
    pending.get('reset')!(reset.texture)
    await resetLoad
    expect(reset.disposed).toHaveBeenCalledTimes(1)
    f.expectOriginal()
    const olderLoad = picture.setPhoto('older'),
      latestLoad = picture.setPhoto('latest')
    pending.get('latest')!(latest.texture)
    await latestLoad
    pending.get('older')!(older.texture)
    await olderLoad
    expect(older.disposed).toHaveBeenCalledTimes(1)
    expect(f.canvas.material.map).toBe(latest.texture)
    const closedLoad = picture.setPhoto('closed')
    picture.dispose()
    pending.get('closed')!(closed.texture)
    await closedLoad
    expect(latest.disposed).toHaveBeenCalledTimes(1)
    expect(closed.disposed).toHaveBeenCalledTimes(1)
    expect(changed.mock.calls.filter(([status]) => status === 'custom')).toEqual([
      ['custom', 4 / 3],
    ])
    expect(error).not.toHaveBeenCalled()
    f.expectOriginal()
  })

  it('falls back to the original artwork on a failed or invalid image while releasing custom resources', async () => {
    const f = fixture()
    const valid = photo(3, 2),
      invalid = photo(0, 2)
    const load = vi
      .fn()
      .mockResolvedValueOnce(valid.texture)
      .mockRejectedValueOnce(new Error('missing image'))
      .mockResolvedValueOnce(invalid.texture)
    const changed = vi.fn(),
      error = vi.fn()
    const picture = new RoomPicture(f.room, { load, changed, error })
    await picture.setPhoto('valid')
    await picture.setPhoto('missing')
    expect(valid.disposed).toHaveBeenCalledTimes(1)
    f.expectOriginal()
    await picture.setPhoto('invalid')
    expect(invalid.disposed).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledTimes(2)
    expect(changed).toHaveBeenLastCalledWith('error')
    f.expectOriginal()
    picture.dispose()
  })
})
