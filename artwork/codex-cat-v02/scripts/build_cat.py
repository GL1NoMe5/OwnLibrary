"""Adult resting tabby, built from empty Blender data. No source cat mesh is reused.

Geometry/rig authoring is executed in the live Blender through MCP.
Common mesh/image helpers are shared with the earlier experiment, not its anatomy.
"""
import bpy, bmesh, math, random, bisect, runpy
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree
ROOT=Path(r'D:\CodexProjects\OwnLibrary')
OUT=ROOT/'artwork/codex-cat-v02'
H=runpy.run_path(str(OUT/'scripts/blender_helpers.py'))
H['mesh_obj'].__globals__['OUT']=OUT
mesh_obj=H['mesh_obj'];tube=H['tube'];activate=H['activate'];smooth=H['smooth'];srgb=H['srgb']
R=random.Random(20261022)
HC=Vector((-.091,-.085,.062))


def clear_scene():
    for o in list(bpy.data.objects):bpy.data.objects.remove(o,do_unlink=True)
    for s in list(bpy.data.scenes):
        if s!=bpy.context.scene:bpy.data.scenes.remove(s)
    for a in list(bpy.data.actions):bpy.data.actions.remove(a)
    for m in list(bpy.data.materials):bpy.data.materials.remove(m)
    for im in list(bpy.data.images):
        if im.type!='RENDER_RESULT':bpy.data.images.remove(im)
    for d in ('source','textures','previews'): (OUT/d).mkdir(parents=True,exist_ok=True)


def rig():
    data=bpy.data.armatures.new('SleepingCatSkeleton');arm=bpy.data.objects.new('Cat_Armature',data)
    bpy.context.scene.collection.objects.link(arm);activate(arm);bpy.ops.object.mode_set(mode='EDIT')
    bones=[('Root',(0,0,0),(0,0,.025),None),
           ('Spine',(.10,.015,.045),(-.065,.015,.065),'Root'),
           ('Chest',(-.05,.02,.043),(-.05,.02,.102),'Spine'),
           ('Head',(-.08,-.05,.057),(-.09,-.125,.050),'Spine'),
           ('Ear_L',(-.123,-.072,.085),(-.147,-.063,.126),'Head'),
           ('Ear_R',(-.060,-.064,.090),(-.041,-.055,.134),'Head'),
           ('Tail',(.135,.012,.03),(.15,-.06,.023),'Root')]
    for name,a,b,parent in bones:
        bone=data.edit_bones.new(name);bone.head=a;bone.tail=b
        if parent:bone.parent=data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


def ellipsoid(name,center,radii,tag,mat,rot=0,skull=False):
    rows=28;cols=44;verts=[];faces=[];center=Vector(center)
    rotation=Matrix.Rotation(rot,3,'Z')
    for row in range(rows+1):
        phi=math.pi*row/rows
        for col in range(cols):
            theta=2*math.pi*col/cols
            q=Vector((math.sin(phi)*math.cos(theta),math.sin(phi)*math.sin(theta),math.cos(phi)))
            p=Vector((q.x*radii[0],q.y*radii[1],q.z*radii[2]))
            if skull:
                # A cat skull has a low cranium, sloping brow, high zygomatic arches,
                # and a tapering lower jaw. It is deliberately not a spherical toy head.
                p.x*=.74+.26*smooth(-.55,.25,q.z)
                if q.z>.55:p.z-=.005*smooth(.55,1,q.z)
                front=smooth(.1,-.8,q.y)
                socket=sum(math.exp(-((p.x-x)/.012)**2-((p.z-.003)/.006)**2) for x in (-.020,.020))
                bridge=math.exp(-(p.x/.009)**2-((p.z+.006)/.017)**2)
                p.y+=front*(.0028*socket-.0030*bridge)
                # Cheeks sit wider than the muzzle, without a balloon-like forehead.
                p.x*=1+.08*math.exp(-((p.z+.006)/.015)**2)
            verts.append(center+rotation@p)
    for row in range(rows):
        for col in range(cols):
            a=row*cols+col;b=row*cols+(col+1)%cols
            faces.append((a,b,b+cols,a+cols))
    obj=mesh_obj(name,verts,faces,mat)
    bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=.00001)
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(obj.data);bm.free()
    obj['part']=tag
    return obj


