import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const endpoint = 'http://127.0.0.1:9232/json/list'
const appOrigin = 'http://127.0.0.1:5182/'
const outputDirectory = path.resolve('design/qa-v0082')

await mkdir(outputDirectory, { recursive: true })

const targets = await fetch(endpoint).then((response) => response.json())
const page = targets.find((target) => target.type === 'page' && target.url.startsWith(appOrigin))
if (!page?.webSocketDebuggerUrl) throw new Error('Sales OS Chrome target was not found.')

const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

let commandId = 0
const pending = new Map()
const browserMessages = []

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (message.id && pending.has(message.id)) {
    const { resolve, reject, method, params } = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) reject(new Error(`${method}: ${message.error.message}${params?.expression ? ` | ${params.expression.slice(0, 180)}` : ''}`))
    else resolve(message.result)
    return
  }
  if (message.method === 'Runtime.exceptionThrown') {
    browserMessages.push(`exception: ${message.params?.exceptionDetails?.text || 'unknown exception'}`)
  }
  if (message.method === 'Runtime.consoleAPICalled') {
    const type = message.params?.type || 'log'
    if (type === 'error' || type === 'warning') {
      const body = (message.params?.args || []).map((item) => item.value ?? item.description ?? '').join(' ')
      browserMessages.push(`${type}: ${body}`)
    }
  }
  if (message.method === 'Log.entryAdded') {
    const entry = message.params?.entry
    if (entry?.level === 'error' || entry?.level === 'warning') browserMessages.push(`${entry.level}: ${entry.text}`)
  }
})

function send(method, params = {}) {
  const id = ++commandId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, method, params })
    socket.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Browser evaluation failed.')
  return result.result?.value
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function waitFor(expression, description, timeout = 10000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return
    await delay(120)
  }
  throw new Error(`Timed out waiting for ${description}.`)
}

async function clickText(text, selector = 'button') {
  const clicked = await evaluate(`(() => {
    const text = ${JSON.stringify(text)};
    const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})];
    const node = nodes.find((item) => item.textContent.trim() === text) || nodes.find((item) => item.textContent.includes(text));
    if (!node || node.disabled) return false;
    node.click();
    return true;
  })()`)
  if (!clicked) throw new Error(`Could not click ${selector} containing “${text}”.`)
  await delay(180)
}

async function clickSelector(selector) {
  const clicked = await evaluate(`(() => { const node = document.querySelector(${JSON.stringify(selector)}); if (!node || node.disabled) return false; node.click(); return true; })()`)
  if (!clicked) throw new Error(`Could not click ${selector}.`)
  await delay(180)
}

async function setInput(selector, value, index = 0) {
  const changed = await evaluate(`(() => {
    const node = [...document.querySelectorAll(${JSON.stringify(selector)})][${index}];
    if (!node) return false;
    const prototype = node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : node instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter) setter.call(node, ${JSON.stringify(value)}); else node.value = ${JSON.stringify(value)};
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`)
  if (!changed) throw new Error(`Could not set ${selector} at index ${index}.`)
  await delay(100)
}

async function screenshot(name, fullPage = true) {
  const dimensions = await evaluate(`({ width: Math.max(document.documentElement.scrollWidth, window.innerWidth), height: Math.max(document.documentElement.scrollHeight, window.innerHeight) })`)
  const params = { format: 'png', fromSurface: true, captureBeyondViewport: fullPage }
  if (fullPage) params.clip = { x: 0, y: 0, width: Math.min(dimensions.width, 1800), height: Math.min(dimensions.height, 12000), scale: 1 }
  const result = await send('Page.captureScreenshot', params)
  await writeFile(path.join(outputDirectory, `${name}.png`), Buffer.from(result.data, 'base64'))
}

