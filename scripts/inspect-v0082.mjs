const targets = await fetch('http://127.0.0.1:9232/json/list').then((response) => response.json())
const page = targets.find((target) => target.type === 'page' && target.url.startsWith('http://127.0.0.1:5182/'))
if (!page) throw new Error('QA page not found')
const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
let id = 0
const pending = new Map()
socket.addEventListener('message', (event) => { const message = JSON.parse(event.data); if (!message.id || !pending.has(message.id)) return; const callback = pending.get(message.id); pending.delete(message.id); message.error ? callback.reject(new Error(message.error.message)) : callback.resolve(message.result) })
const send = (method, params = {}) => new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })) })
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value
const snapshot = await evaluate(`(() => ({
  title: document.title,
  body: document.body.innerText.slice(0, 12000),
  view: document.querySelector('.app')?.className || '',
  input: document.querySelector('input[placeholder="What needs to get done?"]')?.value || '',
  addDisabled: [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Add task')?.disabled,
  tasks: JSON.parse(localStorage.getItem('sales-os-tasks-v1') || '[]'),
  keys: Object.keys(localStorage),
}))()`)
console.log(JSON.stringify(snapshot, null, 2))
socket.close()
