const SIMFuncs = require("@design-automation/mobius-sim-funcs").SIMFuncs;
const fs = require('fs');
const input_dir = 'src/assets/models/'
const input_sims = [
    'solar',
    'sky',
    'uhi',
    'wind'
]

const output_dir = 'src/assets/old/models_all.sim'

// async function run() {
//     const files = fs.readdirSync(input_dir);
//     const sim = new SIMFuncs();
//     for (const file of files) {
//         console.log('adding file',file)
//         const input_file = input_dir + file;
//         const fileData = fs.readFileSync(input_file, {encoding:'utf8', flag:'r'});
//         sim.io.ImportData(fileData, 'sim');
//     }
//     const model = await sim.io.ExportData(null, 'sim');
//     fs.writeFileSync(output_dir, model)    
// }
async function run() {
    const files = fs.readdirSync(input_dir);
    let x = 'export const model_files = [\n'
    for (const file of files) {
        x += '    "' + input_dir + file + '",\n'
    }
    x += '];'
    fs.writeFileSync('src/app/viewer/viewer.const.ts', x)    

}
run()
// =================================================================================================
