#!/usr/bin/env python3
"""
tools/assets/01_prepare.py
Blender headless script to prepare and bake photogrammetry relief assets.
Usage:
    blender -b -P tools/assets/01_prepare.py -- in.glb outdir [--bake-8k] [--rebake]
"""

import sys
import os
import math
import bpy
import bmesh
import numpy as np

def log(msg):
    print(f"[prepare.py] {msg}", flush=True)

argv = sys.argv
if "--" in argv:
    args = argv[argv.index("--") + 1:]
else:
    args = []

if len(args) < 2:
    print("Usage: blender -b -P 01_prepare.py -- <in.glb> <outdir> [--bake-8k] [--rebake]")
    sys.exit(1)

in_glb = os.path.abspath(args[0])
outdir = os.path.abspath(args[1])
bake_8k = "--bake-8k" in args
force_rebake = "--rebake" in args
os.makedirs(outdir, exist_ok=True)

log(f"Input GLB: {in_glb}")
log(f"Output directory: {outdir}")

# 1. Clear scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# 2. Import GLTF
bpy.ops.import_scene.gltf(filepath=in_glb)
source_obj = next((o for o in bpy.data.objects if o.type == 'MESH'), None)
if not source_obj:
    log("Error: No mesh object found in imported GLTF.")
    sys.exit(1)

source_obj.name = "relief_source"

# Merge seam doubles
bpy.context.view_layer.objects.active = source_obj
source_obj.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=1e-5)
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode='OBJECT')

# Source bounds
min_x = min(v.co.x for v in source_obj.data.vertices)
max_x = max(v.co.x for v in source_obj.data.vertices)
min_y = min(v.co.y for v in source_obj.data.vertices)
max_y = max(v.co.y for v in source_obj.data.vertices)
min_z = min(v.co.z for v in source_obj.data.vertices)
max_z = max(v.co.z for v in source_obj.data.vertices)

w = max_x - min_x
h = max_z - min_z
log(f"Source bounds: X=[{min_x:.6f}, {max_x:.6f}], Y=[{min_y:.6f}, {max_y:.6f}], Z=[{min_z:.6f}, {max_z:.6f}]")

# Check if textures are already baked
albedo_4k_path = os.path.join(outdir, "relief_albedo_4k.png")
albedo_1k_path = os.path.join(outdir, "relief_albedo_1k.png")
ao_2k_path = os.path.join(outdir, "relief_ao_2k.png")
normal_4k_path = os.path.join(outdir, "relief_normal_4k.png")
orm_2k_path = os.path.join(outdir, "relief_orm_2k.png")

need_bake = force_rebake or not (os.path.exists(albedo_4k_path) and os.path.exists(ao_2k_path) and os.path.exists(normal_4k_path))

# 3. Target mesh
target_obj = source_obj.copy()
target_obj.data = source_obj.data.copy()
bpy.context.collection.objects.link(target_obj)
target_obj.name = "relief_target"

# Assign planar UV to target
target_mesh = target_obj.data
if not target_mesh.uv_layers:
    target_mesh.uv_layers.new(name="UVMap")
uv_layer = target_mesh.uv_layers.active.data

for poly in target_mesh.polygons:
    for loop_idx in poly.loop_indices:
        v_idx = target_mesh.loops[loop_idx].vertex_index
        co = target_mesh.vertices[v_idx].co
        u = (co.x - min_x) / w
        v = (co.z - min_z) / h
        uv_layer[loop_idx].uv = (min(max(u, 0.0), 1.0), min(max(v, 0.0), 1.0))

bake_mat = bpy.data.materials.new("TargetBakeMat")
bake_mat.use_nodes = True
target_mesh.materials.clear()
target_mesh.materials.append(bake_mat)

