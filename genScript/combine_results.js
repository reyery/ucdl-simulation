const SIMFuncs = require("@design-automation/mobius-sim-funcs").SIMFuncs;
const fs = require('fs');
const input_dir = 'src/assets/result'
const input_sims = [
    'solar',
    'sky',
    'uhi',
    'wind'
]

const output_dir = 'src/assets/result_all/'

async function run() {
    for (const simul of input_sims) {
        console.log('combining result of:', simul)
        const files = fs.readdirSync(input_dir + '_' + simul + '/');
        const sim = new SIMFuncs();
        for (const file of files) {
            const input_file = input_dir + '_' + simul + '/' + file;
            const fileData = fs.readFileSync(input_file, {encoding:'utf8', flag:'r'});
            sim.io.ImportData(fileData, 'sim');
        }
        sim.material.Glass('glass', 0.5)
        sim.material.Set(sim.query.Get('pg', null), 'glass')
        
        const solar_model = await sim.io.ExportData(null, 'sim');
        fs.writeFileSync(output_dir + simul +'_10.sim', solar_model)    
    }
}
run()
// =================================================================================================
