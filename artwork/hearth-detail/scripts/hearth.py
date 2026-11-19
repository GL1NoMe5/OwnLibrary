"""Cast-iron fireplace, firebrick liner and brass mantel clock. Dimensions in metres."""
from math import cos, pi, sin, tau
from random import Random

import bpy
from mathutils import Vector


class Batch:
    """Collect small solid details in a single mesh and glTF draw per finish."""
    def __init__(self, name, roughness, metallic):
        self.name = name
        self.roughness = roughness
        self.metallic = metallic
        self.vertices, self.faces, self.colors, self.smooth = [], [], [], []

    def part(self, vertices, faces, color, smooth=False):
        offset = len(self.vertices)
        self.vertices.extend(vertices)
        self.faces.extend(tuple(offset + idx for idx in f) for f in faces)
        self.colors.extend([color] * len(vertices))
        self.smooth.extend([smooth] * len(faces))

    def plaque(self, outline, y, depth, color):
        # A counterclockwise outline in the XZ plane faces the room (-Y).
        n = len(outline)
        area = sum(x*z2 - x2*z for (x,z),(x2,z2) in zip(outline, outline[1:]+outline[:1]))
        if area < 0:
            outline = list(reversed(outline))
        verts = [(x, plane, z) for plane in (y, y+depth) for x,z in outline]
        faces = [tuple(range(n)), tuple(reversed(range(n, 2*n)))]
        faces += [(j,i,i+n,j+n) for i in range(n) for j in [(i+1)%n]]
        self.part(verts, faces, color)

    def tube(self, path, radius, color, sides=8, closed=False):
        # Paths are planar ornaments on the vertical face of the casting.
        points = [Vector(p) for p in path]
        verts, faces = [], []
        for i,p in enumerate(points):
            first = points[i-1] if i or closed else p
            last = points[(i+1)%len(points)] if i+1<len(points) or closed else p
            axis = (last-first).normalized()
            forward = Vector((0,-1,0))
            side = axis.cross(forward).normalized()
            for j in range(sides):
                angle = tau*j/sides
                verts.append(p + radius*(cos(angle)*forward + sin(angle)*side))
        for i in range(len(points) if closed else len(points)-1):
            a, b = i*sides, ((i+1)%len(points))*sides
            for j in range(sides):
                k = (j+1)%sides
                faces.append((a+j,a+k,b+k,b+j))
        if not closed:
            faces.extend([tuple(reversed(range(sides))),tuple(range(len(verts)-sides,len(verts)))])
        self.part(verts, faces, color, True)

    def finish(self, collection):
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.update()
        attr = mesh.color_attributes.new(name="Patina", type='BYTE_COLOR', domain='POINT')
        for data, color in zip(attr.data, self.colors):
            data.color = (*color, 1)
        for poly, smooth in zip(mesh.polygons, self.smooth):
            poly.use_smooth = smooth
        mat = bpy.data.materials.new(self.name)
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        shader = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
        shader.inputs['Roughness'].default_value = self.roughness
        shader.inputs['Metallic'].default_value = self.metallic
        color = nodes.new('ShaderNodeVertexColor')
        color.layer_name = attr.name
        mat.node_tree.links.new(color.outputs['Color'], shader.inputs['Base Color'])
        mesh.materials.append(mat)
        obj = bpy.data.objects.new(self.name, mesh)
        collection.objects.link(obj)


def rect(x1,z1,x2,z2):
    return [(x1,z1),(x2,z1),(x2,z2),(x1,z2)]


def ellipse(x,z,rx,rz,steps=48):
    return [(x + rx*cos(tau*i/steps), z + rz*sin(tau*i/steps)) for i in range(steps)]


def clip(poly, axis, edge, direction):
    out = []
    for a,b in zip(poly,poly[1:]+poly[:1]):
        da, db = (a[axis]-edge)*direction, (b[axis]-edge)*direction
        if da >= 0:
            out.append(a)
        if (da > 0 > db) or (da < 0 < db):
            t = da/(da-db)
            out.append(tuple(v+(w-v)*t for v,w in zip(a,b)))
    return out


