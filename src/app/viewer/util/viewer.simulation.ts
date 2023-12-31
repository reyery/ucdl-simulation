import { visResult1 } from "../simulation-js/sim_execute"
import { raster_to_sim, raster_to_sim_sky, raster_to_sim_ap } from "../simulation-js/sim_convert_py_result"
import * as itowns from 'itowns';
import * as THREE from "three";
import { SIMFuncs } from "@design-automation/mobius-sim-funcs";
import { updateHUD, updateWindHUD } from "./viewer.getresult";
import { JS_SERVER, PY_SERVER } from "./viewer.const";
import { addGeom, addGeomSky, addViewGeom, removeViewerGroup } from "./viewer.threejs";
import { fetchData } from "./viewer.fetch";

export async function runSimulation(view, polygon, simulation, gridSize) {
  removeViewerGroup(view, 'upload_model')
  let extraInfo, colorRange
  if (simulation.type.startsWith('js')) {
    [colorRange, extraInfo] = await runJSSimulation(view, polygon, simulation, gridSize)
  } else {
    [colorRange, extraInfo] = await runPYSimulation(view, polygon, simulation, gridSize)
  }
  return updateHUD({
    ...simulation,
    col_range: colorRange ? colorRange : (simulation.col_range_label? simulation.col_range_label : simulation.col_range),
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

async function runJSSimulation(view, coords, simulation, gridSize) {
  if (!coords || coords.length === 0) { return [null, null] }
  
  const session = 'r' + (new Date()).getTime()
  const reqBody = {
    bounds: coords[0],
    gridSize: gridSize,
    session: session
  }
  console.log('reqBody', reqBody)
  const resp = await fetchData(JS_SERVER + simulation.id, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reqBody)
    })
  if (!resp) { return [simulation.col_range, '']};
  console.log('response', resp)
  // const d1 = await result.io.ExportData(null, 'sim')
  // console.log('~~~~~~____', d1)

  const [resultSIM, surrSim, canvas, minCoord, offset, colRange] = await visResult1(coords[0], simulation, resp, gridSize)
  // var link = document.createElement('a');
  // link.download = 'filename.png';
  // link.href = canvas.toDataURL()
  // link.click();
  
  const canvasTexture = new THREE.CanvasTexture(canvas, THREE.UVMapping, THREE.RepeatWrapping, THREE.RepeatWrapping, THREE.NearestFilter)
  canvasTexture.offset = new THREE.Vector2(...offset)

  // await addViewGeom(view, resultSIM, canvasTexture, coords[0][0], 'simulation_result')
  removeViewerGroup(view, 'simulation_result')
  const threeJSGroup = new THREE.Group();
  threeJSGroup.name = 'simulation_result';

  const geom = await addGeomSky(resultSIM, canvasTexture, 1)
  threeJSGroup.add(geom)

  const camTarget = new itowns.Coordinates('EPSG:4326', minCoord[2], minCoord[3], 0.1);
  const cameraTargetPosition = camTarget.as(view.referenceCrs);

  threeJSGroup.position.copy(cameraTargetPosition);

  itowns.OrientationUtils.quaternionFromEnuToGeocent(camTarget, threeJSGroup.quaternion)
  threeJSGroup.updateMatrixWorld(true);

  view.scene.add(threeJSGroup);
  setTimeout(() => {
    view.notifyChange();
  }, 0);

  if (simulation.id === 'wind') {
    updateWindHUD(resp.wind_stns)
  }

  const extraInfo = resultSIM.attrib.Get(null, 'extra_info')
  return [colRange, extraInfo]

}

async function runPYSimulation(view, coords, simulation, gridSize) {
  if (simulation.id === 'ap') {
    return ap(view, coords, simulation)
  }

  if (!coords || coords.length === 0) { return [null, null] }

  const request = {
    bounds: coords[0],
    grid_size: gridSize
  }
  console.log('request:', request)
  const resp = await fetchData(PY_SERVER + simulation.id, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  })
  if (!resp) { return [simulation.col_range, '']};

  const [result, bottomLeft, colRange, canvas] = raster_to_sim_sky(coords[0], resp, simulation, gridSize)

  const canvasTexture = new THREE.CanvasTexture(canvas, THREE.UVMapping, THREE.RepeatWrapping, THREE.RepeatWrapping, THREE.NearestFilter)

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

  console.log('__________ simulation', simulation)

  if (simulation.id === 'wind') {
    updateWindHUD(resp.wind_stns)
  }

  setTimeout(() => {
    view.notifyChange();
  }, 0);
  return [colRange, extra_info]
}


async function ap(view, coords, simulation) {
  if (!coords || coords.length === 0) { return [null, null] }

  const resp = await fetchData(PY_SERVER + simulation.id, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      bounds: coords[0]
    })
  })
  if (!resp) { return [simulation.col_range, '']};

  const [result, bottomLeft, colRange] = raster_to_sim_ap(coords[0], resp, simulation)
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
  setTimeout(() => {
    view.notifyChange();
  }, 0);
  return [colRange, extra_info]

}