def spline(points,t):
    u=t*(len(points)-1);i=min(len(points)-2,int(u));f=u-i
    a=Vector(points[max(0,i-1)]);b=Vector(points[i]);c=Vector(points[i+1]);d=Vector(points[min(len(points)-1,i+2)])
    return .5*((2*b)+(-a+c)*f+(2*a-5*b+4*c-d)*f*f+(-a+3*b-3*c+d)*f*f*f)


def swept(name,points,radii,tag,mat,rings=72,sides=40):
    verts=[];faces=[]
    for i in range(rings+1):
        t=i/rings;p=spline(points,t)
        tangent=(spline(points,min(1,t+.001))-spline(points,max(0,t-.001))).normalized()
        across=tangent.cross(Vector((0,0,1))).normalized()
        up=across.cross(tangent).normalized()
        r=spline([(a,b,0) for a,b in radii],t)
        for j in range(sides):
            ang=j*2*math.pi/sides
            q=p+across*math.cos(ang)*r.x+up*math.sin(ang)*r.y
            q.z=max(.009,q.z)
            verts.append(q)
    for i in range(rings):
        for j in range(sides):
            a=i*sides+j;b=i*sides+(j+1)%sides;faces.append((a,b,b+sides,a+sides))
    faces.extend([tuple(reversed(range(sides))),tuple(range(rings*sides,(rings+1)*sides))])
    obj=mesh_obj(name,verts,faces,mat);obj['part']=tag
    bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(obj.data);bm.free()
    return obj


def ear(side,mat):
    left=side<0
    cx,cy,z0=(-.122,-.071,.084) if left else (-.061,-.064,.087)
    height=.042 if left else .046; lean=-.018 if left else .016
    rows=18;cols=18;verts=[];faces=[];tags=[]
    for back in (False,True):
        for r in range(rows+1):
            t=r/rows;w=.021*(1-t)**.7+.0004
            for j in range(cols+1):
                u=2*j/cols-1;bowl=(1-u*u)*math.sin(math.pi*t)**.7
                y=cy+.012*t*t+(.004+.005*bowl if back else -.001+.006*bowl)
                z=z0+height*t-.005*u*u*(1-t)+.003*u*math.sin(t*math.pi)
                verts.append((cx+lean*t+w*u,y,z));tags.append(5 if not back and abs(u)<.78 and .12<t<.90 else 6)
    layer=(rows+1)*(cols+1)
    for back in (0,1):
        for r in range(rows):
            for j in range(cols):
                a=back*layer+r*(cols+1)+j;f=(a,a+1,a+cols+2,a+cols+1)
                faces.append(tuple(reversed(f)) if back else f)
    border=list(range(cols+1))+[r*(cols+1)+cols for r in range(1,rows+1)]
    border+=list(range(rows*(cols+1)+cols-1,rows*(cols+1)-1,-1))+[r*(cols+1) for r in range(rows-1,0,-1)]
    for i,a in enumerate(border):b=border[(i+1)%len(border)];faces.append((a,a+layer,b+layer,b))
    obj=mesh_obj('Left pinna' if left else 'Right pinna',verts,faces,mat)
    obj['part']=6;obj['bone']='Ear_L' if left else 'Ear_R'
    bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(obj.data);bm.free()
    return obj,tags


def pigment(p,tag):
    x,y,z=p
    grain=.014*math.sin(x*1940+y*750+math.sin(z*1500))+.009*math.sin(y*2700-z*930)
    warm=np.array((.83,.62,.41));pale=np.array((.91,.84,.72))
    phase=x*260+y*27+1.2*math.sin(y*48+z*30)+.8*math.sin(y*141+z*117)
    amount=smooth(.58,.96,math.cos(phase))*.22
    amount*=.65+.35*math.sin(x*94+y*113-z*129)**2
    if tag==1:
        hx=x-HC.x
        phase=abs(hx)*268+z*31+1.7*math.sin(z*89)
        amount=smooth(.55,.95,math.cos(phase))*.19
        cheek=smooth(.018,.035,abs(hx))*(1-smooth(.053,.074,z))
        amount+=cheek*smooth(.40,.94,math.cos(z*360+y*57))*.18
        white=(1-smooth(.037,.056,z))*.45
    elif tag==2:
        phase=math.atan2(y+.015,x-.055)*15+z*15
        amount=smooth(.30,.96,math.cos(phase))*.28;white=.05
    elif tag==3:amount*=.65;white=.25+(1-smooth(.012,.031,z))*.25
    elif tag==4:amount*=.12;white=.70
    elif tag==5:return srgb((.47+grain,.285+grain,.215+grain))
    elif tag==6:amount*=.25;white=.16
    else:white=(1-smooth(.017,.047,z))*.25
    col=warm*(1-amount)*(1-white)+pale*white
    return srgb(tuple(np.clip(col+grain,.02,.98)))


