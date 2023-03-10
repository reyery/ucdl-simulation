export const SHOW_BUILDINGS = true;
export const LONGLAT = [ 103.778329, 1.298759];
export const DEFAULT_LONGLAT = [103.854382, 1.295460];
// export const DEFAULT_LONGLAT = [4.818, 45.7354]
export const BUILDING_TILES_URL = 'http://172.16.164.199:8090/geoserver/sg_sim/wfs?'
export const RESULT_URL = 'assets/result_full/'
export const SIM_DATA = {
    none: {
        id: 'none',
        display_name: 'None',
        sim_name: 'None',
        type: 'js',
        maptype: 'tile',
        col_range: [0, 100],
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
        col_range: [1, 0],
        unit: '',
        building_type: 'extruded'
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
        unit: '',
        building_type: 'flat'
    },
    wind: {
        id: 'wind',
        display_name: 'Neighborhood Wind Permeability',
        sim_name: 'Neighborhood Wind Permeability',
        type: 'js',
        maptype: 'tile',
        col_range: [100, 0],
        unit: '%',
        building_type: 'extruded'
    },
    ah: {
        id: 'ah',
        display_name: 'Anthropogenic Heat Dispersion',
        sim_name: 'Anthropogenic Heat Dispersion',
        type: 'py',
        maptype: 'shp',
        col_range: [0, 0.3],
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
        unit: '%',
        building_type: 'extruded'
    },
}
// curl -X POST -H "application/json" -d '{"bounds":[[103.85144229891965,1.2959896056663212],[103.85348077777098,1.298478057686836],[103.85779376986693,1.295110066005023],[103.85571237567136,1.2918278787221453],[103.85144229891965,1.2959896056663212]]}' http://172.23.93.70:5000/uwind