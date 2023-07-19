import { visResult, visResult1 } from "../simulation-js/sim_execute"
import { eval_to_sim } from "../simulation-js/sim_convert_py_result"
import * as itowns from 'itowns';
import * as THREE from "three";
import { SIMFuncs } from "@design-automation/mobius-sim-funcs";
import { updateHUD, updateWindHUD } from "./viewer.getresult";
import { JS_SERVER, PY_SERVER } from "./viewer.const";
import { addGeom, addGeomSky, addViewGeom, removeViewerGroup } from "./viewer.threejs";
import GeoJSON from 'ol/format/GeoJSON.js';
import { fetchData } from "./viewer.fetch";

export async function runSimulation(view, simData, simulation, gridSize) {
  let extraInfo, colorRange

  console.log('simData', simData)
  if (simulation.type === 'js') {
    [colorRange, extraInfo] = await runJSSimulation(view, simData, simulation, gridSize)
  } else {
    [colorRange, extraInfo] = await runPYSimulation(view, simData, simulation, gridSize)
  }
  return updateHUD({
    ...simulation,
    col_range: colorRange ? colorRange : (simulation.col_range_label? simulation.col_range_label : simulation.col_range),
    extra_info: extraInfo,
  })
}

async function runJSSimulation(view, simData, simulation, gridSize) {
  if (!simData) { return [null, null] }

  const session = 'r' + (new Date()).getTime()
  const request = {
    extent: simData.extent,
    data: simData.data,
    simBoundary: simData.simBoundary ? simData.simBoundary : null,
    featureBoundary: simData.featureBoundary ? simData.featureBoundary : null,
    gridSize: gridSize, 
    session: session
  }
  if (simData.simBoundary)
  console.log('request:', request)
  const resp = await fetchData(JS_SERVER + simulation.id + '_upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  })
  if (!resp) { return [null, '']};


  // TODO: add result as textured plane rather than multiple colored squares
  // eval_to_sim()
  const [resultSIM, surrSim, canvas, minCoord, offset, colRange] = await visResult1(simData.simBoundary, simulation, resp, gridSize)
  // var link = document.createElement('a');
  // link.download = 'filename.png';
  // link.href = canvas.toDataURL()
  // link.click();
  await addViewGeom(view, resultSIM, simData.simBoundary[0], 'simulation_result')

  const canvasTexture = new THREE.CanvasTexture(canvas, THREE.UVMapping, THREE.RepeatWrapping, THREE.RepeatWrapping, THREE.NearestFilter)
  canvasTexture.offset = new THREE.Vector2(...offset)

  // await addViewGeom(view, resultSIM, canvasTexture, coords[0][0], 'simulation_result')
  removeViewerGroup(view, 'simulation_result')
  const threeJSGroup = new THREE.Group();
  threeJSGroup.name = 'simulation_result';

  const geom = await addGeomSky(resultSIM, canvasTexture, 1)
  const surrGeom = await addGeom(surrSim)
  threeJSGroup.add(geom)
  threeJSGroup.add(surrGeom)

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

async function simToGeoJSON(inputModel: string) {
  console.log('sim data:',inputModel)
  const sim = new SIMFuncs()
  await sim.io.ImportData(inputModel, 'sim' as any);
  const allPgons = sim.query.Get('pg' as any, null);
  const expPgons = [];
  for (const pgon of allPgons) {
    const norm = sim.calc.Normal(pgon, 10000)
    if (Math.round(norm[2]) <= 0) { continue; }
    console.log('pgon', pgon)
    expPgons.push(pgon)
    const ps = sim.query.Get('ps' as any, pgon)
    const zCoords = sim.attrib.Get(ps, 'xyz').map(xyz => xyz[2])
    sim.attrib.Set(pgon, 'height', Math.max(...zCoords), 'one_value' as any)
  }
  sim.edit.Delete(expPgons, 'keep_selected' as any)
  const geoJSON = await sim.io.ExportData(null, 'geojson' as any)
  return JSON.stringify(JSON.parse(geoJSON))
}

async function runPYSimulation(view, simData, simulation, gridSize) {
  if (!simData) { return [null, null] }
  const session = 'r' + (new Date()).getTime()

  const geojsonStr = await simToGeoJSON(simData.data)

  console.log('geojsonStr', geojsonStr)
  // const request = {
  //   extent: simData.extent,
  //   data: simData.data,
  //   simBoundary: simData.simBoundary ? simData.simBoundary : null,
  //   featureBoundary: simData.featureBoundary ? simData.featureBoundary : null,
  //   gridSize: simulation.grid_size || 200, 
  //   session: session
  // }
  // if (simData.simBoundary)
  // console.log('request:', request)
  // const response = await fetch(PY_SERVER + simulation.id + '_upload', {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json'
  //   },
  //   body: JSON.stringify(request)
  // });
  // const resp = await response.json()

  // console.log(resp.result)

  return [null, null]
}





