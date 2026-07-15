import test from 'node:test'
import assert from 'node:assert/strict'

import {
  csvToLeadRows,
  findLeadMatch,
  inferCrmColumnMapping,
  mapCrmImportRows,
  mergeCrmLeads,
  parseCsvRows,
  previewCrmMerge,
  tabularImportData,
} from '../src/lib/csv.js'
import { importIdentityKeys, importedLeadDraft } from '../src/lib/leadModel.js'

test('CSV parser and column inference preserve quoted values', () => {
  const matrix = parseCsvRows('\uFEFFBusiness Name,Mobile,E-mail,Area,Remarks\n"Acme, Inc.",09171234567,buyer@acme.test,North Luzon,"Needs 3/4, G1"')
  const data = tabularImportData(matrix)
  const mapping = inferCrmColumnMapping(data.headers)
  const mapped = mapCrmImportRows(data.headers, data.rows, mapping, { sourceName: 'leads.csv' })
  assert.equal(mapped.rows.length, 1)
  assert.equal(mapped.rows[0].company, 'Acme, Inc.')
  assert.equal(mapped.rows[0].phone, '09171234567')
  assert.equal(mapped.rows[0].email, 'buyer@acme.test')
  assert.equal(mapped.rows[0].region, 'NORTH')
  assert.equal(mapped.rows[0].notes, 'Needs 3/4, G1')
  assert.equal(mapped.rows[0].visibility, 'private')
})

test('missing required company is retained and routed to Research', () => {
  const data = tabularImportData([
    ['Phone', 'Email', 'Notes'],
    ['09991234567', 'unknown@example.test', 'Find the company name'],
  ])
  const mapping = inferCrmColumnMapping(data.headers)
  const mapped = mapCrmImportRows(data.headers, data.rows, mapping, { sourceName: 'research.xlsx', visibility: 'team' })
  assert.equal(mapped.rows.length, 1)
  assert.equal(mapped.missingRequired.length, 1)
  assert.match(mapped.rows[0].company, /Unidentified imported lead/)
  assert.equal(mapped.rows[0].researchStatus, 'Needs Research')
  assert.equal(mapped.rows[0].verificationStatus, 'Needs Research')
  assert.deepEqual(mapped.rows[0].importMissingFields, ['company'])
  assert.equal(mapped.rows[0].visibility, 'team')
})

test('preview separates existing matches from duplicates inside the file', () => {
  const existing = [{ id: 'existing', company: 'Acme', phone: '09171234567', email: '' }]
  const rows = [
    importedLeadDraft({ company: 'Acme branch', phone: '09171234567' }),
    importedLeadDraft({ company: 'Acme duplicate', phone: '+63 917 123 4567' }),
    importedLeadDraft({ company: 'Beta', email: 'buy@beta.test' }),
  ]
  const preview = previewCrmMerge(existing, rows)
  assert.equal(preview.updated, 1)
  assert.equal(preview.duplicates, 1)
  assert.equal(preview.added, 1)
  assert.deepEqual(preview.rows.map((row) => row.action), ['Update', 'Duplicate', 'Add'])
})

test('merge updates one existing lead, adds one lead, and skips in-file duplicates', () => {
  const existing = [{ id: 'existing', company: 'Acme', phone: '09171234567', notes: 'Old', visibility: 'team' }]
  const rows = [
    importedLeadDraft({ company: 'Acme', phone: '09171234567', notes: 'Updated' }, { visibility: 'private' }),
    importedLeadDraft({ company: 'Acme copy', phone: '+63 917 123 4567', notes: 'Duplicate' }, { visibility: 'private' }),
    importedLeadDraft({ company: 'Beta', email: 'buy@beta.test' }, { visibility: 'private' }),
  ]
  const result = mergeCrmLeads(existing, rows, 'merge')
  assert.equal(result.updated, 1)
  assert.equal(result.added, 1)
  assert.equal(result.duplicates, 1)
  assert.equal(result.leads.length, 2)
  assert.equal(result.leads.find((lead) => lead.id === 'existing').notes, 'Updated')
  assert.equal(result.leads.find((lead) => lead.id === 'existing').visibility, 'team')
  assert.equal(result.leads.find((lead) => lead.company === 'Beta').visibility, 'private')
})