def weights(p,tag,bone=None):
    if bone:
        w=smooth(.084,.111,p.z);return {bone:w,'Head':1-w}
    if tag in (1,4):return {'Head':1}
    if tag==2:return {'Root':.92,'Tail':.08}
    if tag==3:return {'Root':1}
    # Breathing is concentrated on ribcage, with the belly/ground remaining still.
    breath=math.exp(-((p.x+.04)/.07)**2)*smooth(.03,.085,p.z)*.65
    return {'Spine':1-breath,'Chest':breath}


def surface_data(obj,tags,bone=None):
    me=obj.data
    for name in bpy.data.objects['Cat_Armature'].data.bones.keys():obj.vertex_groups.new(name=name)
    color=me.color_attributes.new(name='CoatColor',type='FLOAT_COLOR',domain='POINT')
    for v in me.vertices:
        color.data[v.index].color=(*pigment(v.co,tags[v.index]),1)
        for name,w in weights(v.co,tags[v.index],bone).items():
            if w>0:obj.vertex_groups[name].add([v.index],w,'REPLACE')
    uv=me.uv_layers.new(name='CoatFlow')
    for l in me.loops:
        p=me.vertices[l.vertex_index].co
        tag=tags[l.vertex_index]
        if tag==1:
            d=p-Vector((HC.x,-.137,.046))
            uv.data[l.index].uv=(math.atan2(d.x,d.z)*.32,d.length*16)
        elif tag in (5,6):uv.data[l.index].uv=(p.x*20,p.z*20)
        elif tag==3:uv.data[l.index].uv=(p.x*20,-p.y*18)
        else:uv.data[l.index].uv=(p.y*14+p.z*11,p.x*14)
    for f in me.polygons:f.use_smooth=True


def groom(surfaces,material,count=85000):
    triangles=[];cum=[];total=0
    for obj,tags in surfaces:
        obj.data.calc_loop_triangles()
        for t in obj.data.loop_triangles:
            vs=[obj.data.vertices[i] for i in t.vertices]
            area=(vs[1].co-vs[0].co).cross(vs[2].co-vs[0].co).length/2
            triangles.append((obj,t.vertices[:],tags[vs[0].index]));total+=area;cum.append(total)
    verts=[];faces=[];colors=[];skin=[]
    for _ in range(count):
        obj,ids,tag=triangles[bisect.bisect_left(cum,R.random()*total)]
        vs=[obj.data.vertices[i] for i in ids];a=math.sqrt(R.random());b=R.random();ws=[1-a,a*(1-b),a*b]
        p=sum((v.co*w for v,w in zip(vs,ws)),Vector())
        if p.z<.012 or (tag==5 and R.random()<.78):continue
        n=sum((v.normal*w for v,w in zip(vs,ws)),Vector()).normalized()
        # The room uses fixed front cameras. Keep geometry fur at grazing angles;
        # high-frequency albedo handles broad surfaces without subpixel triangles.
        grazing=abs(n.dot(Vector((-.30,-1,.55)).normalized()))
        if grazing>.48 or R.random()<smooth(.18,.48,grazing):continue
        if tag in (1,4):flow=p-Vector((HC.x,-.134,.051));flow.z*=.8
        elif tag==2:flow=Vector((p.y+.015,-(p.x-.055),-.01))
        elif tag in (5,6):flow=Vector((.1,.1,1))
        elif tag==3:flow=Vector((-.1,-1,-.3))
        else:flow=Vector((1,.2,-.48))
        tangent=flow-n*flow.dot(n)
        if tangent.length<.00001:tangent=n.cross(Vector((0,1,0)))
        tangent.normalize()
        turn=.22*math.sin(p.x*580+p.y*200)+R.uniform(-.12,.12)
        tangent=(tangent+n.cross(tangent)*turn).normalized()
        length=R.uniform(.0045,.009) if tag==0 else R.uniform(.0018,.0042)
        if tag==1 and abs(p.x-HC.x)>.031:length*=1.65
        width=R.uniform(.00009,.00018)
        side=n.cross(tangent).normalized()*width
        q=p+n*.00018;m=p+tangent*length*.45+n*length*.23;end=p+tangent*length+n*length*.15
        k=len(verts);verts.extend((q-side,q+side,m-side*.5,m+side*.5,end))
        faces.extend(((k+2,k+3,k+1,k),(k+4,k+3,k+2)))
        c=np.array(pigment(p,tag))*R.uniform(.83,1.12)*.85;colors.extend([tuple(c)]*5)
        vg={}
        for v,w in zip(vs,ws):
            for g in v.groups:
                name=obj.vertex_groups[g.group].name;vg[name]=vg.get(name,0)+g.weight*w
        s=sum(vg.values());skin.extend([{name:w/s for name,w in vg.items()}]*5)
    obj=mesh_obj('Cat_Fur',verts,faces,material,colors,skin)
    obj['castShadow']=False;obj['receiveShadow']=False;obj.visible_shadow=False
    return obj


