import { visResult} from "./simulation-js/sim_execute"
import { raster_to_sim, raster_to_sim_sky } from "./simulation-js/sim_convert_py_result"
import * as itowns from 'itowns';
import * as THREE from "three";
import { SIMFuncs } from "@design-automation/mobius-sim-funcs";
import { updateHUD } from "./viewer.getresult";
import { JS_SERVER, PY_SERVER } from "./viewer.const";

export async function runSimulation(view, polygon, simulation) {
  let extraInfo, colorRange
  if (simulation.type === 'js') {
    extraInfo = await runJSSimulation(view, polygon, simulation)
  } else {
    [colorRange, extraInfo] = await runPYSimulation(view, polygon, simulation)
  }
  return updateHUD({
    ...simulation,
    col_range: colorRange ? colorRange : simulation.col_range,
    extra_info: extraInfo,
  })
}

// async function runJSSimulation(view, polygon, simulationType) {
//   const coords = polygon.getCoordinates()
//   if (!coords || coords.length === 0) { return }
//   const resultSIM = await simExecute(coords[0], simulationType)

//   const threeJSGroup = new THREE.Group();
//   threeJSGroup.name = 'simulation_result';

//   const geom = await addGeom(resultSIM)
//   threeJSGroup.add(geom)

//   const camTarget = new itowns.Coordinates('EPSG:4326', coords[0][0][0], coords[0][0][1], 0);
//   const cameraTargetPosition = camTarget.as(view.referenceCrs);

//   threeJSGroup.position.copy(cameraTargetPosition);

//   itowns.OrientationUtils.quaternionFromEnuToGeocent(camTarget, threeJSGroup.quaternion)
//   threeJSGroup.updateMatrixWorld(true);

//   view.scene.add(threeJSGroup);
//   view.notifyChange();

//   const extraInfo = resultSIM.attrib.Get(null, 'extra_info')
//   return extraInfo
// }

async function runJSSimulation(view, polygon, simulation) {
  const coords = polygon.getCoordinates()
  if (!coords || coords.length === 0) { return }

  const session = 'r' + (new Date()).getTime()
  const response = await fetch(JS_SERVER + simulation.id, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      bounds: coords[0],
      session: session
    })
  });
  const resp = await response.json()

  const resultSIM = await visResult(coords[0], simulation, resp.result)
  console.log('resultSIM', resultSIM)
  const threeJSGroup = new THREE.Group();
  threeJSGroup.name = 'simulation_result';

  const geom = await addGeom(resultSIM)
  threeJSGroup.add(geom)

  const camTarget = new itowns.Coordinates('EPSG:4326', coords[0][0][0], coords[0][0][1], 0);
  const cameraTargetPosition = camTarget.as(view.referenceCrs);

  threeJSGroup.position.copy(cameraTargetPosition);

  itowns.OrientationUtils.quaternionFromEnuToGeocent(camTarget, threeJSGroup.quaternion)
  threeJSGroup.updateMatrixWorld(true);

  view.scene.add(threeJSGroup);
  view.notifyChange();

  const extraInfo = resultSIM.attrib.Get(null, 'extra_info')
  return extraInfo

}

async function runPYSimulation(view, polygon, simulation) {
  if (simulation.id === 'sky') {
    return sky(view, polygon, simulation)
  }

  const coords = polygon.getCoordinates()
  if (!coords || coords.length === 0) { return [null, null] }

  const response = await fetch(PY_SERVER + simulation.id, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      bounds: coords[0]
    })
  });
  const resp = await response.json()
  console.log('response', response)
  console.log('resp', resp)
  const [result, bottomLeft, colRange] = raster_to_sim(coords[0], resp, simulation)
  const extra_info = result.attrib.Get(null, 'extra_info')

  const threeJSGroup = new THREE.Group();
  threeJSGroup.name = 'simulation_result';

  const geom = await addGeom(result, null, 1) as any
  threeJSGroup.add(geom)

  const camTarget = new itowns.Coordinates('EPSG:4326', bottomLeft[0], bottomLeft[1], 1);
  const cameraTargetPosition = camTarget.as(view.referenceCrs);

  threeJSGroup.position.copy(cameraTargetPosition);

  itowns.OrientationUtils.quaternionFromEnuToGeocent(camTarget, threeJSGroup.quaternion)
  threeJSGroup.updateMatrixWorld(true);

  // current_sim_div = document.getElementById('current_sim') as HTMLDivElement
  // if (current_sim_div && current_sim_div.innerHTML !== result_type) {
  //   return false;
  // }

  view.scene.add(threeJSGroup);
  view.notifyChange();
  return [colRange, extra_info]
}



export async function addGeom(sim: SIMFuncs, texture: ArrayBuffer|null = null, opacity=0.5) {
  // const sim = new SIMFuncs()
  // sim.io.ImportData(model, 'sim' as any);

  const threejs_data = sim.model.viewerGet3jsData(1);

  // Get materials
  const pgon_material_groups = threejs_data.pgon_material_groups;
  const pgon_materials = threejs_data.pgon_materials;
  // _replaceColors(pgon_materials, ['color', 'specular', 'emissive']);

  // Create buffers that will be used by all geometry
  const verts_xyz_buffer = new THREE.Float32BufferAttribute(threejs_data.verts_xyz, 3);
  const normals_buffer = new THREE.Float32BufferAttribute(threejs_data.normals, 3);
  const colors_buffer = new THREE.Float32BufferAttribute(threejs_data.colors, 3);
  // const posis_xyz_buffer = new THREE.Float32BufferAttribute(threejs_data.posis_xyz, 3);
  const tri_mesh = _addTris(
    threejs_data.tri_indices,
    verts_xyz_buffer, colors_buffer, normals_buffer,
    pgon_material_groups, pgon_materials, texture, opacity);
  return tri_mesh
}


