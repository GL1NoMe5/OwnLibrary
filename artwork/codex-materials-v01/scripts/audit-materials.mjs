/** Read-only GLB regression audit. Optional arguments: baseline candidate report. */
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { inflateSync } from 'node:zlib'
import { dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
// The previous published room already exists in Git LFS; no duplicate GLB is kept.
const baselineHash = '0af03ce4f0488f35ba954903cc435eb725c50259f32e5e331a7cdfd7c56a6f72'
const baselinePath = process.argv[2] ?? execFileSync('git', [
  'rev-parse', '--git-path', `lfs/objects/${baselineHash.slice(0, 2)}/${baselineHash.slice(2, 4)}/${baselineHash}`,
], { cwd: root, encoding: 'utf8' }).trim()
const beforePath = resolve(root, baselinePath)
const afterPath = resolve(root, process.argv[3] ?? 'src/renderer/public/room/sanctuary-room.glb')
const reportPath = resolve(root, process.argv[4] ?? 'artwork/codex-materials-v01/previews/material-audit.json')
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const stable = (v) => JSON.stringify(v, (_key, item) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
    : item)
const errors = []
function check(condition, message) { if (!condition) errors.push(message) }

function glb(path) {
  const bytes = readFileSync(path)
  if (bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length)
    throw new Error(`Invalid GLB: ${path}`)
  let json, bin
  for (let offset = 12; offset < bytes.length;) {
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4)
    const chunk = bytes.subarray(offset + 8, offset + 8 + length)
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'))
    if (type === 0x004e4942) bin = chunk
    offset += length + 8
  }
  if (!json || !bin) throw new Error(`Missing GLB chunks: ${path}`)
  return { bytes, json, bin }
}
const before = glb(beforePath), after = glb(afterPath)

function accessor(g, index) {
  const a = g.json.accessors[index]
  if (a.sparse) throw new Error('Sparse accessor needs explicit audit support')
  const view = g.json.bufferViews[a.bufferView]
  const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type]
  const componentBytes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[a.componentType]
  if (!components || !componentBytes) throw new Error(`Unsupported accessor ${a.type}/${a.componentType}`)
  const width = components * componentBytes, packed = Buffer.alloc(a.count * width)
  const start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0)
  for (let i = 0; i < a.count; i++) {
    const offset = start + i * (view.byteStride ?? width)
    g.bin.copy(packed, i * width, offset, offset + width)
  }
  const { bufferView, byteOffset, ...metadata } = a
  return { ...metadata, sha256: sha(packed) }
}
function image(g, index) {
  const im = g.json.images[index]
  if (im.uri || im.bufferView === undefined) throw new Error(`External image: ${im.name}`)
  const view = g.json.bufferViews[im.bufferView]
  const data = g.bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
  return { data, mimeType: im.mimeType, sha256: sha(data), name: im.name }
}
function texture(g, index) {
  const tex = g.json.textures[index], im = image(g, tex.source)
  return {
    image: { mimeType: im.mimeType, sha256: im.sha256 },
    sampler: { wrapS: 10497, wrapT: 10497, ...g.json.samplers?.[tex.sampler] },
    extensions: tex.extensions,
  }
}
function material(g, index) {
  function replace(value, key = '') {
    if (!value || typeof value !== 'object') return value
    if (Array.isArray(value)) return value.map((v) => replace(v))
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k,
      k === 'index' && key.endsWith('Texture') ? texture(g, v) : replace(v, k),
    ]))
  }
  return replace(g.json.materials[index])
}
function primitives(g, node) {
  if (node.mesh === undefined) return null
  return g.json.meshes[node.mesh].primitives.map((p) => ({
    mode: p.mode ?? 4,
    attributes: Object.fromEntries(Object.entries(p.attributes).map(([k, v]) => [k, accessor(g, v)])),
    indices: p.indices === undefined ? null : accessor(g, p.indices),
    targets: p.targets?.map((t) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, accessor(g, v)]))),
    material: g.json.materials[p.material]?.name,
    extensions: p.extensions,
  }))
}
function nodeContract(g, n) {
  const { mesh, camera, children, ...other } = n
  return { ...other,
    children: children?.map((i) => g.json.nodes[i].name),
    camera: camera === undefined ? undefined : g.json.cameras[camera],
    mesh: mesh === undefined ? undefined : g.json.meshes[mesh].name,
  }
}
check(before.json.nodes.length === after.json.nodes.length, 'Node count changed')
check(before.json.meshes.length === after.json.meshes.length, 'Mesh count changed')
const geometry = []
for (const node of before.json.nodes) {
  const candidate = after.json.nodes.find((n) => n.name === node.name)
  check(Boolean(candidate), `Missing node: ${node.name}`)
  if (!candidate) continue
  const contractEqual = stable(nodeContract(before, node)) === stable(nodeContract(after, candidate))
  const geometryEqual = stable(primitives(before, node)) === stable(primitives(after, candidate))
  check(contractEqual, `Node transform/hierarchy/camera/metadata changed: ${node.name}`)
  check(geometryEqual, `Geometry or material assignment changed: ${node.name}`)
  if (node.mesh !== undefined) geometry.push({ name: node.name, identical: contractEqual && geometryEqual })
}