def features(body,dark,nose,whiskmat):
    result=[];bvh=BVHTree.FromObject(body,bpy.context.evaluated_depsgraph_get())
    for side in (-1,1):
        pts=[]
        for i in range(33):
            t=i/32;x=HC.x+side*(.012+.016*t);z=.065+.003*t-.002*math.sin(t*math.pi)+(0 if side<0 else .001)
            hit,_,_,_=bvh.ray_cast(Vector((x,-.4,z)),Vector((0,1,0)))
            q=hit if hit else Vector((x,-.12,z));q.y-=.0008;pts.append(q)
        result.append(tube('Closed eyelid',pts,[.00007+.00032*math.sin(math.pi*i/32)**.6 for i in range(33)],dark))
    cx=HC.x
    verts=[(cx-.006,-.139,.048),(cx+.006,-.139,.048),(cx,-.142,.041),
           (cx-.005,-.136,.048),(cx+.005,-.136,.048),(cx,-.137,.041)]
    faces=[(0,1,2),(3,5,4),(0,3,4,1),(1,4,5,2),(2,5,3,0)]
    no=mesh_obj('Nose leather',verts,faces,nose,weights=[{'Head':1}]*6)
    activate(no);be=no.modifiers.new('Soft nose rim','BEVEL');be.width=.001;be.segments=4;bpy.ops.object.modifier_apply(modifier=be.name)
    result.append(no)
    result.append(tube('Philtrum',[(cx,-.141,.042),(cx,-.140,.038),(cx,-.138,.035)],[.0003,.00028,.00012],dark))
    for side in (-1,1):
        result.append(tube('Mouth',[(cx,-.138,.035),(cx+side*.004,-.136,.034),(cx+side*.009,-.132,.035)],[.00016,.00020,.00005],dark))
        result.append(tube('Nostril',[(cx+side*.0035,-.1403,.047),(cx+side*.0045,-.1400,.046),(cx+side*.0042,-.1398,.045)],[.00015,.00030,.00008],dark))
        for j in range(9):
            root=Vector((cx+side*(.009+.001*(j%3)),-.134+.001*(j%3),.038+.002*(j%4)))
            pts=[];length=R.uniform(.038,.058)
            for k in range(14):
                t=k/13
                pts.append(root+Vector((side*length*t,(-.026+.005*j)*t-.009*t*t,.004*math.sin(t*math.pi)-.007*t*t)))
            result.append(tube('Whisker',pts,[.00012*(1-k/13)**.8+.000008 for k in range(14)],whiskmat,sides=4))
    # Explicit neutral color on untextured features, so forced COLOR_0 cannot darken them.
    for obj in result:
        attr=obj.data.color_attributes.new(name='CoatColor',type='FLOAT_COLOR',domain='POINT')
        for c in attr.data:c.color=(1,1,1,1)
    return result


