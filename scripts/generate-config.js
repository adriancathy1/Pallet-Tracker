const fs = require('fs')
const path = require('path')

const outPath = path.join(__dirname, '..', 'config.js')
const url = process.env.SUPABASE_URL || ''
const key = process.env.SUPABASE_ANON_KEY || ''

const content = `window.supabaseConfig = ${JSON.stringify({ url, key })};\n`
fs.writeFileSync(outPath, content)
console.log('Wrote', outPath)
