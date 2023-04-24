import { SIMFuncs } from "@design-automation/mobius-sim-funcs"
import * as shared from "./sim_shared.js"
import {execute as generate} from "./sim_generate.js"
import { sg_wind } from "./sg_wind_all.js"
import { sg_wind_stn_data } from "./sg_wind_station_data.js"
import proj4 from 'proj4';
import * as shapefile from 'shapefile';

const solar_settings = {
    DETAIL: 1,
    RADIUS: 1000,
    FACADE_MAX_VAL: 0.6945730087671974,
}
const sky_settings = { 
    DETAIL: 0,
    RADIUS: 1000,
    FACADE_MAX_VAL: 0.5989617186548527
}
const uhi_settings = { 
    DETAIL: 0,
    RADIUS: 1000
}
const wind_settings = { 
    NUM_RAYS: 4,
    RADIUS: 200,
    LAYERS: [1, 18, 4]
}
const GRID_SIZE = 10

const config = {
    "latitude":1.298759,
    "longitude":103.778329,
    "g_solar_min":0,
    "g_solar_max":50,
    "g_sky_min":50,
    "g_sky_max":100,
    "g_uhi_min":0,
    "g_uhi_max":4,
    "g_wind_min":60,
    "g_wind_max":100,
    "g_irr_min":0,
    "g_irr_max":800,
    "g_irr_rad_min":0,
    "g_irr_rad_max":800,
    "f_solar_min":0,
    "f_solar_max":50,
    "f_sky_min":50,
    "f_sky_max":100,
    "f_irr_min":0,
    "f_irr_max":500,
    "f_irr_rad_min":0,
    "f_irr_rad_max":500,
    "f_noise_min":0,
    "f_noise_max":60,
    "f_unob_min":80,
    "f_unob_max":100,
    "f_visib_min":0,
    "f_visib_max":60,
}

const LONGLAT = [103.778329, 1.298759];
const TILE_SIZE = 500;


function _createProjection() {
    // create the function for transformation
    const proj_str_a = '+proj=tmerc +lat_0=';
    const proj_str_b = ' +lon_0=';
    const proj_str_c = '+k=1 +x_0=0 +y_0=0 +ellps=WGS84 +units=m +no_defs';
    let longitude = LONGLAT[0];
    let latitude = LONGLAT[1];
    const proj_from_str = 'WGS84';
    const proj_to_str = proj_str_a + latitude + proj_str_b + longitude + proj_str_c;
    const proj_obj = proj4(proj_from_str, proj_to_str);
    return proj_obj;
}
const proj_obj = _createProjection()

function fillString(x) {
    if (x < 0) {
        const s = x.toString()
        return '-' + ('00000' + s.slice(1)).slice(s.length - 1)
    }
    const s = x.toString()
    return ('00000' + s).slice(s.length)
}

function eval_solar(sim, model_data, sens_type = 'ground') {
    const settings = solar_settings
    // import model data
    shared.initModel(sim, model_data);
    // get sensors and obstructions
    const [sens_rays, obs_pgons, sens_pgons] = shared.getSensObs(sim, sens_type);
    // run simulation after sim
    const sim_name = 'Solar Exposure (' + sens_type + ')';
    shared.checkErrorBeforSim(sim_name, sens_rays, obs_pgons);
    const data = sim.analyze.Sun(sens_rays, obs_pgons, settings.RADIUS, settings.DETAIL,'direct_weighted');
    const max_val = sens_type === 'facade' ? settings.FACADE_MAX_VAL : 1;
    const values = data['exposure'].map(v => Math.min(Math.max(v / max_val, 0), 1) * 100);
    shared.checkErrorAfterSim(sim_name, sens_rays, values);
    // calc the score
    const des_range = [config[sens_type[0] +'_solar_min'], config[sens_type[0] +'_solar_max']];
    const [des_area, score] = shared.calcScore(sim, values, sens_pgons, des_range);
    // return results
    return {
        sim_name: sim_name,
        sens_type: sens_type, 
        values: values, 
        unit: '%',
        des_range: des_range,
        des_area: des_area, 
        score: score,
        settings: 'Max distance: ' + settings.RADIUS + ' m'
    };
}
function eval_sky(sim, model_data, sens_type = 'ground') {
    const settings = sky_settings
    // import model data
    shared.initModel(sim, model_data);
    // get sensors and obstructions
    const [sens_rays, obs_pgons, sens_pgons] = shared.getSensObs(sim, sens_type);
    // run simulation
    const sim_name = 'Sky Exposure (' + sens_type + ')';
    shared.checkErrorBeforSim(sim_name, sens_rays, obs_pgons);
    const data = sim.analyze.Sky(sens_rays, obs_pgons, settings.RADIUS, settings.DETAIL, 'weighted');
    const max_val = sens_type === 'facade' ? settings.FACADE_MAX_VAL : 1;
    const values = data['exposure'].map(v => Math.min(Math.max(v / max_val, 0), 1) * 100);
    shared.checkErrorAfterSim(sim_name, sens_rays, values);
    // calc the score
    const des_range = [config[sens_type[0] +'_sky_min'], config[sens_type[0] +'_sky_max']];
    const [des_area, score] = shared.calcScore(sim, values, sens_pgons, des_range);
    const UHII = Math.round((-6.51 * (values.reduce((partialSum, a) => partialSum + a, 0)) / (values.length * 100) + 7.13) * 10) / 10
    const extra_info = `<div>Spatially-arranged air temperature increment (UHI): ${UHII} (deg C)</div>`
    sim.attrib.Set(null, "extra_info", extra_info);
    // return results
    return {
        sim_name: sim_name,
        sens_type: sens_type, 
        values: values, 
        unit: '%',
        des_range: des_range,
        des_area: des_area, 
        score: score,
        settings: 'Max distance: ' + settings.RADIUS + ' m',
    };
}

