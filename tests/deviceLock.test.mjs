import test from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { createDeviceCredential, validDevicePin, verifyDevicePin } from '../src/lib/deviceLock.js'

if (!globalThis.crypto) globalThis.crypto = webcrypto
if (!globalThis.btoa) globalThis.btoa = (value) => Buffer.from(value, 'binary').toString('base64')
if (!globalThis.atob) globalThis.atob = (value) => Buffer.from(value, 'base64').toString('binary')

test('device PIN is stored as a salted credential and verifies locally', async () => {
  const credential = await createDeviceCredential('2468')
  assert.equal(credential.enabled, true)
  assert.equal('pin' in credential, false)
  assert.equal(await verifyDevicePin('2468', credential), true)
  assert.equal(await verifyDevicePin('1357', credential), false)
})

test('device PIN requires four to eight digits', () => {
  assert.equal(validDevicePin('1234'), true)
  assert.equal(validDevicePin('12345678'), true)
  assert.equal(validDevicePin('123'), false)
  assert.equal(validDevicePin('12ab'), false)
})
