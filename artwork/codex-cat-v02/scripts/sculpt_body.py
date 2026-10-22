"""Resting torso refinement, preserving face, ears, UVs, weights and topology."""
import math
import runpy
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector
from mathutils.kdtree import KDTree

OUT=Path(__file__).resolve().parents[1]


def refine_body():
    body=bpy.data.objects['Cat_Mesh'];fur=bpy.data.objects['Cat_Fur']
    if body.get('body_anatomy_refined'):return
    bpy.context.scene.frame_set(1)
    arm=bpy.data.objects['Cat_Armature'];arm.data.pose_position='REST'
    model=runpy.run_path(str(OUT/'scripts/build_cat.py'));smooth=model['smooth']
    names={g.index:g.name for g in body.vertex_groups}
    before=np.array([tuple(v.co) for v in body.data.vertices],dtype=np.float64)
    after=before.copy();mask=np.zeros(len(before))
    for v in body.data.vertices:
        p=v.co;x,y,z=p
        weights={names[g.group]:g.weight for g in v.groups}
        trunk=weights.get('Spine',0)+weights.get('Chest',0)
        if trunk>.01:
            # A continuous, gently asymmetric ribcage, rather than a ring of
            # swollen volumes around a second, cylindrical abdomen.
            side=smooth(-.10,-.035,x)
            mask[v.index]=trunk*max(side,smooth(.0,.035,y)*.7)
            r2=((x-.023)/.153)**2+((y-.023)/.105)**2
            target=.019+.086*math.sqrt(max(0,1-r2))
            influence=mask[v.index]*smooth(.035,.077,z)*(1-smooth(.82,1.12,r2))*.86
            after[v.index,2]+=(target-z)*influence
            belly=math.exp(-((x-.018)/.064)**2-((y+.055)/.038)**2)
            after[v.index,1]+=.006*belly*smooth(.018,.040,z)*mask[v.index]
            # Slightly asymmetric flank, leaving a small tucked thigh at right.
            after[v.index,2]-=.0025*math.exp(-((x-.087)/.014)**2-((y+.023)/.043)**2)*smooth(.035,.065,z)*mask[v.index]
        elif weights.get('Root',0)>.999 and x<-.04 and y<-.075:
            # Keep the supporting paw beneath the chin; tuck the other back.
            right=x>-.086
            cx,cy=(-.064,-.111) if right else (-.113,-.122)
            after[v.index,1]=cy+(y-cy)*(.80 if right else .88)+(.008 if right else 0)
            if right:
                after[v.index,0]-=.003
                after[v.index,2]=.006+(z-.006)*.92

    # A few local smoothing passes relax the former union crease without
    # remeshing the photographic face, baked atlas, or animation weights.
    edges=np.array([tuple(e.vertices) for e in body.data.edges],dtype=np.int32)
    degree=np.bincount(edges.ravel(),minlength=len(before)).clip(1)
    influence=mask*smooth_array(.034,.075,before[:,2])*.40
    for _ in range(14):
        sums=np.zeros_like(after)
        np.add.at(sums,edges[:,0],after[edges[:,1]])
        np.add.at(sums,edges[:,1],after[edges[:,0]])
        after+=(sums/degree[:,None]-after)*influence[:,None]
    deltas=after-before
    tree=KDTree(len(before))
    for i,p in enumerate(before):tree.insert(p,i)
    tree.balance()
    for v in fur.data.vertices:
        nearest=tree.find_n(v.co,4)
        weights=np.array([1/max(d,.00025)**2 for _,_,d in nearest])
        weights/=weights.sum()
        shift=sum((deltas[i]*w for (_,i,_),w in zip(nearest,weights)),np.zeros(3))
        v.co+=Vector(shift)
    for v,p in zip(body.data.vertices,after):v.co=p
    body.data.update();fur.data.update();arm.data.pose_position='POSE'
    body['body_anatomy_refined']=True
    print('Torso refined; maximum displacement',float(np.linalg.norm(deltas,axis=1).max()),'m')


def smooth_array(a,b,v):
    t=np.clip((v-a)/(b-a),0,1)
    return t*t*(3-2*t)
