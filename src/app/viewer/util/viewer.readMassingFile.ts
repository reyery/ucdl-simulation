import * as itowns from 'itowns';
import * as THREE from 'three';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader';
// import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';

import { BUILDING_TILES_URL, DEFAULT_LONGLAT, JS_SERVER, LONGLAT, WGS84_SIM_PROJ, SHOW_BUILDINGS, SIM_DATA } from './viewer.const';
import { getResultLayer, removeResultLayer, updateHUD } from './viewer.getresult';
import { runSimulation as runDrawSim } from './viewer.simulation';
import { runSimulation as runUploadSim } from './viewer.simulationUpload';
import proj4 from 'proj4';
import * as shapefile from 'shapefile';

import Map from 'ol/Map.js';
import TileLayer from 'ol/layer/Tile.js';
import TileWMS from 'ol/source/TileWMS.js';
import View from 'ol/View.js';
import XYZ from 'ol/source/XYZ';
import Draw from 'ol/interaction/Draw.js';
import Graticule from 'ol/layer/Graticule.js';
import Stroke from 'ol/style/Stroke.js';
import { getArea } from 'ol/sphere.js';
import { Feature, Image as OlImage, Overlay } from 'ol';
import CircleStyle from 'ol/style/Circle.js';
import MousePosition from 'ol/control/MousePosition.js';
import { createStringXY } from 'ol/coordinate.js';
import { defaults as defaultControls } from 'ol/control.js';

import { Modify, Select, Translate } from 'ol/interaction.js';
import { useGeographic } from 'ol/proj.js';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import { Polygon } from 'ol/geom';
import Style from 'ol/style/Style';
import Fill from 'ol/style/Fill';
import { SIMFuncs } from '@design-automation/mobius-sim-funcs';
import { addGeom, addViewGeom, removeSimulation } from './viewer.threejs';
import { add as addCoord } from 'ol/coordinate';
import ImageStyle from 'ol/style/Image';
import Shape from '@doodle3d/clipper-js';

export async function readMassingFiles(files, currentLatLong: number[]) {
  const fileTypeResult = await checkUploadedFilesType(files)
  if (!fileTypeResult.status) {
    console.log('~~~~~~~~~~~~~~~~~~~~~~')
    console.log('file check status', fileTypeResult.status)
    console.log('file type', fileTypeResult.type)
    return null
  }
  if (fileTypeResult.type === 'dae') {
    return readDAE(fileTypeResult.file, currentLatLong)
  } else if (fileTypeResult.type === 'shp') {
    return readSHP(fileTypeResult)
  }
  return null
}
async function checkUploadedFilesType(files: FileList): Promise<{status: boolean, type: string, shp?: ArrayBuffer, dbf?: ArrayBuffer, file?: File}> {
  let fileType = 'unidentified';
  const shpCheck = [false, false]
  const shpFile: ArrayBuffer[] = [null, null]
  for (let i = 0; i < files.length; i++) {
    const file = files.item(i)
    if (file.name.endsWith('.skp')) {
      return {
        status: true,
        type: 'skp',
        file: file
      }
    } else if (file.name.endsWith('.dae')) {
      return {
        status: true,
        type: 'dae',
        file: file
      }
    } else if (file.name.endsWith('.shp')) {
      fileType = 'shp'
      shpCheck[0] = true
      shpFile[0] = await file.arrayBuffer()
    } else if (file.name.endsWith('.dbf')) {
      fileType = 'shp'
      shpCheck[1] = true
      shpFile[1] = await file.arrayBuffer()
    }
  }
  if (fileType === 'shp') {
    return {
      status: shpCheck[0] && shpCheck[1],
      type: fileType,
      shp: shpFile[0],
      dbf: shpFile[1],
    }
  }
  return {
    status: false,
    type: 'unidentified',
    file: null
  }
}

