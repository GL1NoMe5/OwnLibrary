"""Shared geometry, portable material and animation utilities; no cat geometry."""
from pathlib import Path
import math
import bpy
import numpy as np
from mathutils import Vector, Quaternion
ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parents[1]

def activate(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj



def smooth(a, b, v):
    t = max(0., min(1., (v-a)/(b-a)))
    return t*t*(3.-2.*t)



def srgb(c):
    return tuple(v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in c)



def create_materials():
    for name in ('Mat_Cat_Ginger', 'Mat_Cat_FeatureDark'):
        old = bpy.data.materials.get(name)
        if old: old.name += '_original'
    def mat(name, color, roughness):
        m = bpy.data.materials.new(name); m.use_nodes = True
        bs = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        bs.inputs['Base Color'].default_value = (*srgb(color), 1)
        bs.inputs['Roughness'].default_value = roughness
        bs.inputs['Specular IOR Level'].default_value = .25
        return m, bs
    fur, bs = mat('Mat_Cat_Ginger', (1,1,1), .87)
    c = fur.node_tree.nodes.new('ShaderNodeVertexColor'); c.layer_name = 'CoatColor'
    fur.node_tree.links.new(c.outputs['Color'], bs.inputs['Base Color'])
    bs.inputs['Sheen Weight'].default_value = .15
    bs.inputs['Sheen Tint'].default_value = (.13,.095,.06,1)
    bs.inputs['Sheen Roughness'].default_value = .8
    # A small self-contained, tiling hair normal: relief survives GLB export.
    size = 512
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)/size
    h = np.sin(2*np.pi*(xx*65 + .22*np.sin(yy*2*np.pi)*np.sin(xx*2*np.pi)))
    h += .28*np.sin(2*np.pi*(xx*127+yy*3))
    dx = (np.roll(h,-1,1)-np.roll(h,1,1))*.12
    dy = (np.roll(h,-1,0)-np.roll(h,1,0))*.12
    a = np.stack((-dx,-dy,np.ones_like(h)),axis=-1)
    a /= np.linalg.norm(a,axis=-1,keepdims=True)
    pixels = np.concatenate((a*.5+.5,np.ones((size,size,1))),axis=-1)
    im = bpy.data.images.new('Cat_FineCoat_Normal', width=size, height=size)
    im.colorspace_settings.name = 'Non-Color'
    im.pixels.foreach_set(pixels.astype(np.float32).ravel()); im.update()
    im.filepath_raw = str(OUT/'textures/cat-finecoat-normal.png')
    im.save(); im.pack()
    tex = fur.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=im
    norm = fur.node_tree.nodes.new('ShaderNodeNormalMap'); norm.inputs['Strength'].default_value=.10
    fur.node_tree.links.new(tex.outputs['Color'], norm.inputs['Color'])
    fur.node_tree.links.new(norm.outputs['Normal'], bs.inputs['Normal'])
    dark,_ = mat('Mat_Cat_FeatureDark', (.13,.075,.055), .72)
    nose,n = mat('Mat_Cat_NoseLeather', (.54,.29,.255), .51)
    # Geometry fibers use the same vertex-color shader but no texture/normal work.
    fiber = fur.copy(); fiber.name = 'Mat_Cat_SoftFur'
    fbs = next(n for n in fiber.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    for link in list(fiber.node_tree.links):
        if link.to_socket == fbs.inputs['Normal']: fiber.node_tree.links.remove(link)
    whisker,_ = mat('Mat_Cat_Whiskers', (.78,.73,.62), .7)
    return fur,dark,nose,fiber,whisker



def mesh_obj(name, verts, faces, material, colors=None, weights=None):
    mesh = bpy.data.meshes.new(name); mesh.from_pydata(verts, [], faces);mesh.update()
    obj = bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    mesh.materials.append(material)
    for face in mesh.polygons: face.use_smooth=True
    if colors is not None:
        col=mesh.color_attributes.new(name='CoatColor',type='FLOAT_COLOR',domain='POINT')
        col.data.foreach_set('color',np.array([(*c,1) for c in colors],dtype=np.float32).ravel())
    if weights is not None:
        for name in bpy.data.objects['Cat_Armature'].data.bones.keys(): obj.vertex_groups.new(name=name)
        for i, values in enumerate(weights):
            for name,w in values.items():
                if w>0: obj.vertex_groups[name].add([i],float(w),'REPLACE')
    return obj



def tube(name, pts, radii, material, bone='Head', sides=6):
    verts=[]; faces=[]
    pts=[Vector(p) for p in pts]
    for i,p in enumerate(pts):
        t=(pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized()
        u=t.cross(Vector((0,0,1)))
        if u.length<.1: u=t.cross(Vector((0,1,0)))
        u.normalize(); v=t.cross(u).normalized()
        for j in range(sides):
            a=j*2*math.pi/sides
            verts.append(p+(u*math.cos(a)+v*math.sin(a))*radii[i])
    for i in range(len(pts)-1):
        for j in range(sides): faces.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
    faces.extend([tuple(reversed(range(sides))),tuple(range((len(pts)-1)*sides,len(pts)*sides))])
    return mesh_obj(name,verts,faces,material,weights=[{bone:1}]*len(verts))



def detail_coat():
    """Fine broken hair strands, stored in portable image maps, not Blender noise nodes."""
    size=1024
    yy,xx=np.mgrid[0:size,0:size].astype(np.float32)/size
    random=np.random.default_rng(221026)
    h=random.random((size,size),dtype=np.float32)
    for _ in range(7):h=(h+np.roll(h,1,0)+np.roll(h,-1,0))/3
    phase=xx*140+.48*np.sin(yy*2*np.pi)+.19*np.sin(yy*6*np.pi+xx*2*np.pi)
    h=.55*h+.25*np.sin(phase*2*np.pi)+.12*np.sin((xx*263+yy*2)*2*np.pi)
    intensity=np.clip(.79+h*.30,.59,.98)
    im=bpy.data.images.load(str(OUT/'textures/short-fur-albedo.png'),check_existing=True)
    im.pack()
    mat=bpy.data.materials['Mat_Cat_Ginger'];nt=mat.node_tree
    bs=next(n for n in nt.nodes if n.type=='BSDF_PRINCIPLED')
    color=next(n for n in nt.nodes if n.type=='VERTEX_COLOR')
    tex=nt.nodes.new('ShaderNodeTexImage');tex.image=im
    mix=nt.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1
    nt.links.new(color.outputs['Color'],mix.inputs[1]);nt.links.new(tex.outputs['Color'],mix.inputs[2]);nt.links.new(mix.outputs[0],bs.inputs['Base Color'])
    bs.inputs['Specular IOR Level'].default_value=.18;bs.inputs['Sheen Weight'].default_value=.10
    n=bpy.data.images['Cat_FineCoat_Normal']
    # Use the same strand field for surface relief as for pigment variation.
    dx=(np.roll(h,-1,1)-np.roll(h,1,1))*.42;dy=(np.roll(h,-1,0)-np.roll(h,1,0))*.42
    a=np.stack([-dx,-dy,np.ones_like(h)],axis=-1);a/=np.linalg.norm(a,axis=-1,keepdims=True)
    n.scale(size,size);n.pixels.foreach_set(np.concatenate([a*.5+.5,np.ones((size,size,1))],axis=-1).astype(np.float32).ravel())
    n.update();n.save();n.pack()
    next(node for node in nt.nodes if node.type=='NORMAL_MAP').inputs['Strength'].default_value=.55



def make_animations(arm):
    arm.animation_data_create()
    for name in ('CAT_BREATH','CAT_EAR_TWITCH'):
        action=bpy.data.actions.new(name);arm.animation_data.action=action
        if name=='CAT_BREATH':
            p=arm.pose.bones['Chest']
            for frame,amount in ((1,0),(38,1),(97,0)):
                p.scale=(1+amount*.010,1+amount*.012,1+amount*.010)
                p.keyframe_insert('scale',frame=frame,group='Chest')
        else:
            p=arm.pose.bones['Ear_R']
            for frame,angle in ((1,0),(108,0),(112,4),(117,-1.2),(123,0),(193,0)):
                p.rotation_quaternion=Quaternion(Vector((.4,.2,-.9)).normalized(),math.radians(angle))
                p.keyframe_insert('rotation_quaternion',frame=frame,group='Ear_R')
        track=arm.animation_data.nla_tracks.new();track.name=name
        track.strips.new(name,1,action)
    arm.animation_data.action=None
    bpy.context.scene.frame_end=193



def setup_preview():
    scene=bpy.context.scene
    for o in list(scene.objects):
        if o.type in ('CAMERA','LIGHT'):bpy.data.objects.remove(o,do_unlink=True)
    def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
    cam=bpy.data.cameras.new('Cat_Portrait');co=bpy.data.objects.new('Cat_Portrait',cam)
    scene.collection.objects.link(co);co.location=(.34,-.62,.30);aim(co,(0,-.005,.066));cam.lens=55;scene.camera=co
    for name,loc,power,color,size in [('Warm softbox',(-.30,-.30,.55),18,(1,.81,.60),.55),('Cool fill',(.4,-.1,.3),7,(.65,.78,1),.5),('Rim',(.0,.4,.45),16,(1,.73,.44),.35)]:
        l=bpy.data.lights.new(name,'AREA');l.energy=power;l.color=color;l.shape='DISK';l.size=size
        o=bpy.data.objects.new(name,l);scene.collection.objects.link(o);o.location=loc;aim(o,(0,0,.05))
    scene.world.color=(.06,.06,.06)
    scene.render.resolution_x=1100;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.render.film_transparent=True
    scene.view_settings.exposure=-1.6
    activate(bpy.data.objects['Cat_Mesh'])
