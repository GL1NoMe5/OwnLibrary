import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createWoodThemes } from '../../src/renderer/src/scene/woodThemes'

function fixture() {
  const room = new THREE.Group()
  const palette = new THREE.Group()
  palette.name = 'WoodMaterialPalette'
  const variants = new Map<string, THREE.MeshStandardMaterial>()
  for (const species of ['Walnut', 'Oak', 'Mahogany'])
    for (const role of ['Primary', 'Floor']) {
      const material = new THREE.MeshStandardMaterial({
        map: new THREE.Texture(),
        roughnessMap: new THREE.Texture(),
        normalMap: new THREE.Texture(),
      })
      material.name = `Mat_Wood_${species}_${role}`
      variants.set(`${species}_${role}`, material)
      palette.add(new THREE.Mesh(new THREE.PlaneGeometry(), material))
    }
  const brass = new THREE.MeshStandardMaterial()
  brass.name = 'Mat_Brass'
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(), [variants.get('Walnut_Primary')!, brass])
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(), variants.get('Walnut_Floor')!)
  const logMaterial = new THREE.MeshStandardMaterial()
  logMaterial.name = 'Mat_Wood_Firewood'
  const logs = new THREE.Mesh(new THREE.CylinderGeometry(), logMaterial)
  room.add(cabinet, floor, logs, palette)
  return { room, palette, variants, cabinet, floor, logs, brass, logMaterial }
}

describe('wood PBR themes', () => {
  it('switches complete PBR materials by surface role and preserves other material slots', () => {
    const { room, variants, cabinet, floor, logs, brass, logMaterial } = fixture()
    const apply = createWoodThemes(room)
    for (const [theme, species] of [
      ['OAK', 'Oak'],
      ['MAHOGANY', 'Mahogany'],
      ['WALNUT', 'Walnut'],
    ] as const) {
      apply(theme)
      expect(cabinet.material).toEqual([variants.get(`${species}_Primary`), brass])
      expect(floor.material).toBe(variants.get(`${species}_Floor`))
      expect(logs.material).toBe(logMaterial)
      expect(cabinet.material[0].map).not.toBe(floor.material.map)
      expect(cabinet.material[0].normalMap).toBe(variants.get(`${species}_Primary`)!.normalMap)
      expect(cabinet.material[0].roughnessMap).toBe(
        variants.get(`${species}_Primary`)!.roughnessMap,
      )
    }
  })

  it('never draws or reassigns swatches and retains inactive materials for scene disposal', () => {
    const { room, palette, variants } = fixture()
    const swatches = palette.children.map((object) => (object as THREE.Mesh).material)
    const apply = createWoodThemes(room)
    apply('OAK')
    apply('MAHOGANY')
    expect(palette.visible).toBe(false)
    expect(palette.parent).toBe(room)
    expect(palette.children.map((object) => (object as THREE.Mesh).material)).toEqual(swatches)
    const visible: THREE.Object3D[] = []
    room.traverseVisible((object) => visible.push(object))
    expect(visible).not.toContain(palette)
    for (const swatch of palette.children) expect(visible).not.toContain(swatch)
    const owned = new Set<THREE.Material>()
    room.traverse((object) => {
      if (object instanceof THREE.Mesh)
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          owned.add(material)
    })
    for (const material of variants.values()) expect(owned.has(material)).toBe(true)
  })
})
