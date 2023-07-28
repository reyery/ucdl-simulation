import { SIMFuncs } from "@design-automation/mobius-sim-funcs"
import proj4 from 'proj4';
import { createCanvas } from 'canvas';
import Shape from '@doodle3d/clipper-js';
import { scale as chromaScale } from 'chroma-js';

const SVY21 = "+proj=tmerc +lat_0=1.36666666666667 +lon_0=103.833333333333 +k=1 +x_0=28001.642 +y_0=38744.572 +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs"

const LONGLAT = [103.778329, 1.298759];
const TILE_SIZE = 500;

const projWGS84 = _createProjection('WGS84')
export const projWGS84toSVY21 = proj4('WGS84', SVY21)

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
    
        sim.visualize.Gradient(allPgons, 'data', range, info.col_scale);

        console.log(info)
        if (info.id === 'uwind') {
            range[0] = range[1] > 0 ? (range[1] * 100 / 0.75) : 0;
            range[1] = 0
        }
        return [sim, projWGS84.inverse(extent2.bottom_left), range]
    }

    sim.visualize.Gradient(pgons, 'data', info.col_range, info.col_scale);
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
    const width = (extent2.top_right[0] - extent2.bottom_left[0]) / data.data[0].length
    const height = (extent2.top_right[1] - extent2.bottom_left[1]) / data.data.length

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
        coord[0] = coord[0] - extent2.bottom_left[0]
        coord[1] = coord[1] - extent2.bottom_left[1] + 2
        bound_coords.push(coord)
    }
    const bound_ps = sim.make.Position(bound_coords)
    const bound_pgon = sim.make.Polygon(bound_ps)
    const normal = sim.calc.Normal(bound_pgon, 1)
    if (normal[2] < 0) {
        sim.edit.Reverse(bound_pgon)
    }

    const canvas = createCanvas(data.data[0].length, data.data.length);
    const context = canvas.getContext("2d");

    let boundShape = new Shape([bound_coords.map(coord => {return {X: coord[0], Y: coord[1]}})])
    if (boundShape.totalArea() < 0) {
        boundShape = new Shape([bound_coords.map(coord => {return {X: coord[0], Y: coord[1]}}).reverse()])
    }
    console.log(boundShape)
    console.log(boundShape.totalArea())
    const values = []
    const cornerCheck = {}
    // const imgDataArr = []

    const colorScale = chromaScale(info.col_scale).domain(info.col_range);

    for (let i = 0; i < data.data.length; i++) {
        const r = data.data.length - 1 - i
        for (let j = 0; j < data.data[i].length; j++) {
            let check = false
            for (let x = 0; x < 2; x++) {
                for (let y = 0; y < 2; y++) {
                    const idx = (j + x) + '_' + (r + y)
                    if (cornerCheck[idx]) {
                        check = true
                        break
                    } else if (cornerCheck[idx] === false) {
                        continue
                    }
                    cornerCheck[idx] = boundShape.pointInShape({ X: width * (j + x), Y: height * (r + y) }, false, false)
                    if (cornerCheck[idx]) {
                        check = true
                        break
                    }
                }
                if (check) { break; }
            }
            if (check) {
                const v = 7.13 - (6.51 * data.data[i][j])
                values.push(v)
                context.fillStyle = colorScale(v).css();
                context.fillRect(j, i, 1, 1);
            }
        }
    }

    console.log('bound_coords', bound_coords)

    const UHII = Math.round(((values.reduce((partialSum, a) => partialSum + a, 0)) / values.length) * 10) / 10
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

export function raster_to_sim_ap(bounds, data, info) {
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

    console.log('data.data', data.data)

    const width = (extent2.top_right[0] - extent2.bottom_left[0]) / data.data[0][0].length
    const height = (extent2.top_right[1] - extent2.bottom_left[1]) / data.data[0].length
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
    for (let layerI in data.data) {
        const dataList = data.data[layerI]
        for (let row = 0; row < dataList.length; row++) {
            const disp_row = dataList.length - 1 - row
            for (let col = 0; col < dataList[row].length; col ++) {
                if (dataList[row][col] === data.nodata) { continue; }
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
                    sim.modify.Move(bool, [0, 0, layerI * info.otherInfo.height])
                    keepPgons.splice(0,0, bool)
                    sim.attrib.Set(bool, 'data', dataList[row][col])
                }
            }
        }
    
    }
    sim.edit.Delete(keepPgons, 'keep_selected')
    const pgons = sim.query.Get('pg', null)

    for (const pg of pgons) {
        const pgAttrib = sim.attrib.Get(pg, 'data')
        const newPgons = sim.make.Extrude(pg, info.otherInfo.height, 1, 'quads')
        sim.attrib.Set(newPgons, 'data', pgAttrib)
    }
    sim.edit.Delete(keepPgons, 'delete_selected')
    const allPgons = sim.query.Get('pg', null)

    sim.visualize.Gradient(allPgons, 'data', info.col_range1, info.col_scale);
    return [sim, projWGS84.inverse(extent2.bottom_left), info.col_range]
}


