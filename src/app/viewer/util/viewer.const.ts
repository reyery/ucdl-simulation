import proj4 from 'proj4';
import {register} from 'ol/proj/proj4.js';

export const SHOW_BUILDINGS = true;
export const LONGLAT = [ 103.778329, 1.298759];
export const DEFAULT_LONGLAT = [103.854382, 1.295460];
// export const DEFAULT_LONGLAT = [4.818, 45.7354]
export const BUILDING_TILES_URL = 'http://172.16.164.199:8090/geoserver/sg_sim/wfs?'
export const JS_SERVER = 'http://172.16.164.199:5202/'
export const PY_SERVER = 'http://172.26.51.153:5000/'
export const RESULT_URL = 'assets/result_full/'
export const SIM_DATA = {
    none: {
        id: 'none',
        display_name: 'None',
        sim_name: 'None',
        type: 'js',
        maptype: 'tile',
        col_range: [0, 100],
        col_scale: ['white','black'],
        unit: '',
        building_type: 'extruded'
    },
    sky: {
        id: 'sky',
        display_name: 'Urban Heat Island Intensity',
        sim_name: 'Urban Heat Island Intensity',
        desc: '(measured by SVF)',
        type: 'py',
        maptype: 'tile',
        col_range: [0, 1],
        col_scale: ['#EB6E00', 'white'],
        unit: '',
        building_type: 'extruded',
        grid_size: 1
    },
    // uhi: {
    //     id: 'uhi',
    //     sim_name: 'Sky View Factor',
    //     type: 'js',
    //     maptype: 'tile',
    //     col_range: [1, 0],
    //     unit: '',
    //     building_type: 'extruded'
    // },
    uwind: {
        id: 'uwind',
        display_name: 'Urban Wind Permeability',
        desc: '(measured by FAD)',
        sim_name: 'Urban Wind Permeability',
        type: 'py',
        maptype: 'shp',
        col_range: [0, 0.75],
        col_scale: ['green','yellow','red'],
        unit: '',
        building_type: 'flat'
    },
    wind: {
        id: 'wind',
        display_name: 'Neighborhood Wind Permeability',
        sim_name: 'Neighborhood Wind Permeability',
        type: 'js',
        maptype: 'tile',
        col_range: [0, 100],
        col_scale: ['red','yellow','green'],
        unit: '%',
        building_type: 'extruded'
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
        building_type: 'flat'
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
        building_type: 'extruded'
    },
}

export const SIM_DATA_UPLOAD = {
    none: SIM_DATA.none,
    wind: SIM_DATA.wind,
    solar: SIM_DATA.solar,
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