function eval_uhi(sim, model_data, sens_type = 'ground') {
    const settings = uhi_settings
    // import model data
    shared.initModel(sim, model_data);
    // get sensors and obstructions
    const [sens_rays, obs_pgons, sens_pgons] = shared.getSensObs(sim, sens_type);
    // run simulation
    const sim_name = 'Urban Heat Island (' + sens_type + ')';
    shared.checkErrorBeforSim(sim_name, sens_rays, obs_pgons);
    const data = sim.analyze.Sky(sens_rays, obs_pgons, settings.RADIUS, settings.DETAIL, 'unweighted');
    const values = data['exposure'].map(v => (-6.51 * v) + 7.13); // UHI formula for Singapore developed by Dr Yuan Chao
    shared.checkErrorAfterSim(sim_name, sens_rays, values);
    // calc the score
    const des_range = [config[sens_type[0] +'_uhi_min'], config[sens_type[0] +'_uhi_max']];
    const [des_area, score] = shared.calcScore(sim, values, sens_pgons, des_range);
    // calc UHI
    const mean_uhi = shared.calcUHI(sim, values, sens_pgons);
    // return results
    return {
        sim_name: sim_name,
        sens_type: sens_type, 
        values: values, 
        unit: 'deg',
        des_range: des_range,
        des_area: des_area, 
        score: score,
        settings: 'Max distance: ' + settings.RADIUS + ' m',
        other: 'Mean UHI: ' + sim.inl.sigFig(mean_uhi, 2) + '°'
    };
}
function eval_wind(sim, model_data, weather_stn='S24') {
    const sens_type = 'ground';
    const settings = wind_settings
    // import model data
    shared.initModel(sim, model_data);
    // add data to model
    const sg_wind_data = sg_wind[weather_stn];
    sim.attrib.Set(null, 'wind', sg_wind_data, 'one_value');    
    // get sensors and obstructions
    const [sens_rays, obs_pgons, sens_pgons] = shared.getSensObs(sim, sens_type);
    const obs_pgons_no_wlkwy = sim.query.Filter(obs_pgons, 'type', '!=', 'walkway');
    // run simulation after sim
    const sim_name = 'Wind Permeability (' + sens_type + ')';
    shared.checkErrorBeforSim(sim_name, sens_rays, obs_pgons_no_wlkwy);
    const results = sim.analyze.Wind(sens_rays, obs_pgons_no_wlkwy, settings.RADIUS, settings.NUM_RAYS, settings.LAYERS);
    const values = results['wind'].map(v => Math.min(Math.max(v, 0), 1) * 100);
    shared.checkErrorAfterSim(sim_name, sens_rays, values);
    // calc the score
    const des_range = [config[sens_type[0] +'_wind_min'], config[sens_type[0] +'_wind_max']];
    const [des_area, score] = shared.calcScore(sim, values, sens_pgons, des_range);
    // return results
    return {
        sim_name: sim_name,
        sens_type: sens_type, 
        values: values, 
        unit: '%',
        des_range: des_range,
        des_area: des_area, 
        score: score,
        settings: 'Max distance: ' + settings.RADIUS + ' m'
    };  
}


