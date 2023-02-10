import { SIMFuncs } from "@design-automation/mobius-sim-funcs";
const sim = new SIMFuncs()

export function updateHUD({sim_name, col_range, unit}: {sim_name:string, col_range: number[], unit: string}) {

    let hud_msg = '<div style="line-height:1.1;">'
    hud_msg += '<h3>' + sim_name + '</h3><br>';
    // if ('settings' in results) {
    //     hud_msg += results.settings + '<br>'
    // }
    // hud_msg += 'Desirable range: ' + 
    //         Math.round(des_range[0]) + ' to ' +  
    //         Math.round(des_range[1]) + ' ' + unit + ' <br>' +
    //     // 'Desirable area: ' + Math.round(des_area) + ' m2<br>' +
    //     '<b>Score: ' + Math.round(score * 10)/10 + ' %</b><br>';
    // if ('other' in results) {
    //     hud_msg += results.other + '<br>'
    // }
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