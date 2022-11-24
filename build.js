const mri = require('mri')
const { build } = require('esbuild')

const pkg = require('./package.json')

const prog = mri(process.argv.slice(2), {
    boolean: ['watch', 'minify'],
})

build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    outfile: 'dist/index.js',
    minify: prog.minify,
    watch: prog.watch,
    external: [
        ...Object.keys(pkg.dependencies),
        ...Object.keys(pkg.devDependencies),
    ],
}).then(() => console.log('App has built!'))