await send('Page.enable')
await send('Runtime.enable')
await send('Log.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })

await send('Page.navigate', { url: appOrigin })
await waitFor(`document.title.includes('Sales OS')`, 'Sales OS page load')
await evaluate(`localStorage.clear(); sessionStorage.clear(); location.reload()`)
await waitFor(`document.body?.innerText.includes('Set up your private field cockpit.')`, 'onboarding welcome')
await screenshot('01-onboarding-welcome', false)

await clickText('Continue')
await waitFor(`document.body?.innerText.includes('Make the mission yours.')`, 'operator setup')
await clickText('Continue')
await waitFor(`document.body?.innerText.includes('Lock this device between sessions.')`, 'privacy setup')
await setInput('input[placeholder="4-8 digits"]', '2468')
await setInput('input[placeholder="Repeat PIN"]', '2468')
await screenshot('02-onboarding-privacy', false)
await clickText('Continue')
await waitFor(`document.body?.innerText.includes('Configure discovery once')`, 'Lead Finder setup')
await clickText('Continue')
await waitFor(`document.body?.innerText.includes('Start solo or prepare')`, 'team setup')
await clickText('Continue')
await waitFor(`document.body?.innerText.includes('Your first mission is ready')`, 'onboarding summary')
await clickText('Launch workspace')
await waitFor(`!document.querySelector('.onboarding-modal') && Boolean(document.querySelector('.app'))`, 'workspace launch', 15000)

await clickSelector('[aria-label="Choose visual theme"]')
await waitFor(`document.body?.innerText.includes('Aurora Glass Ops')`, 'theme palette')
await screenshot('03-theme-palette', false)
await evaluate(`(() => { const node = [...document.querySelectorAll('.theme-swatch')].find((item) => item.getAttribute('aria-label')?.startsWith('Aurora Glass Ops')); if (!node) return false; node.click(); return true; })()`)
await delay(400)
await screenshot('04-aurora-dashboard', false)

await clickSelector('[aria-label="Lead finder"]')
await waitFor(`document.body?.innerText.includes('Lead Finder campaigns')`, 'Lead Finder')
await setInput('input[placeholder^="Custom target"]', 'precast concrete supplier')
await clickText('Add term')
await waitFor(`document.body?.innerText.includes('precast concrete supplier')`, 'saved custom Lead Finder term')
await screenshot('05-lead-finder-custom-target', false)
await clickSelector('[aria-label="Tasks"]')
await waitFor(`document.body?.innerText.includes('Tasks beyond the call queue')`, 'Tasks')
await clickSelector('[aria-label="Lead finder"]')
await waitFor(`document.body?.innerText.includes('precast concrete supplier')`, 'Lead Finder state after navigation')

await clickSelector('[aria-label="Tasks"]')
await setInput('input[placeholder="What needs to get done?"]', 'Prepare supplier comparison sheet')
await clickText('Add task')
await waitFor(`[...document.querySelectorAll('input[aria-label="Task title"]')].some((input) => input.value === 'Prepare supplier comparison sheet')`, 'new task')
await clickText('Complete +')
await waitFor(`JSON.parse(localStorage.getItem('sales-os-tasks-v1') || '[]').some((task) => task.xpAwardedAt)`, 'task XP receipt')
await clickText('Completed')
await waitFor(`document.body?.innerText.includes('XP earned')`, 'completed task XP receipt')
await screenshot('06-task-xp', false)

await clickSelector('[aria-label="Reports"]')
await waitFor(`document.body?.innerText.includes('Performance history') || document.body?.innerText.includes('Compare your')`, 'performance history')
await screenshot('07-performance-history', false)

await clickSelector('[aria-label="Team Hub"]')
await waitFor(`Boolean(document.querySelector('.team-workspace-v008'))`, 'Team Hub')
await screenshot('08-team-hub-solo', false)

await clickSelector('[aria-label="Open Sales OS settings"]')
await waitFor(`Boolean(document.querySelector('.settings-modal'))`, 'settings')
await clickText('Privacy')
await waitFor(`document.body?.innerText.includes('Startup device PIN')`, 'privacy settings')
await clickText('Lock now')
await waitFor(`Boolean(document.querySelector('.device-lock-screen')) || document.body?.innerText.includes('Unlock RJ')`, 'device lock')
await screenshot('08-device-lock', false)
await setInput('input[inputmode="numeric"]', '2468')
await clickText('Unlock')
await waitFor(`!document.querySelector('.device-lock-screen')`, 'device unlock')

await evaluate(`(() => {
  const leadsKey = Object.keys(localStorage).find((key) => key.includes('leads'));
  const dailyKey = Object.keys(localStorage).find((key) => key.includes('daily'));
  if (!leadsKey || !dailyKey) return { leadsKey, dailyKey };
  const leads = JSON.parse(localStorage.getItem(leadsKey) || '[]');
  const daily = JSON.parse(localStorage.getItem(dailyKey) || '{}');
  const lead = leads.find((item) => item.phone) || leads[0];
  if (!lead) return { leadsKey, dailyKey, noLead: true };
  daily.activeCall = { id: 'qa-call-v0082', leadId: lead.id, startedAt: new Date().toISOString(), result: '' };
  daily.roster = [lead.id];
  daily.rosterLocked = true;
  daily.date = new Date().toISOString().slice(0, 10);
  localStorage.setItem(dailyKey, JSON.stringify(daily));
  const selectedKey = Object.keys(localStorage).find((key) => key.includes('selected-lead'));
  if (selectedKey) localStorage.setItem(selectedKey, JSON.stringify(lead.id));
  location.reload();
  return { leadsKey, dailyKey, lead: lead.company };
})()`)
await delay(1200)
const callVisible = await evaluate(`Boolean(document.querySelector('.call-mode-backdrop'))`)
if (callVisible) await screenshot('09-aurora-call-mode', false)

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true, screenWidth: 390, screenHeight: 844 })
await delay(500)
await screenshot('10-mobile-current-view', false)

const state = await evaluate(`(() => ({
  theme: JSON.parse(localStorage.getItem('sales-os-theme-v4') || 'null'),
  campaign: JSON.parse(localStorage.getItem('sales-os-lead-finder-campaign-v1') || 'null'),
  tasks: JSON.parse(localStorage.getItem('sales-os-tasks-v1') || '[]'),
  history: JSON.parse(localStorage.getItem('sales-os-performance-history-v1') || '[]'),
  deviceLock: JSON.parse(localStorage.getItem('sales-os-device-lock-v1') || 'null'),
  callVisible: Boolean(document.querySelector('.call-mode-backdrop')),
  bodyClass: document.body.className,
  horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
}))()`)

const report = {
  timestamp: new Date().toISOString(),
  state: {
    theme: state.theme,
    customKeywords: state.campaign?.customKeywords,
    taskCount: state.tasks?.length,
    taskXpReceipts: state.tasks?.filter((task) => task.xpAwardedAt).length,
    historyCount: state.history?.length,
    deviceLockEnabled: state.deviceLock?.enabled,
    callVisible: state.callVisible,
    bodyClass: state.bodyClass,
    horizontalOverflow: state.horizontalOverflow,
  },
  browserMessages,
}

await writeFile(path.join(outputDirectory, 'qa-report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
socket.close()
