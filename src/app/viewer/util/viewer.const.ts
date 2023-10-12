import proj4 from 'proj4';
import {register} from 'ol/proj/proj4.js';
import { environment } from 'src/environments/environment';

export const SHOW_BUILDINGS = true;
export const LONGLAT = [ 103.778329, 1.298759];
export const DEFAULT_LONGLAT = [103.854382, 1.295460];
// export const DEFAULT_LONGLAT = [4.818, 45.7354]
export const {BUILDING_TILES_URL, JS_SERVER, PY_SERVER } = environment
export const RESULT_URL = 'assets/result_full/'
export const MAX_AP_LAYERS = 25

export const ALL_SIMS = {
    none: {
        id: 'none',
        display_name: 'None',
        display_name_mobile: 'None',
        sim_name: 'None',
        footnote: null,
        type: 'js',
        maptype: 'tile',
        col_range: [0, 100],
        col_range_label: [0, 100],
        col_range_rev: false,
        col_scale: ['white','black'],
        unit: '',
        building_type: 'extruded'
    },
    uwind: {
        id: 'uwind',
        display_name: 'Urban Wind Permeability',
        display_name_mobile: 'U. Wind',
        desc: '(estimated by Wind Velocity Ratio)',
        sim_name: 'Urban Wind Permeability',
        footnote: null,
        type: 'py',
        maptype: 'shp',
        col_range: [0, 0.75],
        // col_range_label: [100, 0],
        // col_range_rev: true,
        col_range_label: [0.3, 0.3 - (0.75 / 3)],
        col_range_rev: true,
        col_scale: ['green','yellow','red'],
        unit: '',
        building_type: 'flat',
        grid_size: 200,
    },
    ah: {
        id: 'ah',
        display_name: 'Anthropogenic Heat Dispersion',
        display_name_mobile: 'Anthr. Heat',
        sim_name: 'Anthropogenic Heat Dispersion',
        footnote: null,
        type: 'py',
        maptype: 'shp',
        col_range: [0, 0.33],
        col_scale: ['green','yellow','red'],
        unit: '',
        building_type: 'flat',
        grid_size: 200,
    },
    ap: {
        id: 'ap',
        display_name: 'Air Pollutant',
        display_name_mobile: 'Air Pollutant',
        sim_name: 'Air Pollutant',
        footnote: null,
        type: 'py',
        maptype: 'special',
        col_range: [0, 1],
        col_range1: [0, 0.0375],
        col_scale: ['#003200','#dddd30','red'],
        unit: '',
        building_type: 'flat',
        grid_size: 200,
        otherInfo: {
            height: 100
        }
    },
    sky: {
        id: 'sky',
        display_name: 'Urban Heat Island Intensity',
        display_name_mobile: 'UHI',
        sim_name: 'Urban Heat Island Intensity',
        desc: '(estimated by Sky View Factor)',
        footnote: null,
        type: 'js',
        maptype: 'tile',
        col_range: [7, 0],
        col_range_label: [7, 0],
        col_range_rev: true,
        // col_range1: [7, 0.0375],
        col_scale: ['#EB6E00', 'white'],
        unit: '°C',
        building_type: 'extruded',
        grid_size: 10
    },
    sky1: {
        id: 'sky',
        display_name: 'Urban Heat Island Intensity',
        display_name_mobile: 'UHI',
        sim_name: 'Urban Heat Island Intensity',
        desc: '(estimated by Sky View Factor)',
        footnote: null,
        type: 'py',
        maptype: 'tile',
        col_range: [7, 0],
        col_range_label: [7, 0],
        col_range_rev: true,
        // col_range1: [7, 0.0375],
        col_scale: ['#EB6E00', 'white'],
        unit: '°C',
        building_type: 'extruded',
        grid_size: 10
    },
    wind: {
        id: 'wind',
        display_name: 'Neighborhood Wind Permeability',
        display_name_mobile: 'N. Wind',
        sim_name: 'Neighborhood Wind Permeability',
        desc: '(estimated by wind velocity ratio)',
        footnote: 'Wind velocity ratio: the ratio of wind speed at the pedestrian level to the wind speed at the reference height (300m)',
        type: 'js',
        maptype: 'tile',
        col_range: [0, 0.3],
        col_scale: ['red','yellow','green'],
        // col_range_rev: true,
        unit: '',
        building_type: 'extruded',
        grid_size: 10,
    },
    wind1: {
        id: 'wind',
        display_name: 'Neighborhood Wind Permeability',
        display_name_mobile: 'N. Wind',
        sim_name: 'Neighborhood Wind Permeability',
        desc: '(estimated by wind velocity ratio)',
        footnote: 'Wind velocity ratio: the ratio of wind speed at the pedestrian level to the wind speed at the reference height (300m)',
        type: 'py1',
        maptype: 'tile',
        col_range: [0, 0.3],
        col_scale: ['red','yellow','green'],
        // col_range_rev: true,
        unit: '',
        building_type: 'extruded',
        grid_size: 10,
    },
    solar: {
        id: 'solar',
        display_name: 'Solar Exposure',
        display_name_mobile: 'Solar Exp.',
        sim_name: 'Solar Exposure',
        footnote: null,
        type: 'js',
        maptype: 'tile',
        col_range: [0, 100],
        col_scale: ['green','yellow','red'],
        unit: '%',
        building_type: 'extruded',
        grid_size: 10,
    },
    solar1: {
        id: 'solar',
        display_name: 'Solar Exposure',
        display_name_mobile: 'Solar Exp.',
        sim_name: 'Solar Exposure',
        footnote: null,
        type: 'py1',
        maptype: 'tile',
        col_range: [0, 100],
        col_scale: ['green','yellow','red'],
        unit: '%',
        building_type: 'extruded',
        grid_size: 10,
    },
}
export const SIM_DATA = {
    whole_singapore: ['sky', 'uwind', 'ah'],
    select_area: ['sky1', 'wind1', 'solar1'],
    urban: ['uwind', 'ah', 'ap'],
    neighborhood: ['sky', 'wind', 'solar']
}

