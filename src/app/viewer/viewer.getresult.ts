import axios from "axios";
import * as itowns from 'itowns';
import * as THREE from "three";
import { SIMFuncs } from "@design-automation/mobius-sim-funcs";
import { LONGLAT, model_files } from "./viewer.const";

enum MaterialType {
  MeshBasicMaterial = 'MeshBasicMaterial',
  MeshStandardMaterial = 'MeshStandardMaterial',
  MeshLambertMaterial = 'MeshLambertMaterial',
  MeshPhongMaterial = 'MeshPhongMaterial',
  MeshPhysicalMaterial = 'MeshPhysicalMaterial'
}

export function addLight(view) {
  const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.25);
  view.scene.add(ambientLight);
  const hemiLight = new THREE.HemisphereLight(0xFFFFFF, 0xFFFFFF, 0.15);
  view.scene.add(hemiLight);
}

const material = new THREE.MeshPhongMaterial({

});


export async function getResult(view, filename, result_type = 'uhi'): Promise<boolean> {
  // if (!model_files.has(filename)) { return false; }

  const f = 'assets/result_' + result_type + '/' + filename


  const data: string = await fetch(f).then(res => {
    if (!res.ok) { return '' }
    return res.text()
  })

  if (data === '') { return false; }

  let current_sim_div = document.getElementById('current_sim') as HTMLDivElement
  if (current_sim_div && current_sim_div.innerHTML !== result_type) {
    return false;
  }

  const threeJSGroup = new THREE.Group();
  threeJSGroup.name = 'sim_result-' + filename;

  const geom = await addGeom(data)
  // const geom = await addResult(filename.slice(5, -4).split('_').map(x => Number(x)), 'assets/result_img_' + result_type + '/' + filename.slice(0, -4) + '.png')
  threeJSGroup.add(geom)

  const camTarget = new itowns.Coordinates('EPSG:4326', LONGLAT[0], LONGLAT[1], -7);
  const cameraTargetPosition = camTarget.as(view.referenceCrs);

  threeJSGroup.position.copy(cameraTargetPosition);

  itowns.OrientationUtils.quaternionFromEnuToGeocent(camTarget, threeJSGroup.quaternion)
  threeJSGroup.updateMatrixWorld(true);

  current_sim_div = document.getElementById('current_sim') as HTMLDivElement
  if (current_sim_div && current_sim_div.innerHTML !== result_type) {
    return false;
  }

  view.scene.add(threeJSGroup);
  view.notifyChange();
  return true
}


export async function addGeom(model: string) {
  const sim = new SIMFuncs()
  sim.io.ImportData(model, 'sim' as any);

  const threejs_data = sim.model.viewerGet3jsData(1);

  // Get materials
  const pline_materials = threejs_data.pline_materials;
  _replaceColors(pline_materials, ['color']);
  const pgon_material_groups = threejs_data.pgon_material_groups;
  const vrmesh_pgon_material_groups = threejs_data.vrmesh_pgon_material_groups;
  const pgon_materials = threejs_data.pgon_materials;
  _replaceColors(pgon_materials, ['color', 'specular', 'emissive']);

  // Create buffers that will be used by all geometry
  const verts_xyz_buffer = new THREE.Float32BufferAttribute(threejs_data.verts_xyz, 3);
  const normals_buffer = new THREE.Float32BufferAttribute(threejs_data.normals, 3);
  const colors_buffer = new THREE.Float32BufferAttribute(threejs_data.colors, 3);
  // const posis_xyz_buffer = new THREE.Float32BufferAttribute(threejs_data.posis_xyz, 3);
  const tri_mesh = _addTris(
    threejs_data.tri_indices, threejs_data.vrmesh_tri_indices,
    verts_xyz_buffer, colors_buffer, normals_buffer,
    pgon_material_groups, vrmesh_pgon_material_groups, pgon_materials);
  return tri_mesh
}

function _replaceColors(materials: object[], keys: string[]): void {
  for (const mat of materials) {
    for (const color_key of keys) {
      const rgb = mat[color_key];
      if (rgb === undefined) { continue; }
      if (!Array.isArray(rgb)) { continue; }
      mat[color_key] = new THREE.Color(rgb[0], rgb[1], rgb[2]);
    }
  }
}

function _addTris(
  tris_i: number[],
  vrmesh_tris_i: number[],
  posis_buffer: THREE.Float32BufferAttribute,
  colors_buffer: THREE.Float32BufferAttribute,
  normals_buffer: THREE.Float32BufferAttribute,
  material_groups,
  vrmesh_material_groups,
  materials
): void {
  const geom = new THREE.BufferGeometry();
  geom.setIndex(tris_i);
  geom.setAttribute('position', posis_buffer);
  if (normals_buffer.count > 0) {
    geom.setAttribute('normal', normals_buffer);
  }
  geom.setAttribute('color', colors_buffer);
  geom.clearGroups();
  material_groups.forEach(element => {
    geom.addGroup(element[0], element[1], element[2]);
  });
  // _buffer_geoms.push(geom);

  const vrmesh_geom = new THREE.BufferGeometry();
  vrmesh_geom.setIndex(vrmesh_tris_i);
  vrmesh_geom.setAttribute('position', posis_buffer);
  if (normals_buffer.count > 0) {
    vrmesh_geom.setAttribute('normal', normals_buffer);
  }
  vrmesh_geom.setAttribute('color', colors_buffer);
  vrmesh_geom.clearGroups();
  vrmesh_material_groups.forEach(element => {
    vrmesh_geom.addGroup(element[0], element[1], element[2]);
  });

  const material_arr: any[] = [];
  let index = 0;
  const l = materials.length;


  for (; index < l; index++) {
    const element = materials[index];
    // if (settings.background.show) {
    //     element.envMap = scene.background;
    //     // element.refractionRatio = 1;
    //     // element.envMap.mapping = THREE.CubeRefractionMapping;
    // }
    let mat;
    delete element.type;
    mat = new THREE.MeshPhongMaterial(element);
    mat.transparent = true
    mat.opacity = 0.5
    material_arr.push(mat);
  }
  const mesh = new THREE.Mesh(geom, material_arr);
  mesh.name = 'obj_tri';

  mesh.geometry.computeBoundingSphere();
  if (normals_buffer.count === 0) {
    mesh.geometry.computeVertexNormals();
  }
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  return mesh
}
