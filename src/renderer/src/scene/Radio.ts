import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { radioPosition } from '../../../shared/roomAudio'

export function createRadio() {
  const radio = new THREE.Group()
  radio.name = 'TableRadio'
  radio.position.set(...radioPosition)
  radio.rotation.y = -0.08
  const wood = new THREE.MeshStandardMaterial({ color: '#5d3823', roughness: 0.68 })
  const cream = new THREE.MeshStandardMaterial({ color: '#d0b993', roughness: 0.82 })
  const brass = new THREE.MeshStandardMaterial({
    color: '#b4945d',
    metalness: 0.55,
    roughness: 0.42,
  })
  const dark = new THREE.MeshStandardMaterial({ color: '#241f19', roughness: 0.94 })
  function box(
    size: [number, number, number],
    position: [number, number, number],
    material: THREE.Material,
    radius = 0.004,
  ) {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(...size, 2, radius), material)
    mesh.position.set(...position)
    mesh.castShadow = true
    mesh.receiveShadow = true
    radio.add(mesh)
    return mesh
  }
  box([0.22, 0.15, 0.09], [0, 0, 0], wood, 0.012)
  box([0.202, 0.13, 0.007], [0, 0, 0.045], brass, 0.007)
  box([0.194, 0.123, 0.008], [0, 0, 0.049], cream, 0.006)
  // Woven speaker cloth, drawn locally rather than downloaded as a texture.
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#625546'
  ctx.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 128; i += 4) {
    ctx.fillStyle = i % 8 ? '#766653' : '#887760'
    ctx.fillRect(i, 0, 1, 128)
    ctx.fillStyle = '#3e372e'
    ctx.fillRect(0, i, 128, 1)
  }
  const cloth = new THREE.CanvasTexture(canvas)
  cloth.colorSpace = THREE.SRGBColorSpace
  const grille = new THREE.MeshStandardMaterial({ map: cloth, roughness: 1 })
  box([0.119, 0.101, 0.004], [-0.027, 0, 0.055], grille)
  box([0.044, 0.025, 0.004], [0.065, 0.038, 0.055], dark, 0.002)
  for (let i = 0; i < 5; i++)
    box([0.002, 0.005 + (i % 2) * 0.003, 0.001], [0.051 + i * 0.007, 0.037, 0.058], brass, 0.0004)
  for (const y of [-0.035, 0.002]) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.014, 20), brass)
    knob.rotation.x = Math.PI / 2
    knob.position.set(0.065, y, 0.061)
    radio.add(knob)
    box([0.002, 0.008, 0.001], [0.065, y + 0.003, 0.069], dark, 0.0004)
  }
  for (const x of [-0.07, 0.07]) box([0.028, 0.007, 0.047], [x, -0.078, 0], dark, 0.002)
  const indicator = new THREE.MeshStandardMaterial({
    color: '#48633b',
    emissive: '#9ab05f',
    emissiveIntensity: 0.7,
    roughness: 0.5,
  })
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.003, 8, 6), indicator)
  led.position.set(0.083, -0.055, 0.056)
  radio.add(led)
  // A low leather carrying handle keeps the receiver's compact vintage silhouette.
  for (const x of [-0.05, 0.05]) box([0.009, 0.018, 0.009], [x, 0.079, -0.01], dark)
  box([0.109, 0.009, 0.01], [0, 0.087, -0.01], dark)
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>()
  for (const child of [...radio.children]) {
    const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.Material>
    mesh.updateMatrix()
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
    geometry.applyMatrix4(mesh.matrix)
    const geometries = batches.get(mesh.material) ?? []
    geometries.push(geometry)
    batches.set(mesh.material, geometries)
    mesh.geometry.dispose()
    radio.remove(mesh)
  }
  for (const [material, geometries] of batches) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries)!, material)
    mesh.castShadow = mesh.receiveShadow = true
    radio.add(mesh)
    geometries.forEach((geometry) => geometry.dispose())
  }
  return { root: radio, indicator }
}
