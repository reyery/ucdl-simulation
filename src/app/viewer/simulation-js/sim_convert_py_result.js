import { SIMFuncs } from "@design-automation/mobius-sim-funcs"
import * as shared from "./sim_shared.js"
import {execute as generate} from "./sim_generate.js"
import { sg_wind } from "./sg_wind_all.js"
import { sg_wind_stn_data } from "./sg_wind_station_data.js"
import proj4 from 'proj4';
import * as shapefile from 'shapefile';
import { createCanvas, createImageData } from 'canvas';

const LONGLAT = [103.778329, 1.298759];
const TILE_SIZE = 500;

const projWGS84 = _createProjection('WGS84')

function _createProjection(proj_from_str) {
    // create the function for transformation
    const proj_str_a = '+proj=tmerc +lat_0=';
    const proj_str_b = ' +lon_0=';
    const proj_str_c = '+k=1 +x_0=0 +y_0=0 +ellps=WGS84 +units=m +no_defs';
    let longitude = LONGLAT[0];
    let latitude = LONGLAT[1];
    // const proj_from_str = 'WGS84';
    const proj_to_str = proj_str_a + latitude + proj_str_b + longitude + proj_str_c;
    const proj_obj = proj4(proj_from_str, proj_to_str);
    return proj_obj;
}

export function raster_to_sim(bounds, data, info) {
    const projObj = _createProjection(data.proj)
    
    const extentSplit = data.extent.split(' ')
    const extent = {
        left: Number(extentSplit[0]),
        right: Number(extentSplit[2]),
        top: Number(extentSplit[3]),
        bottom: Number(extentSplit[1]),
    }
    const extent2 = {
        bottom_left: projObj.forward([extent.left, extent.bottom]),
        top_right: projObj.forward([extent.right, extent.top]),
    }

    const width = (extent2.top_right[0] - extent2.bottom_left[0]) / data.data[0].length
    const height = (extent2.top_right[1] - extent2.bottom_left[1]) / data.data.length
    const sim = new SIMFuncs()

    const bound_coords = []
    for (const latlong of bounds) {
        const coord = [ ...projWGS84.forward(latlong), 0]
        coord[0] -= extent2.bottom_left[0]
        coord[1] -= extent2.bottom_left[1]
        bound_coords.push(coord)
    }
    // console.log(JSON.stringify(bound_coords, null, 2))
    const bound_ps = sim.make.Position(bound_coords)
    const bound_pgon = sim.make.Polygon(bound_ps)
    const normal = sim.calc.Normal(bound_pgon, 1)
    if (normal[2] < 0) {
        sim.edit.Reverse(bound_pgon)
    }

    const keepPgons = []
    for (let row = 0; row < data.data.length; row++) {
        const disp_row = data.data.length - 1 - row
        for (let col = 0; col < data.data[row].length; col ++) {
            if (data.data[row][col] === data.nodata) { continue; }
            const pos = [
                [width * col,       height * disp_row,       0],
                [width * (col + 1), height * disp_row,       0],
                [width * (col + 1), height * (disp_row + 1), 0],
                [width * col,       height * (disp_row + 1), 0]
            ]
            const ps = sim.make.Position(pos)
            const pg = sim.make.Polygon(ps)
            const bool = sim.poly2d.Boolean(bound_pgon, pg, 'intersect')
            if (bool.length > 0) {
                keepPgons.splice(0,0, bool)
                sim.attrib.Set(bool, 'data', data.data[row][col])
            }
        }
    }
    const range = [info.col_range[0], info.col_range[0]]
    sim.edit.Delete(keepPgons, 'keep_selected')
    const pgons = sim.query.Get('pg', null)

    if (info.maptype === 'shp') {
        for (const pg of pgons) {
            const pgAttrib = sim.attrib.Get(pg, 'data')
            range[1] = Math.max(pgAttrib, range[1])
            const extrudeH = pgAttrib * 1000 / info.col_range[1]
            const newPgons = sim.make.Extrude(pg, extrudeH, 1, 'quads')
            sim.attrib.Set(newPgons, 'data', pgAttrib)
        }
        sim.edit.Delete(keepPgons, 'delete_selected')
        const allPgons = sim.query.Get('pg', null)
    
        sim.visualize.Gradient(allPgons, 'data', range, ['green','yellow','red']);
        return [sim, projWGS84.inverse(extent2.bottom_left), range]
    }

    sim.visualize.Gradient(pgons, 'data', info.col_range, ['white','#EB6E00']);
    const values = sim.attrib.Get(pgons, 'data')
    const UHII = Math.round((-6.51 * (values.reduce((partialSum, a) => partialSum + a, 0)) / values.length + 7.13) * 10) / 10
    const extra_info = `<div>Air temp increment (UHI): ${UHII}°C</div>`
    sim.attrib.Set(null, 'extra_info', extra_info)
    console.log(UHII, extra_info)
    return [sim, projWGS84.inverse(extent2.bottom_left), info.col_range]
}