export function eval_to_sim(bounds, data, info) {
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

    let boundShape = new Shape([bound_coords.map(coord => {return {X: coord[0], Y: coord[1]}})])
    if (boundShape.totalArea() < 0) {
        boundShape = new Shape([bound_coords.map(coord => {return {X: coord[0], Y: coord[1]}}).reverse()])
    }
    console.log(boundShape)
    console.log(boundShape.totalArea())
    const values = []
    const cornerCheck = {}
    // const imgDataArr = []

    const colorScale = chromaScale(info.col_scale).domain(info.col_range);
    function pyColor(properties) {
        const val = properties.value
        //@ts-ignore
        const colors = colorScale(val).num();
        console.log(colors)
        return new THREE.Color(colors);
    }

    for (let i = 0; i < data.data.length; i++) {
        const r = data.data.length - 1 - i
        for (let j = 0; j < data.data[i].length; j++) {
            let check = false
            for (let x = 0; x < 2; x++) {
                for (let y = 0; y < 2; y++) {
                    const idx = (j + x) + '_' + (r + y)
                    if (cornerCheck[idx]) {
                        check = true
                        break
                    } else if (cornerCheck[idx] === false) {
                        continue
                    }
                    cornerCheck[idx] = boundShape.pointInShape({ X: width * (j + x), Y: height * (r + y) }, false, false)
                    if (cornerCheck[idx]) {
                        check = true
                        break
                    }
                }
                if (check) { break; }
            }
            if (check) {
                const v = data.data[i][j]
                values.push(v)
                context.fillStyle = colorScale(v).css();
                context.fillRect(j * 2 - 0.5, i * 2 - 0.5, 2, 2);
            }
        }
    }

    console.log('bound_coords', bound_coords)

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

export function ap_to_sim(data, info) {
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

    const width = (extent2.top_right[0] - extent2.bottom_left[0]) / data.data[0][0].length
    const height = (extent2.top_right[1] - extent2.bottom_left[1]) / data.data[0].length
    const sim = new SIMFuncs()

    const keepPgons = []
    for (const i in data.data) {
        const layerData = data.data[i]
        const layerAltitude = i * info.otherInfo.height
        for (let row = 0; row < layerData.length; row++) {
            const disp_row = layerData.length - 1 - row
            for (let col = 0; col < layerData[row].length; col ++) {
                if (layerData[row][col] === data.nodata) { continue; }
                const pos = [
                    [width * col,       height * disp_row,       layerAltitude],
                    [width * (col + 1), height * disp_row,       layerAltitude],
                    [width * (col + 1), height * (disp_row + 1), layerAltitude],
                    [width * col,       height * (disp_row + 1), layerAltitude]
                ]
                const ps = sim.make.Position(pos)
                const pg = sim.make.Polygon(ps)
                keepPgons.push(pg)
                sim.attrib.Set(pg, 'data', layerData[row][col])
            }
        }    
    }

    sim.edit.Delete(keepPgons, 'keep_selected')
    const pgons = sim.query.Get('pg', null)

    for (const pg of pgons) {
        const pgAttrib = sim.attrib.Get(pg, 'data')
        const newPgons = sim.make.Extrude(pg, info.otherInfo.height, 1, 'quads')
        sim.attrib.Set(newPgons, 'data', pgAttrib)
    }

    sim.edit.Delete(keepPgons, 'delete_selected')
    const allPgons = sim.query.Get('pg', null)

    sim.visualize.Gradient(allPgons, 'data', info.col_range1, info.col_scale);
    return [sim, projWGS84.inverse(extent2.bottom_left), info.col_range1]
}