async function readSource(bounds) {
    const source = await shapefile.open("assets/_shp_/singapore_buildings.shp")
    const jsonData = {
        "type": "FeatureCollection",
        "name": "sg_dwelling_simplified3",
        "crs": { "type": "name", "properties": { "name": "urn:ogc:def:crs:OGC:1.3:CRS84" } },
        "features": []
    }
    while (true) {
        const result = await source.read()
        if (!result || result.done) { break; }
        // if (!result.value.properties.AGL || result.value.properties.AGL < 1) {
        //     console.log(result.value)
        //     continue
        // }
        let c = result.value.geometry.coordinates[0][0]
        while (c.length > 2) {
            c = c[0]
        }
        const xy = proj_obj.forward(c);
        console.log('~~~~~~~~', xy)
        if (xy[0] < bounds[0][0] || xy[1] < bounds[0][1] || xy[0] > bounds[1][0] || xy[1] > bounds[1][1]) {
            continue
        }
        jsonData.features.push(result.value)
    }
    const jsonDataString = JSON.stringify(jsonData)

    const mfn = new SIMFuncs();
    await mfn.io.Import(jsonDataString, 'geojson');
    const allPgons = mfn.query.Get('pg', null)
    for (const pgon of allPgons){
        const dist = mfn.attrib.Get(pgon, 'AGL')
        if (!dist) {
            continue
        }
        mfn.make.Extrude( pgon, dist, 1, 'quads' );
    }
    return mfn
}
// Loop through all the files in the temp directory

export async function simExecute(latLongs, simInfo) {


    const minCoord = [99999, 99999];
    const maxCoord = [-99999, -99999];
    const coords = []
    for (const latlong of latLongs) {
        const coord = [ ...proj_obj.forward(latlong), 0]
        minCoord[0] = Math.min(coord[0], minCoord[0])
        minCoord[1] = Math.min(coord[1], minCoord[1])
        maxCoord[0] = Math.max(coord[0], maxCoord[0])
        maxCoord[1] = Math.max(coord[1], maxCoord[1])
        coords.push(coord)
    }
    console.log(minCoord, maxCoord)

    const mfn = new SIMFuncs();
    const promises = []
    for (let i = Math.floor(minCoord[0] / TILE_SIZE) - 1; i <= Math.floor(maxCoord[0] / TILE_SIZE) + 1; i++) {
        for (let j = Math.floor(minCoord[1] / TILE_SIZE) - 1; j <= Math.floor(maxCoord[1] / TILE_SIZE) + 1; j++) {
            promises.push(fetch('assets/models/data_' + 
            fillString(i * TILE_SIZE) + '_' + fillString(j * TILE_SIZE) + 
            '.sim').then(response => {
                if (response.ok) {
                    return response.text()
                }
                return null
            }).catch(() => null))
        }
    }

    await Promise.all(promises)
    for (const promise of promises) {
        const model = await promise
        if (model) {
            await mfn.io.Import(model, 'sim');
        }
    }
    const allObstructions = mfn.query.Get('pg', null)
    mfn.attrib.Set(allObstructions, 'cluster', 1)
    mfn.attrib.Set(allObstructions, 'type', 'obstruction')
    mfn.attrib.Set(allObstructions, 'obstruction', true)

    const pos = mfn.make.Position(coords)
    const pgon = mfn.make.Polygon(pos)
    mfn.attrib.Set(pgon, 'type', 'site')
    mfn.attrib.Set(pgon, 'cluster', 0)

    const gen = await generate(mfn, config)

    const sim = new SIMFuncs();

    console.log('starting simulation')
    if (simInfo.id === 'solar') {
        const result = eval_solar(sim, gen)
        shared.visSimResults(sim, result, 'solar_exposure', simInfo);    

    } else if (simInfo.id === 'sky') {
        const result = eval_sky(sim, gen)
        shared.visSimResults(sim, result, 'sky_exposure', simInfo);

    } else if (simInfo.id === 'uhi') {
        const result = eval_uhi(sim, gen)
        shared.visSimResults(sim, result, 'uhi', simInfo);

    } else if (simInfo.id === 'wind') {
        let closest_stn = {id: 'S24', dist2: null}
        for (const stn of sg_wind_stn_data) {
            const distx = stn.coord[0] - coords[0]
            const disty = stn.coord[1] - coords[1]
            const dist2 = distx * distx + disty * disty
            if (!closest_stn.dist2 || closest_stn.dist2 > dist2) {
                closest_stn.id = stn.id
                closest_stn.dist2 = dist2
            }
        }
        const result = eval_wind(sim, gen, closest_stn.id)

        shared.visSimResults(sim, result, 'wind_per', simInfo);

    } else {
        return null
    }
    const ground_pgons = sim.query.Filter(sim.query.Get('pg', null), 'type', '==', 'ground');
    sim.modify.Move(ground_pgons, [-coords[0][0], -coords[0][1], 0])
    sim.edit.Delete(ground_pgons, 'keep_selected')
    // const resultModel = await sim.io.ExportData(ground_pgons, 'sim');
    return sim
}

