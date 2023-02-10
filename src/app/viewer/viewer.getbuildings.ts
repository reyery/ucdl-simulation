import * as itowns from 'itowns';
import * as THREE from "three";
import { BUILDING_TILES_URL, LONGLAT, model_files } from './viewer.const';
// import { addGeom } from './viewer.getresultall';

function extrusion_height(properties) {
    return properties.AGL
}

// export async function getBuildings(view, filename): Promise<boolean> {
//     if (!model_files.has(filename)) { return false; }

//     const f = 'assets/models/' + filename

//     const data: string = await fetch(f).then(res => {
//         if (!res.ok) { return '' }
//         return res.text()
//     })

//     if (data === '') { return false; }

//     const threeJSGroup = new THREE.Group();
//     threeJSGroup.name = filename;

//     const geom = await addGeom(data)
//     threeJSGroup.add(geom[0])

//     const camTarget = new itowns.Coordinates('EPSG:4326', LONGLAT[0], LONGLAT[1], 0);
//     const cameraTargetPosition = camTarget.as(view.referenceCrs);

//     threeJSGroup.position.copy(cameraTargetPosition);
//     threeJSGroup.position.z += 0.1;

//     itowns.OrientationUtils.quaternionFromEnuToGeocent(camTarget, threeJSGroup.quaternion)
//     threeJSGroup.updateMatrixWorld(true);

//     view.scene.add(threeJSGroup);
//     view.notifyChange();
//     return true
// }

export async function getAllBuildings(view): Promise<boolean> {
    // console.log('---------------------------------')
    // const data = [
    //     itowns.Fetcher.arrayBuffer('assets/_shp_/singapore_buildings.shp'),
    //     itowns.Fetcher.arrayBuffer('assets/_shp_/singapore_buildings.dbf'),
    //     itowns.Fetcher.arrayBuffer('assets/_shp_/singapore_buildings.shx'),
    //     itowns.Fetcher.text('assets/_shp_/singapore_buildings.prj'),
    // ]
    // await Promise.all(data)
    // const [shp, dbf, shx, prj] = [await data[0], await data[1], await data[2], await data[3]]
    // console.log(shp, dbf, shx, prj)
    // const geojson = await itowns.ShapefileParser.parse({
    //     shp: shp,
    //     dbf: dbf,
    //     shx: shx,
    //     prj: prj,
    // }, {
    //     in: {
    //         crs: 'EPSG:4326',
    //     },
    //     out: {
    //         crs: view.tileLayer.extent.crs,
    //     }
    // })

    // console.log(geojson)
    // const geometrySource = new itowns.FileSource({ features: geojson });
    var geometrySource = new itowns.WFSSource({
        url: BUILDING_TILES_URL,
        typeName: 'sg_sim:sg_buildings',
        crs: 'EPSG:4326',
    });
    
    var geometryLayer = new itowns.FeatureGeometryLayer('Buildings', {
        source: geometrySource,
        style: new itowns.Style({
            fill: {
                color: new THREE.Color(0xdddddd),
                base_altitude: 0,
                extrusion_height: extrusion_height,
            },
        }),
    });
    
    // const geometrySource = new itowns.FileSource({
    //     url: 'assets/_shp_/singapore_buildings.geojson',
    //     crs: 'EPSG:4326',
    //     format: 'application/json',
    // });
    
    // const geometryLayer = new itowns.FeatureGeometryLayer('Buildings', {
    //     source: geometrySource,
    //     style: new itowns.Style({
    //         fill: {
    //             color: new THREE.Color(0xdddddd),
    //             base_altitude: 7,
    //             extrusion_height: extrusion_height,
    //         },
    //     }),
    // });


    // const geometryLayer = new itowns.GeometryLayer('Buildings', new THREE.Object3D(), {
    //     source: geometrySource,
    // });
   
    // const geometryLayer = new itowns.ColorLayer('Buildings', {
    //     source: geometrySource,
    //     zoom: { min: 12 },
    //     style: new itowns.Style({
    //         fill: {
    //             color: 'cyan',
    //             opacity: 0.5,
    //         },
    //         stroke: {
    //             color: 'blue',
    //         },
    //         extrusion_height: 50
    //     }),
    // });
    
    // const layer = new itowns.ColorLayer('velib', { source  });
    console.log(geometrySource)
    console.log(geometryLayer)
    view.addLayer(geometryLayer);
        

    return true
}