const permitted = /^(Mat_Fabric.*|Mat_Holiday_Knit|Mat_Ceramic.*|Mat_Window_NightGlass)$/
const materials = []
check(before.json.materials.length === after.json.materials.length, 'Material count changed')
for (const [index, m] of before.json.materials.entries()) {
  const nextIndex = after.json.materials.findIndex((v) => v.name === m.name)
  check(nextIndex >= 0, `Missing material: ${m.name}`)
  if (nextIndex < 0) continue
  const changed = stable(material(before, index)) !== stable(material(after, nextIndex))
  check(!changed || permitted.test(m.name), `Unexpected material or image change: ${m.name}`)
  materials.push({ name: m.name, changed, permitted: permitted.test(m.name) })
}

// Decode exported PNG data channels, including row filters; no image library needed.
function png(data) {
  const width = data.readUInt32BE(16), height = data.readUInt32BE(20)
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[data[25]]
  if (data[24] !== 8 || !channels || data[28] !== 0) throw new Error('Unsupported PNG data-map format')
  const idat = []
  for (let offset = 8; offset < data.length;) {
    const length = data.readUInt32BE(offset)
    if (data.toString('ascii', offset + 4, offset + 8) === 'IDAT') idat.push(data.subarray(offset + 8, offset + 8 + length))
    offset += length + 12
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = width * channels, pixels = Buffer.alloc(stride * height)
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
  }
  for (let y = 0; y < height; y++) {
    const type = raw[y * (stride + 1)], row = y * stride
    if (type > 4) throw new Error(`Invalid PNG filter ${type}`)
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? pixels[row + x - channels] : 0
      const b = y ? pixels[row + x - stride] : 0
      const c = y && x >= channels ? pixels[row + x - stride - channels] : 0
      const prediction = type === 0 ? 0 : type === 1 ? a : type === 2 ? b : type === 3 ? Math.floor((a + b) / 2) : paeth(a, b, c)
      pixels[row + x] = (raw[y * (stride + 1) + 1 + x] + prediction) & 255
    }
  }
  let count = 0, sum = 0, min = 1, max = 0, lengthMin = Infinity, lengthMax = 0
  for (let pixel = 0; pixel < width * height; pixel += 101) {
    const offset = pixel * channels, green = pixels[offset + (channels >= 3 ? 1 : 0)] / 255
    min = Math.min(min, green); max = Math.max(max, green); sum += green; count++
    if (channels >= 3) {
      const length = Math.hypot(...[0, 1, 2].map((i) => pixels[offset + i] / 255 * 2 - 1))
      lengthMin = Math.min(lengthMin, length); lengthMax = Math.max(lengthMax, length)
    }
  }
  return { width, height, channels, sampledPixels: count, green: { min, max, mean: sum / count }, normalLength: { min: lengthMin, max: lengthMax } }
}
const mapCache = new Map()
function mapStats(info) {
  if (!info) return null
  const im = image(after, after.json.textures[info.index].source)
  if (!mapCache.has(im.sha256)) mapCache.set(im.sha256, png(im.data))
  return { name: im.name, sha256: im.sha256, scale: info.scale ?? 1, transform: info.extensions?.KHR_texture_transform,
    ...mapCache.get(im.sha256) }
}
const changedMaterials = []
for (const m of after.json.materials.filter((v) => permitted.test(v.name))) {
  const sheen = m.extensions?.KHR_materials_sheen
  if (/^Mat_Fabric|^Mat_Holiday_Knit$/.test(m.name)) {
    check(Boolean(sheen), `Missing sheen: ${m.name}`)
    check(sheen?.sheenColorFactor?.every((v) => v >= 0 && v <= 0.160001), `Excessive sheen: ${m.name}`)
    check(sheen?.sheenRoughnessFactor >= 0.75, `Excessively glossy sheen: ${m.name}`)
  }
  const normal = mapStats(m.normalTexture), roughness = mapStats(m.pbrMetallicRoughness?.metallicRoughnessTexture)
  if (normal) {
    check(normal.normalLength.min > 0.97 && normal.normalLength.max < 1.03, `Invalid normal map channels: ${m.name}`)
    check(normal.scale > 0 && normal.scale <= 1, `Invalid normal scale: ${m.name}`)
  }
  if (roughness) check(roughness.green.min > 0 && roughness.green.max < 1 && roughness.green.max > roughness.green.min,
    `Invalid/flat roughness green channel: ${m.name}`)
  changedMaterials.push({ name: m.name, sheen, normal, roughness, extensions: m.extensions, pbrFactors: {
    baseColorFactor: m.pbrMetallicRoughness?.baseColorFactor,
    metallicFactor: m.pbrMetallicRoughness?.metallicFactor ?? 1,
    roughnessFactor: m.pbrMetallicRoughness?.roughnessFactor ?? 1,
  } })
}
for (const [name, repeat] of [['Mat_Fabric_Rug', 4], ['Mat_Ceramic_Cream', 2], ['Mat_Ceramic_Pot', 3]]) {
  const m = changedMaterials.find((v) => v.name === name)
  for (const channel of ['normal', 'roughness']) check(m?.[channel]?.transform?.scale?.every((v) => v === repeat),
    `Missing ${repeat}x texture repeat: ${name}/${channel}`)
}
const catPath = 'src/renderer/public/room/sanctuary-cat.glb'
const catSha = sha(readFileSync(resolve(root, catPath)))
const catPointer = execFileSync('git', ['show', `HEAD:${catPath}`], { cwd: root, encoding: 'utf8' })
const expectedCatSha = /oid sha256:([a-f0-9]{64})/.exec(catPointer)?.[1]
check(Boolean(expectedCatSha) && catSha === expectedCatSha, 'Cat GLB differs from committed LFS object')