export async function simConvert(latLongs) {
    const coords = []
    for (const latlong of latLongs) {
        const coord = [ ...proj_obj.forward(latlong), 0]
        coords.push(coord)
    }
    const sim = new SIMFuncs();
    const ps = sim.make.Position(coords)
    const pg = sim.make.Polygon(ps)
    const normal = sim.calc.Normal(pg, 1)
    console.log('bounds positions', coords)
    if (normal[2] < 0) {
        sim.edit.Reverse(pg)
    }
    // sim.visualize.Color(pg, [1,0,1])
    // sim.modify.Move(pg, [-coords[0][0], -coords[0][1], 0])
    return sim
}

export async function visResult(latLongs, simulation, result, extraGeom = null) {

    const minCoord = [99999, 99999];
    const maxCoord = [-99999, -99999];
    const coords = []
    for (const latlong of latLongs) {
        const coord = [ ...proj_obj.forward(latlong), 0]
        minCoord[0] = Math.min(coord[0], minCoord[0])
        minCoord[1] = Math.min(coord[1], minCoord[1])
        maxCoord[0] = Math.max(coord[0], maxCoord[0])
        maxCoord[1] = Math.max(coord[1], maxCoord[1])
        coords.push(coord)
    }
    console.log(minCoord, maxCoord)
    console.log(coords)

    const sim = new SIMFuncs();

    const pos = sim.make.Position(coords)
    const pgon = sim.make.Polygon(pos)
    sim.attrib.Set(pgon, 'type', 'site')
    sim.attrib.Set(pgon, 'cluster', 0)

    const pgons = sim.query.Get('pg', null);
    processSite(sim, pgons)
    
    const sens_pgons = sim.query.Filter(sim.query.Get('pg', null), 'type', '==', 'ground');
    console.log('sens_pgons', sens_pgons, sens_pgons.length)
    console.log('result', result)
    // for (let i = 0; i < sens_pgons.length; i ++) {
    //     sim.attrib.Set(sens_pgons[i], 'data', result[i]);
    // }
    // create colors for polygons
    sim.attrib.Set(sens_pgons, 'data', result, 'many_values');
    sim.visualize.Gradient(sens_pgons, 'data', simulation.col_range, simulation.col_scale);

    let allPgons = sens_pgons
    if (extraGeom && extraGeom.length > 0) {
        for (const geom of extraGeom) {
            const ps = sim.make.Position(geom.coord)
            const pg = sim.make.Polygon(ps)
            const pgons = sim.make.Extrude(pg, geom.height, 1, 'quads')
            allPgons = allPgons.concat(pgons)
        }
    }

    sim.modify.Move(allPgons, [-coords[0][0], -coords[0][1], 0])
    sim.edit.Delete(allPgons, 'keep_selected')

    return sim
}

function processSite(sim, pgons) {
    // get the site polygon
    const site = sim.query.Filter(pgons, 'type', '==', 'site');
    const site_off = sim.poly2d.OffsetMitre(site, 0, 1, 'square_end');
    // get the bases of any obstructions, to be used to boolean holes in the grid
    // const obstructions = sim.query.Filter(pgons, 'type', '==', 'obstruction');
    // const obstruction_posis = sim.query.Get('ps', obstructions);
    // sim.attrib.Push(obstruction_posis, ['xyz', 2, 'z'], 'pg' );
    // const bases = sim.query.Filter(pgons, 'z', '==', 0);
    // const bases_off = sim.poly2d.OffsetMitre(bases, 0, 1, 'square_end');

    // create a grid that covers the whole site
    const [cen, _, __, size] = sim.calc.BBox(site);
    const num_edges = [Math.ceil(size[0]/GRID_SIZE), Math.ceil(size[1]/GRID_SIZE)];
    const grid_posis = sim.pattern.Grid([cen[0], cen[1], 0], 
        [num_edges[0] * GRID_SIZE, num_edges[1] * GRID_SIZE],
        [num_edges[0] + 1,         num_edges[1] + 1], 'quads');
    const grid_pgons0 = sim.make.Polygon(grid_posis);
    // intersect the grid with the site
    const grid_pgons1 = sim.poly2d.Boolean(grid_pgons0, site_off, 'intersect');
    // const grid_pgons2 = sim.poly2d.Boolean(grid_pgons1, bases_off, 'difference');
    const grid_pgons2 = grid_pgons1;

    // make sure that all resulting pgons are facing up
    for (const pgon of grid_pgons2) {
        const norm = sim.calc.Normal(pgon, 1);
        if (norm[2] < 0) { sim.edit.Reverse(pgon); }
    }
    // clean up
    sim.edit.Delete([grid_pgons0, site_off], 'delete_selected');
    // sim.edit.Delete([grid_pgons0, grid_pgons1, bases_off, site_off], 'delete_selected');
    // move the grid up by 1 m
    sim.modify.Move(grid_pgons2, [0,0,1]);
    // set attribs
    sim.attrib.Set(grid_pgons2, 'type', 'ground', 'one_value');
    // update colour
    sim.visualize.Color(site, sim.inl.colFromStr('lightgreen'));
}
