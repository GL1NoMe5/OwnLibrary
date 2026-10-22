import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import type { Pass } from 'three/addons/postprocessing/Pass.js'
import type { Book, RoomConfig } from '../../../shared/types'
import { BookBatch } from './BookBatch'
import { roomPlacements } from './layout'
import manifest from './manifest.json'
import { createRadio } from './Radio'
import { createCatPickTarget } from './catPickTarget'
import { createWoodThemes } from './woodThemes'

const cameras = {
  ...manifest.cameras,
  STACK: { position: [0.55, 1.05, 1.05], target: [0.55, 0.18, -0.48], fovDegrees: 42 },
}
export type CameraPreset = keyof typeof cameras
type Callbacks = {
  ready: () => void
  select: (book: Book | null) => void
  camera: (preset: CameraPreset) => void
  open: (id: string) => void
  cat: () => void
  radio: () => void
  listener: (position: number[], forward: number[]) => void
  error: (error: unknown) => void
}

function disposeTree(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (mesh.geometry) geometries.add(mesh.geometry)
    if (mesh.material)
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        materials.add(material)
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) textures.add(value)
      }
    if (object instanceof THREE.SkinnedMesh) object.skeleton.dispose()
    if (object instanceof THREE.Light && 'shadow' in object)
      (object.shadow as THREE.LightShadow)?.dispose()
  })
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
  textures.forEach((texture) => {
    texture.dispose()
    const data: unknown = texture.source.data
    if (typeof ImageBitmap !== 'undefined' && data instanceof ImageBitmap) data.close()
  })
  root.removeFromParent()
}

