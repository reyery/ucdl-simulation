const RETRY_INTERVAL = 1000
const RETRY_ATTEMPTS = 5

export async function fetchData(url, init?) {
    let count = 0
    while (count < RETRY_ATTEMPTS) {
        if (init) {
            const response: Response = await fetch(url, init).catch(ex => {
                console.log('HTTP ERROR:',ex)
                return null
            });
            if (!response) { return null}
            try {
                const responseJSON = await response.json()
                console.log('response', responseJSON)
                return responseJSON    
            } catch (ex) {
                count+= 1
                console.log('error:', ex)
                console.log('error response:', response)
                await new Promise(resolve => { setTimeout(() => {resolve(null)}, RETRY_INTERVAL); })
            }
        } else {
            const response = await fetch(url).catch(ex => {
                console.log('HTTP ERROR:',ex)
                return null
            });
            if (!response) { return null}
            try {
                const responseJSON = await response.json()
                console.log('response', responseJSON)
                return responseJSON    
            } catch (ex) {
                count+= 1
                console.log('error:', ex)
                console.log('error response:', response)
                await new Promise(resolve => { setTimeout(() => {resolve(null)}, RETRY_INTERVAL); })
            }
        }
    }
    console.log('ERROR PERSISTS, EXITING')
    return null    
}