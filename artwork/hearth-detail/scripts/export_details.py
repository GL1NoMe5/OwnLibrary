"""Run build() from the materials-v01 room in Blender, with this file on disk."""
from pathlib import Path
import runpy

import bpy


def build():
    scripts = Path(__file__).resolve().parent
    art = scripts.parent
    project = art.parents[1]
    collection = bpy.data.collections.new('Hearth Details')
    room = bpy.context.scene
    room.collection.children.link(collection)
    runpy.run_path(str(scripts / 'hearth.py'))['build_hearth'](collection)
    runpy.run_path(str(scripts / 'reading_lamp.py'))['build_lamp'](collection)
    bpy.context.view_layer.update()
    # An independent editable source, containing only this layer of the room.
    detail_scene = bpy.data.scenes.new('Hearth and reading lamp')
    detail_scene.collection.children.link(collection)
    try:
        bpy.data.libraries.write(str(art / 'hearth-details.blend'), {detail_scene}, compress=True)
    finally:
        bpy.data.scenes.remove(detail_scene)
    selected = list(bpy.context.selected_objects)
    active = bpy.context.view_layer.objects.active
    try:
        bpy.ops.object.select_all(action='DESELECT')
        for obj in collection.objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = collection.objects[0]
        out = project / 'src/renderer/public/room/hearth-details.glb'
        bpy.ops.export_scene.gltf(filepath=str(out), use_selection=True,
                                  export_format='GLB', export_yup=True,
                                  export_animations=False, export_cameras=False)
        print(out, out.stat().st_size)
    finally:
        bpy.ops.object.select_all(action='DESELECT')
        for obj in selected:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = active
    # The application also swaps this mesh when it loads the detail layer.
    for name in ('FloorLamp_Shade', 'Fireplace_Logs', 'Fireplace_Embers'):
        original = bpy.data.objects[name]
        original.hide_set(True)
        original.hide_render = True
