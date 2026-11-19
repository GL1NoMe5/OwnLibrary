"""Build the reading lamp on the original Sanctuary floor stand (metres, Blender Z up)."""
from math import cos, pi, sin, tau

import bpy
from mathutils import Vector


CENTER = (2.28, .55)
FOLDS = 32


class Surface:
    def __init__(self):
        self.vertices = []
        self.faces = []
        self.slots = []

    def ring(self, points):
        first = len(self.vertices)
        self.vertices.extend(points)
        return list(range(first, len(self.vertices)))

    def strip(self, lower, upper, slots=(0,)):
        for i, vertex in enumerate(lower):
            j = (i + 1) % len(lower)
            self.faces.append((vertex, lower[j], upper[j], upper[i]))
            self.slots.append(slots[i % len(slots)])

    def turn(self, center, profile, segments=32):
        """Solid of revolution from a bottom-to-top series of radii and heights."""
        rings = []
        for radius, height in profile:
            rings.append(self.ring([
                (center[0] + radius * cos(tau*i/segments),
                 center[1] + radius * sin(tau*i/segments), height)
                for i in range(segments)
            ]))
        for lower, upper in zip(rings, rings[1:]):
            self.strip(lower, upper)
        self.faces.extend([tuple(reversed(rings[0])), tuple(rings[-1])])
        self.slots.extend([0, 0])

    def rod(self, start, end, radius):
        axis = (Vector(end) - Vector(start)).normalized()
        right = axis.orthogonal().normalized() * radius
        front = axis.cross(right)
        rings = []
        for point in (start, end):
            rings.append(self.ring([
                Vector(point) + cos(tau*i/8)*right + sin(tau*i/8)*front
                for i in range(8)
            ]))
        self.strip(*rings)

    def mesh(self, name, world_to_local, materials, smooth=False):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata([world_to_local @ Vector(v) for v in self.vertices], [], self.faces)
        for mat in materials:
            mesh.materials.append(mat)
        for poly, slot in zip(mesh.polygons, self.slots):
            poly.material_index = slot
            poly.use_smooth = smooth
        mesh.update()
        return mesh


def dye(mat, color, emission, strength):
    shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = .86
    shader.inputs['Emission Color'].default_value = (*emission, 1)
    shader.inputs['Emission Strength'].default_value = strength
    mat.diffuse_color = (*color, 1)


def replace_mesh(obj, surface, materials, smooth=False):
    old = obj.data
    obj.data = surface.mesh(obj.name, obj.matrix_world.inverted(), materials, smooth)
    if old.users == 0:
        bpy.data.meshes.remove(old)


def build_lamp(collection):
    shade = bpy.data.objects.new('ReadingLamp_Pleats', bpy.data.meshes.new('Pleats'))
    collection.objects.link(shade)
    linen = bpy.data.materials['Mat_Lamp_Shade_Warm'].copy()
    linen.name = 'Mat_ReadingLamp_Linen'
    fold = bpy.data.materials.get('Mat_Lamp_LinenReturn')
    if fold is None:
        fold = linen.copy()
        fold.name = 'Mat_Lamp_LinenReturn'
    # A second, denser facing catches less transmitted bulb light. Constant
    # full-bright emission on both faces would erase the pleats in the app.
    dye(linen, (.80, .63, .40), (1., .69, .35), .85)
    dye(fold, (.70, .51, .31), (1., .65, .31), .49)
    x, y = CENTER
    body = Surface()
    previous = None
    for height, radius, recess in [
        (1.400, .217, .002), (1.407, .220, .005),
        (1.422, .215, .014), (1.530, .171, .015),
        (1.644, .134, .011), (1.654, .131, .004), (1.660, .129, .002),
    ]:
        ring = []
        for i in range(2*FOLDS):
            angle = pi*i/FOLDS
            r = radius - (recess if i % 2 else 0)
            ring.append((x + r*cos(angle), y + r*sin(angle), height))
        current = body.ring(ring)
        if previous is not None:
            body.strip(previous, current, slots=(0, 1))
        previous = current
    replace_mesh(shade, body, [linen, fold])

    mount = Surface()
    # Rolled metal binding around the two frame hoops, with the interior open.
    for radius, height, minor in [(.218, 1.404, .0036), (.130, 1.656, .0030)]:
        hoops = []
        for j in range(8):
            angle = tau*j/8
            r = radius + minor*cos(angle)
            hoops.append(mount.ring([
                (x + r*cos(tau*i/96), y + r*sin(tau*i/96), height + minor*sin(angle))
                for i in range(96)
            ]))
        for j in range(8):
            mount.strip(hoops[j], hoops[(j + 1) % 8])
    # Harp, three spokes, and a turned finial continue the existing pole.
    mount.turn(CENTER, [
        (.009, 1.516), (.016, 1.526), (.013, 1.54), (.005, 1.55),
        (.005, 1.645), (.018, 1.651), (.018, 1.657), (.007, 1.661),
        (.007, 1.666), (.011, 1.672), (.010, 1.679), (.003, 1.686),
    ])
    for j in range(3):
        angle = tau*j/3
        mount.rod((x, y, 1.650),
                  (x+.130*cos(angle), y+.130*sin(angle), 1.656), .0025)

    # Brass ball chain hangs from a short switch arm on the socket.
    chain = (x-.059, y-.035)
    mount.rod((x, y, 1.520), (*chain, 1.498), .004)
    mount.turn(chain, [(.0012, 1.315), (.0012, 1.499)], 8)
    for i in range(24):
        z = 1.322 + .0076*i
        mount.turn(chain, [(.0016,z-.003), (.0034,z-.001), (.0034,z+.001), (.0016,z+.003)], 8)
    mount.turn(chain, [
        (.002, 1.286), (.007, 1.290), (.009, 1.297), (.008, 1.303),
        (.004, 1.310), (.004, 1.316), (.002, 1.319),
    ], 16)

    metal = bpy.data.materials['Mat_Metal_AgedBrass']
    obj = bpy.data.objects.get('ReadingLamp_Brasswork')
    if obj is None:
        mesh = bpy.data.meshes.new('ReadingLamp_Brasswork')
        obj = bpy.data.objects.new('ReadingLamp_Brasswork', mesh)
        collection.objects.link(obj)
        bpy.context.view_layer.update()
    replace_mesh(obj, mount, [metal], smooth=True)
