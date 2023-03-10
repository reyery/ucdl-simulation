import * as itowns from 'itowns';
import * as THREE from "three";
import { BUILDING_TILES_URL } from './viewer.const';
import { SIMFuncs } from "@design-automation/mobius-sim-funcs";
const sim = new SIMFuncs()


export async function getResultLayer(view, simulation, itown_layers) {
    if (simulation.maptype === 'tile') {
        const wmsSource = new itowns.WMSSource({
            url: BUILDING_TILES_URL.replace('wfs', 'wms'),
            name: simulation.id + '_png',
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
        itown_layers[simulation.id]
        if (!itown_layers[simulation.id]) {
            const geometrySource = new itowns.WFSSource({
                url: BUILDING_TILES_URL,
                typeName: `sg_sim:${simulation.id}_shp`,
                crs: 'EPSG:4326',
            });

            const range = simulation.col_range[1]
            // function pyColor(properties) {
            //     const val = properties.value
            //     const r25 = range / 4
            //     const r50 = range / 2
            //     const r75 = r25 * 3
            //     if (val <= r25) {
            //         return new THREE.Color(`rgb(0, ${Math.round(val * 255 / r25)}, 255)`);
            //     } else if (val <= r50) {
            //         return new THREE.Color(`rgb(0, ${128 + Math.round((r50 - val) * 127 / r25)}, ${Math.round((r50 - val) * 255 / r25)})`);
            //     } else if (val <= r75) {
            //         return new THREE.Color(`rgb(${Math.round((val - r50) * 255 / r25)}, ${128 + Math.round((val - r50) * 127 / r25)}, 0)`);
            //     } else {
            //         return new THREE.Color(`rgb(255, ${Math.round((range - val) * 255 / r25)}, 0)`);
            //     }
            // }
            
            function pyColor(properties) {
                const val = properties.value
                const r50 = range / 2
                if (val <= r50) {
                    return new THREE.Color(`rgb(${Math.round(val * 255 / r50)}, ${200 + Math.round(val * 55 / r50)}, 0)`);
                } else {
                    return new THREE.Color(`rgb(255, ${Math.round((range - val) * 200 / r50)}, 0)`);
                }
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
    }
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
}

export function updateHUD({ sim_name, col_range, unit, extra_info, desc }: { sim_name: string, col_range: number[], unit: string, extra_info?: string , desc?: string}): string {
    let hud_msg = '<div style="line-height:1.1; font-weight: 500; font-size: large;">'
    hud_msg += '<h3>' + sim_name + (desc? (' ' + desc) : '' )+ '</h3>';
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
    let hud_leg
    if (sim_name === 'Urban Heat Island Intensity') {
        hud_leg = sim.inl.htmlColLeg([300, 20], leg_labels, ['white','#EB6E00']);
    } else {
        hud_leg = sim.inl.htmlColLeg([300, 20], leg_labels, ['green','yellow','red']);
    }
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