def brickwork(clay):
    rng = Random(507)
    # A 2:1 bond of perpendicular bricks, turned on the diagonal then trimmed
    # to the opening. The recess behind each brick is the original fireback.
    unit, gap = .064, .0018
    for i in range(-12,13):
        for j in range(-12,13):
            bond = (i-j)%4
            if bond not in (0,3):
                continue
            w,h = (2,1) if bond==0 else (1,2)
            tile = rect(i*unit+gap,j*unit+gap,(i+w)*unit-gap,(j+h)*unit-gap)
            tile = [((x-z)*.707107, .43+(x+z)*.707107) for x,z in tile]
            for axis,edge,sign in [(0,-.444,1),(0,.444,-1),(1,.109,1),(1,.796,-1)]:
                tile = clip(tile,axis,edge,sign)
            if len(tile)<3:
                continue
            height = sum(p[1] for p in tile)/len(tile)
            tone = rng.uniform(.60,1.15) * (1-.42*(height/.8)**2)
            color = tuple(k*tone for k in (.164,.085,.056))
            y=1.888+rng.uniform(-.0015,.0015)
            cx=sum(p[0] for p in tile)/len(tile)
            cz=height
            verts=[(cx,y-.002,cz)]
            verts += [(cx+.96*(x-cx),y,cz+.96*(z-cz)) for x,z in tile]
            verts += [(x,y+.0028,z) for x,z in tile]
            faces=[]
            n=len(tile)
            for a in range(n):
                b=(a+1)%n
                faces.extend([(0,a+1,b+1),(a+1,a+1+n,b+1+n,b+1)])
            clay.part(verts,faces,color)
            # Soot pools near the crown and at the sides of the back plate.
            # Interpolating across each fired face keeps the bevel readable.
            shades=[rng.uniform(.82,1.03) for _ in tile]
            for idx,(x,_,z) in enumerate(verts):
                patina = .99 if idx==0 else shades[(idx-1)%n]
                soot = 1 - .51*min(1, (z/.80)**3 + .3*(abs(x)/.45)**2)
                clay.colors[len(clay.colors)-len(verts)+idx]=tuple(c*patina*soot for c in color)


