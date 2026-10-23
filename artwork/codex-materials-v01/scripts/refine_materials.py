"""Material-only iteration, run in the wood-v01 source through Blender MCP.

Procedural yarn/pores maps are authored here, without baked scene lighting.
Positions, UVs, furniture, personal-picture nodes and wood palettes stay intact.
"""
import bpy
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / 'artwork/codex-materials-v01'
TEX = ART / 'textures'


def save_map(name, data):
    h, w = data.shape[:2]
    image = bpy.data.images.new(name, width=w, height=h, alpha=False)
    image.colorspace_settings.name = 'Non-Color'
    pixels = np.ones((h, w, 4), dtype=np.float32)
    pixels[:, :, :3] = data[:, :, None] if data.ndim == 2 else data
    image.pixels.foreach_set(pixels.ravel())
    image.filepath_raw = str(TEX / (name + '.png'))
    image.file_format = 'PNG'
    image.save()
    return image


def maps(kind, n=1024):
    y, x = np.mgrid[0:n, 0:n].astype(np.float32) / n
    # Integer frequencies make repeat boundaries continuous; coarse noise is
    # subordinate to yarns and never becomes a painted shadow or a large bump.
    slow = (np.sin(2*np.pi*(3*x+2*y)) + np.sin(2*np.pi*(7*x-5*y)))/2
    fine = (np.sin(2*np.pi*(127*x+113*y)) + np.cos(2*np.pi*(191*x-157*y)))/2
    if kind == 'linen':
        count = 96
        a, b = x*count, y*count
        over = ((np.floor(a)+np.floor(b)) % 2)*2-1
        warp = np.maximum(0, np.cos(2*np.pi*a))**1.3
        weft = np.maximum(0, np.cos(2*np.pi*b))**1.3
        height = .45*(warp+weft) + .18*over*(warp-weft) + .045*fine + .025*slow
        rough = .82 + .07*(1-height) + .025*slow
        amplitude = .30
    elif kind == 'wool':
        # Small slanted legs form stocking stitches, rather than thick stripes.
        a, b = x*32, y*40
        leg = (a % 1 - .5)*2
        stitch = np.exp(-((np.sin(np.pi*(b + .48*np.abs(leg))))/.30)**2)
        height = .7*stitch + .08*fine + .025*slow
        rough = .87 + .055*(1-stitch) + .02*slow
        amplitude = .38
    elif kind == 'pile':
        height = .30*np.sin(2*np.pi*x*64)*np.cos(2*np.pi*y*80) + .10*fine
        rough = .91 + .035*slow + .025*fine
        amplitude = .23
    else:
        height = .05*fine + .04*slow
        rough = (.23 + .035*slow + .015*fine) if kind == 'glaze' else (.56 + .065*slow + .025*fine)
        amplitude = .09 if kind == 'glaze' else .17
    dx = (np.roll(height,-1,axis=1)-np.roll(height,1,axis=1))
    dy = (np.roll(height,-1,axis=0)-np.roll(height,1,axis=0))
    # Normalize to controlled micro-normal slopes independent of texture size.
    scale = amplitude / max(float(np.sqrt(np.mean(dx*dx+dy*dy))), .001)
    normal = np.stack((-dx*scale,-dy*scale,np.ones_like(dx)),axis=-1)
    normal /= np.linalg.norm(normal,axis=-1,keepdims=True)
    return save_map(kind+'-normal',normal*.5+.5), save_map(kind+'-roughness',np.clip(rough,0,1))


def principled(material):
    return next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')


def texture(material, image, repeat=1):
    nodes, links = material.node_tree.nodes, material.node_tree.links
    node = nodes.new('ShaderNodeTexImage'); node.image = image
    node.interpolation = 'Linear'; node.extension = 'REPEAT'
    if repeat != 1:
        uv = nodes.new('ShaderNodeTexCoord')
        mapping = nodes.new('ShaderNodeMapping')
        mapping.inputs['Scale'].default_value = (repeat,repeat,1)
        links.new(uv.outputs['UV'],mapping.inputs['Vector'])
        links.new(mapping.outputs['Vector'],node.inputs['Vector'])
    return node


def detail(material, images, strength=1, repeat=1):
    p = principled(material)
    nodes, links = material.node_tree.nodes, material.node_tree.links
    for socket in ['Normal','Roughness']:
        for link in list(p.inputs[socket].links): links.remove(link)
    normal = nodes.new('ShaderNodeNormalMap')
    normal.inputs['Strength'].default_value = strength
    links.new(texture(material,images[0],repeat).outputs['Color'],normal.inputs['Color'])
    links.new(normal.outputs['Normal'],p.inputs['Normal'])
    links.new(texture(material,images[1],repeat).outputs['Color'],p.inputs['Roughness'])


