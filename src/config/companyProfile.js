export const COMPANY_VERTICALS = [
  { id: 'aggregates-supplier', label: 'Aggregates supplier' },
  { id: 'ready-mix', label: 'Ready-mix / batching plant' },
  { id: 'hardware-distributor', label: 'Hardware / materials distributor' },
  { id: 'equipment-lessor', label: 'Equipment lessor' },
  { id: 'construction-services', label: 'Construction services' },
]

export const defaultCompanyProfile = Object.freeze({
  companyName: 'Your Company',
  shortName: 'Company',
  operatorName: 'Operator',
  operatorRole: 'Team Member',
  approverLabel: 'Management',
  businessVertical: 'construction-services',
  ownedAssets: [],
  quarryLocations: [],
  fleetSize: 0,
  fleetTypes: [],
  credentials: [],
  materials: [],
})

const cleanText = (value, fallback = '') => String(value ?? fallback).trim()

export function textToList(value) {
  if (Array.isArray(value)) return value.map((item) => cleanText(item)).filter(Boolean)
  return cleanText(value)
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function listToText(value) {
  return textToList(value).join(', ')
}

export function normalizeCompanyProfile(value = {}) {
  const source = value && typeof value === 'object' ? value : {}
  const fleetSize = Number.parseInt(source.fleetSize, 10)
  const verticalIds = new Set(COMPANY_VERTICALS.map((item) => item.id))
  const listField = (key) => Object.prototype.hasOwnProperty.call(source, key)
    ? textToList(source[key])
    : [...defaultCompanyProfile[key]]
  return {
    companyName: cleanText(source.companyName, defaultCompanyProfile.companyName),
    shortName: cleanText(source.shortName, defaultCompanyProfile.shortName),
    operatorName: cleanText(source.operatorName, defaultCompanyProfile.operatorName),
    operatorRole: cleanText(source.operatorRole, defaultCompanyProfile.operatorRole),
    approverLabel: cleanText(source.approverLabel, defaultCompanyProfile.approverLabel),
    businessVertical: verticalIds.has(source.businessVertical) ? source.businessVertical : defaultCompanyProfile.businessVertical,
    ownedAssets: listField('ownedAssets'),
    quarryLocations: listField('quarryLocations'),
    fleetSize: Number.isFinite(fleetSize) && fleetSize >= 0 ? fleetSize : defaultCompanyProfile.fleetSize,
    fleetTypes: listField('fleetTypes'),
    credentials: listField('credentials'),
    materials: listField('materials'),
  }
}

export function companyVerticalLabel(value) {
  return COMPANY_VERTICALS.find((item) => item.id === value)?.label || COMPANY_VERTICALS[0].label
}

export function companyDifferentiator(profile = defaultCompanyProfile) {
  const company = normalizeCompanyProfile(profile)
  if (company.businessVertical === 'equipment-lessor' && company.fleetSize) {
    return `We operate our own ${company.fleetSize}-unit delivery and equipment fleet.`
  }
  if (company.quarryLocations.length) {
    return `We supply directly from owned quarry operations in ${company.quarryLocations.join(' and ')}.`
  }
  if (company.fleetSize) return `We operate our own ${company.fleetSize}-unit delivery fleet.`
  return 'We provide direct, accountable construction-material supply support.'
}

export function companyProofSummary(profile = defaultCompanyProfile) {
  const company = normalizeCompanyProfile(profile)
  const facts = []
  if (company.ownedAssets.length) facts.push(`Owned assets: ${company.ownedAssets.join(' / ')}`)
  if (company.quarryLocations.length) facts.push(`Quarry operations: ${company.quarryLocations.join(' / ')}`)
  if (company.fleetSize) facts.push(`Fleet: ${company.fleetSize} ${company.fleetTypes.join(' + ')}`)
  if (company.credentials.length) facts.push(`Credentials: ${company.credentials.join(' / ')}`)
  return facts
}
