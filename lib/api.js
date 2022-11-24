'use strict';
const path = require('path');
const fs = require('fs');
const child_process = require('child_process');

const getSchema = async () => {
    const scriptPath = path.join(__dirname, 'schema')
    if (!fs.existsSync(scriptPath)) {
        // build go bin if it doesn't exist, but it definitely should
        child_process.execSync(`go build -o "lib/schema" pkg/main.go`, {
            cwd: path.join(__dirname, '../'),
            windowsHide: true,
            maxBuffer: process.env.ESBUILD_MAX_BUFFER || 16 * 1024 * 1024,
        })
    }
    
    let stdin = new Uint8Array();

    const f = child_process.execFileSync(path.join(__dirname, "schema"), {
        cwd: process.cwd(),
        windowsHide: true,
        input: stdin,
        maxBuffer: process.env.ESBUILD_MAX_BUFFER || 16 * 1024 * 1024,
    })

    console.log(f.toString())
}

module.exports = getSchema

getSchema()