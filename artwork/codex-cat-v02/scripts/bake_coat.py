"""Bake the photo/body transition to a portable, unlit albedo atlas.

Run in Blender after build_cat.project_face(), before export(). This module does
not run on import. Only a temporary copy is unwrapped/baked; original geometry,
vertex groups, animation, and feature-material UV coordinates are preserved.
"""
from array import array
import math
from pathlib import Path
import runpy

import bpy
import bmesh
from mathutils import Vector


OUT = Path(__file__).resolve().parents[1]
ATLAS_SIZE = 4096
ATLAS_NAME = 'Cat_Coat_Atlas'
ATLAS_UV = 'CoatAtlas'
SOURCE_UV = 'CoatFlow'
LOOP_ID = '_CoatBakeOriginalLoop'


def _texture(nodes, name, image):
    node = nodes.new('ShaderNodeTexImage')
    node.name = name
    node.label = name
    node.image = image
    return node


def _uv(nodes, name):
    node = nodes.new('ShaderNodeUVMap')
    node.uv_map = name
    node.label = name
    return node


def _smart_project():
    # Blender releases differ slightly in optional UV operator parameters.
    candidates = {
        'angle_limit': math.radians(66),
        'island_margin': .003,
        'area_weight': .25,
        'correct_aspect': True,
        'scale_to_bounds': False,
    }
    properties = bpy.ops.uv.smart_project.get_rna_type().properties.keys()
    bpy.ops.uv.smart_project(**{k: v for k, v in candidates.items() if k in properties})


