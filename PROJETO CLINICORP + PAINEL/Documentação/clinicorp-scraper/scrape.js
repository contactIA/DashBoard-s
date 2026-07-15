const { chromium } = require('playwright')
const fs = require('fs')

const LOGIN_URL = 'https://sistema.clinicorp.com/'
const USER = 'joaoescalar@ibsodonto1s'
const PASS = 'Joaohenrique123$'

const captured = []

function isApiCall(url) {
  return url.includes('api.clinicorp.com') && !url.includes('sentry') && !url.includes('google')
}

function isLoginUrl(url) {
  return url.includes('/auth/login') || url.includes('/login')
}

async function run() {
  const browser = await chromium.launch({ headless: false, slowMo: 100 })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  page.on('request', (req) => {
    if (isApiCall(req.url())) {
      captured.push({
        type: 'REQUEST',
        method: req.method(),
        url: req.url(),
        postData: req.postData() || null,
      })
    }
  })

  page.on('response', async (res) => {
    if (isApiCall(res.url())) {
      let body = null
      try {
        const ct = res.headers()['content-type'] || ''
        if (ct.includes('json')) body = await res.json().catch(() => null)
      } catch {}
      captured.push({
        type: 'RESPONSE',
        status: res.status(),
        url: res.url(),
        body,
      })
    }
  })

  // ── Login ──────────────────────────────────────────────────────
  console.log('🔐 Abrindo página de login...')
  await page.goto(LOGIN_URL, { waitUntil: 'networkidle' })

  // Wait for any input to appear (form rendered)
  console.log('⏳ Aguardando formulário de login renderizar...')
  try {
    await page.waitForSelector('input', { timeout: 20000 })
  } catch {
    console.log('⚠️ Timeout esperando formulário')
  }
  await page.waitForTimeout(2000)

  // Take screenshot to see what the login page looks like
  await page.screenshot({ path: 'login-page.png' })
  console.log('📸 Screenshot da página de login salvo')

  // Log all inputs found
  const allInputs = await page.$$eval('input', els => els.map(e => ({
    type: e.type, placeholder: e.placeholder, name: e.name, id: e.id
  })))
  console.log('📋 Inputs encontrados:', JSON.stringify(allInputs))

  // Fill username - try multiple selectors in order
  const userInputSelectors = [
    'input[placeholder*="usuário" i]',
    'input[placeholder*="user" i]',
    'input[name="username"]',
    'input[name="user"]',
    'input[type="text"]',
    'input[id*="user" i]',
  ]

  let filledUser = false
  for (const sel of userInputSelectors) {
    try {
      const el = await page.$(sel)
      if (el) {
        await el.fill(USER)
        console.log(`✅ Preencheu usuário em: ${sel}`)
        filledUser = true
        break
      }
    } catch {}
  }

  if (!filledUser) {
    console.log('⚠️ Tentando primeiro input encontrado...')
    const inputs = await page.$$('input:not([type="password"])')
    if (inputs.length > 0) {
      await inputs[0].fill(USER)
      console.log('✅ Preencheu usuário no primeiro input não-password')
      filledUser = true
    }
  }

  await page.fill('input[type="password"]', PASS)
  console.log('✅ Preencheu senha')

  await page.screenshot({ path: 'login-filled.png' })
  console.log('📸 Screenshot preenchido salvo')

  // Submit
  const submitSelectors = ['button[type="submit"]', 'button:has-text("Entrar")', 'button:has-text("Login")', 'input[type="submit"]']
  let clicked = false
  for (const sel of submitSelectors) {
    try {
      const el = await page.$(sel)
      if (el) {
        await page.click(sel)
        console.log(`✅ Clicou em: ${sel}`)
        clicked = true
        break
      }
    } catch {}
  }

  if (!clicked) {
    console.log('⚠️ Nenhum botão encontrado, tentando Enter...')
    await page.keyboard.press('Enter')
  }

  // Wait for navigation after login
  console.log('⏳ Aguardando login completar...')
  try {
    await page.waitForURL((url) => !isLoginUrl(url.href), { timeout: 15000 })
  } catch {
    console.log('⚠️ Timeout aguardando URL pós-login')
  }
  await page.waitForTimeout(5000)

  const postLoginUrl = page.url()
  console.log(`📍 URL após login: ${postLoginUrl}`)
  await page.screenshot({ path: 'post-login.png' })

  if (isLoginUrl(postLoginUrl)) {
    console.log('❌ Ainda na tela de login. Tentando verificar a estrutura da página...')
    const html = await page.content()
    fs.writeFileSync('login-html.html', html)
    console.log('📄 HTML da página salvo em login-html.html')
    await browser.close()
    return
  }

  console.log('✅ Login bem-sucedido!')

  // ── Navega para tela Financeiro ────────────────────────────────
  // Espera mais para o app carregar completamente
  await page.waitForTimeout(3000)

  // Try clicking menu item first (SPA navigation - better for session)
  console.log('🔍 Procurando menu Financeiro...')
  const menuSelectors = [
    'text=Financeiro',
    'a:has-text("Financeiro")',
    'li:has-text("Financeiro")',
    'span:has-text("Financeiro")',
    '[href*="financ"]',
    '[routerlink*="financ" i]',
  ]

  let found = false
  for (const sel of menuSelectors) {
    try {
      const el = await page.$(sel)
      if (el) {
        console.log(`✅ Encontrou menu: ${sel}`)
        await el.click()
        await page.waitForTimeout(4000)
        const newUrl = page.url()
        if (!isLoginUrl(newUrl) && newUrl !== postLoginUrl) {
          console.log(`✅ Navegou para: ${newUrl}`)
          found = true
          break
        }
      }
    } catch {}
  }

  if (!found) {
    // Try direct URL navigation
    const financialUrls = [
      'https://sistema.clinicorp.com/financeiro',
      'https://sistema.clinicorp.com/financial',
      'https://sistema.clinicorp.com/#financeiro',
      'https://sistema.clinicorp.com/#financial',
    ]

    for (const url of financialUrls) {
      try {
        console.log(`🔍 Tentando URL direta: ${url}`)
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 })
        await page.waitForTimeout(5000)
        const currentUrl = page.url()
        if (!isLoginUrl(currentUrl) && (currentUrl.includes('financ') || !currentUrl.includes('sistema.clinicorp.com/'))) {
          console.log(`✅ Financeiro acessado: ${currentUrl}`)
          found = true
          break
        }
        console.log(`  → Redirecionou para: ${currentUrl}`)
      } catch (e) {
        console.log(`  → Erro: ${e.message}`)
      }
    }
  }

  await page.screenshot({ path: 'financial-page.png', fullPage: true })
  console.log(`📍 URL final: ${page.url()}`)

  // ── Aguarda carregamento dos dados ────────────────────────────
  console.log('⏳ Aguardando chamadas de API financeira (15s)...')
  await page.waitForTimeout(15000)

  // Screenshot final
  await page.screenshot({ path: 'financial-loaded.png', fullPage: true })

  // ── Salva resultados ──────────────────────────────────────────
  const apiCalls = captured.filter(c => c.type === 'REQUEST')
  const apiResponses = captured.filter(c => c.type === 'RESPONSE')

  console.log(`\n📊 ${apiCalls.length} chamadas de API capturadas`)
  console.log('\n📋 Todas as chamadas à API Clinicorp:')
  apiCalls.forEach(r => console.log(`  [${r.method}] ${r.url}`))

  // Filtra responses financeiras/de pagamento
  const financialResponses = apiResponses.filter(r =>
    r.url.includes('financial') || r.url.includes('payment') || r.url.includes('cash') || r.url.includes('receivable')
  )
  console.log(`\n💰 ${financialResponses.length} responses financeiras/pagamento capturadas:`)
  financialResponses.forEach(r => {
    console.log(`\n  [${r.status}] ${r.url}`)
    if (r.body) console.log(`  Body (preview): ${JSON.stringify(r.body).slice(0, 500)}`)
  })

  fs.writeFileSync('captured-api.json', JSON.stringify({ apiCalls, financialResponses, allResponses: apiResponses }, null, 2))
  console.log('\n✅ Salvo em captured-api.json')

  await browser.close()
}

run().catch(err => {
  console.error('❌ Erro:', err.message)
  fs.writeFileSync('captured-api.json', JSON.stringify({ captured }, null, 2))
  process.exit(1)
})