def build():
    clear_scene();arm=rig();fur,dark,nose,fibermat,whiskmat=H['create_materials']()
    hair_shader=next(n for n in fibermat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    hair_shader.inputs['Specular IOR Level'].default_value=0
    hair_shader.inputs['Sheen Weight'].default_value=0
    hair_shader.inputs['Roughness'].default_value=1
    hair_shader.inputs['Alpha'].default_value=.32
    fibermat.surface_render_method='BLENDED'
    parts=[]
    body=swept('Curled ribcage',[(-.100,-.011,.053),(-.060,.033,.066),(.025,.058,.071),(.100,.032,.061),(.131,-.017,.044)],[(.014,.026),(.052,.052),(.071,.064),(.064,.055),(.021,.028)],0,fur)
    parts.append(body)
    parts.extend([
      ellipsoid('Shoulder',(-.076,-.025,.054),(.051,.045,.047),0,fur,rot=-.3),
      ellipsoid('Neck',(-.082,-.055,.052),(.035,.044,.037),0,fur),
      ellipsoid('Feline skull',HC,(.045,.043,.039),1,fur,skull=True),
      ellipsoid('Left muzzle',(-.099,-.124,.042),(.011,.015,.011),4,fur),
      ellipsoid('Right muzzle',(-.083,-.124,.042),(.011,.015,.011),4,fur),
      ellipsoid('Nasal bridge',(-.091,-.119,.056),(.010,.015,.017),1,fur),
      ellipsoid('Chin',(-.091,-.120,.032),(.015,.014,.008),4,fur),
      ellipsoid('Soft abdomen',(.017,-.010,.043),(.094,.065,.041),0,fur),
      ellipsoid('Folded hindquarter',(.078,-.028,.035),(.064,.052,.032),0,fur,rot=.30),
      ellipsoid('Resting forearm',(-.106,-.072,.026),(.019,.048,.021),0,fur,rot=-.16),
      ellipsoid('Tucked forearm',(-.064,-.074,.023),(.017,.042,.019),0,fur,rot=.15)])
    kd=KDTree(sum(len(o.data.vertices) for o in parts));tags=[]
    for o in parts:
        for v in o.data.vertices:tags.append(o['part']);kd.insert(v.co,len(tags)-1)
    kd.balance();bpy.ops.object.select_all(action='DESELECT')
    for o in parts:o.select_set(True)
    bpy.context.view_layer.objects.active=body;bpy.ops.object.join()
    body.data.remesh_voxel_size=.00135;body.data.use_remesh_preserve_volume=True;bpy.ops.object.voxel_remesh()
    sm=body.modifiers.new('Anatomical transitions','SMOOTH');sm.factor=.7;sm.iterations=4;bpy.ops.object.modifier_apply(modifier=sm.name)
    dec=body.modifiers.new('Surface topology','DECIMATE');dec.ratio=.35;bpy.ops.object.modifier_apply(modifier=dec.name)
    pids=[tags[kd.find(v.co)[1]] for v in body.data.vertices];surface_data(body,pids)
    surfaces=[(body,pids)]
    for center,radii,angle in [((-.113,-.122,.017),(.020,.030,.014),-.12),((-.064,-.111,.018),(.018,.028,.015),.20)]:
        paw=ellipsoid('Folded paw',center,radii,3,fur,rot=angle)
        for v in paw.data.vertices:
            x,y,z=v.co
            grooves=sum(math.exp(-((x-center[0]-d)/.0011)**2) for d in (-.007,0,.007))
            v.co.z-=.0014*grooves*(1-smooth(center[1]-.012,center[1]+.003,y))*smooth(center[2],center[2]+.008,z)
        ids=[3]*len(paw.data.vertices);surface_data(paw,ids);surfaces.append((paw,ids))
    tail=swept('Wrapped tapered tail',[(.128,.010,.030),(.157,-.032,.027),(.126,-.092,.023),(.056,-.128,.023),(-.018,-.139,.022),(-.052,-.134,.021)],[(.017,.017),(.018,.016),(.017,.014),(.014,.013),(.010,.009),(.002,.002)],2,fur,rings=100,sides=28)
    ids=[2]*len(tail.data.vertices);surface_data(tail,ids);surfaces.append((tail,ids))
    for side in (-1,1):
        o,ids=ear(side,fur);surface_data(o,ids,o['bone']);surfaces.append((o,ids))
    hairs=groom(surfaces,fibermat)
    detail=features(body,dark,nose,whiskmat)
    bpy.ops.object.select_all(action='DESELECT')
    for o,_ in surfaces:o.select_set(True)
    for o in detail:o.select_set(True)
    bpy.context.view_layer.objects.active=body;bpy.ops.object.join();body.name='Cat_Mesh';body.data.name='AdultTabbySurface'
    for obj in (body,hairs):
        activate(obj);tri=obj.modifiers.new('Triangles','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)
        obj.data.validate(clean_customdata=True)
        mod=obj.modifiers.new('Armature','ARMATURE');mod.object=arm;obj.parent=arm
        for p in obj.data.polygons:p.use_smooth=True
    body['origin']='Built from empty Blender scene by Codex via MCP; new anatomy, UVs, rig and groom'
    H['detail_coat']();apply_fur_texture();project_face();refine_resting_shape();ear_fuzz()
    runpy.run_path(str(OUT/'scripts/bake_coat.py'))['bake_coat']()
    H['make_animations'](arm)
    seat_ears()
    runpy.run_path(str(OUT/'scripts/sculpt_body.py'))['refine_body']()
    preview_setup()
    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'source/sanctuary-cat.blend'))
    print('NEW CAT',sum(len(o.data.polygons) for o in (body,hairs)),'triangles')