async function readSHP(shpFiles) {
  const features = []
  let boundTransf = false
  const source = await shapefile.open(shpFiles.shp, shpFiles.dbf)
  for (const bboxCoord of source.bbox) {
    if (bboxCoord > 180) {
      boundTransf = true
      break
    }
  }
  const sim = new SIMFuncs()
  const extent = [99999, 99999, -99999, -99999]

  while (true) {
    const result = await source.read()
    if (!result || result.done) { break; }
    const coords = result.value.geometry.coordinates

    const feature = new Feature({
      geometry: new Polygon(coords),
    });
    if (boundTransf) {
      feature.getGeometry().transform('SVY21', 'EPSG:4326')
    }
    const geomExtent = feature.getGeometry().getExtent()
    extent[0] = Math.min(extent[0], geomExtent[0])
    extent[1] = Math.min(extent[1], geomExtent[1])
    extent[2] = Math.max(extent[2], geomExtent[2])
    extent[3] = Math.max(extent[3], geomExtent[3])
    feature.setProperties(result.value.properties)
    features.push(feature)
    simImportFeature(sim, feature)
  }

  const allPgons = sim.query.Get('pg' as any, null)
  const walls = [];
  const roofs = [];
  for (const obstruction of allPgons) {
    // if facing up, then make it roof, otherwise walls
    const normal = sim.calc.Normal(obstruction, 1);
    if (normal[2] > 0.5) {
      roofs.push(obstruction);
    } else {
      walls.push(obstruction);
    }
  }
  // update colour
  sim.visualize.Color(walls, sim.inl.colFromStr('beige') as any);
  sim.visualize.Color(roofs, sim.inl.colFromStr('beige') as any);

  const exportedData = await sim.io.ExportData(null, 'sim' as any)

  const simExtent = WGS84_SIM_PROJ.forward([extent[0], extent[1]])
  sim.modify.Move(allPgons, [-simExtent[0], -simExtent[1], 0])

  return {
    uploadedGeomData: {
      extent: extent,
      sim: sim,
      data: exportedData,
      features: features
    },
    features: features,
    translateModeSwitch: false
  }
}

async function readDAE(file, currentLatLong: number[]) {
  // const fileData = await file.arrayBuffer()
  // const parsedCollada = colladaParser.parse(fileData)
  // console.log(parsedCollada)
  const loader = new ColladaLoader();
  const fileURI = window.URL.createObjectURL(file)
  // const fileData = await file.arrayBuffer()
  const itownSim = new SIMFuncs()
  const fileData = await new Promise(resolve => {
    let clipperShape
    loader.load(fileURI, function (collada) {
      const pgonsCoords = getThreeGeomCoords(collada.scene)

      for (const pgonC of pgonsCoords) {
        const pos = itownSim.make.Position(pgonC as any)
        const pgon = itownSim.make.Polygon(pos)
        const norm = itownSim.calc.Normal(pgon, 1)
        if (norm[2] > 0) {
          if (clipperShape) {
            const projectedShape = new Shape([pgonC.map(x => { return { X: x[0] * 100000, Y: x[1] * 100000 } })])
            clipperShape = clipperShape.union(projectedShape)
          } else {
            clipperShape = new Shape([pgonC.map(x => { return { X: x[0] * 100000, Y: x[1] * 100000 } })])
          }
        }
      }
      const features: Feature<Polygon>[] = []
      const extent = [9999, 9999, -9999, -9999]
      for (const clipPath of clipperShape.paths) {
        const pathCoords = [];
        for (const c of clipPath) {
          const coord = WGS84_SIM_PROJ.inverse([c.X / 100000, c.Y / 100000])
          extent[0] = Math.min(extent[0], coord[0])
          extent[1] = Math.min(extent[1], coord[1])
          extent[2] = Math.max(extent[2], coord[0])
          extent[3] = Math.max(extent[3], coord[1])
          pathCoords.push(coord)
        }
        features.push(new Feature({
          geometry: new Polygon([pathCoords]),
        }))
      }
      console.log('currentLatLong', currentLatLong)
      console.log('extent', extent)
      console.log('currentLatLong[0] - extent[0], currentLatLong[1] - extent[1]', currentLatLong[0] - extent[0], currentLatLong[1] - extent[1])
      
      const translation = [currentLatLong[0] - extent[0], currentLatLong[1] - extent[1]]
      for (const feature of features) {
        feature.getGeometry().translate(translation[0], translation[1])
      }
      const extentSimCoord =  WGS84_SIM_PROJ.forward([extent[0], extent[1]])
      const currentSimCoord =  WGS84_SIM_PROJ.forward(currentLatLong)
      console.log('extentSimCoord, currentSimCoord', extentSimCoord, currentSimCoord)
      itownSim.modify.Move(itownSim.query.Get('pg' as any, null), [currentSimCoord[0] - extentSimCoord[0], currentSimCoord[1] - extentSimCoord[1], 0])
      extent[2] = extent[2] + currentLatLong[0] - extent[0]
      extent[3] = extent[3] + currentLatLong[1] - extent[1]
      extent[0] = currentLatLong[0]
      extent[1] = currentLatLong[1]

      resolve([features, extent])
    });
  }).catch(error => console.log('promise error', error))
  const oplFeatures = fileData[0]
  const oplExtent: number[] = fileData[1]
  for (const feature of oplFeatures) {
    console.log(feature.getGeometry().getCoordinates())
  }

  const allPgons = itownSim.query.Get('pg' as any, null)
  const walls = [];
  const roofs = [];
  for (const obstruction of allPgons) {
    // if facing up, then make it roof, otherwise walls
    const normal = itownSim.calc.Normal(obstruction, 1);
    if (normal[2] > 0.5) {
      roofs.push(obstruction);
    } else {
      walls.push(obstruction);
    }
  }
  // update colour
  itownSim.visualize.Color(walls, itownSim.inl.colFromStr('beige') as any);
  itownSim.visualize.Color(roofs, itownSim.inl.colFromStr('beige') as any);

  const exportedData = await itownSim.io.ExportData(null, 'sim' as any)

  const simExtent = WGS84_SIM_PROJ.forward([oplExtent[0], oplExtent[1]])
  itownSim.modify.Move(allPgons, [-simExtent[0], -simExtent[1], 0])

  console.log(oplExtent)
  // return null
  return {
    uploadedGeomData: {
      extent: oplExtent,
      sim: itownSim,
      data: exportedData,
      features: oplFeatures
    },
    features: oplFeatures,
    translateModeSwitch: true
  }

  // return {
  //   uploadedGeomData: {
  //     extent: extent,
  //     data: exportedData
  //   },
  //   uploadSim: {
  //     sim: sim,
  //     viewCoord: [extent[0], extent[1]]
  //   },
  //   features: features
  // }

}

