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
        sim_name: 'None',
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
        desc: '(estimated by Wind Velocity Ratio)',
        sim_name: 'Urban Wind Permeability',
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
        sim_name: 'Anthropogenic Heat Dispersion',
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
        sim_name: 'Air Pollutant',
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
        sim_name: 'Urban Heat Island Intensity',
        desc: '(estimated by Sky View Factor)',
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
        sim_name: 'Urban Heat Island Intensity',
        desc: '(estimated by Sky View Factor)',
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
        sim_name: 'Neighborhood Wind Permeability',
        desc: '(estimated by Wind Velocity Ratio)',
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
        sim_name: 'Neighborhood Wind Permeability',
        desc: '(estimated by Wind Velocity Ratio)',
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
        sim_name: 'Solar Exposure',
        type: 'js',
        maptype: 'tile',
        col_range: [0, 100],
        col_scale: ['green','yellow','red'],
        unit: '%',
        building_type: 'extruded',
        grid_size: 10,
    },
}
export const SIM_DATA = {
    whole_singapore: ['sky', 'uwind', 'ah', 'ap'],
    select_area: ['sky1', 'wind1', 'solar'],
    urban: ['uwind', 'ah', 'ap'],
    neighborhood: ['sky', 'wind', 'solar']
}

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

