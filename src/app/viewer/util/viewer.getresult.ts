import * as itowns from 'itowns';
import * as THREE from "three";
import { BUILDING_TILES_URL, MAX_AP_LAYERS, PY_SERVER } from './viewer.const';
import { SIMFuncs } from "@design-automation/mobius-sim-funcs";
import { scale as chromaScale } from 'chroma-js';
import { addGeom } from './viewer.threejs';
import { ap_to_sim } from "../simulation-js/sim_convert_py_result"
import { fetchData } from './viewer.fetch';
import * as chroma from 'chroma-js';

const sim = new SIMFuncs()
const defaultStyles = {
    maindiv: 'line-height:1.1; font-weight: 600; font-size: large;',
    h3: '',
    desc: 'font-size: 0.9rem; line-height: 1.1rem; font-style: italic; font-weight: 400;',
    footnote: 'font-size: 0.75rem; line-height: 1rem; font-style: italic;',
    extraInfo: '',
    legendSize: [300, 20],
    numLabels: 11
}
const mobileStyles = {
    maindiv: 'line-height:1.1; font-weight: 600; font-size: small;',
    h3: '',
    desc: 'font-size: 0.6rem; line-height: 1.1rem; font-style: italic; font-weight: 400;',
    footnote: 'font-size: 0.5rem; line-height: 1rem; font-style: italic;',
    extraInfo: 'font-size: 0.7rem; ',
    legendSize: [200, 20],
    numLabels: 5
}

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

    // const response = await fetch(PY_SERVER + 'get_ap').catch(ex => {
    //   console.log('HTTP ERROR:',ex)
    //   return null
    // });
    // if (!response) { return [simulation.col_range, '']};
    // const resp = await response.json()
    // console.log('response', response)
    // console.log('resp', resp)
    const resp = await fetchData(PY_SERVER + 'get_ap')
    if (!resp) { return [simulation.col_range, '']};

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
    setTimeout(() => {
        view.notifyChange();
    }, 0);
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

function legendVertical(size: number| [number, number], labels: string[], col_scale: string[] = null) {
    size = Array.isArray(size) ? size : [size, 20] as [number, number];
    // calc heights
    const col_row_height = 2; //  2px
    const label_row_height: number = Math.round(size[0] / ((labels.length - 1) * col_row_height)) * col_row_height;
    const col_table_height: number = label_row_height * (labels.length - 1);
    const col_num_rows: number = col_table_height / col_row_height;
    const col_width: number = size[1];
    // if no scale is provided, then default to false color scale
    col_scale = col_scale === null ? ['blue', 'cyan', 'green', 'yellow', 'red'] : col_scale;
    // color
    const ch_scale = chroma.scale(col_scale);
    const ch_domain = ch_scale.domain([0, col_num_rows]);
    // ---------------------------------------------------------------------------------------------
    // table with colours
    let table_html1 = '<table cellspacing="0">'
    const table_row1 = 
        '<tr>' + 
            '<td style="height:' + col_row_height + 'px; width:' + col_width + 
                'px;padding:0px;background-color:rgb($col)" />' + 
        '</tr>'
    for (let i = 0; i < col_num_rows; i++) {
        const col = ch_domain(i).gl();
        const col_str: string = 
            Math.round(col[0] * 255) + ',' + 
            Math.round(col[1] * 255) + ',' + 
            Math.round(col[2] * 255);
        table_html1 += table_row1.replace('$col', col_str);
    }
    table_html1 += '</table>';
    // ---------------------------------------------------------------------------------------------
    // table with labels
    let table_html2 = '<table cellspacing="0">'
    const table_row2 = 
        '<tr>' + 
            '<td style="height:' + label_row_height + 'px;padding:0px;">$text</td>' + 
        '</tr>'
    for (const label of labels) {
        table_html2 += table_row2.replace('$text', '  ' + label);
    }
    table_html2 += '</table>';
    // ---------------------------------------------------------------------------------------------
    // join and return
    return '<table><td>' + table_html1 + '</td><td>' + table_html2 + '</td></table>';
}
function legendHorizontal(size: number| [number, number], labels: string[], col_scale: string[] = null) {
    size = Array.isArray(size) ? size : [size, 20] as [number, number];
    // calc heights
    const col_width = 1;
    const label_col_width: number = Math.round(size[0] / ((labels.length - 1) * col_width)) * col_width;
    const table_width: number = label_col_width * (labels.length - 1);
    const col_num_rows: number = table_width / col_width;
    const row_height: number = size[1];
    // if no scale is provided, then default to false color scale
    col_scale = col_scale === null ? ['blue', 'cyan', 'green', 'yellow', 'red'] : col_scale;
    // color
    const ch_scale = chroma.scale(col_scale);
    const ch_domain = ch_scale.domain([0, col_num_rows]);
    // ---------------------------------------------------------------------------------------------
    // table with colours
    let table_html1 = '<table cellspacing="0">'
    const table_row1 = `<td style="height:${row_height}px; width:${col_width}px;padding:0px;background-color:rgb($col)"/>`
    for (let i = 0; i < col_num_rows; i++) {
        const col = ch_domain(i).gl();
        const col_str: string = 
            Math.round(col[0] * 255) + ',' + 
            Math.round(col[1] * 255) + ',' + 
            Math.round(col[2] * 255);
        table_html1 += table_row1.replace('$col', col_str);
    }
    table_html1 += '</table>';
    // ---------------------------------------------------------------------------------------------
    // table with labels
    let table_html2 = '<table cellspacing="0">'
    const table_col2 = `<td style="width:${label_col_width}px;padding:0px;font-size:8px;text-align:center;">$text</td>`
    for (let i = 0; i < labels.length; i++) {
        const label = labels[i]
        let table_col2_text = table_col2.replace('$text', '  ' + label);
        if (i === 0) {
            table_col2_text = table_col2_text.replace('text-align:center', 'text-align:start')
        } else if (i === (labels.length - 1)) {
            table_col2_text = table_col2_text.replace('text-align:center', 'text-align:end')
        }
        table_html2 += table_col2_text;
    }
    table_html2 += '</table>';
    // ---------------------------------------------------------------------------------------------
    // join and return
    return '<table><tr>' + table_html2 + '</tr><tr>' + table_html1 + '</tr></table>';
}

