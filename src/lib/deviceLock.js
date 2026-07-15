const encoder = new TextEncoder()
const DEFAULT_ITERATIONS = 150000

const bytesToBase64 = (bytes) => {
  let value = ''
  bytes.forEach((byte) => { value += String.fromCharCode(byte) })
  return btoa(value)
}

const base64ToBytes = (value) => {
  const binary = atob(String(value || ''))
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

const cryptoApi = () => {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error('Secure PIN storage is unavailable in this browser. Open Sales OS through the one-click launcher or localhost.')
  }
  return globalThis.crypto
}

export const validDevicePin = (pin) => /^\d{4,8}$/.test(String(pin || ''))

async function derivePin(pin, salt, iterations = DEFAULT_ITERATIONS) {
  const api = cryptoApi()
  const key = await api.subtle.importKey('raw', encoder.encode(String(pin)), 'PBKDF2', false, ['deriveBits'])
  const bits = await api.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
  return new Uint8Array(bits)
}

export async function createDeviceCredential(pin) {
  if (!validDevicePin(pin)) throw new Error('Choose a 4-8 digit PIN.')
  const api = cryptoApi()
  const salt = api.getRandomValues(new Uint8Array(16))
  const digest = await derivePin(pin, salt)
  return {
    enabled: true,
    version: 1,
    algorithm: 'PBKDF2-SHA256',
    iterations: DEFAULT_ITERATIONS,
    salt: bytesToBase64(salt),
    digest: bytesToBase64(digest),
    configuredAt: new Date().toISOString(),
  }
}

export async function verifyDevicePin(pin, credential) {
  if (!credential?.enabled || !credential?.salt || !credential?.digest || !validDevicePin(pin)) return false
  const expected = base64ToBytes(credential.digest)
  const actual = await derivePin(pin, base64ToBytes(credential.salt), Number(credential.iterations || DEFAULT_ITERATIONS))
  if (expected.length !== actual.length) return false
  let difference = 0
  for (let index = 0; index < expected.length; index += 1) difference |= expected[index] ^ actual[index]
  return difference === 0
}

export const deviceUnlockSessionKey = 'sales-os-device-unlocked-v1'
