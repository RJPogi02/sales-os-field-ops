import test from 'node:test'
import assert from 'node:assert/strict'
import {
  companyDifferentiator,
  defaultCompanyProfile,
  listToText,
  normalizeCompanyProfile,
  textToList,
} from '../src/config/companyProfile.js'

test('company profile defaults are generic and safe for a new user', () => {
  const profile = normalizeCompanyProfile()
  assert.equal(profile.companyName, 'Your Company')
  assert.equal(profile.fleetSize, 0)
  assert.deepEqual(profile.quarryLocations, [])
  assert.deepEqual(profile.credentials, [])
  assert.doesNotMatch(companyDifferentiator(profile), /quarry|fleet/i)
})

test('company profile normalizes editable list and number fields', () => {
  const profile = normalizeCompanyProfile({
    ...defaultCompanyProfile,
    fleetSize: '42',
    materials: 'G1, 3/4\nS1',
    quarryLocations: ['Rizal', '', 'Tarlac'],
  })
  assert.equal(profile.fleetSize, 42)
  assert.deepEqual(profile.materials, ['G1', '3/4', 'S1'])
  assert.deepEqual(profile.quarryLocations, ['Rizal', 'Tarlac'])
  assert.equal(listToText(textToList('A, B\nC')), 'A, B, C')
})

test('company profile lets a business explicitly clear company facts', () => {
  const profile = normalizeCompanyProfile({
    ...defaultCompanyProfile,
    companyName: 'Example Services',
    ownedAssets: [], quarryLocations: [], fleetTypes: [], credentials: [], materials: [], fleetSize: 0,
  })
  assert.deepEqual(profile.ownedAssets, [])
  assert.deepEqual(profile.quarryLocations, [])
  assert.deepEqual(profile.materials, [])
  assert.equal(profile.fleetSize, 0)
  assert.doesNotMatch(companyDifferentiator(profile), /quarry|27-unit/i)
})
