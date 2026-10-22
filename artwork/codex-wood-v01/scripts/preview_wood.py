"""Saved reference images only: CPU render, no window invocation or app launch."""
import bpy
from pathlib import Path
from mathutils import Vector

ART = Path(__file__).resolve().parents[1]


def render(label, overview=False):
    scene = bpy.context.scene
    previous = scene.camera
    camera = bpy.data.objects.get('WoodReviewCamera')
    if camera is None:
        camera = bpy.data.objects.new('WoodReviewCamera', bpy.data.cameras.new('WoodReviewCamera'))
        scene.collection.objects.link(camera)
    camera.location = (-.45,-.45,1.60)
    target = Vector((-1.38,1.80,1.22))
    camera.rotation_euler = (target-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.lens = 41
    camera.data.clip_start = .03; camera.data.clip_end = 30
    scene.camera = bpy.data.objects['Camera_OVERVIEW'] if overview else camera
    scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'
    scene.cycles.samples = 20; scene.cycles.use_denoising = True
    scene.render.threads_mode = 'FIXED'; scene.render.threads = 2
    scene.render.resolution_x = 1152 if overview else 896
    scene.render.resolution_y = 648 if overview else 896
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(ART/'previews'/f'{label}.png')
    # No new reference light: retain v03's night rig for an honest material comparison.
    try:
        bpy.ops.render.render(write_still=True)
        print('SAVED_PREVIEW', scene.render.filepath)
    finally:
        scene.camera = previous
