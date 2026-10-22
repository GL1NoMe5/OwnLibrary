"""Wood v01 authoring, executed through Blender MCP in the saved v03 room.

All painting comes from the three ImageGen albedo sources. Blender nodes author
grain relief, satin roughness and staggered floor joints, then bake glTF maps.
Never invokes a render window. Bake and reference renders use two CPU threads.
"""
import bpy
import math
import random
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / 'artwork/codex-wood-v01'
TEX = ART / 'textures'
SPECIES = ('Walnut', 'Oak', 'Mahogany')


class Graph:
    def __init__(self, material):
        material.use_nodes = True
        self.nodes = material.node_tree.nodes
        self.links = material.node_tree.links
        self.nodes.clear()

    def node(self, kind):
        return self.nodes.new(kind)

    def put(self, socket, value):
        if isinstance(value, bpy.types.NodeSocket):
            self.links.new(value, socket)
        else:
            socket.default_value = value

    def math(self, operation, a, b=0):
        n = self.node('ShaderNodeMath'); n.operation = operation
        self.put(n.inputs[0], a); self.put(n.inputs[1], b)
        return n.outputs[0]

    def vector(self, x, y, z=0):
        n = self.node('ShaderNodeCombineXYZ')
        for i, value in enumerate((x, y, z)): self.put(n.inputs[i], value)
        return n.outputs[0]

    def separate(self, value):
        n = self.node('ShaderNodeSeparateXYZ'); self.put(n.inputs[0], value)
        return n.outputs

    def remap(self, value, a, b, c, d):
        n = self.node('ShaderNodeMapRange'); n.clamp = True
        n.interpolation_type = 'SMOOTHSTEP'
        for i, v in enumerate((value, a, b, c, d)): self.put(n.inputs[i], v)
        return n.outputs[0]


def image(path, data=False):
    im = bpy.data.images.load(str(path), check_existing=True)
    im.colorspace_settings.name = 'Non-Color' if data else 'sRGB'
    return im


