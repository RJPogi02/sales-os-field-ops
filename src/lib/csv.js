import { importedLeadDraft, normalizeLead, sameImportIdentity } from './leadModel.js'

export const CRM_HEADER_ALIASES = {
  company: ['company', 'company name', 'lead', 'business', 'business name', 'account', 'account name'],
  region: ['region', 'territory', 'area'],
  location: ['location', 'address', 'plant location', 'plant address', 'branch address', 'business address'],
  sourceWebsite: ['website', 'website url', 'site', 'company website', 'url'],
  phone: ['phone', 'phone number', 'contact number', 'mobile', 'telephone', 'tel'],
  email: ['email', 'email address', 'e-mail'],
  contactPerson: ['contactperson', 'contact person', 'contact', 'person'],
  contactRole: ['contactrole', 'contact role', 'role', 'department'],
  status: ['status', 'lead status', 'stage'],
  notes: ['notes', 'remarks', 'comment', 'comments'],
  materialNeeded: ['materialneeded', 'material needed', 'material'],
  volumeNeeded: ['volumeneeded', 'volume needed', 'volume'],
  deliveryLocation: ['deliverylocation', 'delivery location', 'project location'],
  targetPrice: ['targetprice', 'target price', 'current price'],
  nextFollowUp: ['nextfollowup', 'next follow-up', 'follow-up', 'follow up'],
  opportunityValue: ['opportunityvalue', 'opportunity value', 'deal value'],
  commissionRate: ['commissionrate', 'commission rate', 'commission %'],
}

export const CRM_IMPORT_MAPPING_FIELDS = [
  { key: 'company', label: 'Company', required: true },
  { key: 'location', label: 'Location / address' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'sourceWebsite', label: 'Website' },
  { key: 'region', label: 'Region' },
  { key: 'status', label: 'Status' },
  { key: 'notes', label: 'Notes' },
]

const cleanHeader = (value) => String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
const cleanCell = (value) => value === null || value === undefined ? '' : String(value).trim()

function stableImportId(sourceName, rowNumber, values) {
  const source = `${sourceName}|${rowNumber}|${values.join('|')}`
  let hash = 2166136261
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `import-${(hash >>> 0).toString(36)}-${rowNumber}`
}

export function parseCsvRows(text = '') {
  const rows = []
  let row = []
  let value = ''
  let quoted = false
  const source = String(text).replace(/^\uFEFF/, '')
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') { value += '"'; index += 1 }
      else if (character === '"') quoted = false
      else value += character
      continue
    }
    if (character === '"') quoted = true
    else if (character === ',') { row.push(value); value = '' }
    else if (character === '\n') { row.push(value.replace(/\r$/, '')); rows.push(row); row = []; value = '' }
    else value += character
  }
  if (value || row.length) { row.push(value.replace(/\r$/, '')); rows.push(row) }
  return rows.filter((item) => item.some((cell) => cleanCell(cell)))
}

export function tabularImportData(matrix = []) {
  const usable = (Array.isArray(matrix) ? matrix : []).filter((row) => Array.isArray(row) && row.some((cell) => cleanCell(cell)))
  if (!usable.length) return { headers: [], rows: [] }
  const width = Math.max(...usable.map((row) => row.length))
  const headers = Array.from({ length: width }, (_, index) => cleanCell(usable[0][index]) || `Column ${index + 1}`)
  return {
    headers,
    rows: usable.slice(1).map((row) => Array.from({ length: width }, (_, index) => cleanCell(row[index]))),
  }
}

export function inferCrmColumnMapping(headers = []) {
  const normalized = headers.map(cleanHeader)
  const used = new Set()
  return Object.fromEntries(CRM_IMPORT_MAPPING_FIELDS.map((field) => {
    const aliases = (CRM_HEADER_ALIASES[field.key] || [field.key]).map(cleanHeader)
    const index = normalized.findIndex((header, candidateIndex) => !used.has(candidateIndex) && aliases.includes(header))
    if (index >= 0) used.add(index)
    return [field.key, index >= 0 ? String(index) : '']
  }))
}

function normalizeImportRegion(value = '') {
  const normalized = cleanHeader(value)
  if (!normalized) return 'NCR'
  if (['ncr', 'metro manila', 'national capital region'].includes(normalized)) return 'NCR'
  if (normalized.includes('north') || normalized.includes('luzon north')) return 'NORTH'
  if (normalized.includes('south') || normalized.includes('luzon south')) return 'SOUTH'
  return String(value).trim().toUpperCase()
}