function legendStr(smallHUD: boolean, size: number| [number, number], labels: string[], col_scale: string[] = null) {
    if (smallHUD) {
        return legendHorizontal(size, labels, col_scale)
    }
    return legendVertical(size, labels, col_scale)
}

export function updateHUD({ id, sim_name, col_range, col_range_rev, col_scale, unit, extra_info, desc, footnote }: any): string {
    // hide wind rose HUD (hide for simulation that's not wind situations)
    if (id !== 'wind') {
        const hud_wind_elm = document.getElementById('hud_wind') as HTMLDivElement;
        if (hud_wind_elm && !hud_wind_elm.classList.contains('hidden')) {
            hud_wind_elm.classList.add('hidden')
        }
    }
    const smallHUD = window.innerHeight < 500 || window.innerWidth < 500
    let styles = defaultStyles
    if (smallHUD) { styles = mobileStyles }

    let hud_msg = `<div style="${styles.maindiv}">`
    hud_msg += `<h3 style="${styles.h3}">` + sim_name + '</h3>';
    hud_msg += `<div style='${styles.desc}'>${desc ? desc : ''}</div>`
    hud_msg += '</div>'
    // create a legend for the Heads Up Display
    const leg_labels: string[] = [];
    const col_range_diff = col_range[1] - col_range[0];
    for (let i = 0; i < styles.numLabels; i++) {
        const val = col_range[0] + (col_range_diff * (i / (styles.numLabels - 1)));
        const val_sf = sim.inl.sigFig(val, 2);
        leg_labels.push(val_sf + ' ' + unit);
    }
    let hud_leg;
    if (col_range_rev) {
        //@ts-ignore
        hud_leg = legendStr(smallHUD, styles.legendSize, leg_labels.toReversed(), col_scale.toReversed());
    } else {
        hud_leg = legendStr(smallHUD, styles.legendSize as any, leg_labels, col_scale);
    }
    let hud_footnote = ''
    if (footnote) {
        hud_footnote += `<div style='${styles.footnote}'>${footnote}</div>`
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
        hud_elm.innerHTML = hud_msg + hud_leg + hud_footnote
        if (extra_info) {
            hud_elm.innerHTML += `<div style='${styles.extraInfo}'>${extra_info}</div>`
        }
        return hud_elm.innerHTML
    }
    return ''
}

export function updateWindHUD(wind_stns: string[]) {
    const hud_wind_container_elm = document.getElementById('hud_wind') as HTMLDivElement;
    if (hud_wind_container_elm) {
        if (hud_wind_container_elm.classList.contains('hidden')) {
            hud_wind_container_elm.classList.remove('hidden')
        }
    }
    const hud_wind_elm = hud_wind_container_elm.children[0]
    while (hud_wind_elm.firstChild) {
        hud_wind_elm.removeChild(hud_wind_elm.firstChild);
    }
    for (const stnID of wind_stns) {
        const img = document.createElement("img");
        img.src = `/assets/windrose/${stnID}.png`;
        hud_wind_elm.appendChild(img);
    }
}
// export function updateWindHUDPos(stickToRight) {
//     const hud_wind_elm = document.getElementById('hud_wind') as HTMLDivElement;
//     if (hud_wind_elm) {
//         if (stickToRight) {
//             hud_wind_elm.style.right = '0.25rem';
//         } else {
//             hud_wind_elm.style.right = '3rem';
//         }
//     }
// }