function _addTris(
  tris_i: number[],
  posis_buffer: THREE.Float32BufferAttribute,
  colors_buffer: THREE.Float32BufferAttribute,
  normals_buffer: THREE.Float32BufferAttribute,
  material_groups,
  materials,
  texture, opacity
) {
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
  let material_arr
  if (texture) {
    console.log(texture)
    material_arr = new THREE.MeshBasicMaterial({map: texture})
  } else {
    material_arr= [];
    let index = 0;
    const l = materials.length;
    for (; index < l; index++) {
      const element = materials[index];
      let mat;
      delete element.type;
      mat = new THREE.MeshPhongMaterial(element);
      mat.transparent = true
      mat.opacity = opacity
      material_arr.push(mat);
    }
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

export function removeSimulation(view) {
  const layer = view.getLayerById('py_sim')
  if (layer) {
    view.removeLayer('py_sim');
  }
  const group = view.scene.getObjectByName('simulation_result')
  if (group) {
    view.scene.remove(group);
  }
}


async function sky(view, polygon, simulation) {
  const coords = polygon.getCoordinates()
  if (!coords || coords.length === 0) { return [null, null] }

  console.log(JSON.stringify({
    bounds: coords[0]
  }))
  const response = await fetch(PY_SERVER + simulation.id, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      bounds: coords[0]
    })
  });
  const resp = await response.json()

  const [result, bottomLeft, colRange, canvas] = raster_to_sim_sky(coords[0], resp, simulation)
  const canvasTexture = new THREE.CanvasTexture(canvas)

  const threeJSGroup = new THREE.Group();
  threeJSGroup.name = 'simulation_result';

  const geom = await addGeomSky(result, canvasTexture, 1) as any
  threeJSGroup.add(geom)


  const camTarget = new itowns.Coordinates('EPSG:4326', bottomLeft[0], bottomLeft[1], 1);
  const cameraTargetPosition = camTarget.as(view.referenceCrs);

  threeJSGroup.position.copy(cameraTargetPosition);

  itowns.OrientationUtils.quaternionFromEnuToGeocent(camTarget, threeJSGroup.quaternion)
  threeJSGroup.updateMatrixWorld(true);

  const extra_info = result.attrib.Get(null, 'extra_info')

  // current_sim_div = document.getElementById('current_sim') as HTMLDivElement
  // if (current_sim_div && current_sim_div.innerHTML !== result_type) {
  //   return false;
  // }

  view.scene.add(threeJSGroup);
  view.notifyChange();
  return [colRange, extra_info]

}

export async function addGeomSky(sim: SIMFuncs, texture: any, opacity=0.5) {
  // const sim = new SIMFuncs()
  // sim.io.ImportData(model, 'sim' as any);

  const threejs_data = sim.model.viewerGet3jsData(1);

  // Get materials
  const pgon_material_groups = threejs_data.pgon_material_groups;
  const pgon_materials = threejs_data.pgon_materials;
  // _replaceColors(pgon_materials, ['color', 'specular', 'emissive']);
  // Create buffers that will be used by all geometry
  const verts_xyz_buffer = new THREE.Float32BufferAttribute(threejs_data.verts_xyz, 3);
  const normals_buffer = new THREE.Float32BufferAttribute(threejs_data.normals, 3);
  const colors_buffer = new THREE.Float32BufferAttribute(threejs_data.colors, 3);
  // const posis_xyz_buffer = new THREE.Float32BufferAttribute(threejs_data.posis_xyz, 3);
  const tri_mesh = _addTrisSky(
    threejs_data.tri_indices,
    verts_xyz_buffer, colors_buffer, normals_buffer,
    pgon_material_groups, pgon_materials, texture, opacity);
  return tri_mesh
}


function _addTrisSky(
  tris_i: number[],
  posis_buffer: THREE.Float32BufferAttribute,
  colors_buffer: THREE.Float32BufferAttribute,
  normals_buffer: THREE.Float32BufferAttribute,
  material_groups,
  materials,
  texture, opacity
) {
  let geom = new THREE.BufferGeometry();
  geom.setIndex(tris_i);
  geom.setAttribute('position', posis_buffer);
  const uv_arr: number[] = []
  const max = [0, 0]
  for (let i = 0; i < posis_buffer.count; i++) {
    max[0] = Math.max(max[0], posis_buffer.getX(i))
    max[1] = Math.max(max[1], posis_buffer.getY(i))
  }
  for (let i = 0; i < posis_buffer.count; i++) {
    uv_arr.push(posis_buffer.getX(i) / max[0])
    uv_arr.push(posis_buffer.getY(i) / max[1])
  }
  geom.setAttribute('uv', new THREE.Float32BufferAttribute( uv_arr, 2 ) );
  if (normals_buffer.count > 0) {
    geom.setAttribute('normal', normals_buffer);
  }
  // geom.setAttribute('color', colors_buffer);
  geom.clearGroups();
  material_groups.forEach(element => {
    geom.addGroup(element[0], element[1], element[2]);
  });
  // _buffer_geoms.push(geom);
  let material_arr
  if (texture) {
    // geom = new THREE.PlaneGeometry( 100, 100 );
    material_arr = new THREE.MeshBasicMaterial({map: texture})
  } else {
    material_arr= [];
    let index = 0;
    const l = materials.length;
    for (; index < l; index++) {
      const element = materials[index];
      let mat;
      delete element.type;
      mat = new THREE.MeshPhongMaterial(element);
      mat.transparent = true
      mat.opacity = opacity
      material_arr.push(mat);
    }
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