def author_graph(species, floor=False):
    name = species.lower()
    mat = bpy.data.materials.new('Bake_' + species + ('_Floor' if floor else '_Primary'))
    g = Graph(mat)
    out = g.node('ShaderNodeOutputMaterial')
    bsdf = g.node('ShaderNodeBsdfPrincipled')
    g.links.new(bsdf.outputs[0], out.inputs['Surface'])
    uv = g.node('ShaderNodeTexCoord').outputs['UV']
    seam = 1.0
    shade = 1.0
    if floor:
        xy = g.separate(uv)
        u = g.math('MULTIPLY', xy[0], 12)
        column = g.math('FLOOR', u)
        local_u = g.math('FRACT', u)
        v = g.math('ADD', g.math('MULTIPLY', xy[1], 2), g.math('MULTIPLY', column, .5))
        local_v = g.math('FRACT', v)
        row = g.math('MODULO', g.math('FLOOR', v), 2)
        rand = g.node('ShaderNodeTexWhiteNoise')
        rand.noise_dimensions = '3D'
        g.put(rand.inputs['Vector'], g.vector(column, row, 7))
        jitter = g.separate(rand.outputs['Color'])
        # 20 cm boards sample different crops of the 65 cm wide veneer source.
        uv = g.vector(g.math('ADD', g.math('MULTIPLY', local_u, .20/.65), g.math('MULTIPLY', jitter[0], .65)),
                      g.math('ADD', g.math('MULTIPLY', local_v, .5), g.math('MULTIPLY', jitter[1], .48)))
        edge_u = g.math('MINIMUM', local_u, g.math('SUBTRACT', 1, local_u))
        edge_v = g.math('MINIMUM', local_v, g.math('SUBTRACT', 1, local_v))
        seam = g.math('MULTIPLY', g.remap(edge_u, .0005, .005, 0, 1), g.remap(edge_v, .0001, .00085, 0, 1))
        shade = g.math('ADD', .89, g.math('MULTIPLY', rand.outputs['Value'], .16))
    tex = g.node('ShaderNodeTexImage'); tex.image = image(TEX / (name + '-albedo.png'))
    g.put(tex.inputs['Vector'], uv)
    color = tex.outputs['Color']
    # Light oil finish; mahogany remains brown rather than glowing orange.
    if species == 'Mahogany':
        sat = g.node('ShaderNodeHueSaturation')
        g.put(sat.inputs['Color'], color)
        sat.inputs['Saturation'].default_value = .76
        sat.inputs['Value'].default_value = .78
        color = sat.outputs['Color']
    if floor:
        mul = g.node('ShaderNodeMixRGB'); mul.blend_type = 'MULTIPLY'
        mul.inputs[0].default_value = 1
        g.put(mul.inputs[1], color)
        g.put(mul.inputs[2], g.math('MULTIPLY', shade, g.math('ADD', .38, g.math('MULTIPLY', seam, .62))))
        color = mul.outputs[0]
    gray = g.node('ShaderNodeRGBToBW'); g.put(gray.inputs[0], tex.outputs['Color'])
    rough_base = {'Walnut': .36, 'Oak': .43, 'Mahogany': .34}[species] + (.06 if floor else 0)
    rough = g.remap(gray.outputs[0], .035, .52, rough_base+.16, rough_base)
    if floor:
        rough = g.math('ADD', rough, g.math('MULTIPLY', g.math('SUBTRACT', 1, seam), .20))
    g.put(bsdf.inputs['Base Color'], color)
    g.put(bsdf.inputs['Roughness'], rough)
    bsdf.inputs['Metallic'].default_value = 0
    bsdf.inputs['Specular IOR Level'].default_value = .35
    # Sub-millimetre pores under a smooth finish, never deeply corrugated timber.
    bump = g.node('ShaderNodeBump')
    g.put(bump.inputs['Height'], gray.outputs[0])
    bump.inputs['Distance'].default_value = .00055 if species == 'Oak' else .00030
    bump.inputs['Strength'].default_value = .45
    normal = bump.outputs['Normal']
    if floor:
        joints = g.node('ShaderNodeBump')
        g.put(joints.inputs['Height'], seam)
        g.put(joints.inputs['Normal'], normal)
        joints.inputs['Distance'].default_value = .00065
        joints.inputs['Strength'].default_value = .65
        normal = joints.outputs['Normal']
    g.put(bsdf.inputs['Normal'], normal)
    return mat, g, out, bsdf, color, rough


def bake_species(species):
    """One species per MCP invocation; safely restore the room even on failure."""
    original_scene = bpy.context.window.scene
    scene = bpy.data.scenes.new('WoodBake_' + species)
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'; scene.cycles.samples = 1
    scene.render.threads_mode = 'FIXED'; scene.render.threads = 2
    scene.render.bake.margin = 0
    scene.render.bake.use_clear = True
    scene.render.bake.normal_space = 'TANGENT'
    mesh = bpy.data.meshes.new('WoodBakePlane')
    mesh.from_pydata([(0,0,0),(.65,0,0),(.65,2.4,0),(0,2.4,0)], [], [(0,1,2),(0,2,3)])
    uv = mesh.uv_layers.new(name='UVMap')
    coords = [(0,0),(1,0),(1,1),(0,1)]
    for loop in mesh.loops: uv.data[loop.index].uv = coords[loop.vertex_index]
    plane = bpy.data.objects.new('WoodBakePlane', mesh); scene.collection.objects.link(plane)
    bpy.context.window.scene = scene
    scene.view_layers[0].objects.active = plane; plane.select_set(True)
    try:
        for floor in (False, True):
            role = 'floor' if floor else 'primary'
            for vertex in mesh.vertices:
                vertex.co.x = coords[vertex.index][0] * (2.4 if floor else .65)
            mesh.update()
            mat, g, out, bsdf, color, rough = author_graph(species, floor)
            mesh.materials.clear(); mesh.materials.append(mat)
            target = g.node('ShaderNodeTexImage')
            emission = g.node('ShaderNodeEmission')
            for channel in ('basecolor', 'roughness', 'normal'):
                size = 2048 if floor else 1254
                if channel == 'roughness': size = 1024
                im = bpy.data.images.new(f'{species.lower()}-{role}-{channel}', width=size, height=size, alpha=False)
                im.colorspace_settings.name = 'sRGB' if channel == 'basecolor' else 'Non-Color'
                target.image = im
                for node in g.nodes: node.select = False
                target.select = True; g.nodes.active = target
                if channel == 'normal':
                    g.links.new(bsdf.outputs[0], out.inputs['Surface'])
                    bpy.ops.object.bake(type='NORMAL')
                else:
                    g.put(emission.inputs['Color'], color if channel == 'basecolor' else rough)
                    g.links.new(emission.outputs[0], out.inputs['Surface'])
                    bpy.ops.object.bake(type='EMIT')
                # JPEG color keeps the six embedded material sets compact; data maps stay lossless.
                extension = '.jpg' if channel == 'basecolor' else '.png'
                im.filepath_raw = str(TEX / (im.name + extension))
                im.file_format = 'JPEG' if channel == 'basecolor' else 'PNG'
                scene.render.image_settings.quality = 95
                im.save()
                print('BAKED', im.filepath_raw, flush=True)
            mesh.materials.clear()
            bpy.data.materials.remove(mat)
    finally:
        bpy.context.window.scene = original_scene
        bpy.data.objects.remove(plane, do_unlink=True)
        bpy.data.meshes.remove(mesh)
        bpy.data.scenes.remove(scene)


