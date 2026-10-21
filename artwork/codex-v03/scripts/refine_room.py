"""Refine Argon's v02 as a new source. Run with Blender --background --python.

No v01/v02 inputs are written. Coordinates below are Blender's Z-up metres.
The runtime light rig is authored separately in SanctuaryScene.ts.
"""
import bpy
import math
import random
import subprocess
from contextlib import nullcontext
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
SOURCE = Path(r'D:\CodexProjects\OwnLibrary-3D\argon\v02\source\sanctuary-room.blend')
OUTPUT = ROOT / 'artwork/codex-v03'
RUNTIME = ROOT / 'src/renderer/public/room/sanctuary-room.glb'
RNG = random.Random(21102026)


class Needles:
    """Opaque crossed needle geometry: no alpha cards or alpha overdraw."""
    def __init__(self):
        self.vertices, self.faces, self.colors = [], [], []

    def triangle(self, a, b, c, color):
        start = len(self.vertices)
        self.vertices.extend((tuple(a), tuple(b), tuple(c)))
        self.faces.append((start, start + 1, start + 2))
        self.colors.extend((color, color, color))

    def needle(self, base, direction, length):
        direction = direction.normalized()
        side = direction.cross(Vector((0, 0, 1)))
        if side.length < .01:
            side = direction.cross(Vector((0, 1, 0)))
        side.normalize()
        up = direction.cross(side).normalized()
        width = RNG.uniform(.0008, .0013)
        tip = base + direction * length
        shade = RNG.uniform(.65, 1.28)
        color = (.045 * shade, .105 * shade, .052 * shade, 1)
        self.triangle(base - side * width, base + side * width, tip, color)
        self.triangle(base - up * width, base + up * width, tip, color)

    def shoot(self, base, direction, length, dense=1):
        direction = direction.normalized()
        side = direction.cross(Vector((0, 0, 1)))
        if side.length < .05:
            side = direction.cross(Vector((1, 0, 0)))
        side.normalize()
        up = side.cross(direction).normalized()
        # Dense inner needles form a dark tapered core; individual outer needles
        # provide the silhouette. This avoids subpixel "dust" between bare twigs.
        tip = base + direction * length
        core = (.025, .060, .030, 1)
        rings = []
        for t, radius in [(0, .004), (.38, .009), (.78, .005)]:
            rings.append([base+direction*(length*t)+(side*math.cos(i*math.pi/2)+up*math.sin(i*math.pi/2))*radius for i in range(4)])
        for ring in range(2):
            for i in range(4):
                k=(i+1)%4
                self.triangle(rings[ring][i],rings[ring][k],rings[ring+1][k],core)
                self.triangle(rings[ring][i],rings[ring+1][k],rings[ring+1][i],core)
        for i in range(4):
            self.triangle(rings[-1][i], rings[-1][(i+1)%4], tip, core)
        count = max(18, int(length * 420 * dense))
        for j in range(count):
            t = (j + .3) / count
            point = base + direction * (t * length)
            angle = j * 2.39996 + RNG.uniform(-.2, .2)
            spread = side * math.cos(angle) + up * math.sin(angle)
            n_dir = direction * .38 + spread * .86
            n_len = RNG.uniform(.018, .034) * (.65 + .35 * math.sin(t * math.pi))
            self.needle(point, n_dir, n_len)

    def branch(self, base, direction, length):
        direction = direction.normalized()
        side = direction.cross(Vector((0, 0, 1))).normalized()
        self.shoot(base, direction, length, .8)
        for i in range(1, 8):
            t = i / 8
            p = base + direction * (length * t) + Vector((0, 0, -.018 * t*t))
            for sign in (-1, 1):
                shoot_dir = (direction * .44 + side * sign * .8 + Vector((0, 0, RNG.uniform(-.1, .22)))).normalized()
                self.shoot(p, shoot_dir, max(.035, length * .40 * (1 - .67 * t)))

    def replace(self, name, mat):
        obj = bpy.data.objects[name]
        old = obj.data
        mesh = bpy.data.meshes.new(name + '_NeedlesV03')
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.materials.append(mat)
        color = mesh.color_attributes.new(name='NeedleColor', type='FLOAT_COLOR', domain='POINT')
        flat = [value for rgba in self.colors for value in rgba]
        color.data.foreach_set('color', flat)
        mesh.update()
        obj.data = mesh
        if old.users == 0:
            bpy.data.meshes.remove(old)
        print(name, len(self.faces), 'opaque needle triangles', flush=True)


def principled(mat):
    return next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')


