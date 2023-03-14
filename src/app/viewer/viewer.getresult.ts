import * as itowns from 'itowns';
import * as THREE from "three";
import { BUILDING_TILES_URL } from './viewer.const';
import { SIMFuncs } from "@design-automation/mobius-sim-funcs";
import { scale as chromaScale } from 'chroma-js';

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

export function updateHUD({ sim_name, col_range, col_scale, unit, extra_info, desc }: any): string {
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