def apply_fur_texture():
    image=bpy.data.images.load(str(OUT/'textures/short-fur-albedo.png'),check_existing=True);image.pack()
    mat=bpy.data.materials['Mat_Cat_Ginger']
    for node in mat.node_tree.nodes:
        if node.type=='TEX_IMAGE' and node.image and node.image.name=='Cat_FineCoat_Albedo':node.image=image


def project_face():
    """Face-specific hair flow and sleeping eyelids, projected onto the sculpted skull.

    Corner colors/UVs keep the facial texture isolated from the coat material at seams.
    The rest of the head, body, nose and whiskers remain three-dimensional geometry.
    """
    obj=bpy.data.objects['Cat_Mesh'];me=obj.data
    dark=next(i for i,m in enumerate(me.materials) if m.name=='Mat_Cat_FeatureDark')
    bm=bmesh.new();bm.from_mesh(me)
    remove=[f for f in bm.faces if f.material_index==dark and f.calc_center_median().z>.055]
    bmesh.ops.delete(bm,geom=remove,context='FACES');bm.to_mesh(me);bm.free()
    image=bpy.data.images.load(str(OUT/'textures/sleeping-tabby-face.png'),check_existing=True);image.pack()
    mat=bpy.data.materials.new('Mat_Cat_Face');mat.use_nodes=True
    bs=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    bs.inputs['Roughness'].default_value=.88;bs.inputs['Specular IOR Level'].default_value=.18
    tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
    mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    face_index=len(me.materials);me.materials.append(mat)
    old=me.color_attributes['CoatColor'];values=[tuple(c.color) for c in old.data]
    domain=old.domain;me.color_attributes.remove(old)
    col=me.color_attributes.new(name='CoatColor',type='FLOAT_COLOR',domain='CORNER')
    for loop in me.loops:col.data[loop.index].color=values[loop.vertex_index if domain=='POINT' else loop.index]
    head_id=obj.vertex_groups['Head'].index
    uv=me.uv_layers.active
    for f in me.polygons:
        material=me.materials[f.material_index].name
        if material not in ('Mat_Cat_Ginger','Mat_Cat_NoseLeather'):continue
        p=f.center
        is_head=all(any(g.group==head_id and g.weight>.8 for g in me.vertices[i].groups) for i in f.vertices)
        if not is_head or p.y>-.083 or p.z<.026:continue
        if material=='Mat_Cat_Ginger':f.material_index=face_index
        for li in f.loop_indices:
            v=me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv=((v.x-(HC.x-.043))/.086,(v.z-.017)/.080)
            col.data[li].color=(1,1,1,1)
    nose=bpy.data.materials['Mat_Cat_NoseLeather'];nbs=next(n for n in nose.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    nt=nose.node_tree.nodes.new('ShaderNodeTexImage');nt.image=image;nose.node_tree.links.new(nt.outputs['Color'],nbs.inputs['Base Color'])
    me.update();me.validate()


def refine_resting_shape():
    """Lower a resting torso and shape smaller, rounded, relaxed ear pinnae."""
    for name in ('Cat_Mesh','Cat_Fur'):
        obj=bpy.data.objects[name]
        if obj.get('resting_shape_refined'):continue
        ears={obj.vertex_groups[n].index:s for n,s in [('Ear_L',-1),('Ear_R',1)]}
        for v in obj.data.vertices:
            p=v.co
            e=next(((ears[g.group],g.weight) for g in v.groups if g.group in ears and g.weight>.001),None)
            if e:
                side,w=e;z0=.084 if side<0 else .087
                height=.042 if side<0 else .046
                t=max(0,min(1,(p.z-z0)/height))
                p.z-=height*.27*t
                p.x+=side*.004*math.sin(t*math.pi/2)
                p.y+=.004*math.sin(t*math.pi)
            else:
                back=smooth(-.02,.035,p.y)*(1-smooth(-.07,-.12,p.x))
                p.z-=max(0,p.z-.052)*.24*back
        obj.data.update();obj['resting_shape_refined']=True


def ear_fuzz():
    """Fine pale guard hairs across the relaxed ear bowls, attached to each ear."""
    fur=bpy.data.objects['Cat_Fur']
    if fur.get('ear_fuzz'):return
    randomizer=random.Random(513)
    verts=[];faces=[];colors=[];skin=[]
    for side in (-1,1):
        cx,cy,z0=(-.122,-.071,.084) if side<0 else (-.061,-.064,.087)
        height=.042 if side<0 else .046;lean=-.018 if side<0 else .016
        def pinna(t,u):
            w=.021*(1-t)**.7+.0004;bowl=(1-u*u)*math.sin(math.pi*t)**.7
            return Vector((cx+lean*t+w*u+side*.004*math.sin(t*math.pi/2),
                cy+.012*t*t-.001+.006*bowl+.004*math.sin(t*math.pi),
                z0+height*.73*t-.005*u*u*(1-t)+.003*u*math.sin(t*math.pi)))
        for _ in range(260):
            t=randomizer.uniform(.10,.77);u=randomizer.uniform(-.83,.83)
            start=pinna(t,u);end=pinna(min(.94,t+randomizer.uniform(.08,.21)),u*.36)
            start.y-=.0009;end.y-=.0025
            width=randomizer.uniform(.000065,.00012)
            offset=len(verts)
            for j in range(5):
                f=j/4;p=start.lerp(end,f);p.y-=.001*math.sin(math.pi*f)
                w=width*(1-f)+.000005
                verts.extend([p+Vector((w,0,0)),p-Vector((w,0,0))])
                shade=.63+f*.10
                colors.extend([srgb((shade,shade*.87,shade*.70))]*2)
                skin.extend([{'Ear_L' if side<0 else 'Ear_R':1}]*2)
                if j:faces.extend([(offset+j*2+1,offset+j*2,offset+(j-1)*2),(offset+(j-1)*2+1,offset+j*2+1,offset+(j-1)*2)])
    detail=mesh_obj('Ear guard hairs',verts,faces,bpy.data.materials['Mat_Cat_SoftFur'],colors,skin)
    activate(fur);detail.select_set(True);bpy.ops.object.join()
    fur['ear_fuzz']=True


def seat_ears():
    """Embed the complete ear bases in the skull, including Head-weighted rims."""
    arm=bpy.data.objects['Cat_Armature']
    if arm.get('ear_attachment_fixed'):return
    bpy.context.scene.frame_set(1)
    arm.data.pose_position='REST'
    deltas={'Ear_L':Vector((.009,-.010,-.009)),
            'Ear_R':Vector((-.009,-.010,-.009))}
    def components(obj):
        parents=list(range(len(obj.data.vertices)))
        def find(v):
            while parents[v]!=v:
                parents[v]=parents[parents[v]];v=parents[v]
            return v
        for edge in obj.data.edges:
            a,b=map(find,edge.vertices);parents[a]=b
        groups={}
        for v in obj.data.vertices:groups.setdefault(find(v.index),[]).append(v.index)
        return groups.values()
    def side_of(obj,ids):
        names={g.index:g.name for g in obj.vertex_groups if g.name in deltas}
        for i in ids:
            for g in obj.data.vertices[i].groups:
                if g.group in names and g.weight>.001:return names[g.group]
        return None
    body=bpy.data.objects['Cat_Mesh'];ear_ids={}
    for ids in components(body):
        side=side_of(body,ids)
        if side:ear_ids[side]=set(ids)
    if set(ear_ids)!=set(deltas):raise RuntimeError('Expected two separate ear components')
    trees={}
    coords=[v.co.copy() for v in body.data.vertices]
    for side,ids in ear_ids.items():
        polys=[tuple(p.vertices) for p in body.data.polygons if p.vertices[0] in ids]
        trees[side]=BVHTree.FromPolygons(coords,polys)
    fur=bpy.data.objects['Cat_Fur'];moved_fur=0
    for ids in components(fur):
        side=side_of(fur,ids)
        if side is None:
            root=fur.data.vertices[min(ids)].co
            for candidate,tree in trees.items():
                hit=tree.find_nearest(root)
                if hit[0] is not None and hit[3]<.0008:
                    side=candidate;break
        if side:
            for i in ids:fur.data.vertices[i].co+=deltas[side]
            moved_fur+=1
    for side,ids in ear_ids.items():
        for i in ids:body.data.vertices[i].co+=deltas[side]
    body.data.update();fur.data.update()
    activate(arm);bpy.ops.object.mode_set(mode='EDIT')
    for side,delta in deltas.items():
        bone=arm.data.edit_bones[side];bone.head+=delta;bone.tail+=delta
    bpy.ops.object.mode_set(mode='OBJECT');arm.data.pose_position='POSE'
    arm['ear_attachment_fixed']=True
    print('Ear bases seated:',{s:len(v) for s,v in ear_ids.items()},'fur strands',moved_fur)


def preview_setup():
    if bpy.context.scene.world is None:bpy.context.scene.world=bpy.data.worlds.new('CatStudio')
    H['setup_preview']()
    s=bpy.context.scene;s.render.film_transparent=False;s.world.use_nodes=True
    bg=next(n for n in s.world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs[0].default_value=(.035,.045,.055,1);bg.inputs[1].default_value=.35
    s.camera.location=(-.34,-.60,.25);s.camera.rotation_euler=(Vector((-.01,-.015,.060))-s.camera.location).to_track_quat('-Z','Y').to_euler();s.camera.data.lens=55
    s.view_settings.exposure=-1.25
    try:s.render.engine='CYCLES'
    except TypeError as e:print(e)
    s.cycles.samples=48;s.cycles.use_denoising=True
    s.render.filepath=str(OUT/'previews/cat-portrait.png')
    for a in bpy.context.screen.areas:
        if a.type=='VIEW_3D':a.spaces.active.region_3d.view_location=(0,0,.06);a.spaces.active.region_3d.view_distance=.6


def export():
    bpy.context.scene.frame_set(1);bpy.ops.object.select_all(action='DESELECT')
    for name in ('Cat_Mesh','Cat_Fur','Cat_Armature'):bpy.data.objects[name].select_set(True)
    bpy.context.view_layer.objects.active=bpy.data.objects['Cat_Armature']
    path=ROOT/'src/renderer/public/room/sanctuary-cat.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,
       export_apply=False,export_texcoords=True,export_normals=True,export_tangents=True,
       export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=False,
       export_optimize_animation_keep_anim_armature=False,export_all_vertex_colors=False,
       export_vertex_color='NAME',export_vertex_color_name='CoatColor',export_materials='EXPORT',export_extras=True)
    print('Candidate exported',str(path))
