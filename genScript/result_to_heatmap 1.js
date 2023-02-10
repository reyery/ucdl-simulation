const fs = require("fs");
const SIMFuncs = require("@design-automation/mobius-sim-funcs").SIMFuncs;
const { createCanvas } = require("canvas");
const GeoTiff = require("geotiff");


const input_dir = 'src/assets/result'
const output_dir = 'src/assets/result_img'

const SIM_DATA = [
    {
        id: 'solar',
        sim_name: 'Solar Exposure',
        col_range: [0, 100],
        unit: '%'
    },
    // {
    //     id: 'uhi',
    //     sim_name: 'Urban Heat Island',
    //     col_range: [2, 6],
    //     unit: 'deg'
    // },
    // {
    //     id: 'wind',
    //     sim_name: 'Wind permeability',
    //     col_range: [100, 0],
    //     unit: '%'
    // },
]


const minmax = [ [ -19500, -9000 ], [ 34000, 19500 ] ]
const minmaxrange1 = [ 5350, 2850 ]


for (const mode of SIM_DATA) {
    const outDir = output_dir + '_' + mode.id
    if (!fs.existsSync(outDir)){
        fs.mkdirSync(outDir);
    }
    const files = fs.readdirSync(input_dir + '_' + mode.id);
    
    const data = []
    for (let i = 0; i < minmaxrange1[0]; i++) {
        const sub = []
        for (let j = 0; j < minmaxrange1[1]; j++) {
            sub.push(0)
        }
        data.push(sub)
    }

    for (const file of files) {
        const fileCoords = file.slice(5, -4).split('_').map(x => Number(x))
        fileCoords[0] = (fileCoords[0] - minmax[0][0]) / 10
        fileCoords[1] = (fileCoords[1] - minmax[0][1]) / 10
        // if (fileCoords[0] < minmaxcoord[0][0] || fileCoords[0] >= minmaxcoord[1][0] || 
        //     fileCoords[1] < minmaxcoord[0][1] || fileCoords[1] >= minmaxcoord[1][1]) { continue; }
        const fileData = fs.readFileSync(input_dir + '_' + mode.id + '/' + file, {encoding:'utf8', flag:'r'});
        const sim = new SIMFuncs()
        sim.io.ImportData(fileData, 'sim');
        const pgons = sim.query.Get('pg', null)
        console.log(file)
        for (const pgon of pgons) {
            const pgon_num = Number(pgon.split('pg')[1])
            const x = pgon_num % 50 + fileCoords[0]
            const y = minmaxrange1[1] - (Math.floor(pgon_num / 50) + fileCoords[1])

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

    const canvas = createCanvas(...minmaxrange1);
    const context = canvas.getContext("2d");


    for (const file of files) {
        const fileCoords = file.slice(5, -4).split('_').map(x => Number(x))
        fileCoords[0] = (fileCoords[0] - minmax[0][0]) / 10
        fileCoords[1] = (fileCoords[1] - minmax[0][1]) / 10
        // if (fileCoords[0] < minmaxcoord[0][0] || fileCoords[0] >= minmaxcoord[1][0] || 
        //     fileCoords[1] < minmaxcoord[0][1] || fileCoords[1] >= minmaxcoord[1][1]) { continue; }
        const fileData = fs.readFileSync(input_dir + '_' + mode.id + '/' + file, {encoding:'utf8', flag:'r'});
        const sim = new SIMFuncs()
        sim.io.ImportData(fileData, 'sim');
        const pgons = sim.query.Get('pg', null)
        console.log(file)
        for (const pgon of pgons) {
            const pgon_num = Number(pgon.split('pg')[1])
            const x = pgon_num % 50 + fileCoords[0]
            const y = minmaxrange1[1] - (Math.floor(pgon_num / 50) + fileCoords[1])

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
    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(outDir + '/result.png', buffer);

    break;
}

