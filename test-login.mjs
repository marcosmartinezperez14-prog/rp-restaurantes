import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage()

await page.goto('http://localhost:3000/login')

// Rellenar credenciales
const inputs = await page.locator('input').all()
console.log('Inputs encontrados:', inputs.length)
for (const inp of inputs) {
  const type = await inp.getAttribute('type')
  const name = await inp.getAttribute('name')
  const placeholder = await inp.getAttribute('placeholder')
  console.log(' -', type, name, placeholder)
}

await browser.close()
