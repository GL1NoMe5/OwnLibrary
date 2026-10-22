import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createCatPickTarget } from '../../src/renderer/src/scene/catPickTarget'

describe('cat interaction target', () => {
  it('encloses the model and follows later root transformations without drawing a mesh', () => {
    const cat = new THREE.Group()
    cat.position.set(-0.36, 0.056, -0.52)
    cat.rotation.y = 0.25
    const geometry = new THREE.BoxGeometry(0.32, 0.12, 0.28)
    const vertexCount = geometry.getAttribute('position').count
    geometry.setAttribute(
      'skinIndex',
      new THREE.Uint16BufferAttribute(new Uint16Array(vertexCount * 4), 4),
    )
    const weights = new Float32Array(vertexCount * 4)
    for (let i = 0; i < vertexCount; i++) weights[i * 4] = 1
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4))
    const body = new THREE.SkinnedMesh(geometry)
    const bone = new THREE.Bone()
    body.add(bone)
    body.bind(new THREE.Skeleton([bone]))
    body.position.set(0.01, 0.06, 0.02)
    const fur = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.13, 0.29))
    fur.position.copy(body.position)
    cat.add(body, fur)
    const target = createCatPickTarget(cat)
    expect(target.visible).toBe(false)
    expect(target.geometry.index!.count).toBe(36)
    expect(target.parent).toBe(cat)

    cat.position.set(1, 2, 3)
    cat.rotation.set(0.1, -0.4, 0.2)
    cat.scale.set(1.2, 0.8, 1.1)
    cat.updateWorldMatrix(true, true)
    const targetInverse = target.matrixWorld.clone().invert()
    target.geometry.computeBoundingBox()
    for (const mesh of [body, fur]) {
      const positions = mesh.geometry.getAttribute('position')
      for (let i = 0; i < positions.count; i++) {
        const vertex = new THREE.Vector3()
          .fromBufferAttribute(positions, i)
          .applyMatrix4(mesh.matrixWorld)
          .applyMatrix4(targetInverse)
        expect(target.geometry.boundingBox!.containsPoint(vertex)).toBe(true)
      }
    }
  })

  it('keeps nearer objects first, misses outside the cat, and never raycasts its detailed meshes', () => {
    const cat = new THREE.Group()
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 64, 32))
    cat.add(body)
    const detailedRaycast = vi.spyOn(body, 'raycast')
    const target = createCatPickTarget(cat)
    const nearBook = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03))
    nearBook.position.z = 0.3
    const farRadio = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03))
    farRadio.position.z = -0.3
    cat.updateWorldMatrix(true, true)
    nearBook.updateWorldMatrix(true, false)
    farRadio.updateWorldMatrix(true, false)
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1))
    expect(ray.intersectObjects([target, farRadio, nearBook], true)[0].object).toBe(nearBook)
    expect(ray.intersectObjects([farRadio, target], true)[0].object).toBe(target)
    ray.ray.origin.x = 0.3
    expect(ray.intersectObjects([target, farRadio, nearBook], true)).toHaveLength(0)
    expect(detailedRaycast).not.toHaveBeenCalled()
  })
})