export function mapCrmImportRows(headers = [], rawRows = [], mapping = {}, options = {}) {
  const rows = []
  const missingRequired = []
  const mappedFields = CRM_IMPORT_MAPPING_FIELDS.filter(({ key }) => {
    const columnIndex = Number.parseInt(mapping[key], 10)
    return Number.isInteger(columnIndex) && columnIndex >= 0 && columnIndex < headers.length
  }).map(({ key }) => key)
  let blankRows = 0
  rawRows.forEach((cells, index) => {
    const values = {}
    CRM_IMPORT_MAPPING_FIELDS.forEach(({ key }) => {
      const columnIndex = Number.parseInt(mapping[key], 10)
      if (Number.isInteger(columnIndex) && columnIndex >= 0 && columnIndex < headers.length) values[key] = cleanCell(cells[columnIndex])
    })
    if (!Object.values(values).some(Boolean)) { blankRows += 1; return }
    if (values.region) values.region = normalizeImportRegion(values.region)
    const providedFields = mappedFields.filter((field) => values[field] !== '' && values[field] !== null && values[field] !== undefined)
    const draft = importedLeadDraft(values, {
      visibility: options.visibility,
      sourceName: options.sourceName,
      leadSource: options.leadSource,
      rowNumber: index + 2,
      mappedFields,
      providedFields,
    })
    const row = {
      ...draft,
      id: stableImportId(options.sourceName || 'crm-import', index + 2, cells),
    }
    if (draft.importMissingFields.length) missingRequired.push({ row, rowNumber: index + 2, fields: draft.importMissingFields })
    rows.push(row)
  })
  return { rows, missingRequired, blankRows }
}

export async function readCrmImportFile(file) {
  if (!file) return { headers: [], rows: [], fileType: '' }
  const extension = String(file.name || '').split('.').pop().toLowerCase()
  if (extension === 'xlsx') {
    const { default: readXlsxFile } = await import('read-excel-file')
    const matrix = await readXlsxFile(file)
    return { ...tabularImportData(matrix), fileType: 'xlsx' }
  }
  if (extension !== 'csv') throw new Error('Choose a CSV or XLSX file.')
  return { ...tabularImportData(parseCsvRows(await file.text())), fileType: 'csv' }
}

export function csvToLeadRows(text = '') {
  const data = tabularImportData(parseCsvRows(text))
  if (!data.headers.length || !data.rows.length) return []
  const mapping = inferCrmColumnMapping(data.headers)
  return mapCrmImportRows(data.headers, data.rows, mapping, { visibility: 'private', leadSource: 'CSV import' }).rows
}

export function findLeadMatch(leads = [], candidate = {}) {
  return leads.find((lead) => sameImportIdentity(lead, candidate))
}

export function previewCrmMerge(currentLeads = [], importedRows = []) {
  let added = 0
  let updated = 0
  let duplicates = 0
  const seenRows = []
  const rows = importedRows.map((row) => {
    const duplicate = findLeadMatch(seenRows, row)
    const match = duplicate ? undefined : findLeadMatch(currentLeads, row)
    let action = 'Add'
    if (duplicate) { duplicates += 1; action = 'Duplicate' }
    else if (match) { updated += 1; action = 'Update' }
    else added += 1
    seenRows.push(row)
    return { row, matchId: match?.id || duplicate?.id || '', action }
  })
  return { rows, added, updated, duplicates, missingRequired: importedRows.filter((row) => row.importMissingFields?.length).length }
}

export function mergeCrmLeads(currentLeads = [], importedRows = [], mode = 'merge') {
  const next = [...currentLeads]
  const seenRows = []
  let added = 0
  let updated = 0
  let matches = 0
  let duplicates = 0
  importedRows.forEach((row, index) => {
    if (findLeadMatch(seenRows, row)) { duplicates += 1; return }
    seenRows.push(row)
    const match = findLeadMatch(next, row)
    if (match) {
      matches += 1
      if (mode === 'add-only') return
      const position = next.findIndex((lead) => lead.id === match.id)
      const providedFields = Array.isArray(row.importProvidedFields) ? new Set(row.importProvidedFields) : null
      const nonEmpty = Object.fromEntries(Object.entries(row).filter(([field, value]) => {
        if (value === '' || value === null || value === undefined) return false
        return !providedFields || providedFields.has(field)
      }))
      next[position] = normalizeLead({
        ...match,
        ...nonEmpty,
        id: match.id,
        visibility: match.visibility,
        ownerId: match.ownerId,
        ownerName: match.ownerName,
        leadSource: match.leadSource || row.leadSource || 'CRM import',
      })
      updated += 1
      return
    }
    next.push(normalizeLead({ ...row, id: row.id || `import-${Date.now()}-${index}` }))
    added += 1
  })
  return {
    leads: next,
    added,
    updated,
    matches,
    duplicates,
    missingRequired: importedRows.filter((row) => row.importMissingFields?.length).length,
  }
}

export function csvTextForLeads(fields, leads) {
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
  return `\uFEFF${[fields.join(','), ...leads.map((lead) => fields.map((field) => quote(lead[field])).join(','))].join('\n')}`
}
