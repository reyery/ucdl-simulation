const SIMFuncs = require("@design-automation/mobius-sim-funcs").SIMFuncs;
const fs = require('fs');
const input_dir = 'src/assets/result'
const input_sims = [
    'solar',
    // 'sky',
    // 'uhi',
    // 'wind'
]

const output_dir = 'src/assets/result_all/'

async function run() {
    for (const simul of input_sims) {
        let count = 0;
        console.log('combining result of:', simul)
        const files = fs.readdirSync(input_dir + '_' + simul + '/');
        fs.writeFileSync(output_dir + simul +'.geojson', '{"type":"FeatureCollection","features":[')    
        let firstcheck = true;
        for (const file of files) {
            if (firstcheck) {
                firstcheck = false
            } else {
                fs.appendFileSync(output_dir + simul +'.geojson', ',')
            }
            const input_file = input_dir + '_' + simul + '/' + file;
            console.log(input_file)
            const fileData = fs.readFileSync(input_file, {encoding:'utf8', flag:'r'});
            const sim = new SIMFuncs();
            sim.io.ImportData(fileData, 'sim');
            sim.attrib.Delete('pg', 'type')
            const geojsonFile = await sim.io.ExportData(null, 'geojson')
            const parsedGeojson = JSON.parse(geojsonFile)
            const featureString = JSON.stringify(parsedGeojson.features).slice(1, -1)
            fs.appendFileSync(output_dir + simul +'.geojson', featureString)
            count += 1;
            if (count >= 20) {
                break
            }
        }
        fs.appendFileSync(output_dir + simul +'.geojson', ']}')
    }
}
run()
// =================================================================================================
