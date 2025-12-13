/**
 * Test snapshot importu přes HTTP
 * Spustí se přímo v Node.js a pošle soubor na API endpoint
 * 
 * Použití: npx tsx scripts/test-snapshot-http.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import * as http from 'http'

async function testSnapshotHTTP() {
  const cliFile = process.argv[2]
  const preferredDefault = path.join(__dirname, '../public/import/vyuctovani2024.xlsx')
  const legacyDefault = path.join(__dirname, '../JSON/vyuctovani2024.xlsx')

  const filePath = cliFile
    ? path.resolve(process.cwd(), cliFile)
    : (fs.existsSync(preferredDefault) ? preferredDefault : legacyDefault)
  
  if (!fs.existsSync(filePath)) {
    console.error('❌ Soubor neexistuje:', filePath)
    process.exit(1)
  }
  
  console.log('📁 Soubor:', filePath)
  
  const fileBuffer = fs.readFileSync(filePath)
  console.log('📊 Velikost:', Math.round(fileBuffer.length / 1024), 'KB')
  
  // Vytvořit multipart form data ručně
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2)
  
  const parts: Buffer[] = []
  
  const filename = path.basename(filePath)

  // File part
  parts.push(Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`
  ))
  parts.push(fileBuffer)
  parts.push(Buffer.from('\r\n'))
  
  // Year part
  parts.push(Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="year"\r\n\r\n` +
    `2024\r\n`
  ))
  
  // End
  parts.push(Buffer.from(`--${boundary}--\r\n`))
  
  const body = Buffer.concat(parts)
  
  console.log('📤 Odesílám na http://localhost:3000/api/import/snapshot...')
  
  return new Promise<void>((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/import/snapshot',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      }
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        console.log('Status:', res.statusCode)
        console.log('')
        
        try {
          const result = JSON.parse(data)
          const verbose = process.env.VERBOSE_SNAPSHOT === '1'
          if (verbose) {
            console.log(JSON.stringify(result, null, 2))
          } else {
            console.log(JSON.stringify({
              success: result.success,
              year: result.year,
              building: result.building,
              summary: result.summary,
              warnings: Array.isArray(result.warnings) ? result.warnings.slice(0, 10) : result.warnings,
              errors: Array.isArray(result.errors) ? result.errors.slice(0, 10) : result.errors,
            }, null, 2))
          }
          
          if (result.success) {
            console.log('')
            console.log('✅ Import úspěšný!')
            console.log('   Budova:', result.building?.name, result.building?.created ? '(NOVÁ)' : '(existující)')
            console.log('   Rok:', result.year)
            console.log('   Jednotek:', result.summary?.unitsInExcel)
            console.log('   Výsledků:', result.summary?.billingResultsCreated)
            console.log('   Nákladů služeb:', result.summary?.serviceCostsCreated)
          } else {
            console.log('')
            console.log('❌ Import selhal:', result.error)
          }
          
          if (result.warnings?.length > 0) {
            console.log('')
            console.log('⚠️ Varování:', result.warnings.length)
            result.warnings.slice(0, 5).forEach((w: string) => console.log('  -', w))
          }
          
          if (result.errors?.length > 0) {
            console.log('')
            console.log('❌ Chyby:', result.errors.length)
            result.errors.slice(0, 5).forEach((e: string) => console.log('  -', e))
          }
        } catch {
          console.log('Raw response:', data.substring(0, 500))
        }
        
        resolve()
      })
    })
    
    req.on('error', (error) => {
      console.error('❌ Chyba:', error.message)
      reject(error)
    })
    
    req.write(body)
    req.end()
  })
}

testSnapshotHTTP()