def foliage():
    mat = bpy.data.materials.new('Mat_Holiday_SpruceNeedles_V03')
    mat.use_nodes = True
    bsdf = principled(mat)
    bsdf.inputs['Roughness'].default_value = .9
    bsdf.inputs['Specular IOR Level'].default_value = .12
    attr = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'NeedleColor'
    mat.node_tree.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    tree = Needles()
    origin = Vector((-2.38, 1.18, 0))
    for layer in range(26):
        t = layer / 25
        height = .25 + t * 1.94 + RNG.uniform(-.018, .018)
        radius = .40 * (1 - t)**.76 + .045
        count = round(14 - t * 7)
        for j in range(count):
            angle = j / count * 2 * math.pi + layer * .62 + RNG.uniform(-.15, .15)
            direct = Vector((math.cos(angle), math.sin(angle), -.20 + .45*t))
            length = radius * RNG.uniform(.9, 1.08)
            if direct.x > .35:
                length *= .77  # preserve clearance to left bookcase
            tree.branch(origin + Vector((0, 0, height)), direct, length)
    tree.replace('Holiday_Tree', mat)
    garland = Needles()
    for i in range(62):
        t = i / 61
        base = Vector((-.92 + t*1.84, 1.405 + .022*math.cos(t*math.pi*2), 1.286 - .018*math.sin(t*math.pi*3)))
        for sign in (-1, 1):
            garland.branch(base, Vector((sign*.70, -.65, RNG.uniform(-.28, .15))), RNG.uniform(.09, .15))
    garland.replace('Holiday_MantelGarland', mat)
    wreath = Needles()
    for i in range(76):
        angle = i / 76 * math.pi * 2
        base = Vector((-2.85, .70 + math.cos(angle)*.22, 1.82 + math.sin(angle)*.22))
        tangent = Vector((.25, -math.sin(angle), math.cos(angle)))
        wreath.branch(base, tangent, RNG.uniform(.08, .12))
    wreath.replace('Holiday_Wreath', mat)


def materials():
    # Reduce exaggerated sheen and normal strength; preserve all wood tint prefixes.
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        nodes = mat.node_tree.nodes
        bsdf = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not bsdf:
            continue
        fabric = mat.name.startswith('Mat_Fabric') or mat.name == 'Mat_Holiday_Knit'
        wood = mat.name.startswith('Mat_Wood_Walnut')
        for normal in [n for n in nodes if n.type == 'NORMAL_MAP']:
            normal.inputs['Strength'].default_value *= .65 if wood else .8
        if wood or fabric:
            if 'Specular IOR Level' in bsdf.inputs:
                bsdf.inputs['Specular IOR Level'].default_value = .25 if wood else .13
            if 'Sheen Weight' in bsdf.inputs and fabric:
                bsdf.inputs['Sheen Weight'].default_value = .18
        if mat.name == 'Mat_Window_NightGlass':
            bsdf.inputs['Base Color'].default_value = (.009, .018, .042, 1)
            bsdf.inputs['Emission Color'].default_value = (.014, .028, .065, 1)
            bsdf.inputs['Emission Strength'].default_value = .40
            bsdf.inputs['Roughness'].default_value = .3


def textiles():
    blanket = bpy.data.objects['Armchair_Blanket']
    # Multiple gravity-weighted folds with an irregular hem, keeping the upper drape seated.
    for vert in blanket.data.vertices:
        x, y, z = vert.co
        t = max(0, min(1, (.56-z)/.40))
        u = (x-1.32)/.36
        vert.co.y += (.016*math.sin(u*math.pi*6+.55*t) + .008*math.sin(u*math.pi*11-1.4*t))*t**.8
        vert.co.z += .007*math.sin(u*math.pi*5+.7)*t**3
    blanket.data.update()
    # Existing cuff/holder mesh is retained; tiny uneven folds only in hanging fabric.
    stockings = bpy.data.objects['Holiday_Stockings']
    for vert in stockings.data.vertices:
        x, y, z = vert.co
        if z < 1.13:
            fade = min(1, (1.13-z)/.16)
            vert.co.y += .0035*math.sin(z*87+x*17)*fade
    stockings.data.update()
    # Piping follows each connected upholstered component's widest middle contour.
    chair = bpy.data.objects['Armchair_Body']
    mesh = chair.data
    adjacency = [[] for _ in mesh.vertices]
    for edge in mesh.edges:
        a,b = edge.vertices
        adjacency[a].append(b); adjacency[b].append(a)
    unseen = set(range(len(mesh.vertices)))
    curves = []
    while unseen:
        first = unseen.pop(); stack = [first]; group = [first]
        while stack:
            for other in adjacency[stack.pop()]:
                if other in unseen:
                    unseen.remove(other); group.append(other); stack.append(other)
        if len(group) < 30:
            continue
        points = [mesh.vertices[i].co.copy() for i in group]
        lo = Vector([min(p[i] for p in points) for i in range(3)])
        hi = Vector([max(p[i] for p in points) for i in range(3)])
        size = hi-lo
        axis = 1 if size.z > .35 else 2
        center = (lo+hi)/2
        selected = [p for p in points if abs(p[axis]-center[axis]) < size[axis]*.065]
        if len(selected) < 8:
            continue
        axes = [i for i in range(3) if i != axis]
        selected.sort(key=lambda p: math.atan2(p[axes[1]]-center[axes[1]], p[axes[0]]-center[axes[0]]))
        curve = bpy.data.curves.new('UpholsteryPiping', 'CURVE')
        curve.dimensions = '3D'; curve.bevel_depth = .0017; curve.bevel_resolution = 2
        spline = curve.splines.new('POLY'); spline.points.add(len(selected)-1)
        for out, point in zip(spline.points, selected):
            point += (point-center).normalized()*.0018
            out.co = (*point, 1)
        spline.use_cyclic_u = True
        obj = bpy.data.objects.new('Armchair_Piping', curve)
        bpy.data.collections['SanctuaryRoom'].objects.link(obj)
        obj.parent = bpy.data.objects['RoomRoot']
        curve.materials.append(bpy.data.materials['Mat_Fabric_Terracotta'])
        curves.append(obj)
    for obj in curves:
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True); bpy.context.view_layer.objects.active = obj
        bpy.ops.object.convert(target='MESH')