def split_billets(batch):
    # Axes measured from the wood on the grate and the stack on the hearth.
    billets = [
        ((-.722,1.350,.125),(-.087,.996,0),.30,.043,False),
        ((-.628,1.350,.125),(.070,.998,0),.30,.041,False),
        ((-.677,1.350,.195),(-.035,.999,0),.28,.039,False),
        ((0,1.738,.208),(.990,.139,.035),.50,.055,True),
        ((-.030,1.662,.222),(.978,-.208,-.035),.46,.050,True),
        ((.040,1.708,.288),(.969,.204,.137),.42,.046,True),
        ((-.100,1.762,.272),(.981,-.173,-.086),.38,.042,True),
    ]
    rng = Random(928)
    for center, axis, length, radius, burnt in billets:
        axis = Vector(axis).normalized()
        up = (Vector((0,0,1))-axis*axis.z).normalized()
        right = up.cross(axis)
        center = Vector(center)
        count = 38
        rough = [rng.uniform(.92,1.035) for _ in range(count)]
        ridges = [rng.uniform(.71,1.09) for _ in range(count)]
        phase, split = rng.uniform(0,tau), rng.uniform(-.76,-.50)
        def section(j,span):
            a = tau*j/count + .054*sin(8*span + j*.8+phase)
            x = rough[j]*cos(a)*(1+.03*sin(6*span+phase))
            z = max(split,rough[j]*sin(a)) + .035*sin(span*4+j*.25)
            end = .0035*sin(phase+j*.43)
            return center+axis*(span*length+end) + radius*(right*x + up*z)
        previous = [section(j,-.5) for j in range(count)]
        for s in range(1,9):
            ring = [section(j,s/8-.5) for j in range(count)]
            for j in range(count):
                k=(j+1)%count
                flat = sin(tau*j/count) < split
                bark = (.085,.052,.034) if burnt else (.150,.079,.034)
                cut = (.175,.091,.045) if burnt else (.48,.291,.145)
                # Bark flakes break across the grain; broad neighbouring faces
                # share tone and only short fissures catch a dark occlusion.
                tone = ridges[j]*(.96+.13*sin(3.1*s+j*.63+phase))
                if (j+s//3)%11==0 and s%4: tone *= .57
                rgb = tuple(c*tone for c in (cut if flat else bark))
                batch.part([previous[j],previous[k],ring[k],ring[j]],[(0,1,2,3)],rgb)
            previous = ring
        for end in (-.5,.5):
            rim=[section(j,end) for j in range(count)]
            heart=center+axis*(end*length)+up*(radius*.09)
            previous=[heart for _ in rim]
            for n, fraction in enumerate([.19,.23,.41,.45,.61,.65,.81,.85,.96,1.]):
                loop = [heart+(p-heart)*fraction for p in rim]
                for j in range(count):
                    k=(j+1)%count
                    tone = (.48 if n%2 else .95)*rng.uniform(.9,1.06)
                    if j in (4,21) and fraction>.6: tone *= .30
                    rgb = tuple(c*tone for c in ((.245,.135,.068) if burnt else (.56,.328,.151)))
                    facet = [previous[j],loop[j],loop[k]] if n==0 else [previous[j],loop[j],loop[k],previous[k]]
                    if end<0: facet.reverse()
                    batch.part(facet,[tuple(range(len(facet)))],rgb)
                previous=loop


def coal_bed(char, glow):
    rng = Random(305)
    for row in range(5):
        for col in range(13):
            x=(col-6)*.042 + (row%2)*.012 + rng.uniform(-.012,.012)
            y=1.583+row*.056+rng.uniform(-.024,.024)
            if (x/.31)**2+((y-1.70)/.167)**2 > 1.10:
                continue
            radius=rng.uniform(.021,.037)
            height=rng.uniform(.019,.050)
            bottom=.11 + rng.uniform(-.004,.003)
            n=rng.randrange(6,10)
            phase=rng.uniform(0,tau)
            rough=[rng.uniform(.79,1.15) for _ in range(n)]
            rings=[]
            for scale,h in [(.65,0), (1,.49), (.69,.86), (.24,1)]:
                ring=[]
                for j in range(n):
                    a=tau*j/n+phase
                    ring.append((x+radius*scale*rough[j]*cos(a),
                                 y+radius*scale*rough[j]*sin(a),
                                 bottom+height*h+rng.uniform(-.002,.002)))
                rings.append(ring)
            hot = rng.random()<.60
            ash = rng.uniform(.036,.14)
            for level,(lo,hi) in enumerate(zip(rings,rings[1:])):
                for j in range(n):
                    k=(j+1)%n
                    face=[lo[j],lo[k],hi[k],hi[j]]
                    tone = ash*rng.uniform(.72,1.08)
                    char.part(face,[(0,1,2,3)],(tone,tone*.86,tone*.77))
                    if hot and level==0 and rng.random()>.22:
                        # Thin glowing breaks below a dark charcoal crust.
                        fragment = [(x+(a-x)*1.009,y+(b-y)*1.009,z) for a,b,z in face]
                        strength=rng.uniform(.38,.9)
                        glow.part(fragment,[(0,1,2,3)],(strength,.089*strength,.008))
            char.part(rings[-1],[tuple(range(n))],(ash*1.2,ash*1.1,ash))


def casting(iron, brass):
    base, worn, gold = (.060,.069,.065), (.105,.117,.107), (.34,.202,.078)
    # One continuous U with a shallow elliptical arch. Its front is 24 mm
    # proud of the masonry. The spring line clears the existing grate.
    def opening(rx, rise):
        return [(rx*cos(pi*i/56),.537+rise*sin(pi*i/56)) for i in range(57)]
    outline = [(-.514,.08),(-.514,.858),(.514,.858),(.514,.08),(.427,.08)]
    outline += opening(.427,.233) + [(-.427,.08)]
    iron.plaque(outline,1.475,.028,base)
    for rx,rise,r,y,col in [(.433,.239,.009,1.471,worn),(.454,.258,.0045,1.471,gold)]:
        rim = [(rx,.083)]+opening(rx,rise)+[(-rx,.083)]
        batch = iron if col==worn else brass
        batch.tube([(x,y,z) for x,z in rim],r,col)
    for xsign in (-1,1):
        for n in range(3):
            x = xsign*(.469+.012*n)
            iron.tube([(x,1.471,.145),(x,1.471,.518)],.0043,worn)
        for z,h in [(.081,.042),(.12,.012),(.524,.014),(.548,.013)]:
            x = xsign*.479
            iron.plaque(rect(x-.035,z,x+.035,z+h),1.462,.014,worn)
        # Raised fan-leaf spandrels in the corners above the arch.
        for n in range(5):
            x0,z0 = xsign*.49,.617
            x1,z1 = xsign*(.47-.049*n),.813
            mid = xsign*(.477-.019*n)
            path = [((1-t)**2*x0+2*(1-t)*t*mid+t*t*x1,1.466,
                     (1-t)**2*z0+2*(1-t)*t*.739+t*t*z1) for t in [i/12 for i in range(13)]]
            iron.tube(path,.0042,worn)
            brass.plaque(ellipse(x1,z1,.0048,.006,10),1.461,.006,gold)
    for z,r in [(.835,.004),(.857,.009)]:
        iron.tube([(-.516,1.466,z),(.516,1.466,z)],r,worn)
    # A lozenge and a domed boss above the keystone.
    brass.plaque([(0,.777),(.025,.805),(0,.834),(-.025,.805)],1.462,.014,gold)
    iron.plaque(ellipse(0,.805,.009,.011,20),1.456,.009,worn)


def clock(iron, brass, enamel):
    x,z = -.19,1.390
    aged, satin = (.39,.228,.082), (.53,.347,.146)
    forest, dark = (.042,.095,.078), (.036,.033,.025)
    # Stepped plinth and a lacquered oval case with a double turned bezel.
    for half,zb,h,y,col in [(.102,1.280,.013,1.501,aged),(.094,1.293,.014,1.509,forest),
                              (.086,1.307,.012,1.514,aged)]:
        (iron if col==forest else brass).plaque(rect(x-half,zb,x+half,zb+h),y,.084,col)
    iron.plaque(ellipse(x,z,.088,.091),1.513,.074,forest)
    enamel.plaque(ellipse(x,z,.073,.073),1.506,.009,(.77,.675,.476))
    for radius,r,y,c in [(.082,.006,1.510,aged),(.074,.0025,1.503,satin)]:
        brass.tube([(a,y,b) for a,b in ellipse(x,z,radius,radius,64)],r,c,10,True)
    for i in range(60):
        theta = tau*i/60
        major = i%5==0
        u,v = sin(theta),cos(theta)
        outer,inner,half = .066,.054 if major else .062,.0019 if major else .00065
        tick = [(x+r*u+d*v,z+r*v-d*u) for r,d in [(inner,-half),(outer,-half),(outer,half),(inner,half)]]
        enamel.plaque(tick,1.504,.0022,dark)
    for angle,length,width in [(-55,.041,.0056),(60,.055,.0037)]:
        a=angle*pi/180
        hand=[(x+t*sin(a)+d*cos(a),z+t*cos(a)-d*sin(a))
              for t,d in [(-.010,0),(.010,-width),(length,0),(.010,width)]]
        iron.plaque(hand,1.500 if length>.05 else 1.5015,.002,dark)
    brass.plaque(ellipse(x,z,.0047,.0047,18),1.496,.005,satin)
    handle = [(x+.027*cos(pi*i/24),1.548,1.473+.018*sin(pi*i/24)) for i in range(25)]
    brass.tube(handle,.0033,satin)


def build_hearth(collection):
    iron = Batch('Hearth_BlackenedIron',.49,.57)
    brass = Batch('Hearth_AntiqueBrass',.37,.72)
    clay = Batch('Hearth_Firebrick',.93,0)
    dial = Batch('Clock_VitreousDial',.38,.06)
    wood = Batch('Hearth_SplitBillets',.9,0)
    char = Batch('Hearth_Charcoal',.97,0)
    glow = Batch('Hearth_EmberFissures',.85,0)
    casting(iron,brass)
    brickwork(clay)
    clock(iron,brass,dial)
    split_billets(wood)
    coal_bed(char,glow)
    for batch in (iron,brass,clay,dial,wood,char,glow):
        batch.finish(collection)
