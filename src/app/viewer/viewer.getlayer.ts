import * as itowns from 'itowns';
import * as THREE from "three";
import { BUILDING_TILES_URL } from './viewer.const';
import { SIMFuncs } from "@design-automation/mobius-sim-funcs";
const sim = new SIMFuncs()

export async function getAllBuildings(view): Promise<boolean> {
    const geometrySource = new itowns.WFSSource({
        url: BUILDING_TILES_URL,
        typeName: 'sg_sim:sg_buildings',
        crs: 'EPSG:4326',
    });

    const geometryLayer = new itowns.FeatureGeometryLayer('Buildings', {
        source: geometrySource,
        style: new itowns.Style({
            fill: {
                color: new THREE.Color(0xdddddd),
                base_altitude: 0,
                extrusion_height: properties => properties.AGL,
            },
        }),
    });

    view.addLayer(geometryLayer);

    return true
}

export async function getResultLayer(view, type) {
    console.log(type)
    const wmsSource = new itowns.WMSSource({
        url: BUILDING_TILES_URL.replace('wfs', 'wms'),
        name: type + '_png',
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
        opacity: 0.5,
    });

    console.log(geometryLayer)
    view.addLayer(geometryLayer);
}

export async function removeResultLayer(view) {
    const layer = view.getLayerById('resultLayer')
    if (!layer) { return; }
    view.removeLayer('resultLayer');
}

export function updateHUD({sim_name, col_range, unit}: {sim_name:string, col_range: number[], unit: string}) {
    let hud_msg = '<div style="line-height:1.1;">'
    hud_msg += '<h3>' + sim_name + '</h3><br>';
    hud_msg += '</div>'
    // create a legend for the Heads Up Display
    const leg_labels: string[] = [];
    const col_range_diff = col_range[1] - col_range[0];
    const num_labels = 11;
    for (let i = 0; i < num_labels; i ++) {
        const val = col_range[0] + (col_range_diff * (i / (num_labels - 1)));
        const val_sf = sim.inl.sigFig(val, 2);
        leg_labels.push(val_sf + ' ' + unit);
    }
    const hud_leg = sim.inl.htmlColLeg([300, 20], leg_labels);
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
    }
}