export function raster_to_sim_sky(bounds, data, info) {
    const projObj = _createProjection(data.proj)
    
    const extentSplit = data.extent.split(' ')
    const extent = {
        left: Number(extentSplit[0]),
        right: Number(extentSplit[2]),
        top: Number(extentSplit[3]),
        bottom: Number(extentSplit[1]),
    }
    const extent2 = {
        bottom_left: projObj.forward([extent.left, extent.bottom]),
        top_right: projObj.forward([extent.right, extent.top]),
    }
    console.log('data.extent', data.extent)

    const sim = new SIMFuncs()

    // const bound_coords = [
    //     [0, 0, 0],
    //     [extent2.top_right[0] - extent2.bottom_left[0], 0, 0],
    //     [extent2.top_right[0] - extent2.bottom_left[0], extent2.top_right[1] - extent2.bottom_left[1], 0],
    //     [0, extent2.top_right[1] - extent2.bottom_left[1], 0]
    // ]
    // console.log(bound_coords)
    const bound_coords = []
    for (const latlong of bounds) {
        const coord = [ ...projWGS84.forward(latlong), 0]
        coord[0] -= extent2.bottom_left[0]
        coord[1] -= extent2.bottom_left[1]
        bound_coords.push(coord)
    }
    const bound_ps = sim.make.Position(bound_coords)
    const bound_pgon = sim.make.Polygon(bound_ps)
    const normal = sim.calc.Normal(bound_pgon, 1)
    if (normal[2] < 0) {
        sim.edit.Reverse(bound_pgon)
    }

    const canvas = createCanvas(data.data[0].length * 2, data.data.length * 2);
    const context = canvas.getContext("2d");

    const values = []
    // const imgDataArr = []
    for (let i = 0; i < data.data.length; i++) {
        for (let j = 0; j < data.data[i].length; j++) {
            const v = data.data[i][j]
            values.push(v)
            // ['white','#EB6E00']
            const colorVal = [v * 20 + 235, v * 145 + 110, v * 255]
            // const colorVal = [v * 255, v * 200 + 55, v * 165 + 90]
            // const colorVal = [v * 255, v * 255, v * 255]
            // console.log(v, colorVal)
            const color = 'rgba(' + colorVal.join(',') + ',255)';
            context.fillStyle = color
            context.fillRect(j * 2 - 0.5, i * 2 - 0.5, 2, 2);
        }
    }

    const UHII = Math.round((-6.51 * (values.reduce((partialSum, a) => partialSum + a, 0)) / values.length + 7.13) * 10) / 10
    const extra_info = `<div>Air temp increment (UHI): ${UHII}°C</div>`
    sim.attrib.Set(null, 'extra_info', extra_info)


    // console.log(canvas,  canvas.createPNGStream)
    // const a = document.getElementById('test_canvas')
    // if (a.children.length > 0) {
    //     a.removeChild(a.firstElementChild);
    // }
    // a.appendChild(canvas)

    return [sim, projWGS84.inverse(extent2.bottom_left), info.col_range, canvas]
}