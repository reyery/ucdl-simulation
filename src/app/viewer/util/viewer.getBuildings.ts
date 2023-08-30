import { SIMFuncs } from '@design-automation/mobius-sim-funcs';
import { GlobeView, Coordinates, OrientationUtils } from 'itowns';
import proj4 from 'proj4';
import { addGeom, removeViewerGroup } from './viewer.threejs';
import * as THREE from "three";

function _createProjection() {
    const proj_from_str = 'WGS84';
    const proj_to_str = '+proj=tmerc +lat_0=1.36666666666667 +lon_0=103.833333333333 ' +
        '+k=1 +x_0=28001.642 +y_0=38744.572 +ellps=WGS84 ' +
        '+towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs';
    const proj_obj = proj4(proj_from_str, proj_to_str);
    return proj_obj;
}
const proj_obj = _createProjection()
const RANGE = 500
const TILES_NUM_INDEX = {
    14: 6,
    15: 4,
    16: 2,
    0: 1
}
let INDEX = new Set([])

export async function getBuildings(view: GlobeView, bldGroup: THREE.Group, buildingMeshesIndex: any) {
    const lookCoordObj = view.controls.getLookAtCoordinate()
    const lookCoord = [lookCoordObj.x, lookCoordObj.y]
    const lookCoordSVY = proj_obj.forward(lookCoord)
    const buildingFileXY = [Math.floor(lookCoordSVY[0] / RANGE), Math.floor(lookCoordSVY[1] / RANGE)]
    const buildingData = []
    const currentZoom = view.controls.getZoom()
    let tilesNum = TILES_NUM_INDEX[currentZoom] ? TILES_NUM_INDEX[currentZoom] : TILES_NUM_INDEX[0]

    if (INDEX.size === 0) {
        const indexing = await fetch(`/assets/buildings/index.json`).then(resp => resp.json()).catch(ex => null)
        if (indexing) {INDEX = new Set(indexing)}
    }
    let buildingGroup = bldGroup
    for (const mesh of buildingGroup.children) {
        buildingGroup.remove(mesh)
    }

    for (let x = buildingFileXY[0] - tilesNum; x < buildingFileXY[0] + tilesNum + 1; x++ ) {
        for (let y = buildingFileXY[1] - tilesNum; y < buildingFileXY[1] + tilesNum + 1; y++ ) {
            const pos = [x * RANGE, y * RANGE]
            const posid = pos.join('_')

            if (buildingMeshesIndex[posid]) {
                buildingGroup.add(buildingMeshesIndex[posid])
                continue
            }
            try {
                if (!INDEX.has(posid)) { continue }
                const result = fetch(`/assets/buildings/f_${posid}.json`).then(resp => resp.json()).catch(ex => ['error'])
                buildingData.push([pos, result])    
            } catch (ex) {}
        }
    }

    for (const data of buildingData) {
        const tileBuildings = await data[1]
        if (tileBuildings[0] === 'error') { continue }
        const pos = proj_obj.inverse(data[0]) 
        const sim = new SIMFuncs()
        for (const building of tileBuildings) {
            const ps = sim.make.Position(building[0].map(c => [c[0], c[1], 0]))
            const pg = sim.make.Polygon(ps)
            sim.make.Extrude(pg, building[1], 1, 'quads' as any)
        }
        const geom = await addGeom(sim)
        const geomCoord = new Coordinates('EPSG:4326', pos[0], pos[1], 0);
        const geomPos = geomCoord.as(view.referenceCrs);
        geom.position.copy(geomPos);
        geom.name = data[0].join('_')
        buildingMeshesIndex[geom.name] = geom
        OrientationUtils.quaternionFromEnuToGeocent(geomCoord, geom.quaternion);
        geom.updateMatrixWorld(true);
        const check = buildingGroup.getObjectByName(geom.name)
        if (check) { continue }
        buildingGroup.add(geom)
    }
    view.notifyChange();
}