import {
    arrMakeFlat,
    createSingleMeshBufTjs,
    idsBreak,
    vecAdd,
    vecDot,
    vecMult,
    vecSetLen,
} from '@design-automation/mobius-sim';
import * as THREE from 'three';
import { _addLine, _addPosi, _addTri, _generateLines, _getSensorRays } from './_shared';
const EPS = 1e-6;
// =================================================================================================
/**
 * Calculate an approximation of the wind frequency for a set sensors positioned at specified 
 * locations. 
 * \n
 * @param __model__
 * @param sensors A list of Rays or a list of Planes, to be used as the 
 * sensors for calculating wind.
 * @param entities The obstructions, polygons, or collections of polygons.
 * @param radius The max distance for raytracing.
 * @param num_rays An integer specifying the number of rays to generate in each wind direction.
 * @param layers Three numbers specifying layers of rays, as [start, stop, step] relative to the 
 * sensors.
 * @returns A dictionary containing wind results.
 */
export function Wind(
    __model__,
    sensors,
    entities,
    radius,
    num_rays,
    layers,
) {
    entities = arrMakeFlat(entities);
    let ents_arrs = idsBreak(entities);
    radius = Array.isArray(radius) ? radius : [1, radius];
    layers = Array.isArray(layers) ? layers : [0, layers, 1]; // start, end, step_size
    if (layers.length === 2) { layers = [layers[0], layers[1], 1]; }
    // get rays for sensor points
    const [sensors0, sensors1, two_lists] = _getSensorRays(sensors, 0.01); // offset by 0.01
    // create mesh
    const [mesh_tjs, _] = createSingleMeshBufTjs(__model__, ents_arrs);
    // get the wind rose
    const wind_rose = __model__.modeldata.attribs.get.getModelAttribVal("wind");
    // get the direction vectors for shooting rays
    const dir_vecs = _windVecs(num_rays + 1, wind_rose);
    // run simulation
    const results0 = _calcWind(__model__,
        sensors0, dir_vecs, radius, mesh_tjs, layers, wind_rose, false);
    // cleanup
    mesh_tjs.geometry.dispose();
    (mesh_tjs.material).dispose();
    // return the results
    return results0;
}
// =================================================================================================
function _calcWind(
    __model__,
    sensor_rays,
    dir_vecs,
    radius,
    mesh_tjs,
    layers,
    wind_rose,
    generate_lines
) {
    const results = [];
    const num_layers = Math.round((layers[1] - layers[0]) / layers[2]);
    // create tjs objects (to be resued for each ray)
    const sensor_tjs = new THREE.Vector3();
    const dir_tjs = new THREE.Vector3();
    const ray_tjs = new THREE.Raycaster(sensor_tjs, dir_tjs, radius[0], radius[1]);
    // shoot rays
    for (const [sensor_xyz, sensor_dir] of sensor_rays) {
        const vis_rays = [];
        const ray_starts = [];
        let sensor_result = 0;
        // loop through vertical layers
        for (let z = layers[0]; z < layers[1]; z += layers[2]) {
            const vis_layer_rays = [];
            // save start
            const ray_start = [sensor_xyz[0], sensor_xyz[1], sensor_xyz[2] + z];
            ray_starts.push(ray_start);
            sensor_tjs.x = ray_start[0]; sensor_tjs.y = ray_start[1]; sensor_tjs.z = ray_start[2];
            // loop through wind directions
            for (let i = 0; i < wind_rose.length; i++) {
                const wind_freq = wind_rose[i] / (dir_vecs[i].length * num_layers);
                // loop through dirs
                for (const ray_dir of dir_vecs[i]) {
                    // check if target is behind sensor
                    const dot_ray_sensor = vecDot(ray_dir, sensor_dir);
                    if (dot_ray_sensor < -EPS) { continue; }
                    // set raycaster direction
                    dir_tjs.x = ray_dir[0]; dir_tjs.y = ray_dir[1]; dir_tjs.z = ray_dir[2];
                    // shoot raycaster
                    const isects = ray_tjs.intersectObject(mesh_tjs, false);
                    // get results
                    if (isects.length === 0) {
                        // if no intersection => distance ratio is 1
                        // add wind_frequency to the result
                        sensor_result += wind_freq; // dist_ratio is 1
                        const ray_end = vecAdd(ray_start, vecMult(ray_dir, 2));
                        vis_layer_rays.push([ray_end, 0]);
                    } else {
                        // distance ratio: intersection distance / radius
                        // i.e. intersection at 50m over a 200m radius => distance ratio = 0.25
                        const dist_ratio = isects[0].distance / radius[1];
                        // add wind_frequency * distance ratio to the result
                        sensor_result += (wind_freq * dist_ratio);
                        const ray_end = [isects[0].point.x, isects[0].point.y, isects[0].point.z];
                        vis_layer_rays.push([ray_end, 1]);
                    }
                }
            }
            vis_rays.push(vis_layer_rays);
        }
        results.push(sensor_result);
        // generate calculation lines for each sensor
        if (generate_lines) {
            for (let i = 0; i < vis_rays.length; i++) {
                _generateLines(__model__, ray_starts[i], vis_rays[i]);
            }
            // vert line
            const z_min = sensor_xyz[2] < ray_starts[0][2] ? sensor_xyz : ray_starts[0];
            const last = ray_starts[ray_starts.length - 1];
            const z_max = sensor_xyz[2] > last[2] ? sensor_xyz : last;
            z_max[2] = z_max[2] + 0.2;
            const posi0_i = _addPosi(__model__, z_min);
            const posi1_i = _addPosi(__model__, z_max);
            _addLine(__model__, posi0_i, posi1_i);
            // wind rose
            const ang_inc = (2 * Math.PI) / wind_rose.length;
            for (let i = 0; i < wind_rose.length; i++) {
                const ang2 = (Math.PI / 2) - (ang_inc / 2) - (ang_inc * i);
                const ang3 = ang2 + ang_inc;
                const vec2 = vecSetLen([Math.cos(ang2), Math.sin(ang2), 0], wind_rose[i] * 20);
                const vec3 = vecSetLen([Math.cos(ang3), Math.sin(ang3), 0], wind_rose[i] * 20);
                const posi2_i = _addPosi(__model__, vecAdd(z_max, vec2));
                const posi3_i = _addPosi(__model__, vecAdd(z_max, vec3));
                _addTri(__model__, posi1_i, posi2_i, posi3_i);
            }
        }
    }
    return { wind: results };
}
// =================================================================================================
function _windVecs(num_vecs, wind_rose) {
    // num_vecs is the number of vecs for each wind angle
    const num_winds = wind_rose.length;
    const wind_ang = (Math.PI * 2) / num_winds;
    const ang_inc = wind_ang / num_vecs;
    const ang_start = -(wind_ang / 2) + (ang_inc / 2);
    const dir_vecs = [];
    for (let wind_i = 0; wind_i < num_winds; wind_i++) {
        const vecs_wind_dir = [];
        for (let vec_i = 0; vec_i < num_vecs; vec_i++) {
            const ang = ang_start + (wind_ang * wind_i) + (ang_inc * vec_i);
            vecs_wind_dir.push([Math.sin(ang), Math.cos(ang), 0]);
        }
        dir_vecs.push(vecs_wind_dir);
    }
    // returns a nest list, with vectors groups according to the wind direction
    // e.g. if there are 16 wind directions, then there will be 16 groups of vectors
    return dir_vecs;
}
// =================================================================================================
