import * as itowns from 'itowns';
import * as THREE from "three";
import { SIMFuncs } from "@design-automation/mobius-sim-funcs";

export async function addViewGeom(view: itowns.View, sim: SIMFuncs, viewCoord: number[], geomName: string) {
  console.log('++++++++++++ add view geometry', geomName, viewCoord)
  removeViewerGroup(view, geomName)
  const threeJSGroup = new THREE.Group();
  threeJSGroup.name = geomName;

  const geom = await addGeom(sim)
  console.log('added view geometry:', geom)
  threeJSGroup.add(geom)

  const camTarget = new itowns.Coordinates('EPSG:4326', viewCoord[0], viewCoord[1], 0);
  const cameraTargetPosition = camTarget.as(view.referenceCrs);

  threeJSGroup.position.copy(cameraTargetPosition);

  itowns.OrientationUtils.quaternionFromEnuToGeocent(camTarget, threeJSGroup.quaternion)
  threeJSGroup.updateMatrixWorld(true);

  view.scene.add(threeJSGroup);
  view.notifyChange();

}
export async function addGeom(sim: SIMFuncs, texture: any = null, opacity=1) {
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
    console.log('~~~~~~~~~ remove simulation')
    removeViewerGroup(view, 'py_sim')
    removeViewerGroup(view, 'simulation_result')
  }

  export function removeViewerGroup(view, groupName) {
    const group = view.scene.getObjectByName(groupName)
    if (group) {
      view.scene.remove(group);
    }
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
    // let geom = new THREE.PlaneGeometry(100, 100);
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
      material_arr = new THREE.MeshBasicMaterial({map: texture})
      material_arr.transparent = true
      // material_arr.opacity = opacity
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
  
  