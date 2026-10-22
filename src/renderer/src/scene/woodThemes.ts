import * as THREE from 'three'
import type { RoomConfig } from '../../../shared/types'

type WoodRole = 'Primary' | 'Floor'
const species = { WALNUT: 'Walnut', OAK: 'Oak', MAHOGANY: 'Mahogany' } as const
const roles: WoodRole[] = ['Primary', 'Floor']
const woodName = /^Mat_Wood_(Walnut|Oak|Mahogany)_(Primary|Floor)$/

/** Keep every PBR variant in the hidden palette so scene disposal owns them all. */
export function createWoodThemes(room: THREE.Object3D) {
  const palette = room.getObjectByName('WoodMaterialPalette')
  if (!palette) throw new Error('В комнате отсутствует палитра материалов дерева')
  palette.visible = false
  const materials = new Map<string, THREE.MeshStandardMaterial>()
  palette.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
      if (material instanceof THREE.MeshStandardMaterial && woodName.test(material.name))
        materials.set(material.name, material)
  })
  for (const name of Object.values(species))
    for (const role of roles)
      if (!materials.has(`Mat_Wood_${name}_${role}`))
        throw new Error(`Отсутствует материал дерева ${name}/${role}`)

  const targets: {
    mesh: THREE.Mesh
    originals: THREE.Material[]
    roles: (WoodRole | null)[]
    array: boolean
  }[] = []
  function collect(object: THREE.Object3D) {
    if (object === palette) return
    if (object instanceof THREE.Mesh) {
      const array = Array.isArray(object.material)
      const originals: THREE.Material[] = array ? object.material : [object.material]
      const roles = originals.map(
        (material) => (woodName.exec(material.name)?.[2] as WoodRole | undefined) ?? null,
      )
      if (roles.some(Boolean)) targets.push({ mesh: object, originals, roles, array })
    }
    object.children.forEach(collect)
  }
  collect(room)

  return (theme: RoomConfig['woodTheme']) => {
    for (const target of targets) {
      const selected = target.originals.map((original, index) =>
        target.roles[index]
          ? materials.get(`Mat_Wood_${species[theme]}_${target.roles[index]}`)!
          : original,
      )
      target.mesh.material = target.array ? selected : selected[0]
    }
  }
}
