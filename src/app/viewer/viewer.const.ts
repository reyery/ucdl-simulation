export const LONGLAT = [ 103.778329, 1.298759];
export const DEFAULT_LONGLAT = [103.854382, 1.295460];
// export const DEFAULT_LONGLAT = [4.818, 45.7354]
export const BUILDING_TILES_URL = 'http://172.16.164.199:8090/geoserver/sg_sim/wfs?'
export const RESULT_URL = 'assets/result_full/'
export const SIM_DATA = {
    none: {
        id: 'none',
        sim_name: 'None',
        col_range: [0, 100],
        unit: ''
    },
    solar: {
        id: 'solar',
        sim_name: 'Solar Exposure',
        col_range: [0, 100],
        unit: '%'
    },
    // sky: {
    //     id: 'sky',
    //     sim_name: 'Sky Exposure',
    //     col_range: [0, 100],
    //     unit: '%'
    // },
    uhi: {
        id: 'uhi',
        sim_name: 'Urban Heat Island',
        col_range: [2, 6],
        unit: 'deg'
    },
    wind: {
        id: 'wind',
        sim_name: 'Wind permeability',
        col_range: [100, 0],
        unit: '%'
    },
}