function getThreeGeomCoords(threeObj): number[][][] {
  if (threeObj.type === 'Group') {
    let pgons = []
    for (const obj of threeObj.children) {
      pgons = pgons.concat(getThreeGeomCoords(obj))
    }
    return pgons
  } else if (threeObj.type === 'Mesh') {
    console.log('threeObj',threeObj)
    const gp = threeObj.geometry.attributes.position;
    const pgons: number[][][] = [];
    let pgonPos: number[][] = [];
    let pgonVertCount = 0
    for (let i = 0; i < gp.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(gp, i); // set p from `position`
      const coord = [p.x, p.y, p.z / 39.37]
      pgonPos.push(coord);
      pgonVertCount += 1
      if (pgonVertCount === 3) {
        pgonVertCount = 0
        pgons.push(pgonPos)
        pgonPos = []
      }
    }
    return pgons
  }
  return []
}
function simImportFeature(sim: SIMFuncs, feature: Feature) {
  const geom = (<Polygon>feature.getGeometry()).getCoordinates()
  const properties = feature.getProperties()
  const pgonHeight: number = properties['h'] ||
    properties['H'] || properties['height'] ||
    properties['Height'] || properties['AGL']

  if (geom.length === 1) {
    if (geom[0][0] === geom[0][geom[0].length - 1]) {
      geom[0].splice(geom[0].length - 1, 1)
    }
    const pgCoords = geom[0].map(c => {
      const coord = WGS84_SIM_PROJ.forward(c)
      coord.push(0)
      return sim.make.Position(coord)
    })
    const pg = sim.make.Polygon(pgCoords)
    const pg_norm = sim.calc.Normal(pg, 1)
    if (pg_norm[2] < 0) {
      sim.edit.Reverse(pg)
    }
    if (pgonHeight) {
      sim.make.Extrude(pg, pgonHeight, 1, <any>'quads')
      sim.edit.Delete(pg, <any>'delete_selected')
    }
  } else {

  }
}