def bake_coat():
    """Create and install textures/cat-coat-atlas.png; call once per rebuild.

    The bake is DIFFUSE/COLOR only: no studio lighting, AO, or shadows enter
    the albedo. It uses a temporary mesh/material and a coordinate-based mask.
    A failed bake leaves the original cat mesh and its materials unchanged.
    """
    obj = bpy.data.objects.get('Cat_Mesh')
    if obj is None or obj.type != 'MESH':
        raise RuntimeError('Build Cat_Mesh and project its face before baking.')
    if obj.get('coat_atlas_baked'):
        raise RuntimeError('This cat is already baked; rebuild/project_face before rebaking.')
    me = obj.data
    if SOURCE_UV not in me.uv_layers:
        raise RuntimeError('Expected the original CoatFlow UV layer.')
    color = me.color_attributes.get('CoatColor')
    if color is None or color.domain != 'CORNER':
        raise RuntimeError('project_face() must provide CORNER CoatColor before baking.')
    head_group = obj.vertex_groups.get('Head')
    if head_group is None:
        raise RuntimeError('The cat needs its Head vertex group.')
    group_names = {group.index: group.name for group in obj.vertex_groups}
    skin_indices = {
        i for i, mat in enumerate(me.materials)
        if mat and mat.name in ('Mat_Cat_Ginger', 'Mat_Cat_Face')
    }
    if len(skin_indices) != 2:
        raise RuntimeError('Expected exactly Mat_Cat_Ginger and Mat_Cat_Face skin slots.')
    ginger_index = next(i for i in skin_indices if me.materials[i].name == 'Mat_Cat_Ginger')
    face_index = next(i for i in skin_indices if me.materials[i].name == 'Mat_Cat_Face')
    ginger = me.materials[ginger_index]
    old_bs = next(n for n in ginger.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    material_values = {}
    for key in ('Roughness', 'Specular IOR Level', 'Sheen Weight', 'Sheen Roughness', 'Sheen Tint'):
        value = old_bs.inputs[key].default_value
        material_values[key] = tuple(value) if hasattr(value, '__len__') else float(value)
    old_norm = next((n for n in ginger.node_tree.nodes if n.type == 'NORMAL_MAP'), None)
    normal_strength = old_norm.inputs['Strength'].default_value if old_norm else .55

    model = runpy.run_path(str(OUT / 'scripts/build_cat.py'))
    smooth = model['smooth']
    pigment = model['pigment']
    hc = model['HC']
    face_image = bpy.data.images.load(str(OUT / 'textures/sleeping-tabby-face.png'), check_existing=True)
    fur_image = bpy.data.images.load(str(OUT / 'textures/short-fur-albedo.png'), check_existing=True)
    normal_image = bpy.data.images.get('Cat_FineCoat_Normal')
    if normal_image is None:
        normal_image = bpy.data.images.load(str(OUT / 'textures/cat-finecoat-normal.png'), check_existing=True)
        normal_image.colorspace_settings.name = 'Non-Color'

    scene = bpy.context.scene
    old_engine = scene.render.engine
    old_samples = scene.cycles.samples
    old_device = scene.cycles.device
    old_selection = list(bpy.context.selected_objects)
    old_active = bpy.context.view_layer.objects.active
    old_mode = bpy.context.object.mode if bpy.context.object else 'OBJECT'
    bake_options = {
        key: getattr(scene.render.bake, key)
        for key in ('use_pass_direct', 'use_pass_indirect', 'use_pass_color',
                    'use_selected_to_active', 'use_clear', 'margin')
    }
    work = None
    work_mesh = None
    work_mat = None
    atlas = None
    baked = False
    try:
        if old_mode != 'OBJECT':
            bpy.ops.object.mode_set(mode='OBJECT')
        bpy.ops.object.select_all(action='DESELECT')
        work_mesh = me.copy()
        work_mesh.name = '_CoatBakeMesh'
        loop_ids = work_mesh.attributes.new(LOOP_ID, 'INT', 'CORNER')
        loop_ids.data.foreach_set('value', array('i', range(len(work_mesh.loops))))
        bm = bmesh.new()
        try:
            bm.from_mesh(work_mesh)
            unwanted = [f for f in bm.faces if f.material_index not in skin_indices]
            bmesh.ops.delete(bm, geom=unwanted, context='FACES')
            loose = [v for v in bm.verts if not v.link_faces]
            if loose:
                bmesh.ops.delete(bm, geom=loose, context='VERTS')
            bm.to_mesh(work_mesh)
        finally:
            bm.free()
        work_mesh.update()
        work = bpy.data.objects.new('_CoatBakeOnly', work_mesh)
        scene.collection.objects.link(work)
        work.matrix_world = obj.matrix_world.copy()
        work.select_set(True)
        bpy.context.view_layer.objects.active = work

        # Read original vertex weights through original loop IDs. The temporary
        # mesh intentionally has no armature modifier or copied pose evaluation.
        original_ids = work_mesh.attributes[LOOP_ID]
        body_uv = work_mesh.uv_layers[SOURCE_UV]
        photo_uv = work_mesh.uv_layers.new(name='_FaceProjection')
        blend = work_mesh.color_attributes.new(name='_FaceBlend', type='FLOAT_COLOR', domain='CORNER')
        body_color = work_mesh.color_attributes['CoatColor']
        restored_uv = {}
        for face in work_mesh.polygons:
            projected_face = face.material_index == face_index
            for li in face.loop_indices:
                original_li = original_ids.data[li].value
                original_vertex = me.vertices[me.loops[original_li].vertex_index]
                p = original_vertex.co
                weights = {group_names[g.group]: g.weight for g in original_vertex.groups}
                weight = weights.get('Head', 0.)
                head = smooth(.5, .95, weight)
                amount = head * (1 - smooth(-.092, -.077, p.y))
                amount *= 1 - smooth(.029, .043, abs(p.x - hc.x))
                amount *= smooth(.026, .034, p.z)
                amount *= 1 - smooth(.085, .094, p.z)
                blend.data[li].color = (amount, amount, amount, 1)
                photo_uv.data[li].uv = ((p.x - (hc.x - .043)) / .086, (p.z - .017) / .080)
                is_ear = max(weights.get('Ear_L', 0.), weights.get('Ear_R', 0.)) > 1e-5
                # The very bottom edge of each pinna is weighted only to Head.
                is_ear |= weight > .8 and p.z > .076 and p.y > -.082 and p.x < -.040
                if not is_ear:
                    if weight > .8:
                        tag = 4 if p.z < .051 and p.y < -.116 and abs(p.x - hc.x) < .026 else 1
                    elif weights.get('Tail', 0.) > .01:
                        tag = 2
                    elif weights.get('Root', 0.) > .99 and p.x < -.04 and p.y < -.09:
                        tag = 3
                    else:
                        tag = 0
                    # Recompute from the current build script, including its
                    # latest warm/pale pigment calibration. Ear inner colors
                    # remain the authored vertex colors rather than orange.
                    body_color.data[li].color = (*pigment(p, tag), 1)
                if projected_face:
                    # project_face overwrote these corners with white/photo UV.
                    # Recover the original head/muzzle flow and pigment first.
                    tag = 4 if p.z < .051 and p.y < -.116 and abs(p.x - hc.x) < .026 else 1
                    if tag == 1:
                        delta = p - Vector((hc.x, -.137, .046))
                        uv = (math.atan2(delta.x, delta.z) * .32, delta.length * 16)
                    else:
                        uv = (p.y * 14 + p.z * 11, p.x * 14)
                    body_uv.data[li].uv = uv
                    restored_uv[original_li] = uv

        # Explicit source UV nodes prevent changing the active bake UV from
        # accidentally moving either input texture during the bake.
        work_mat = bpy.data.materials.new('_CoatBakeMaterial')
        work_mat.use_nodes = True
        nt = work_mat.node_tree
        nt.nodes.clear()
        output = nt.nodes.new('ShaderNodeOutputMaterial')
        bs = nt.nodes.new('ShaderNodeBsdfPrincipled')
        bs.inputs['Roughness'].default_value = 1
        nt.links.new(bs.outputs['BSDF'], output.inputs['Surface'])
        pigment_node = nt.nodes.new('ShaderNodeVertexColor')
        pigment_node.layer_name = 'CoatColor'
        mask_node = nt.nodes.new('ShaderNodeVertexColor')
        mask_node.layer_name = '_FaceBlend'
        body_tex = _texture(nt.nodes, 'Original short coat', fur_image)
        nt.links.new(_uv(nt.nodes, SOURCE_UV).outputs['UV'], body_tex.inputs['Vector'])
        photo_tex = _texture(nt.nodes, 'Projected sleeping face', face_image)
        photo_tex.extension = 'EXTEND'
        nt.links.new(_uv(nt.nodes, '_FaceProjection').outputs['UV'], photo_tex.inputs['Vector'])
        multiply = nt.nodes.new('ShaderNodeMixRGB')
        multiply.blend_type = 'MULTIPLY'
        multiply.inputs[0].default_value = 1
        nt.links.new(pigment_node.outputs['Color'], multiply.inputs[1])
        nt.links.new(body_tex.outputs['Color'], multiply.inputs[2])
        mix = nt.nodes.new('ShaderNodeMixRGB')
        mix.blend_type = 'MIX'
        nt.links.new(mask_node.outputs['Color'], mix.inputs[0])
        nt.links.new(multiply.outputs['Color'], mix.inputs[1])
        nt.links.new(photo_tex.outputs['Color'], mix.inputs[2])
        nt.links.new(mix.outputs['Color'], bs.inputs['Base Color'])
        work_mesh.materials.clear()
        work_mesh.materials.append(work_mat)
        for face in work_mesh.polygons:
            face.material_index = 0

        target_uv = work_mesh.uv_layers.get(ATLAS_UV) or work_mesh.uv_layers.new(name=ATLAS_UV)
        work_mesh.uv_layers.active_index = work_mesh.uv_layers.find(ATLAS_UV)
        target_uv.active_render = True
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        _smart_project()
        bpy.ops.object.mode_set(mode='OBJECT')
        # Blender may replace RNA handles while leaving edit mode.
        target_uv = work_mesh.uv_layers[ATLAS_UV]
        original_ids = work_mesh.attributes[LOOP_ID]
        atlas = bpy.data.images.new(ATLAS_NAME, width=ATLAS_SIZE, height=ATLAS_SIZE, alpha=False)
        atlas.colorspace_settings.name = 'sRGB'
        target_node = _texture(nt.nodes, 'BAKE TARGET — unconnected', atlas)
        nt.nodes.active = target_node
        target_node.select = True
        scene.render.engine = 'CYCLES'
        scene.cycles.device = 'CPU'
        scene.cycles.samples = 1
        scene.render.bake.use_pass_direct = False
        scene.render.bake.use_pass_indirect = False
        scene.render.bake.use_pass_color = True
        scene.render.bake.use_selected_to_active = False
        scene.render.bake.use_clear = True
        scene.render.bake.margin = 12
        bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'})
        destination = OUT / 'textures/cat-coat-atlas.png'
        destination.parent.mkdir(parents=True, exist_ok=True)
        atlas.filepath_raw = str(destination)
        atlas.file_format = 'PNG'
        atlas.save()
        atlas.pack()

        # Commit only after the bake and PNG save both succeed.
        final_uv = me.uv_layers.get(ATLAS_UV) or me.uv_layers.new(name=ATLAS_UV)
        source_uv = me.uv_layers[SOURCE_UV]
        # Non-skin corners retain their original coordinates in both layers.
        for loop in me.loops:
            final_uv.data[loop.index].uv = source_uv.data[loop.index].uv
        for loop in work_mesh.loops:
            original_li = original_ids.data[loop.index].value
            final_uv.data[original_li].uv = target_uv.data[loop.index].uv
            color.data[original_li].color = (1, 1, 1, 1)
        for original_li, uv in restored_uv.items():
            source_uv.data[original_li].uv = uv
        for face in me.polygons:
            if face.material_index in skin_indices:
                face.material_index = ginger_index
        me.uv_layers.active_index = me.uv_layers.find(SOURCE_UV)
        source_uv.active_render = True

        nt = ginger.node_tree
        nt.nodes.clear()
        output = nt.nodes.new('ShaderNodeOutputMaterial')
        bs = nt.nodes.new('ShaderNodeBsdfPrincipled')
        for key, value in material_values.items():
            bs.inputs[key].default_value = value
        nt.links.new(bs.outputs['BSDF'], output.inputs['Surface'])
        albedo = _texture(nt.nodes, 'Baked coat albedo', atlas)
        nt.links.new(_uv(nt.nodes, ATLAS_UV).outputs['UV'], albedo.inputs['Vector'])
        nt.links.new(albedo.outputs['Color'], bs.inputs['Base Color'])
        normal_tex = _texture(nt.nodes, 'Fine coat normal', normal_image)
        nt.links.new(_uv(nt.nodes, SOURCE_UV).outputs['UV'], normal_tex.inputs['Vector'])
        normal = nt.nodes.new('ShaderNodeNormalMap')
        normal.uv_map = SOURCE_UV
        normal.inputs['Strength'].default_value = normal_strength
        nt.links.new(normal_tex.outputs['Color'], normal.inputs['Color'])
        nt.links.new(normal.outputs['Normal'], bs.inputs['Normal'])
        # Feature materials (especially the photo-textured nose) must never
        # start sampling the newly created atlas UV implicitly.
        for mat in me.materials:
            if mat is None or mat == ginger or not mat.use_nodes:
                continue
            for node in list(mat.node_tree.nodes):
                if node.type == 'TEX_IMAGE' and not node.inputs['Vector'].is_linked:
                    mat.node_tree.links.new(_uv(mat.node_tree.nodes, SOURCE_UV).outputs['UV'], node.inputs['Vector'])
        me.update()
        obj['coat_atlas_baked'] = True
        obj['coat_atlas_size'] = ATLAS_SIZE
        obj['coat_atlas_file'] = str(destination)
        baked = True
        result = {'path': str(destination), 'size': ATLAS_SIZE, 'skin_triangles': len(work_mesh.polygons)}
        print('Baked portable coat:', result)
        return result
    finally:
        if bpy.context.object and bpy.context.object.mode != 'OBJECT':
            bpy.ops.object.mode_set(mode='OBJECT')
        if work is not None:
            bpy.data.objects.remove(work, do_unlink=True)
        if work_mesh is not None and work_mesh.users == 0:
            bpy.data.meshes.remove(work_mesh)
        if work_mat is not None and work_mat.users == 0:
            bpy.data.materials.remove(work_mat)
        if atlas is not None and not baked and atlas.users == 0:
            bpy.data.images.remove(atlas)
        scene.render.engine = old_engine
        scene.cycles.samples = old_samples
        scene.cycles.device = old_device
        for key, value in bake_options.items():
            setattr(scene.render.bake, key, value)
        bpy.ops.object.select_all(action='DESELECT')
        for selected in old_selection:
            if selected.name in bpy.data.objects:
                selected.select_set(True)
        if old_active and old_active.name in bpy.data.objects:
            bpy.context.view_layer.objects.active = old_active
            if old_mode != 'OBJECT':
                bpy.ops.object.mode_set(mode=old_mode)