if need_bake:
    log("Baking textures via Cycles OptiX...")
    # Setup emit for source materials so baking EMIT bakes unlit albedo directly
    for mat in bpy.data.materials:
        if not mat.node_tree:
            continue
        nodes = mat.node_tree.nodes
        links = mat.node_tree.links
        img_node = next((n for n in nodes if n.type == 'TEX_IMAGE'), None)
        out_node = next((n for n in nodes if n.type == 'OUTPUT_MATERIAL'), None)
        if img_node and out_node:
            links.new(img_node.outputs['Color'], out_node.inputs['Surface'])

    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    try:
        cpref = bpy.context.preferences.addons['cycles'].preferences
        cpref.compute_device_type = 'OPTIX'
        scene.cycles.device = 'GPU'
    except Exception as e:
        log(f"GPU notice: {e}")

    scene.render.bake.use_selected_to_active = True
    scene.render.bake.cage_extrusion = 0.002

    def setup_bake_image(name, width, height):
        img = bpy.data.images.new(name, width=width, height=height)
        nodes = bake_mat.node_tree.nodes
        img_node = nodes.new('ShaderNodeTexImage')
        img_node.image = img
        nodes.active = img_node
        return img, img_node

    def bake_and_save(img, filepath, bake_type, samples=64, normal_space='TANGENT'):
        scene.cycles.samples = samples
        scene.render.bake.normal_space = normal_space
        bpy.ops.object.select_all(action='DESELECT')
        source_obj.select_set(True)
        target_obj.select_set(True)
        bpy.context.view_layer.objects.active = target_obj
        log(f"Baking {bake_type} ({img.size[0]}x{img.size[1]})...")
        bpy.ops.object.bake(type=bake_type)
        img.filepath_raw = filepath
        img.file_format = 'PNG'
        img.save()
        log(f"Saved: {filepath}")

    img_4k, _ = setup_bake_image("albedo_4k", 4096, 4096)
    bake_and_save(img_4k, albedo_4k_path, 'EMIT', samples=1)

    img_1k = bpy.data.images.load(albedo_4k_path)
    img_1k.scale(1024, 1024)
    img_1k.filepath_raw = albedo_1k_path
    img_1k.file_format = 'PNG'
    img_1k.save()

    img_ao, _ = setup_bake_image("ao_2k", 2048, 2048)
    bake_and_save(img_ao, ao_2k_path, 'AO', samples=128)

    img_norm, _ = setup_bake_image("normal_4k", 4096, 4096)
    bake_and_save(img_norm, normal_4k_path, 'NORMAL', samples=64, normal_space='TANGENT')

    ao_pixels = np.array(img_ao.pixels[:], dtype=np.float32).reshape(-1, 4)
    orm_pixels = np.empty_like(ao_pixels)
    orm_pixels[:, 0] = ao_pixels[:, 0]
    orm_pixels[:, 1] = 0.90
    orm_pixels[:, 2] = 0.0
    orm_pixels[:, 3] = 1.0

    orm_img = bpy.data.images.new("relief_orm", width=img_ao.size[0], height=img_ao.size[1])
    orm_img.pixels.foreach_set(orm_pixels.ravel())
    orm_img.filepath_raw = orm_2k_path
    orm_img.file_format = 'PNG'
    orm_img.save()
else:
    log("Reusing existing baked textures (relief_albedo_4k.png, relief_ao_2k.png, relief_normal_4k.png, relief_orm_2k.png).")

# 4. Construct zero-distortion back and rim via bmesh extrusion along Y
log("Constructing back and rim with zero X/Z displacement...")
bm = bmesh.new()
bm.from_mesh(target_obj.data)

uv_lay = bm.loops.layers.uv.verify()

# Boundary edges for rim
boundary_edges = [e for e in bm.edges if len(e.link_faces) == 1]
ext_res = bmesh.ops.extrude_edge_only(bm, edges=boundary_edges)
rim_verts = [ele for ele in ext_res['geom'] if isinstance(ele, bmesh.types.BMVert)]
rim_faces = [ele for ele in ext_res['geom'] if isinstance(ele, bmesh.types.BMFace)]

for v in rim_verts:
    v.co.y += 0.012 # offset purely along Y (into depth)

# Duplicate original faces to form back
orig_faces = [f for f in bm.faces if f not in rim_faces]
dup_res = bmesh.ops.duplicate(bm, geom=orig_faces)
dup_faces = [ele for ele in dup_res['geom'] if isinstance(ele, bmesh.types.BMFace)]
dup_verts = [ele for ele in dup_res['geom'] if isinstance(ele, bmesh.types.BMVert)]

for v in dup_verts:
    v.co.y += 0.012

bmesh.ops.reverse_faces(bm, faces=dup_faces)

# Mirror UV on back faces
for f in dup_faces:
    for loop in f.loops:
        u, v_coord = loop[uv_lay].uv
        loop[uv_lay].uv = (1.0 - u, v_coord)

# Set rim UVs to edge of texture
for f in rim_faces:
    for loop in f.loops:
        loop[uv_lay].uv = (0.99, 0.99)

# Merge duplicate vertices between rim and back boundary
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)

bm.to_mesh(target_obj.data)
bm.free()

target_obj.data.update()

# Assert bounds
cur_min_x = min(v.co.x for v in target_obj.data.vertices)
cur_max_x = max(v.co.x for v in target_obj.data.vertices)
cur_min_z = min(v.co.z for v in target_obj.data.vertices)
cur_max_z = max(v.co.z for v in target_obj.data.vertices)
cur_min_y = min(v.co.y for v in target_obj.data.vertices)
cur_max_y = max(v.co.y for v in target_obj.data.vertices)

log(f"New mesh bounds: X=[{cur_min_x:.6f}, {cur_max_x:.6f}], Y=[{cur_min_y:.6f}, {cur_max_y:.6f}], Z=[{cur_min_z:.6f}, {cur_max_z:.6f}]")
assert abs(cur_min_x - min_x) < 1e-5, f"X min shift: {abs(cur_min_x - min_x)}"
assert abs(cur_max_x - max_x) < 1e-5, f"X max shift: {abs(cur_max_x - max_x)}"
assert abs(cur_min_z - min_z) < 1e-5, f"Z min shift: {abs(cur_min_z - min_z)}"
assert abs(cur_max_z - max_z) < 1e-5, f"Z max shift: {abs(cur_max_z - max_z)}"
log("PARITY ASSERTION PASSED: X and Z bounds match source exactly (diff < 1e-5)!")