test('legacy CSV helper now defaults imports to private visibility', () => {
  const rows = csvToLeadRows('Company,Phone\nGamma,09180000000')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].company, 'Gamma')
  assert.equal(rows[0].visibility, 'private')
})

test('identity keys normalize Philippine phone formats', () => {
  assert.ok(importIdentityKeys({ phone: '+63 917 123 4567' }).includes('phone|09171234567'))
})

test('safe defaults do not overwrite unmapped status or region on an existing lead', () => {
  const data = tabularImportData([
    ['Company', 'Phone', 'Notes'],
    ['Acme', '09171234567', 'Fresh note'],
  ])
  const mapping = inferCrmColumnMapping(data.headers)
  const imported = mapCrmImportRows(data.headers, data.rows, mapping, { sourceName: 'partial.csv' }).rows
  assert.equal(imported[0].region, 'NCR')
  assert.equal(imported[0].status, 'New Lead')
  assert.ok(!imported[0].importProvidedFields.includes('region'))
  assert.ok(!imported[0].importProvidedFields.includes('status'))

  const result = mergeCrmLeads([{
    id: 'existing', company: 'Acme', phone: '09171234567', region: 'NORTH', status: 'Contacted', notes: 'Old', visibility: 'team',
  }], imported, 'merge')
  assert.equal(result.leads[0].region, 'NORTH')
  assert.equal(result.leads[0].status, 'Contacted')
  assert.equal(result.leads[0].notes, 'Fresh note')
})

test('explicitly mapped status and region can update an existing match', () => {
  const data = tabularImportData([
    ['Company', 'Phone', 'Region', 'Status'],
    ['Acme', '09171234567', 'South Luzon', 'Follow-up Needed'],
  ])
  const mapping = inferCrmColumnMapping(data.headers)
  const imported = mapCrmImportRows(data.headers, data.rows, mapping, { sourceName: 'full.csv' }).rows
  const result = mergeCrmLeads([{
    id: 'existing', company: 'Acme', phone: '09171234567', region: 'NORTH', status: 'Contacted', visibility: 'team',
  }], imported, 'merge')
  assert.equal(result.leads[0].region, 'SOUTH')
  assert.equal(result.leads[0].status, 'Follow-up Needed')
})

test('same-company plants at different known locations are not collapsed even with shared contacts', () => {
  const bulacan = { id: 'bulacan', company: 'Acme Ready Mix', location: 'Bustos, Bulacan', phone: '09171234567', email: 'procurement@acme.test' }
  const cavite = importedLeadDraft({ company: 'Acme Ready Mix', location: 'General Trias, Cavite', phone: '09171234567', email: 'procurement@acme.test' })
  assert.equal(findLeadMatch([bulacan], cavite), undefined)
  const result = mergeCrmLeads([bulacan], [cavite], 'merge')
  assert.equal(result.added, 1)
  assert.equal(result.updated, 0)
  assert.equal(result.leads.length, 2)
})

test('location and website columns are exposed and identify the same branch', () => {
  const data = tabularImportData([
    ['Business Name', 'Plant Address', 'Website'],
    ['Acme Ready Mix', 'Bustos, Bulacan', 'https://www.acme.test/bustos'],
  ])
  const mapping = inferCrmColumnMapping(data.headers)
  assert.notEqual(mapping.location, '')
  assert.notEqual(mapping.sourceWebsite, '')
  const [candidate] = mapCrmImportRows(data.headers, data.rows, mapping, { sourceName: 'branches.xlsx' }).rows
  assert.equal(candidate.location, 'Bustos, Bulacan')
  assert.equal(candidate.sourceWebsite, 'https://www.acme.test/bustos')
  assert.equal(findLeadMatch([{ id: 'one', company: 'Acme Ready Mix', location: 'Bustos Bulacan' }], candidate)?.id, 'one')
  assert.equal(findLeadMatch([{ id: 'two', company: 'Acme Ready Mix', location: 'General Trias, Cavite', sourceWebsite: 'https://acme.test' }], candidate), undefined)
})
