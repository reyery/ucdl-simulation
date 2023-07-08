import * as itowns from 'itowns';
import * as THREE from "three";
import { BUILDING_TILES_URL, MAX_AP_LAYERS, PY_SERVER } from './viewer.const';
import { SIMFuncs } from "@design-automation/mobius-sim-funcs";
import { scale as chromaScale } from 'chroma-js';
import { addGeom } from './viewer.threejs';
import { ap_to_sim } from "../simulation-js/sim_convert_py_result"

const sim = new SIMFuncs()


export async function getResultLayer(view, simulation, itown_layers) {
    if (simulation.maptype === 'tile') {
        const wmsSource = new itowns.WMSSource({
            url: BUILDING_TILES_URL.replace('wfs', 'wms'),
            name: simulation.id + '_png',
            // version: '1.2.0',
            transparent: true,
            crs: 'EPSG:4326',
            extent: {
                west: '103.60305',
                east: '104.08385',
                south: '1.21725',
                north: '1.47507',
            },
        });

        const geometryLayer = new itowns.ColorLayer('resultLayer', {
            source: wmsSource,
            opacity: 1,
        });

        console.log(geometryLayer)
        view.addLayer(geometryLayer);
        itowns.ColorLayersOrdering.moveLayerDown(view, 'resultLayer');
        itowns.ColorLayersOrdering.moveLayerDown(view, 'resultLayer');

    } else if (simulation.maptype === 'shp') {
        if (!itown_layers[simulation.id]) {
            const geometrySource = new itowns.WFSSource({
                url: BUILDING_TILES_URL,
                typeName: `sg_sim:${simulation.id}_shp`,
                crs: 'EPSG:4326',
            });

            const range = simulation.col_range[1]

            const colorScale = chromaScale(simulation.col_scale).domain(simulation.col_range);
            function pyColor(properties) {
                //@ts-ignore
                return new THREE.Color(colorScale(properties.value).num());
            }

            itown_layers[simulation.id] = new itowns.FeatureGeometryLayer('resultLayer_' + simulation.id, {
                source: geometrySource,
                style: new itowns.Style({
                    fill: {
                        color: pyColor,
                        base_altitude: 0.1,
                        extrusion_height: properties => properties.value * 1000 / range,
                    },
                }),
            });
        }
        view.addLayer(itown_layers[simulation.id]);
    } else if (simulation.maptype = 'special') {
        if (simulation.id === 'ap') {
            await getAirPollutantResult(view, simulation)
        }
    }
}

// function getAirPollutantResult(view, simulation) {
//     for (let i = 0; i < MAX_AP_LAYERS; i++) {
//         const layerName = 'resultLayer_ap_' + i
//         const geometrySource = new itowns.WFSSource({
//             url: BUILDING_TILES_URL,
//             typeName: `sg_sim:ap_${i+1}`,
//             crs: 'EPSG:4326',
//         });

//         const range = simulation.col_range[1]

//         const colorScale = chromaScale(simulation.col_scale).domain(simulation.col_range);
//         function pyColor(properties) {
//             //@ts-ignore
//             return new THREE.Color(colorScale(properties.value).num());
//         }

//         const itown_layer = new itowns.FeatureGeometryLayer(layerName, {
//             source: geometrySource,
//             style: new itowns.Style({
//                 fill: {
//                     color: pyColor,
//                     base_altitude: simulation.otherInfo.height * i,
//                     extrusion_height: simulation.otherInfo.height,
//                 },
//             }),
//         });
//         view.addLayer(itown_layer);
//     }
// }

async function getAirPollutantResult(view, simulation) {

    const response = await fetch(PY_SERVER + 'get_ap').catch(ex => {
      console.log('HTTP ERROR:',ex)
      return null
    });
    if (!response) { return [simulation.col_range, '']};
    const resp = await response.json()
    console.log('response', response)
    console.log('resp', resp)

    const [result, bottomLeft, colRange] = ap_to_sim(resp, simulation)
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

export async function removeResultLayer(view) {
    const layer = view.getLayerById('resultLayer')
    if (layer) {
        view.removeLayer('resultLayer');
    }
    const layer_uwind = view.getLayerById('resultLayer_uwind')
    if (layer_uwind) {
        view.removeLayer('resultLayer_uwind');
    }
    const layer_ah = view.getLayerById('resultLayer_ah')
    if (layer_ah) {
        view.removeLayer('resultLayer_ah');
    }
    for (let i = 0; i < MAX_AP_LAYERS; i++) {
        const layerName = 'resultLayer_ap_' + i
        const layer_ap = view.getLayerById(layerName)
        if (layer_ap) {
            view.removeLayer(layerName);
        }
    }
}

export function updateHUD({ id, sim_name, col_range, col_scale, unit, extra_info, desc }: any): string {
    // hide wind rose HUD (hide for simulation that's not wind situations)
    if (id !== 'wind') {
        const hud_wind_elm = document.getElementById('hud_wind') as HTMLDivElement;
        console.log('____________ update ')
        if (hud_wind_elm && !hud_wind_elm.classList.contains('hidden')) {
            hud_wind_elm.classList.add('hidden')
        }
    }

    let hud_msg = '<div style="line-height:1.1; font-weight: 500; font-size: large;">'
    hud_msg += '<h3>' + sim_name + (desc ? (' ' + desc) : '') + '</h3>';
    hud_msg += '</div>'
    // create a legend for the Heads Up Display
    const leg_labels: string[] = [];
    const col_range_diff = col_range[1] - col_range[0];
    const num_labels = 11;
    for (let i = 0; i < num_labels; i++) {
        const val = col_range[0] + (col_range_diff * (i / (num_labels - 1)));
        const val_sf = sim.inl.sigFig(val, 2);
        leg_labels.push(val_sf + ' ' + unit);
    }
    const hud_leg = sim.inl.htmlColLeg([300, 20], leg_labels, col_scale);

    // Heads Up Display
    const hud_elm = document.getElementById('hud') as HTMLDivElement;
    if (hud_elm) {
        if (sim_name === 'None') {
            if (!hud_elm.classList.contains('hidden')) {
                hud_elm.classList.add('hidden')
            }
        } else {
            hud_elm.classList.remove('hidden')
        }
        hud_elm.innerHTML = hud_msg + hud_leg
        if (extra_info) {
            hud_elm.innerHTML += `${extra_info}`
        }
        return hud_elm.innerHTML
    }
    return ''
}

export function updateWindHUD(wind_stns: string[]) {
    const hud_wind_elm = document.getElementById('hud_wind') as HTMLDivElement;
    if (hud_wind_elm) {
        if (hud_wind_elm.classList.contains('hidden')) {
            hud_wind_elm.classList.remove('hidden')
        }
    }
    while (hud_wind_elm.firstChild) {
        hud_wind_elm.removeChild(hud_wind_elm.firstChild);
    }
    for (const stnID of wind_stns) {
        const img = document.createElement("img");
        img.src = `/assets/windrose/${stnID}.png`;
        hud_wind_elm.appendChild(img);
    }
}
export function updateWindHUDPos(stickToRight) {
    const hud_wind_elm = document.getElementById('hud_wind') as HTMLDivElement;
    if (hud_wind_elm) {
        if (stickToRight) {
            hud_wind_elm.style.right = '0.25rem';
        } else {
            hud_wind_elm.style.right = '3rem';
        }
    }
  }