def install():
    assert not bpy.context.scene.get('softMaterialRevision'), 'Already installed; open wood-v01 source first'
    TEX.mkdir(parents=True,exist_ok=True)
    generated = {kind:maps(kind) for kind in ['linen','wool','pile','glaze','stoneware']}
    # Exporter uses Sheen Tint as KHR_materials_sheen color. Do not leave it white:
    # Blender's small Sheen Weight alone did not survive the previous export.
    for material in bpy.data.materials:
        if not material.use_nodes: continue
        p = next((n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'),None)
        if not p: continue
        if material.name.startswith('Mat_Fabric') or material.name == 'Mat_Holiday_Knit':
            p.inputs['Sheen Weight'].default_value = 1
            p.inputs['Sheen Tint'].default_value = (.12,.085,.055,1)
            p.inputs['Sheen Roughness'].default_value = .78
            p.inputs['Specular IOR Level'].default_value = .18
    chair=bpy.data.materials['Mat_Fabric_Terracotta']
    detail(chair,generated['linen'],.65)
    principled(chair).inputs['Sheen Tint'].default_value = (.13,.045,.028,1)
    blanket=bpy.data.materials['Mat_Fabric_BlanketCream']
    detail(blanket,generated['wool'],.62)
    principled(blanket).inputs['Sheen Tint'].default_value = (.16,.14,.105,1)
    detail(bpy.data.materials['Mat_Fabric_Rug'],generated['pile'],.7,4)
    # Keep holiday atlas motifs intact while reducing embossed-looking relief.
    holiday=bpy.data.materials['Mat_Holiday_Knit']
    for n in holiday.node_tree.nodes:
        if n.type=='NORMAL_MAP': n.inputs['Strength'].default_value=.25
    cream=bpy.data.materials['Mat_Ceramic_Cream']
    detail(cream,generated['glaze'],.35,2)
    p=principled(cream)
    p.inputs['Coat Weight'].default_value=.32
    p.inputs['Coat Roughness'].default_value=.17
    p.inputs['Specular IOR Level'].default_value=.42
    pots=bpy.data.materials['Mat_Ceramic_Pot']
    detail(pots,generated['stoneware'],.55,3)
    p=principled(pots)
    p.inputs['Coat Weight'].default_value=.12
    p.inputs['Coat Roughness'].default_value=.30
    p.inputs['Specular IOR Level'].default_value=.35
    glass=bpy.data.materials['Mat_Window_NightGlass']
    p=principled(glass)
    # Night pane retains its dark backing: transmission would reveal empty space.
    p.inputs['Roughness'].default_value=.085
    p.inputs['IOR'].default_value=1.46
    p.inputs['Specular IOR Level'].default_value=.5
    p.inputs['Coat Weight'].default_value=.2
    p.inputs['Coat Roughness'].default_value=.065
    bpy.context.scene['softMaterialRevision']='codex-materials-v01'
    print('INSTALLED', {k:[i.name for i in v] for k,v in generated.items()})


def preview(label):
    scene=bpy.context.scene
    original=scene.camera
    resolution=(scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage)
    camera=bpy.data.objects.get('MaterialReviewCamera')
    if not camera:
        camera=bpy.data.objects.new('MaterialReviewCamera',bpy.data.cameras.new('MaterialReviewCamera'))
        scene.collection.objects.link(camera)
    camera.location=(.15,-1.15,1.25)
    target=Vector((1.36,.38,.52))
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.lens=48
    scene.camera=camera
    scene.render.engine='CYCLES';scene.cycles.device='CPU'
    scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.render.threads_mode='FIXED';scene.render.threads=4
    scene.render.resolution_x=1000;scene.render.resolution_y=800;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.render.filepath=str(ART/'previews'/f'{label}.png')
    try: bpy.ops.render.render(write_still=True)
    finally:
        scene.camera=original
        scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage=resolution
    print('PREVIEW',scene.render.filepath)


def save_export():
    # glTF camera aspectRatio uses scene render resolution, even for unrendered
    # cameras. Keep wood-v01's square export contract after a landscape preview.
    bpy.context.scene.render.resolution_x=1024
    bpy.context.scene.render.resolution_y=1024
    bpy.context.scene.render.resolution_percentage=100
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(ART/'source/sanctuary-room.blend'))
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.data.collections['SanctuaryRoom'].all_objects: obj.select_set(True)
    bpy.context.view_layer.objects.active=bpy.data.objects['RoomRoot']
    bpy.ops.export_scene.gltf(filepath=str(ART/'previews/candidate.glb'),
        export_format='GLB',use_selection=True,export_cameras=True,export_yup=True,
        export_apply=True,export_texcoords=True,export_normals=True,export_tangents=True,
        export_materials='EXPORT',export_image_format='AUTO',export_extras=True)
    print('MATERIAL_SOURCE_AND_GLB_SAVED')