def reference_lighting():
    scene = bpy.context.scene
    for obj in bpy.data.objects:
        if obj.type != 'LIGHT':
            continue
        if obj.name.startswith('Neutral_'):
            obj.hide_render = True; obj.hide_viewport = True
        elif obj.name == 'Light_RoomSoftBounce': obj.data.energy = 18
        elif obj.name.startswith('Light_Cabinet'): obj.data.energy = 22
        elif obj.name == 'Light_FireplaceGlow':
            obj.data.energy = 85; obj.data.color = (1,.42,.14); obj.data.shadow_soft_size = .14
        elif obj.name == 'Light_FloorLamp':
            obj.data.energy = 85; obj.data.color = (1,.68,.38); obj.data.shadow_soft_size = .20
        elif obj.name == 'Light_HolidayTree':
            obj.data.energy = 20; obj.data.color = (1,.55,.22)
        elif obj.name == 'Light_WindowMoonFill':
            obj.data.energy = 70; obj.data.color = (.32,.48,1)
    if scene.world and scene.world.use_nodes:
        bg = next((n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND'), None)
        if bg:
            bg.inputs['Color'].default_value = (.12,.19,.32,1)
            bg.inputs['Strength'].default_value = .12
    scene.camera = bpy.data.objects['Camera_OVERVIEW']
    # The current engine identifier was read from the connected Blender 5.2.
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 1440; scene.render.resolution_y = 810
    scene.render.resolution_percentage = 100
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                area.spaces.active.region_3d.view_perspective = 'CAMERA'
                area.spaces.active.shading.type = 'RENDERED'


def export_current():
    windows = bpy.context.window_manager.windows
    override = nullcontext()
    if windows:
        window = windows[0]
        area = next((a for a in window.screen.areas if a.type == 'VIEW_3D'), window.screen.areas[0])
        region = next((r for r in area.regions if r.type == 'WINDOW'), None)
        override = bpy.context.temp_override(window=window, area=area, region=region)
    with override:
        bpy.ops.object.select_all(action='DESELECT')
        for obj in bpy.data.collections['SanctuaryRoom'].all_objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = bpy.data.objects['RoomRoot']
        bpy.ops.export_scene.gltf(filepath=str(RUNTIME), export_format='GLB', use_selection=True,
            export_cameras=True, export_yup=True, export_apply=True, export_texcoords=True,
            export_normals=True, export_tangents=True, export_materials='EXPORT',
            export_image_format='AUTO', export_extras=True)
    subprocess.run(['node', str(ROOT/'scripts/optimize-room.mjs'), str(RUNTIME)], check=True)
    print('V03_EXPORTED', str(RUNTIME), RUNTIME.stat().st_size, flush=True)


def main():
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    materials(); textiles(); foliage(); reference_lighting()
    bpy.context.view_layer.update()
    (OUTPUT/'source').mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT/'source/sanctuary-room.blend'))
    # Loading a file from an MCP timer invalidates the calling UI context.
    # Export on the next tick, when Blender has activated the new file's window.
    if not hasattr(bpy.context, 'active_object'):
        bpy.app.timers.register(export_current, first_interval=.2)
        print('Source saved; export scheduled for the next Blender UI tick.')
    else:
        export_current()


if __name__ == '__main__':
    main()