def components(mesh):
    adjacency = [set() for _ in mesh.vertices]
    for edge in mesh.edges:
        a,b = edge.vertices; adjacency[a].add(b); adjacency[b].add(a)
    unseen = set(range(len(mesh.vertices)))
    while unseen:
        first = min(unseen); unseen.remove(first)
        found = {first}; todo = [first]
        while todo:
            for i in adjacency[todo.pop()]:
                if i in unseen: unseen.remove(i); found.add(i); todo.append(i)
        yield found


def grain_uv(obj):
    mesh = obj.data
    uv = mesh.uv_layers.active or mesh.uv_layers.new(name='WoodGrain')
    rng = random.Random(obj.name)
    by_vertex = {}
    for indices in components(mesh):
        low = [min(mesh.vertices[i].co[a] for i in indices) for a in range(3)]
        high = [max(mesh.vertices[i].co[a] for i in indices) for a in range(3)]
        dims = [high[a]-low[a] for a in range(3)]
        grain = max(range(3), key=lambda a:dims[a])
        if obj.name == 'Room_WoodTrim' and .65 < dims[2] < .70: grain = 2
        offsets = (rng.random(), rng.random())
        for i in indices: by_vertex[i] = (grain, offsets, low)
    for polygon in mesh.polygons:
        grain, offsets, low = by_vertex[polygon.vertices[0]]
        normal_axis = max(range(3), key=lambda a:abs(polygon.normal[a]))
        if normal_axis == grain:
            across, along = [a for a in range(3) if a != grain]
            scales = (.65, .65)
        else:
            across = next(a for a in range(3) if a not in (grain,normal_axis))
            along = grain; scales = (.65, 2.4)
        for index in polygon.loop_indices:
            co = mesh.vertices[mesh.loops[index].vertex_index].co
            uv.data[index].uv = ((co[across]-low[across])/scales[0]+offsets[0],
                                 (co[along]-low[along])/scales[1]+offsets[1])
    mesh.update()


def pbr_material(species, role):
    name = f'Mat_Wood_{species}_{role}'
    mat = bpy.data.materials.new(name)
    g = Graph(mat)
    out = g.node('ShaderNodeOutputMaterial')
    bsdf = g.node('ShaderNodeBsdfPrincipled')
    g.links.new(bsdf.outputs[0], out.inputs['Surface'])
    bsdf.inputs['Metallic'].default_value = 0
    bsdf.inputs['IOR'].default_value = 1.46
    bsdf.inputs['Specular IOR Level'].default_value = .35
    for channel, socket in [('basecolor','Base Color'),('roughness','Roughness'),('normal','Normal')]:
        path = TEX / f'{species.lower()}-{role.lower()}-{channel}{".jpg" if channel == "basecolor" else ".png"}'
        tex = g.node('ShaderNodeTexImage'); tex.image = image(path, channel != 'basecolor')
        if channel == 'normal':
            normal = g.node('ShaderNodeNormalMap'); normal.inputs['Strength'].default_value = .8
            g.put(normal.inputs['Color'], tex.outputs['Color'])
            g.put(bsdf.inputs[socket], normal.outputs['Normal'])
        else: g.put(bsdf.inputs[socket], tex.outputs['Color'])
    mat['woodSpecies'] = species; mat['woodRole'] = role
    mat['finish'] = 'satin oil, subdued pores'
    return mat