# 5. Production PBR Material
bake_mat.node_tree.nodes.clear()
p_bsdf = bake_mat.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
p_out = bake_mat.node_tree.nodes.new('ShaderNodeOutputMaterial')
bake_mat.node_tree.links.new(p_bsdf.outputs['BSDF'], p_out.inputs['Surface'])

tex_albedo = bake_mat.node_tree.nodes.new('ShaderNodeTexImage')
tex_albedo.image = bpy.data.images.load(albedo_4k_path)
bake_mat.node_tree.links.new(tex_albedo.outputs['Color'], p_bsdf.inputs['Base Color'])

tex_norm = bake_mat.node_tree.nodes.new('ShaderNodeTexImage')
tex_norm.image = bpy.data.images.load(normal_4k_path)
tex_norm.image.colorspace_settings.name = 'Non-Color'
norm_node = bake_mat.node_tree.nodes.new('ShaderNodeNormalMap')
bake_mat.node_tree.links.new(tex_norm.outputs['Color'], norm_node.inputs['Color'])
bake_mat.node_tree.links.new(norm_node.outputs['Normal'], p_bsdf.inputs['Normal'])

p_bsdf.inputs['Roughness'].default_value = 0.90
p_bsdf.inputs['Metallic'].default_value = 0.0

# Remove source object before export
bpy.data.objects.remove(source_obj, do_unlink=True)

# 6. Export relief.glb
relief_glb_path = os.path.join(outdir, "relief.glb")
log(f"Exporting {relief_glb_path}...")
bpy.ops.object.select_all(action='DESELECT')
target_obj.select_set(True)
bpy.context.view_layer.objects.active = target_obj

bpy.ops.export_scene.gltf(
    filepath=relief_glb_path,
    use_selection=True,
    export_format='GLB',
    export_materials='EXPORT',
    export_apply=True
)
log(f"Saved: {relief_glb_path}")

# 7. Create proxy model (decimate to ~8k tris with 1k texture)
log("Creating proxy model...")
proxy_obj = target_obj.copy()
proxy_obj.data = target_obj.data.copy()
bpy.context.collection.objects.link(proxy_obj)
proxy_obj.name = "relief_proxy"

current_polys = len(proxy_obj.data.polygons)
target_ratio = min(1.0, 8000.0 / max(1, current_polys))
mod_dec = proxy_obj.modifiers.new(name="Decimate", type='DECIMATE')
mod_dec.ratio = target_ratio
bpy.context.view_layer.objects.active = proxy_obj
bpy.ops.object.modifier_apply(modifier="Decimate")

proxy_mat = bake_mat.copy()
proxy_mat.name = "ProxyMat"
proxy_tex = proxy_mat.node_tree.nodes.get('Image Texture')
if proxy_tex:
    proxy_tex.image = bpy.data.images.load(albedo_1k_path)
proxy_obj.data.materials.clear()
proxy_obj.data.materials.append(proxy_mat)

relief_proxy_glb_path = os.path.join(outdir, "relief_proxy.glb")
bpy.ops.object.select_all(action='DESELECT')
proxy_obj.select_set(True)
bpy.context.view_layer.objects.active = proxy_obj

bpy.ops.export_scene.gltf(
    filepath=relief_proxy_glb_path,
    use_selection=True,
    export_format='GLB',
    export_materials='EXPORT',
    export_apply=True
)
log(f"Saved: {relief_proxy_glb_path}")

# 8. Render fallback poster
poster_path = os.path.join(outdir, "relief-poster.jpg")
if not os.path.exists(poster_path):
    log("Rendering fallback relief-poster.jpg...")
    cam_data = bpy.data.cameras.new("PosterCamera")
    cam_obj = bpy.data.objects.new("PosterCamera", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj
    cam_obj.location = (0, -2.2, 0)
    cam_obj.rotation_euler = (math.radians(90), 0, 0)

    light_data = bpy.data.lights.new(name="InspectionLamp", type='SPOT')
    light_data.energy = 80
    light_data.spot_size = math.radians(70)
    light_obj = bpy.data.objects.new(name="InspectionLamp", object_data=light_data)
    bpy.context.collection.objects.link(light_obj)
    light_obj.location = (0.3, -1.5, 0.4)
    light_obj.rotation_euler = (math.radians(65), 0, math.radians(20))

    bpy.context.scene.render.resolution_x = 1920
    bpy.context.scene.render.resolution_y = 1080
    bpy.context.scene.render.filepath = poster_path
    bpy.context.scene.render.image_settings.file_format = 'JPEG'
    bpy.context.scene.render.image_settings.quality = 90
    bpy.context.scene.cycles.samples = 128
    bpy.ops.render.render(write_still=True)
    log(f"Saved: {poster_path}")

log("01_prepare.py finished successfully!")
