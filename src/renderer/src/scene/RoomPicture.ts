import * as THREE from 'three'

type PictureStatus = 'original' | 'loading' | 'custom' | 'error'
type Options = {
  load?: (url: string) => Promise<THREE.Texture>
  changed?: (status: PictureStatus, aspect?: number) => void
  error?: (error: Error) => void
  anisotropy?: number
}

/** Keep the complete photo inside the original artwork's available wall area. */
export function fitPicture(width: number, height: number, maxWidth: number, maxHeight: number) {
  if (![width, height, maxWidth, maxHeight].every((n) => Number.isFinite(n) && n > 0))
    throw new Error('Не удалось определить размер фотографии')
  const scale = Math.min(maxWidth / width, maxHeight / height)
  return { width: width * scale, height: height * scale }
}

/** Owns only the replacement texture/material; original GLB resources stay with the room. */
export class RoomPicture {
  private canvas: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  private originalMaterial: THREE.MeshStandardMaterial
  private material: THREE.MeshStandardMaterial
  private texture: THREE.Texture | null = null
  private parts: { geometry: THREE.BufferGeometry; original: Float32Array; frameOnly: boolean }[]
  private center: THREE.Vector3
  private size: THREE.Vector3
  private requested: string | null | undefined
  private generation = 0
  private disposed = false

  constructor(
    room: THREE.Object3D,
    private options: Options = {},
  ) {
    const canvas = room.getObjectByName('Mantel_PaintingCanvas')
    const matboard = room.getObjectByName('Mantel_PaintingMatboard')
    const wood = room.getObjectByName('Fireplace_MantelWood')
    if (
      !(canvas instanceof THREE.Mesh) ||
      !(canvas.material instanceof THREE.MeshStandardMaterial) ||
      !(matboard instanceof THREE.Mesh) ||
      !(wood instanceof THREE.Mesh)
    )
      throw new Error('Не найдена рама картины в комнате')
    this.canvas = canvas
    this.originalMaterial = canvas.material
    this.material = canvas.material.clone()
    this.material.name = 'Personal_Picture'
    this.material.map = null
    this.material.roughness = 0.85
    canvas.geometry.computeBoundingBox()
    this.center = canvas.geometry.boundingBox!.getCenter(new THREE.Vector3())
    this.size = canvas.geometry.boundingBox!.getSize(new THREE.Vector3())
    this.parts = [canvas, matboard, wood].map((mesh) => ({
      geometry: mesh.geometry,
      original: new Float32Array(mesh.geometry.getAttribute('position').array),
      frameOnly: mesh === wood,
    }))
  }

  private resize(width: number, height: number) {
    // Preserve the thickness of the frame and matboard instead of stretching them.
    const remap = (value: number, center: number, previous: number, next: number) => {
      const distance = value - center
      return (
        center +
        (Math.abs(distance) >= previous / 2
          ? Math.sign(distance) * (Math.abs(distance) - previous / 2 + next / 2)
          : (distance * next) / previous)
      )
    }
    for (const { geometry, original, frameOnly } of this.parts) {
      const position = geometry.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < position.count; i++) {
        const x = original[i * 3],
          y = original[i * 3 + 1],
          z = original[i * 3 + 2]
        // The GLB joins the four wooden rails with the mantel. Its frame starts at
        // y=1.5075, while every mantel vertex is at or below y=1.28 (tested on GLB).
        if (!frameOnly || y > 1.4)
          position.setXYZ(
            i,
            remap(x, this.center.x, this.size.x, width),
            remap(y, this.center.y, this.size.y, height),
            z,
          )
      }
      position.needsUpdate = true
      geometry.computeBoundingBox()
      geometry.computeBoundingSphere()
    }
  }

  private restore() {
    this.canvas.material = this.originalMaterial
    this.material.map = null
    this.texture?.dispose()
    this.texture = null
    for (const { geometry, original } of this.parts) {
      const position = geometry.getAttribute('position') as THREE.BufferAttribute
      position.copyArray(original)
      position.needsUpdate = true
      geometry.computeBoundingBox()
      geometry.computeBoundingSphere()
    }
  }

  async setPhoto(url: string | null): Promise<void> {
    if (this.disposed || this.requested === url) return
    this.requested = url
    const generation = ++this.generation
    if (!url) {
      this.restore()
      this.options.changed?.('original')
      return
    }
    this.options.changed?.('loading')
    let texture: THREE.Texture | undefined
    try {
      texture = await (this.options.load ?? ((src) => new THREE.TextureLoader().loadAsync(src)))(
        url,
      )
      if (this.disposed || generation !== this.generation) {
        texture.dispose()
        return
      }
      const image = texture.image as { width: number; height: number }
      const fitted = fitPicture(image.width, image.height, this.size.x, this.size.y)
      texture.colorSpace = THREE.SRGBColorSpace
      // The original GLB canvas has v=0 at the top (unlike a Three.js PlaneGeometry).
      texture.flipY = false
      texture.anisotropy = this.options.anisotropy ?? 1
      texture.needsUpdate = true
      this.resize(fitted.width, fitted.height)
      this.texture?.dispose()
      this.texture = texture
      this.material.map = texture
      this.material.needsUpdate = true
      this.canvas.material = this.material
      this.options.changed?.('custom', image.width / image.height)
    } catch {
      texture?.dispose()
      if (this.disposed || generation !== this.generation) return
      this.restore()
      this.options.changed?.('error')
      this.options.error?.(
        new Error('Не удалось открыть фотографию над камином. Выберите её заново в настройках.'),
      )
    }
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.generation++
    this.restore()
    this.material.dispose()
  }
}
