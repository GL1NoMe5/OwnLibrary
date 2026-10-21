// glTF supports normalized unsigned-byte vertex colors natively. Compact only
// those attributes; retain all positions, normals, UVs and original PBR images.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const file = resolve(process.argv[2] ?? 'src/renderer/public/room/sanctuary-room.glb')
const bytes = readFileSync(file)
if (bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2)
  throw new Error('Expected GLB 2.0')
const jsonLength = bytes.readUInt32LE(12)
const json = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength))
const binaryStart = 20 + jsonLength + 8
if (json.buffers.length !== 1 || json.buffers[0].uri)
  throw new Error('Expected one embedded buffer')
const replacements = new Map()
const colors = new Set()
for (const mesh of json.meshes)
  for (const primitive of mesh.primitives)
    if (primitive.attributes.COLOR_0 !== undefined) colors.add(primitive.attributes.COLOR_0)
for (const index of colors) {
  const accessor = json.accessors[index]
  if (accessor.componentType !== 5126) continue
  if (!['VEC3', 'VEC4'].includes(accessor.type) || accessor.sparse)
    throw new Error('Unexpected color layout')
  const components = accessor.type === 'VEC3' ? 3 : 4
  const view = json.bufferViews[accessor.bufferView]
  const compact = Buffer.alloc(accessor.count * components)
  for (let vertex = 0; vertex < accessor.count; vertex++)
    for (let channel = 0; channel < components; channel++) {
      const value = bytes.readFloatLE(
        binaryStart +
          (view.byteOffset ?? 0) +
          (accessor.byteOffset ?? 0) +
          vertex * (view.byteStride ?? components * 4) +
          channel * 4,
      )
      compact[vertex * components + channel] = Math.round(Math.max(0, Math.min(1, value)) * 255)
    }
  const replacement = json.bufferViews.length
  json.bufferViews.push({ buffer: 0, byteLength: compact.length, target: 34962 })
  replacements.set(replacement, compact)
  accessor.bufferView = replacement
  accessor.byteOffset = 0
  accessor.componentType = 5121
  accessor.normalized = true
  delete accessor.min
  delete accessor.max
}
const referenced = new Set()
for (const accessor of json.accessors) {
  if (accessor.bufferView !== undefined) referenced.add(accessor.bufferView)
  if (accessor.sparse) {
    referenced.add(accessor.sparse.indices.bufferView)
    referenced.add(accessor.sparse.values.bufferView)
  }
}
for (const image of json.images ?? [])
  if (image.bufferView !== undefined) referenced.add(image.bufferView)
const chunks = [],
  views = [],
  remap = new Map()
let offset = 0
for (const index of [...referenced].sort((a, b) => a - b)) {
  const view = json.bufferViews[index]
  const data =
    replacements.get(index) ??
    bytes.subarray(
      binaryStart + (view.byteOffset ?? 0),
      binaryStart + (view.byteOffset ?? 0) + view.byteLength,
    )
  const padding = (4 - (offset % 4)) % 4
  if (padding) {
    chunks.push(Buffer.alloc(padding))
    offset += padding
  }
  remap.set(index, views.length)
  views.push({ ...view, byteOffset: offset, byteLength: data.length })
  chunks.push(data)
  offset += data.length
}
for (const accessor of json.accessors) {
  if (accessor.bufferView !== undefined) accessor.bufferView = remap.get(accessor.bufferView)
  if (accessor.sparse) {
    accessor.sparse.indices.bufferView = remap.get(accessor.sparse.indices.bufferView)
    accessor.sparse.values.bufferView = remap.get(accessor.sparse.values.bufferView)
  }
}
for (const image of json.images ?? [])
  if (image.bufferView !== undefined) image.bufferView = remap.get(image.bufferView)
json.bufferViews = views
json.buffers[0].byteLength = offset
if (offset % 4) chunks.push(Buffer.alloc(4 - (offset % 4)))
const binary = Buffer.concat(chunks)
let encoded = Buffer.from(JSON.stringify(json))
encoded = Buffer.concat([encoded, Buffer.alloc((4 - (encoded.length % 4)) % 4, 0x20)])
const header = Buffer.alloc(20)
header.write('glTF')
header.writeUInt32LE(2, 4)
header.writeUInt32LE(28 + encoded.length + binary.length, 8)
header.writeUInt32LE(encoded.length, 12)
header.write('JSON', 16)
const binHeader = Buffer.alloc(8)
binHeader.writeUInt32LE(binary.length)
binHeader.write('BIN\0', 4)
const result = Buffer.concat([header, encoded, binHeader, binary])
writeFileSync(file, result)
console.log(
  `Vertex colors compacted: ${bytes.length} -> ${result.length} bytes; PBR images unchanged`,
)