export class SanctuaryScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(45, 1, 0.05, 25)
  private target = new THREE.Vector3()
  private desiredPosition = new THREE.Vector3()
  private desiredTarget = new THREE.Vector3()
  private preset: CameraPreset = 'OVERVIEW'
  private room: THREE.Object3D | null = null
  private cat: THREE.Object3D | null = null
  private catPickTarget: THREE.Mesh | null = null
  private radio = createRadio()
  private listenerDirection = new THREE.Vector3()
  private mixer: THREE.AnimationMixer | null = null
  private batch: BookBatch | null = null
  private key = new THREE.DirectionalLight('#9ebde8', 0.66)
  private fire = new THREE.PointLight('#ff9a4f', 3.2, 4.2, 2)
  private fairy = new THREE.PointLight('#ffc47c', 0.38, 3.2, 2)
  private treeLight = new THREE.PointLight('#ffc47c', 0.7, 2.5, 2)
  private lamp = new THREE.SpotLight('#ffd098', 12, 5, 0.95, 0.85, 2)
  private shelfLights: THREE.PointLight[] = []
  private environment: THREE.WebGLRenderTarget | null = null
  private flames = new THREE.Group()
  private steam = new THREE.Group()
  private composer: EffectComposer | null = null
  private bloom: UnrealBloomPass | null = null
  private passes: Pass[] = []
  private observer: ResizeObserver
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2(2, 2)
  private hover: string | null = null
  private hit: { book?: Book; cabinet?: number; cat?: boolean; radio?: boolean } = {}
  private selected: string | null = null
  private books: Book[] = []
  private page = 0
  private generation = 0
  private loaded = false
  private disposed = false
  private paused = false
  private frame = 0
  private previousTime = 0
  private elapsed = 0
  private statsTime = 0
  private config: RoomConfig
  private setWoodTheme: ReturnType<typeof createWoodThemes> | null = null

  constructor(
    private container: HTMLElement,
    config: RoomConfig,
    private callbacks: Callbacks,
  ) {
    this.config = config
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      // Keep the last complete frame when a DOM overlay repaints between capped
      // animation frames, and while the journal pauses the scene.
      preserveDrawingBuffer: true,
    })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.info.autoReset = false
    const canvas = this.renderer.domElement
    canvas.setAttribute('aria-label', 'Интерактивная читательская комната')
    canvas.addEventListener('pointermove', this.pointerMove)
    canvas.addEventListener('pointerleave', this.pointerLeave)
    canvas.addEventListener('click', this.click)
    canvas.addEventListener('webglcontextlost', this.contextLost)
    this.container.appendChild(canvas)
    this.scene.background = new THREE.Color('#10151f')
    this.observer = new ResizeObserver(this.resize)
    this.observer.observe(container)
    document.addEventListener('visibilitychange', this.visibility)
    this.resize()
  }
  async start(): Promise<void> {
    const loader = new GLTFLoader()
    const results = await Promise.allSettled([
      loader.loadAsync('sanctuary-scene://assets/sanctuary-room.glb'),
      loader.loadAsync('sanctuary-scene://assets/sanctuary-cat.glb'),
    ])
    if (this.disposed || results.some((result) => result.status === 'rejected')) {
      for (const result of results)
        if (result.status === 'fulfilled') disposeTree(result.value.scene)
      if (!this.disposed)
        throw new Error('Не удалось загрузить комнату. Попробуйте открыть её ещё раз.')
      return
    }
    const [roomGltf, catGltf] = results.map(
      (result) => (result as PromiseFulfilledResult<GLTF>).value,
    )
    this.room = roomGltf.scene
    this.cat = catGltf.scene
    this.scene.add(this.room, this.cat)
    this.setWoodTheme = createWoodThemes(this.room)
    this.scene.add(this.radio.root)
    this.scene.updateMatrixWorld(true)
    for (const zone of manifest.shelfZones) {
      const node = this.room.getObjectByName(zone.nodeName)
      if (
        !node ||
        node
          .getWorldPosition(new THREE.Vector3())
          .distanceTo(new THREE.Vector3().fromArray(zone.origin)) > 0.002
      )
        throw new Error(`Не совпадает положение полки ${zone.nodeName}`)
    }
    this.cat.position.fromArray(manifest.cat.position)
    this.cat.rotation.set(
      ...(manifest.cat.rotationEulerDegrees.map(THREE.MathUtils.degToRad) as [
        number,
        number,
        number,
      ]),
    )
    this.cat.scale.fromArray(manifest.cat.scale)
    this.catPickTarget = createCatPickTarget(this.cat)
    this.mixer = new THREE.AnimationMixer(this.cat)
    for (const name of ['CAT_BREATH', 'CAT_EAR_TWITCH']) {
      const clip = catGltf.animations.find((animation) => animation.name === name)
      if (!clip) throw new Error(`Отсутствует анимация ${name}`)
      this.mixer.clipAction(clip).play()
    }
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      // Fine fur uses the body's shadow; the shadow map cannot resolve individual hairs.
      // Tiny luminous bulbs should not cast a forest of dark pin-sized shadows.
      object.castShadow =
        object.userData.castShadow !== false && !/Bulbs|Flames|Window_Glass/.test(object.name)
      object.receiveShadow = object.userData.receiveShadow !== false
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of materials) {
        if (material.name === 'Mat_Cat_SoftFur') material.depthWrite = false
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture)
            value.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy())
      }
    })
    this.lighting()
    this.effects()
    this.loaded = true
    this.setSettings(this.config)
    this.setCamera(this.preset, true)
    await this.setBooks(this.books, this.page)
    if (this.disposed) return
    this.container.dataset.status = 'ready'
    this.callbacks.ready()
    this.resume()
  }
  private lighting() {
    // A low cool sky level lets the fireplace and lamp make distinct pools of light.
    this.scene.add(new THREE.HemisphereLight('#8ca9d4', '#25160e', 0.28))
    this.key.position.set(-2.6, 2.6, 0.5)
    this.key.target.position.set(0.5, 0.35, -1.4)
    this.key.castShadow = true
    Object.assign(this.key.shadow.camera, {
      left: -3,
      right: 3,
      top: 3,
      bottom: -2,
      near: 0.1,
      far: 12,
    })
    this.key.shadow.bias = -0.0004
    this.key.shadow.normalBias = 0.009
    this.key.shadow.radius = 2.5
    this.scene.add(this.key, this.key.target)
    // Soft reflected window light keeps the sleeping cat readable against the fire.
    const catBounce = new THREE.PointLight('#b9c9df', 0.55, 1.45, 2)
    catBounce.position.fromArray(manifest.cat.position).add(new THREE.Vector3(-0.3, 0.42, 0.52))
    this.scene.add(catBounce)
    this.fire.position
      .fromArray(manifest.anchors.Anchor_Fire.position)
      .add(new THREE.Vector3(0, 0.08, 0.18))
    this.scene.add(this.fire)
    this.lamp.position.fromArray(manifest.anchors.Anchor_Lamp.position)
    this.lamp.target.position.set(1.6, 0.28, -0.1)
    this.lamp.castShadow = true
    this.lamp.shadow.mapSize.set(1024, 1024)
    this.lamp.shadow.bias = -0.0002
    this.lamp.shadow.normalBias = 0.006
    this.lamp.shadow.radius = 3
    this.scene.add(this.lamp, this.lamp.target)
    // A small light through the linen shade also illuminates the upper chair/wall.
    const shade = new THREE.PointLight('#ffd3a4', 0.45, 2.2, 2)
    shade.position.copy(this.lamp.position)
    this.scene.add(shade)
    for (const x of [-1.6, 1.6]) {
      const fill = new THREE.PointLight('#edd6b7', 0.8, 2.4, 2)
      fill.position.set(x, 1.65, -0.55)
      this.shelfLights.push(fill)
      this.scene.add(fill)
    }
    this.fairy.position
      .fromArray(manifest.anchors.Anchor_FairyLights.position)
      .add(new THREE.Vector3(0, -0.08, 0.25))
    this.scene.add(this.fairy)
    const anchor = this.room!.getObjectByName('Anchor_TreeLights')
    if (anchor) anchor.getWorldPosition(this.treeLight.position)
    else this.treeLight.position.set(-2.34, 1.15, -1.14)
    this.treeLight.position.add(new THREE.Vector3(0.16, 0.02, 0.2))
    this.scene.add(this.treeLight)

    // Offline reflection capture with a cool window and warm lamp, rather than a white studio.
    const reference = new THREE.Scene()
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(7, 5, 7),
      new THREE.MeshBasicMaterial({ color: '#302a26', side: THREE.BackSide }),
    )
    reference.add(shell)
    for (const [color, position, size] of [
      ['#7e9cc9', [-3, 0.4, 0], [1.5, 2]],
      ['#ffc27c', [2.5, 0.6, -0.5], [0.6, 1]],
      ['#ff9e51', [0, -1, -2.5], [1, 0.5]],
    ] as const) {
      const card = new THREE.Mesh(
        new THREE.PlaneGeometry(...size),
        new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
      )
      card.position.set(position[0], position[1], position[2])
      card.lookAt(0, 0, 0)
      reference.add(card)
    }
    const generator = new THREE.PMREMGenerator(this.renderer)
    this.environment = generator.fromScene(reference, 0.045)
    this.scene.environment = this.environment.texture
    this.scene.environmentIntensity = 0.27
    generator.dispose()
    disposeTree(reference)
  }
  private effects() {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 64
    const ctx = canvas.getContext('2d')!
    const gradient = ctx.createRadialGradient(32, 38, 1, 32, 32, 30)
    gradient.addColorStop(0, '#fff6cd')
    gradient.addColorStop(0.3, '#ffc342dc')
    gradient.addColorStop(0.7, '#f2551020')
    gradient.addColorStop(1, '#f2551000')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 64, 64)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    for (let i = 0; i < 6; i++) {
      const flame = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      flame.position.set((i - 2.5) * 0.055, -0.04, 0.08)
      flame.scale.set(0.12, 0.23, 1)
      this.flames.add(flame)
    }
    this.flames.position.fromArray(manifest.anchors.Anchor_Fire.position)
    this.scene.add(this.flames)
    for (let i = 0; i < 3; i++) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          color: '#b1b1ab',
          opacity: 0.055,
          depthWrite: false,
        }),
      )
      sprite.scale.set(0.035, 0.065, 1)
      this.steam.add(sprite)
    }
    this.steam.position.fromArray(manifest.anchors.Anchor_TeaSteam.position)
    this.scene.add(this.steam)
  }
  async setBooks(books: Book[], page: number): Promise<void> {
    this.books = books
    this.page = page
    if (!this.loaded || this.disposed) return
    const generation = ++this.generation
    const batch = await BookBatch.create(roomPlacements(books, page))
    if (this.disposed || generation !== this.generation) {
      batch?.dispose()
      return
    }
    this.batch?.dispose()
    this.batch = batch
    if (batch) this.scene.add(batch.mesh)
    this.container.dataset.bookCount = String(batch?.placements.length ?? 0)
    if (this.selected && !batch?.placements.some(({ book }) => book.id === this.selected))
      this.select(null)
  }
  setSettings(config: RoomConfig) {
    if (this.disposed) return
    this.config = config
    if (!this.loaded) return
    this.fire.visible = config.fireplaceActive
    this.flames.visible = config.fireplaceActive
    const embers = this.room!.getObjectByName('Fireplace_Embers')
    if (embers) embers.visible = config.fireplaceActive
    this.fairy.visible = config.fairyLights
    this.treeLight.visible = config.fairyLights
    for (const name of ['FairyLights_Bulbs', 'HolidayLights_Bulbs']) {
      const bulbs = this.room!.getObjectByName(name)
      if (bulbs) bulbs.visible = config.fairyLights
    }
    this.container.dataset.holidayLights = String(config.fairyLights)
    this.container.dataset.fireplace = String(config.fireplaceActive)
    this.container.dataset.look = 'winter-night'
    const radioPlaying = config.sound && config.radioPlaying
    this.radio.indicator.emissiveIntensity = radioPlaying ? 0.8 : 0
    this.radio.indicator.color.set(radioPlaying ? '#9ab05f' : '#3c392d')
    this.container.dataset.radioPlaying = String(radioPlaying)
    this.setWoodTheme?.(config.woodTheme)
    this.renderer.shadowMap.enabled = config.quality !== 'LOW'
    const size = config.quality === 'HIGH' ? 2048 : 1024
    if (this.key.shadow.mapSize.x !== size) {
      this.key.shadow.map?.dispose()
      this.key.shadow.map = null
      this.key.shadow.mapSize.set(size, size)
    }
    if (config.quality === 'HIGH' && !this.composer) {
      this.composer = new EffectComposer(this.renderer)
      const render = new RenderPass(this.scene, this.camera),
        output = new OutputPass()
      // A single non-finite HDR highlight otherwise spreads through every bloom
      // mip level and clears the complete image on some WebGL drivers.
      const highlights = new ShaderPass({
        uniforms: { tDiffuse: { value: null } },
        vertexShader: `varying vec2 vUv;
          void main() { vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
          float safe(float c) { return c >= 0.0 ? min(c,32.0) : 0.0; }
          void main() { vec3 c=texture2D(tDiffuse,vUv).rgb;
            gl_FragColor=vec4(safe(c.r),safe(c.g),safe(c.b),1.0); }`,
      })
      this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.24, 0.35, 1.2)
      this.composer.addPass(render)
      this.composer.addPass(highlights)
      this.composer.addPass(this.bloom)
      this.composer.addPass(output)
      this.passes = [render, highlights, output]
    } else if (config.quality !== 'HIGH' && this.composer) this.disposeComposer()
    if (config.reducedMotion) this.setCamera(this.preset, true)
    this.container.dataset.quality = config.quality
    this.container.dataset.motion = config.reducedMotion ? 'reduced' : 'normal'
    this.resize()
  }
  setCamera(preset: CameraPreset, immediate = false) {
    this.preset = preset
    const definition = cameras[preset]
    this.desiredPosition.fromArray(definition.position)
    this.desiredTarget.fromArray(definition.target)
    if (immediate || this.config.reducedMotion) {
      this.camera.position.copy(this.desiredPosition)
      this.target.copy(this.desiredTarget)
      this.camera.lookAt(this.target)
    }
    this.container.dataset.camera = preset
    this.container.dataset.cameraSettled = 'false'
    this.callbacks.camera(preset)
    this.resize()
  }
  focusBook(book: Book) {
    this.setCamera(book.status === 'OWNED' ? 'STACK' : book.cabinet === 0 ? 'SHELF_0' : 'SHELF_1')
    this.select(book)
    this.hover = book.id
  }
  private select(book: Book | null) {
    if (this.selected === (book?.id ?? null)) return
    this.selected = book?.id ?? null
    this.callbacks.select(book)
  }
  setPaused(paused: boolean) {
    this.paused = paused
    this.container.dataset.paused = String(paused || document.hidden)
    this.visibility()
  }
  private resize = () => {
    if (this.disposed) return
    const width = Math.max(1, this.container.clientWidth),
      height = Math.max(1, this.container.clientHeight)
    const ratio = Math.min(
      devicePixelRatio,
      this.config.quality === 'HIGH' ? 1.5 : this.config.quality === 'MEDIUM' ? 1.25 : 1,
    )
    const size = this.renderer.getSize(new THREE.Vector2())
    if (size.x !== width || size.y !== height || this.renderer.getPixelRatio() !== ratio) {
      this.renderer.setPixelRatio(ratio)
      this.renderer.setSize(width, height)
      this.composer?.setPixelRatio(ratio)
      this.composer?.setSize(width, height)
    }
    this.camera.aspect = width / height
    const fov = cameras[this.preset].fovDegrees
    this.camera.fov = THREE.MathUtils.radToDeg(
      2 *
        Math.atan(
          Math.tan(THREE.MathUtils.degToRad(fov / 2)) * Math.max(1, 16 / 9 / this.camera.aspect),
        ),
    )
    this.camera.updateProjectionMatrix()
  }
  private pointerMove = (event: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    )
  }
  private pointerLeave = () => {
    this.pointer.set(2, 2)
    this.hover = null
    this.hit = {}
  }
  private pick() {
    this.camera.updateMatrixWorld(true)
    this.scene.updateMatrixWorld(true)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const objects: THREE.Object3D[] = []
    if (this.batch) objects.push(this.batch.mesh)
    if (this.catPickTarget) objects.push(this.catPickTarget)
    objects.push(this.radio.root)
    for (const name of ['Cabinet_0', 'Cabinet_1']) {
      const object = this.room?.getObjectByName(name)
      if (object) objects.push(object)
    }
    const hit = this.raycaster.intersectObjects(objects, true)[0]
    this.hit = {}
    this.hover = null
    if (hit) {
      if (hit.object === this.batch?.mesh) {
        const book = this.batch.placements[this.batch.indexOfHit(hit)]?.book
        if (book) {
          this.hit = { book }
          if (this.preset !== 'OVERVIEW' || book.status === 'OWNED') {
            this.hover = book.id
            this.select(book)
          }
        }
      } else {
        let object: THREE.Object3D | null = hit.object
        while (object) {
          if (object === this.radio.root) {
            this.hit = { radio: true }
            break
          }
          if (object === this.cat) {
            this.hit = { cat: true }
            break
          }
          if (/^Cabinet_[01]$/.test(object.name)) {
            this.hit = { cabinet: Number(object.name.slice(-1)) }
            break
          }
          object = object.parent
        }
      }
    }
    this.renderer.domElement.style.cursor = hit ? 'pointer' : 'default'
    this.renderer.domElement.title = this.hit.cat
      ? 'Погладить котика'
      : (this.hit.book?.title ??
        (this.hit.cabinet !== undefined ? 'Нажмите, чтобы приблизить шкаф' : ''))
  }
  private click = (event: MouseEvent) => {
    this.pointerMove(event as PointerEvent)
    this.pick()
    if (this.hit.book) {
      if (this.preset === 'OVERVIEW' && this.hit.book.status !== 'OWNED')
        this.focusBook(this.hit.book)
      else this.callbacks.open(this.hit.book.id)
    } else if (this.hit.cabinet !== undefined)
      this.setCamera(this.hit.cabinet === 0 ? 'SHELF_0' : 'SHELF_1')
    else if (this.hit.cat) this.callbacks.cat()
    else if (this.hit.radio) this.callbacks.radio()
  }
  private contextLost = (event: Event) => {
    event.preventDefault()
    if (!this.disposed)
      this.callbacks.error(
        new Error(
          'Графика временно недоступна. Откройте комнату заново или продолжите в библиотеке.',
        ),
      )
  }
  private visibility = () => {
    this.container.dataset.paused = String(this.paused || document.hidden)
    if (this.paused || document.hidden) {
      cancelAnimationFrame(this.frame)
      this.frame = 0
    } else this.resume()
  }
  private resume() {
    if (!this.loaded || this.disposed || this.paused || document.hidden || this.frame) return
    this.previousTime = 0
    this.frame = requestAnimationFrame(this.render)
  }
  private render = (time: number) => {
    if (this.disposed || this.paused || document.hidden) {
      this.frame = 0
      return
    }
    this.frame = requestAnimationFrame(this.render)
    if (this.previousTime && time - this.previousTime < (this.config.quality === 'LOW' ? 32 : 15))
      return
    const dt = this.previousTime ? Math.min((time - this.previousTime) / 1000, 0.06) : 0.016
    this.previousTime = time
    this.elapsed += dt
    const motion = !this.config.reducedMotion
    const alpha = motion ? 1 - Math.exp(-7 * dt) : 1
    this.camera.position.lerp(this.desiredPosition, alpha)
    this.target.lerp(this.desiredTarget, alpha)
    this.camera.lookAt(this.target)
    this.container.dataset.cameraSettled = String(
      this.camera.position.distanceToSquared(this.desiredPosition) < 0.00001 &&
        this.target.distanceToSquared(this.desiredTarget) < 0.00001,
    )
    this.scene.updateMatrixWorld(true)
    if (this.pointer.x <= 1) this.pick()
    this.batch?.animate(this.hover, dt, !motion)
    this.shelfLights.forEach((light, index) => {
      const intensity = this.preset === `SHELF_${index}` ? 1.6 : 0.8
      light.intensity = THREE.MathUtils.lerp(light.intensity, intensity, alpha)
    })
    if (motion) this.mixer?.update(dt)
    this.fire.intensity = motion
      ? 3.2 + Math.sin(this.elapsed * 7.3) * 0.13 + Math.cos(this.elapsed * 13.1) * 0.07
      : 3.2
    this.flames.children.forEach((sprite, i) => {
      sprite.scale.y = 0.23 + (motion ? Math.sin(this.elapsed * 5 + i * 2) * 0.06 : 0)
    })
    this.steam.visible = motion
    this.steam.children.forEach((sprite, i) => {
      const t = (this.elapsed * 0.3 + i / 3) % 1
      sprite.position.set(Math.sin(t * 5 + i) * 0.012, t * 0.13, 0)
      ;(sprite as THREE.Sprite).material.opacity = Math.sin(t * Math.PI) * 0.055
    })
    this.renderer.info.reset()
    this.camera.getWorldDirection(this.listenerDirection)
    this.callbacks.listener(this.camera.position.toArray(), this.listenerDirection.toArray())
    if (this.composer) this.composer.render(dt)
    else this.renderer.render(this.scene, this.camera)
    if (this.container.dataset.renderQuality !== this.config.quality)
      this.container.dataset.renderQuality = this.config.quality
    if (time - this.statsTime > 500) {
      this.statsTime = time
      this.container.dataset.drawCalls = String(this.renderer.info.render.calls)
      this.container.dataset.triangles = String(this.renderer.info.render.triangles)
    }
  }
  private disposeComposer() {
    this.passes.forEach((pass) => pass.dispose())
    this.passes = []
    this.bloom?.dispose()
    this.bloom = null
    this.composer?.dispose()
    this.composer = null
  }
  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.generation++
    cancelAnimationFrame(this.frame)
    this.observer.disconnect()
    document.removeEventListener('visibilitychange', this.visibility)
    const canvas = this.renderer.domElement
    canvas.removeEventListener('pointermove', this.pointerMove)
    canvas.removeEventListener('pointerleave', this.pointerLeave)
    canvas.removeEventListener('click', this.click)
    canvas.removeEventListener('webglcontextlost', this.contextLost)
    this.mixer?.stopAllAction()
    if (this.cat) this.mixer?.uncacheRoot(this.cat)
    this.batch?.dispose()
    this.disposeComposer()
    this.scene.environment = null
    this.environment?.dispose()
    this.environment = null
    disposeTree(this.scene)
    this.setWoodTheme = null
    this.scene.clear()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    canvas.remove()
  }
}