def install():
    scene = bpy.context.scene
    assert not bpy.data.objects.get('WoodMaterialPalette'), 'Already installed; use saved wood source.'
    old_primary = bpy.data.materials['Mat_Wood_Walnut_Primary']
    old_floor = bpy.data.materials['Mat_Wood_Walnut_Floor']
    old_primary.name = 'Mat_Wood_Firewood'
    old_floor.name = 'Archive_Wood_Floor'
    mats = {(s,r):pbr_material(s,r) for s in SPECIES for r in ('Primary','Floor')}
    for obj in bpy.data.collections['SanctuaryRoom'].all_objects:
        if obj.type != 'MESH' or obj.name == 'Fireplace_Logs': continue
        changed = False
        for slot in obj.material_slots:
            if slot.material == old_primary:
                slot.material = mats['Walnut','Primary']; changed = True
            elif slot.material == old_floor:
                slot.material = mats['Walnut','Floor']
                uv = obj.data.uv_layers.active
                for loop in obj.data.loops:
                    co = obj.data.vertices[loop.vertex_index].co
                    uv.data[loop.index].uv = (co.x/2.4,co.y/2.4)
        if changed: grain_uv(obj)
    # Keep all variants reachable in GLB so runtime teardown disposes every image.
    collection = bpy.data.collections['SanctuaryRoom']
    palette = bpy.data.objects.new('WoodMaterialPalette', None)
    palette['materialPalette'] = True
    collection.objects.link(palette)
    palette.parent = bpy.data.objects['RoomRoot']
    palette.location = (0,0,-8)
    for i, ((species,role), mat) in enumerate(mats.items()):
        mesh = bpy.data.meshes.new(f'WoodSwatch_{species}_{role}')
        mesh.from_pydata([(0,0,0),(.01,0,0),(.01,.01,0),(0,.01,0)], [], [(0,1,2),(0,2,3)])
        uv = mesh.uv_layers.new(name='UVMap')
        coords = [(0,0),(1,0),(1,1),(0,1)]
        for loop in mesh.loops: uv.data[loop.index].uv = coords[loop.vertex_index]
        mesh.materials.append(mat); mesh.update()
        obj = bpy.data.objects.new(mesh.name,mesh); collection.objects.link(obj)
        obj.parent = palette; obj.location.x = i*.02
        obj['castShadow'] = False; obj['receiveShadow'] = False
        obj.hide_render = True
    scene['woodRevision'] = 'codex-wood-v01'
    scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 20
    scene.cycles.use_denoising = True
    scene.render.threads_mode = 'FIXED'; scene.render.threads = 2
    bpy.context.view_layer.update()
    print('INSTALLED: six PBR materials, per-component grain UV, independent firewood.')


def set_theme(species):
    palette = bpy.data.objects['WoodMaterialPalette']
    for obj in bpy.data.collections['SanctuaryRoom'].all_objects:
        if obj.type != 'MESH' or obj.parent == palette: continue
        for slot in obj.material_slots:
            if slot.material and slot.material.get('woodRole'):
                slot.material = bpy.data.materials[f'Mat_Wood_{species}_{slot.material["woodRole"]}']


def save_export():
    set_theme('Walnut')
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(ART/'source/sanctuary-room.blend'))
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.data.collections['SanctuaryRoom'].all_objects: obj.select_set(True)
    bpy.context.view_layer.objects.active = bpy.data.objects['RoomRoot']
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'src/renderer/public/room/sanctuary-room.glb'),
        export_format='GLB', use_selection=True, export_cameras=True, export_yup=True,
        export_apply=True, export_texcoords=True, export_normals=True, export_tangents=True,
        export_materials='EXPORT', export_image_format='AUTO', export_extras=True)
    print('WOOD_SOURCE_AND_GLB_SAVED')
