import { normalizeLead, phoneKey } from './leadModel.js'

const HEADER_ALIASES = {
  company: ['company', 'company name', 'lead', 'business', 'business name'],
  region: ['region', 'territory'],
  location: ['location', 'address', 'plant location'],
  phone: ['phone', 'phone number', 'contact number', 'mobile'],
  email: ['email', 'email address'],
  contactPerson: ['contactperson', 'contact person', 'contact', 'person'],
  contactRole: ['contactrole', 'contact role', 'role', 'department'],
  status: ['status', 'lead status'],
  notes: ['notes', 'remarks'],
  materialNeeded: ['materialneeded', 'material needed', 'material'],
  volumeNeeded: ['volumeneeded', 'volume needed', 'volume'],
  deliveryLocation: ['deliverylocation', 'delivery location', 'project location'],
  targetPrice: ['targetprice', 'target price', 'current price'],
  nextFollowUp: ['nextfollowup', 'next follow-up', 'follow-up', 'follow up'],
  opportunityValue: ['opportunityvalue', 'opportunity value', 'deal value'],
  commissionRate: ['commissionrate', 'commission rate', 'commission %'],
}

const cleanHeader = (value) => String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
const cleanIdentity = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')

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
  return rows.filter((item) => item.some((cell) => String(cell).trim()))
}

export function csvToLeadRows(text = '') {
  const rows = parseCsvRows(text)
  if (rows.length < 2) return []
  const headers = rows[0].map(cleanHeader)
  const fieldByIndex = headers.map((header) => Object.entries(HEADER_ALIASES).find(([, aliases]) => aliases.includes(header))?.[0] || header.replace(/\s+/g, ''))
  return rows.slice(1).map((cells, rowIndex) => {
    const lead = {}
    fieldByIndex.forEach((field, index) => { if (field && cells[index] !== undefined) lead[field] = String(cells[index]).trim() })
    return { ...lead, id: lead.id || `import-${Date.now()}-${rowIndex}`, leadSource: 'CSV import' }
  }).filter((lead) => lead.company || lead.phone || lead.email)
}

export function findLeadMatch(leads, candidate) {
  const candidatePhone = phoneKey(candidate.phone)
  const candidateEmail = String(candidate.email || '').trim().toLowerCase()
  const candidateCompany = cleanIdentity(candidate.company)
  return leads.find((lead) => {
    if (candidatePhone && candidatePhone === phoneKey(lead.phone)) return true
    if (candidateEmail && candidateEmail === String(lead.email || '').trim().toLowerCase()) return true
    return candidateCompany && candidateCompany === cleanIdentity(lead.company)
  })
}

export function previewCrmMerge(currentLeads = [], importedRows = []) {
  let added = 0
  let updated = 0
  const rows = importedRows.map((row) => {
    const match = findLeadMatch(currentLeads, row)
    if (match) updated += 1
    else added += 1
    return { row, matchId: match?.id || '', action: match ? 'Update' : 'Add' }
  })
  return { rows, added, updated }
}

export function mergeCrmLeads(currentLeads = [], importedRows = [], mode = 'merge') {
  const next = [...currentLeads]
  let added = 0
  let updated = 0
  importedRows.forEach((row, index) => {
    const match = findLeadMatch(next, row)
    if (match) {
      if (mode === 'add-only') return
      const position = next.findIndex((lead) => lead.id === match.id)
      const nonEmpty = Object.fromEntries(Object.entries(row).filter(([, value]) => value !== '' && value !== null && value !== undefined))
      next[position] = normalizeLead({ ...match, ...nonEmpty, id: match.id, leadSource: match.leadSource || 'CSV import' })
      updated += 1
      return
    }
    next.push(normalizeLead({ ...row, id: row.id || `import-${Date.now()}-${index}` }))
    added += 1
  })
  return { leads: next, added, updated }
}

export function csvTextForLeads(fields, leads) {
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
  return `\uFEFF${[fields.join(','), ...leads.map((lead) => fields.map((field) => quote(lead[field])).join(','))].join('\n')}`
}
