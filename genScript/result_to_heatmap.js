const fs = require("fs");
const SIMFuncs = require("@design-automation/mobius-sim-funcs").SIMFuncs;
const { createCanvas } = require("canvas");
const proj4 = require('proj4');

const LONGLAT = [103.778329, 1.298759];

const resulting =   '+proj=tmerc +lat_0=1.2173604125554882 +lon_0=103.6031185124633 ' +
                    '+k=0.1 +x_0=0 +y_0=0 +ellps=WGS84 +units=m +vunits=m +no_defs '

const input_dir = 'src/assets/result'
const output_dir = 'src/assets/result_full'

const SIM_DATA = [
    {
        id: 'solar',
        sim_name: 'Solar Exposure',
        col_range: [0, 100],
        unit: '%'
    },
    {
        id: 'uhi',
        sim_name: 'Urban Heat Island',
        col_range: [2, 6],
        unit: 'deg'
    },
    {
        id: 'wind',
        sim_name: 'Wind permeability',
        col_range: [100, 0],
        unit: '%'
    },
]

function drawPixel(context, x, y, color) {
    context.fillStyle = color || '#000';
}

const minmax = [[-19500, -9000], [34000, 19500]]
const minmaxrange = [53500, 28500]
const minmaxrange1 = [5350, 2850]

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
const PROJ = _createProjection()
const longlat_min = PROJ.inverse(minmax[0])
const longlat_max = PROJ.inverse(minmax[1])

console.log(longlat_min)
console.log(longlat_max)

const projectionCoord = {
    "type": "FeatureCollection", "features": [
        {
            "type": "Feature",
            "id": 0,
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [longlat_min[0] , longlat_min[1]],
                    [longlat_max[0] + 500 , longlat_min[1]],
                    [longlat_max[0] + 500 , longlat_max[1] + 500],
                    [longlat_min[0] , longlat_max[1] + 500],
                    [longlat_min[0] , longlat_min[1]]
                ]]
            }
        }
    ]
}
fs.writeFileSync(output_dir + '/coord.geojson', JSON.stringify(projectionCoord));
for (const mode of SIM_DATA) {
    const outDir = output_dir
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir);
    }
    const files = fs.readdirSync(input_dir + '_' + mode.id);
    // const min_max_coords = [[0, 0],[0, 0]]
    // for (const file of files) {
    //     const coords = file.slice(5, -4).split('_').map(x => Number(x))
    //     if (min_max_coords[0][0] > coords[0]) {
    //         min_max_coords[0][0] = coords[0]
    //     }
    //     if (min_max_coords[0][1] > coords[1]) {
    //         min_max_coords[0][1] = coords[1]
    //     }
    //     if (min_max_coords[1][0] < coords[0]) {
    //         min_max_coords[1][0] = coords[0]
    //     }
    //     if (min_max_coords[1][1] < coords[1]) {
    //         min_max_coords[1][1] = coords[1]
    //     }
    // }
    // console.log(min_max_coords)

    // const minmaxcoord = [[0,0],[10000,10000]]
    // while (minmaxcoord[0][0] < minmaxrange[0]) {
    //     while (minmaxcoord[0][1] < minmaxrange[1]) {
    //         const canvas = createCanvas(10000, 10000);
    //         const context = canvas.getContext("2d");

    //         for (const file of files) {
    //             const fileCoords = file.slice(5, -4).split('_').map(x => Number(x))
    //             fileCoords[0] = fileCoords[0] - minmax[0][0]
    //             fileCoords[1] = fileCoords[1] - minmax[0][1]
    //             if (fileCoords[0] < minmaxcoord[0][0] || fileCoords[0] >= minmaxcoord[1][0] || 
    //                 fileCoords[1] < minmaxcoord[0][1] || fileCoords[1] >= minmaxcoord[1][1]) { continue; }
    //             const fileData = fs.readFileSync(input_dir + '_' + mode.id + '/' + file, {encoding:'utf8', flag:'r'});
    //             const sim = new SIMFuncs()
    //             sim.io.ImportData(fileData, 'sim');
    //             const pgons = sim.query.Get('pg', null)

    //             for (const pgon of pgons) {
    //                 const pgon_num = Number(pgon.split('pg')[1])
    //                 const x = pgon_num % 50 * 10 + fileCoords[0] - minmaxcoord[0][0]
    //                 const y = Math.floor(pgon_num / 50) * 10 + fileCoords[1] - minmaxcoord[0][1]
    //                 console.log(minmaxcoord[0], x, y)

    //                 const v = sim.query.Get('_v', pgon);
    //                 const color = '#' + sim.attrib.Get(v[0], 'rgb').map(x => {
    //                     const val = Math.round(x * 255)
    //                     if (val < 16) {
    //                         return '0' + val.toString(16);
    //                     }
    //                     return val.toString(16)
    //                 }).join('');

    //                 context.fillStyle = color
    //                 context.fillRect(x, y, 10, 10);
    //             }
    //             // break;
    //         }
    //         const buffer = canvas.toBuffer("image/png");
    //         fs.writeFileSync(outDir + '/result' + minmaxcoord[0].join('_') + '.png', buffer);

    //         minmaxcoord[0][1] += 10000
    //         minmaxcoord[1][1] += 10000
    //     }
    //     minmaxcoord[0][1] = 0
    //     minmaxcoord[1][1] = 10000
    //     minmaxcoord[0][0] += 10000
    //     minmaxcoord[1][0] += 10000

    // }

    const canvas = createCanvas(...minmaxrange1);
    const context = canvas.getContext("2d");

    for (const file of files) {
        const fileCoords = file.slice(5, -4).split('_').map(x => Number(x))
        fileCoords[0] = (fileCoords[0] - minmax[0][0]) / 10
        fileCoords[1] = (fileCoords[1] - minmax[0][1]) / 10
        // if (fileCoords[0] < minmaxcoord[0][0] || fileCoords[0] >= minmaxcoord[1][0] || 
        //     fileCoords[1] < minmaxcoord[0][1] || fileCoords[1] >= minmaxcoord[1][1]) { continue; }
        const fileData = fs.readFileSync(input_dir + '_' + mode.id + '/' + file, { encoding: 'utf8', flag: 'r' });
        const sim = new SIMFuncs()
        sim.io.ImportData(fileData, 'sim');
        const pgons = sim.query.Get('pg', null)
        console.log(file)
        for (const pgon of pgons) {
            const pgon_num = Number(pgon.split('pg')[1])
            const x = pgon_num % 50 + fileCoords[0]
            const y = Math.floor(pgon_num / 50) + fileCoords[1]
            // const y = minmaxrange1[1] - (Math.floor(pgon_num / 50) + fileCoords[1])

            const v = sim.query.Get('_v', pgon);
            const color = '#' + sim.attrib.Get(v[0], 'rgb').map(x => {
                const val = Math.round(x * 255)
                if (val < 16) {
                    return '0' + val.toString(16);
                }
                return val.toString(16)
            }).join('');

            context.fillStyle = color
            context.fillRect(x, y, 1, 1);
        }
    }
    const buffer = canvas.toBuffer("image/png", {
        compressionLevel: 9,
    });
    fs.writeFileSync(outDir + '/' + mode.id + '_png.png', buffer);
}
