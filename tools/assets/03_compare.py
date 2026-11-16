#!/usr/bin/env python3
"""
tools/assets/03_compare.py
Renders side-by-side comparison frames between source GLB and rebaked GLB.
Overview and close-up views using Blender headless + Cycles OptiX.
"""

import sys
import os
import math
import bpy
import numpy as np

source_glb = os.path.abspath("public/map-assets/map-2048.glb")
rebake_glb = os.path.abspath("public/map-assets/relief.glb")
out_dir = os.path.abspath("docs/redesign/progress")
os.makedirs(out_dir, exist_ok=True)

def render_scene(glb_path, shot_name, camera_pos, camera_rot, out_filename):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    try:
        cpref = bpy.context.preferences.addons['cycles'].preferences
        cpref.compute_device_type = 'OPTIX'
        scene.cycles.device = 'GPU'
    except:
        pass
    scene.cycles.samples = 128

    bpy.ops.import_scene.gltf(filepath=glb_path)

    # Setup Camera
    cam_data = bpy.data.cameras.new("RenderCam")
    cam_obj = bpy.data.objects.new("RenderCam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj
    cam_obj.location = camera_pos
    cam_obj.rotation_euler = camera_rot

    # Warm raking inspection lamp
    light_data = bpy.data.lights.new(name="InspectionLamp", type='SPOT')
    light_data.energy = 90
    light_data.color = (1.0, 0.94, 0.88)
    light_data.spot_size = math.radians(75)
    light_data.shadow_soft_size = 0.02
    light_obj = bpy.data.objects.new(name="InspectionLamp", object_data=light_data)
    bpy.context.collection.objects.link(light_obj)
    light_obj.location = (0.2, -1.2, 0.35)
    light_obj.rotation_euler = (math.radians(65), 0, math.radians(15))

    # Dim cool fill
    fill_data = bpy.data.lights.new(name="FillLamp", type='POINT')
    fill_data.energy = 8
    fill_data.color = (0.75, 0.82, 1.0)
    fill_obj = bpy.data.objects.new(name="FillLamp", object_data=fill_data)
    bpy.context.collection.objects.link(fill_obj)
    fill_obj.location = (-0.4, -1.0, -0.2)

    scene.render.resolution_x = 960
    scene.render.resolution_y = 960
    scene.render.filepath = out_filename
    scene.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(write_still=True)
    print(f"Rendered: {out_filename}", flush=True)

# Camera positions
ov_cam_pos = (0, -2.1, 0)
ov_cam_rot = (math.radians(90), 0, 0)

cu_cam_pos = (0.05, -0.45, 0.05)
cu_cam_rot = (math.radians(90), 0, 0)

src_ov = os.path.join(out_dir, "phase-1-compare-overview-source.png")
reb_ov = os.path.join(out_dir, "phase-1-compare-overview-rebake.png")
src_cu = os.path.join(out_dir, "phase-1-compare-closeup-source.png")
reb_cu = os.path.join(out_dir, "phase-1-compare-closeup-rebake.png")

print("Rendering source overview...", flush=True)
render_scene(source_glb, "overview", ov_cam_pos, ov_cam_rot, src_ov)

print("Rendering rebake overview...", flush=True)
render_scene(rebake_glb, "overview", ov_cam_pos, ov_cam_rot, reb_ov)

print("Rendering source closeup...", flush=True)
render_scene(source_glb, "closeup", cu_cam_pos, cu_cam_rot, src_cu)

print("Rendering rebake closeup...", flush=True)
render_scene(rebake_glb, "closeup", cu_cam_pos, cu_cam_rot, reb_cu)

# Side-by-side stitch using numpy
def make_side_by_side(img_left_path, img_right_path, out_path):
    im1 = bpy.data.images.load(img_left_path)
    im2 = bpy.data.images.load(img_right_path)
    w, h = im1.size[0], im1.size[1]
    p1 = np.array(im1.pixels[:], dtype=np.float32).reshape(h, w, 4)
    p2 = np.array(im2.pixels[:], dtype=np.float32).reshape(h, w, 4)
    combined_pixels = np.concatenate([p1, p2], axis=1) # shape (h, w*2, 4)

    combined = bpy.data.images.new("combined", width=w * 2, height=h)
    combined.pixels.foreach_set(combined_pixels.ravel())
    combined.filepath_raw = out_path
    combined.file_format = 'PNG'
    combined.save()
    print(f"Saved side-by-side: {out_path}", flush=True)

make_side_by_side(src_ov, reb_ov, os.path.join(out_dir, "phase-1-compare-overview.png"))
make_side_by_side(src_cu, reb_cu, os.path.join(out_dir, "phase-1-compare-closeup.png"))
print("03_compare.py complete!", flush=True)
