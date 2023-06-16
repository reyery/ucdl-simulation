import { visResult} from "../simulation-js/sim_execute"
import { raster_to_sim, raster_to_sim_sky, raster_to_sim_ap } from "../simulation-js/sim_convert_py_result"
import * as itowns from 'itowns';
import * as THREE from "three";
import { SIMFuncs } from "@design-automation/mobius-sim-funcs";
import { updateHUD, updateWindHUD } from "./viewer.getresult";
import { JS_SERVER, PY_SERVER } from "./viewer.const";
import { addGeom, addGeomSky, addViewGeom, removeViewerGroup } from "./viewer.threejs";

export async function runSimulation(view, polygon, simulation) {
  removeViewerGroup(view, 'upload_model')
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

async function runJSSimulation(view, coords, simulation) {
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

  await addViewGeom(view, resultSIM, coords[0][0], 'simulation_result')
  // console.log('resultSIM', resultSIM)
  // const threeJSGroup = new THREE.Group();
  // threeJSGroup.name = 'simulation_result';

  // const geom = await addGeom(resultSIM)
  // threeJSGroup.add(geom)

  // const camTarget = new itowns.Coordinates('EPSG:4326', coords[0][0][0], coords[0][0][1], 0);
  // const cameraTargetPosition = camTarget.as(view.referenceCrs);

  // threeJSGroup.position.copy(cameraTargetPosition);

  // itowns.OrientationUtils.quaternionFromEnuToGeocent(camTarget, threeJSGroup.quaternion)
  // threeJSGroup.updateMatrixWorld(true);

  // view.scene.add(threeJSGroup);
  // view.notifyChange();

  if (simulation.id === 'wind') {
    updateWindHUD(resp.wind_stns)
  }

  const extraInfo = resultSIM.attrib.Get(null, 'extra_info')
  return extraInfo

}

async function runPYSimulation(view, coords, simulation) {
  if (simulation.id === 'sky') {
    return sky(view, coords, simulation)
  } else if (simulation.id === 'ap') {
    return ap(view, coords, simulation)
  }

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

async function sky(view, coords, simulation) {
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

  console.log('coords[0], resp, simulation', coords[0], resp, simulation)

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

async function ap(view, coords, simulation) {
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
  view.notifyChange();
  return [colRange, extra_info]

}