//@ts-ignore
window.mobileAndTabletCheck = function() {
    let check = false;
    //@ts-ignore
    (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
    return check;
};  
// //@ts-ignore
// if (window.mobileAndTabletCheck()) {
//     for (const i in ALL_SIMS) {
//         ALL_SIMS[i].display_name = ALL_SIMS[i].display_name_mobile
//     }
// }

export const GRID_SIZE_SELECTIONS = {
    'py': [
        {gridsize: 1, label: '1m x 1m', type: 'py'},
    ],
    'py1': [
        {gridsize: 10, label: '10m x 10m', type: 'py'},
        {gridsize: 5, label: '5m x 5m', type: 'py'},
        {gridsize: 2, label: '2m x 2m', type: 'py'},
        {gridsize: 1, label: '1m x 1m', type: 'py'},
    ],
    'js': [
        {gridsize: 10, label: '10m x 10m', type: 'js'},
        {gridsize: 5, label: '5m x 5m', type: 'js'},
        {gridsize: 2, label: '2m x 2m', type: 'js'},
        {gridsize: 1, label: '1m x 1m', type: 'js'},
    ],
    'js1': [
        {gridsize: 1, label: '1m x 1m', type: 'js'},
    ]
}




const SVY21_STRING = 'PROJCS["SVY21_Singapore_TM",GEOGCS["GCS_SVY21",DATUM["D_SVY21",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",28001.642],PARAMETER["False_Northing",38744.572],PARAMETER["Central_Meridian",103.8333333333333],PARAMETER["Scale_Factor",1.0],PARAMETER["Latitude_Of_Origin",1.366666666666667],UNIT["Meter",1.0]]'
proj4.defs('SVY21', SVY21_STRING)
register(proj4);

function _createProjection(longlat = LONGLAT) {
    // create the function for transformation
    const proj_str_a = '+proj=tmerc +lat_0=';
    const proj_str_b = ' +lon_0=';
    const proj_str_c = '+k=1 +x_0=0 +y_0=0 +ellps=WGS84 +units=m +no_defs';
    const proj_from_str = 'WGS84';
    const proj_to_str = proj_str_a + longlat[1] + proj_str_b + longlat[0] + proj_str_c;
    const proj_obj = proj4(proj_from_str, proj_to_str);
    return proj_obj;
}
export const WGS84_SIM_PROJ = _createProjection()

