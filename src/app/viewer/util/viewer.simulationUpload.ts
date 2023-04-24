import { visResult } from "../simulation-js/sim_execute"
import { eval_to_sim } from "../simulation-js/sim_convert_py_result"
import * as itowns from 'itowns';
import * as THREE from "three";
import { SIMFuncs } from "@design-automation/mobius-sim-funcs";
import { updateHUD } from "./viewer.getresult";
import { JS_SERVER, PY_SERVER } from "./viewer.const";
import { addGeom, addViewGeom } from "./viewer.threejs";

export async function runSimulation(view, simData, simulation) {
  let extraInfo, colorRange

  console.log('simData', simData)
  if (simulation.type === 'js') {
    extraInfo = await runJSSimulation(view, simData, simulation)
  } else {
    [colorRange, extraInfo] = await runPYSimulation(view, simData, simulation)
  }
  return updateHUD({
    ...simulation,
    col_range: colorRange ? colorRange : simulation.col_range,
    extra_info: extraInfo,
  })
}

async function runJSSimulation(view, simData, simulation) {
  if (!simData) { return }

  const session = 'r' + (new Date()).getTime()
  const request = {
    extent: simData.extent,
    data: simData.data,
    simBoundary: simData.simBoundary ? simData.simBoundary : null,
    featureBoundary: simData.featureBoundary ? simData.featureBoundary : null,
    gridSize: simulation.grid_size || 10, 
    session: session
  }
  if (simData.simBoundary)
  console.log('request:', request)
  const response = await fetch(JS_SERVER + simulation.id + '_upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });
  const resp = await response.json()

  console.log(resp.result)

  // TODO: add result as textured plane rather than multiple colored squares
  // eval_to_sim()
  
  const resultSIM = await visResult(simData.simBoundary, simulation, resp.result, resp.surrounding)

  
  // const bottomLeft = simData.simBoundary.reduce((minCoord, b) => [Math.min(minCoord[0], b[0]), Math.min(minCoord[1], b[1])], [99999, 99999])
  // console.log(bottomLeft)
  await addViewGeom(view, resultSIM, simData.simBoundary[0], 'simulation_result')
  // console.log('resultSIM', resultSIM)
  // const threeJSGroup = new THREE.Group();
  // threeJSGroup.name = 'simulation_result';

  // const geom = await addGeom(resultSIM)
  // threeJSGroup.add(geom)

  // const camTarget = new itowns.Coordinates('EPSG:4326', simData.extent[0], simData.extent[1], 0);
  // const cameraTargetPosition = camTarget.as(view.referenceCrs);

  // threeJSGroup.position.copy(cameraTargetPosition);

  // itowns.OrientationUtils.quaternionFromEnuToGeocent(camTarget, threeJSGroup.quaternion)
  // threeJSGroup.updateMatrixWorld(true);

  // view.scene.add(threeJSGroup);
  // view.notifyChange();

  const extraInfo = resultSIM.attrib.Get(null, 'extra_info')
  return extraInfo

}

async function runPYSimulation(view, simData, simulation) {
  // if (simulation.id === 'sky') {
  //   return sky(view, polygon, simulation)
  // }

  // const coords = polygon.getCoordinates()
  // if (!coords || coords.length === 0) { return [null, null] }

  // const response = await fetch(PY_SERVER + simulation.id, {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json'
  //   },
  //   body: JSON.stringify({
  //     bounds: coords[0]
  //   })
  // });
  // const resp = await response.json()
  // console.log('response', response)
  // console.log('resp', resp)
  // const [result, bottomLeft, colRange] = raster_to_sim(coords[0], resp, simulation)
  // const extra_info = result.attrib.Get(null, 'extra_info')

  // const threeJSGroup = new THREE.Group();
  // threeJSGroup.name = 'simulation_result';

  // const geom = await addGeom(result, null, 1) as any
  // threeJSGroup.add(geom)

  // const camTarget = new itowns.Coordinates('EPSG:4326', bottomLeft[0], bottomLeft[1], 1);
  // const cameraTargetPosition = camTarget.as(view.referenceCrs);

  // threeJSGroup.position.copy(cameraTargetPosition);

  // itowns.OrientationUtils.quaternionFromEnuToGeocent(camTarget, threeJSGroup.quaternion)
  // threeJSGroup.updateMatrixWorld(true);

  // // current_sim_div = document.getElementById('current_sim') as HTMLDivElement
  // // if (current_sim_div && current_sim_div.innerHTML !== result_type) {
  // //   return false;
  // // }

  // view.scene.add(threeJSGroup);
  // view.notifyChange();
  // return [colRange, extra_info]
  return [null, null]
}





