import test from 'node:test'
import assert from 'node:assert/strict'
import {
  companyDifferentiator,
  defaultCompanyProfile,
  listToText,
  normalizeCompanyProfile,
  textToList,
} from '../src/config/companyProfile.js'

test('company profile defaults keep only verified HUAYU operating facts', () => {
  const profile = normalizeCompanyProfile()
  assert.equal(profile.companyName, 'HUAYU KJ Supply & Leasing Corp.')
  assert.equal(profile.fleetSize, 27)
  assert.deepEqual(profile.quarryLocations, ['Rodriguez, Rizal', 'Tarlac'])
  assert.equal(profile.quarryLocations.includes('Batangas'), false)
  assert.match(companyDifferentiator(profile), /owned quarry operations/i)
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

test('company profile lets another business explicitly clear HUAYU-specific facts', () => {
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
