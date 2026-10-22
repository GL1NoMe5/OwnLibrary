import * as THREE from 'three'

/** Keep pointer tests independent of the dense groom and skinned cat geometry. */
export function createCatPickTarget(cat: THREE.Object3D): THREE.Mesh {
  cat.updateWorldMatrix(true, false)
  // SkinnedMesh updates its bind-matrix inverse in updateMatrixWorld.
  cat.updateMatrixWorld(true)
  const inverse = cat.matrixWorld.clone().invert()
  const bounds = new THREE.Box3()
  cat.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    let box: THREE.Box3 | null
    if (object instanceof THREE.SkinnedMesh) {
      object.computeBoundingBox()
      box = object.boundingBox
    } else {
      object.geometry.computeBoundingBox()
      box = object.geometry.boundingBox
    }
    if (box) bounds.union(box.clone().applyMatrix4(inverse.clone().multiply(object.matrixWorld)))
  })
  // The existing clips move the chest and ear by less than four millimetres.
  bounds.expandByScalar(0.004)
  const size = bounds.getSize(new THREE.Vector3())
  const target = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y, size.z),
    new THREE.MeshBasicMaterial(),
  )
  target.name = 'Cat_PickTarget'
  target.position.copy(bounds.getCenter(new THREE.Vector3()))
  target.visible = false
  cat.add(target)
  return target
}