const summary = (g) => ({ bytes: g.bytes.length, sha256: sha(g.bytes), nodes: g.json.nodes.length,
  meshes: g.json.meshes.length, materials: g.json.materials.length, images: g.json.images.length,
  vertices: g.json.meshes.reduce((sum, m) => sum + m.primitives.reduce((n, p) => n + g.json.accessors[p.attributes.POSITION].count, 0), 0),
  triangles: g.json.meshes.reduce((sum, m) => sum + m.primitives.reduce((n, p) => n + (p.indices === undefined ? g.json.accessors[p.attributes.POSITION].count : g.json.accessors[p.indices].count) / 3, 0), 0),
  extensionsUsed: g.json.extensionsUsed,
})
const report = {
  passed: errors.length === 0, errors,
  before: { path: relative(root, beforePath), ...summary(before) },
  after: { path: relative(root, afterPath), ...summary(after) },
  geometry,
  protectedPictureAndFireplace: geometry.filter((v) => /Picture|Painting|Mantel|Fireplace/.test(v.name)),
  materials,
  unchangedWoodMaterials: materials.filter((v) => v.name.startsWith('Mat_Wood')),
  changedMaterials,
  cat: { path: catPath, sha256: catSha, expectedSha256: expectedCatSha, unchanged: catSha === expectedCatSha },
}
writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ passed: report.passed, errors, before: report.before, after: report.after,
  changedMaterials: materials.filter((m) => m.changed).map((m) => m.name), catUnchanged: report.cat.unchanged,
  report: relative(root, reportPath) }, null, 2))
if (errors.length) process.exitCode = 1
