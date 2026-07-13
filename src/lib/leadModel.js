export const CHECKLIST_LABELS = [
  'Confirm procurement / purchasing contact',
  'Confirm materials usually sourced',
  'Ask if open to additional suppliers',
  'Confirm delivery / project location',
  'Ask current buying price or target price',
  'Ask if sample or documents are required',
  'Confirm email and send company profile',
]

export const MATERIAL_OPTIONS = [
  'Aggregates', 'Sand', 'Gravel', 'S1', '3/4', '3/8', 'G1',
  'Vibro sand', 'Filling materials', 'Hauling', 'Equipment leasing',
  'Construction material supply support',
]

export const QUICK_RESULTS = [
  'No Answer', 'Wrong Number', 'Spoke to Staff', 'Procurement Contact Found',
  'Asked for Email', 'Profile Sent', 'Sample Requested', 'Quotation Requested', 'Not Interested',
]

export const STATUS_OPTIONS = [
  'New Lead', 'Attempted', 'Contacted', 'Follow-up Needed', 'Profile Sent',
  'Quotation Requested', 'Pricing Queue', 'Won', 'Lost', 'Not Interested', 'Invalid Contact',
]

export const PRICING_STAGES = [
  'Needs pricing', 'Submitted to Pricing Desk', 'Price received',
  'Quotation sent to client', 'Follow-up scheduled', 'Won', 'Lost',
]

export const NOMINATIM_DEFAULT_ENDPOINT = 'https://nominatim.openstreetmap.org/search'

export const SAMPLE_STATUSES = [
  'Not started', 'Preparing', 'Submitted', 'Follow-up needed', 'Completed',
]

export const RANKS = [
  { min: 0, title: 'Field Scout', classTier: 1 },
  { min: 250, title: 'Road Warrior', classTier: 1 },
  { min: 750, title: 'Pipeline Builder', classTier: 2 },
  { min: 1500, title: 'Procurement Pathfinder', classTier: 2 },
  { min: 3000, title: 'Quote Commander', classTier: 3 },
  { min: 5000, title: 'Territory Closer', classTier: 4 },
]

export const CLASS_TIERS = [
  { tier: 1, min: 0, title: 'Prototype Scout', short: 'Scout' },
  { tier: 2, min: 750, title: 'Business Development Officer', short: 'BDO' },
  { tier: 3, min: 3000, title: 'Growth Engineer', short: 'Growth' },
  { tier: 4, min: 5000, title: 'Revenue Architect', short: 'Revenue' },
]

export const ACHIEVEMENTS = [
  { id: 'first-call', label: 'First Call', icon: 'C1' },
  { id: 'first-contact', label: 'First Real Contact', icon: '01' },
  { id: 'first-profile', label: 'First Profile Sent', icon: '02' },
  { id: 'first-warm', label: 'First Warm Lead', icon: 'WL' },
  { id: 'first-quote', label: 'First Quote-Ready Lead', icon: '03' },
  { id: 'five-quotes', label: '5 Quote-Ready Leads', icon: '05' },
  { id: 'first-handoff', label: 'First Pricing Desk Handoff', icon: 'SL' },
  { id: 'first-sample', label: 'First Sample Request', icon: 'SR' },
  { id: 'first-followup', label: 'First Follow-Up Scheduled', icon: 'FU' },
  { id: 'first-win', label: 'First Closed Deal', icon: 'W' },
]

export const todayKey = () => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

export const createDailyState = () => ({
  date: todayKey(),
  rosterLocked: false,
  activeCall: null,
  calls: [],
  events: [],
  completedLeadIds: [],
  xpEarned: 0,
})

export const ANSWERED_FOLLOW_UP_RESULTS = [
  'Spoke to Staff', 'Procurement Contact Found', 'Asked for Email',
]

export const resultAnswered = (result) => !['No Answer', 'Wrong Number'].includes(result)

export const isFinalCallResult = (result) => QUICK_RESULTS.includes(result)

export function rankForXp(xp = 0) {
  let current = RANKS[0]
  let next = RANKS[1]
  for (let index = 0; index < RANKS.length; index += 1) {
    if (xp >= RANKS[index].min) current = RANKS[index]
    if (xp < RANKS[index].min) { next = RANKS[index]; break }
    next = RANKS[index + 1] || { min: current.min + 2500, title: 'National Sales Vanguard' }
  }
  return { ...current, nextTitle: next.title, nextXp: next.min }
}

export function classForXp(xp = 0) {
  let current = CLASS_TIERS[0]
  let next = CLASS_TIERS[1]
  for (let index = 0; index < CLASS_TIERS.length; index += 1) {
    if (xp >= CLASS_TIERS[index].min) current = CLASS_TIERS[index]
    if (xp < CLASS_TIERS[index].min) { next = CLASS_TIERS[index]; break }
    next = CLASS_TIERS[index + 1] || null
  }
  return { ...current, nextTitle: next?.title || 'Mastery', nextXp: next?.min || current.min }
}

export function normalizeLead(lead) {
  return {
    ...lead,
    company: lead.company || 'New lead',
    region: lead.region || 'NCR',
    location: lead.location || '',
    selected: Boolean(lead.selected),
    answered: Boolean(lead.answered),
    quoteReady: Boolean(lead.quoteReady),
    inPricingQueue: Boolean(lead.inPricingQueue),
    quoteReadyToday: Boolean(lead.quoteReadyToday),
    profileSent: Boolean(lead.profileSent),
    profileSentAt: lead.profileSentAt || '',
    checklist: Array.from({ length: 7 }, (_, index) => Boolean(lead.checklist?.[index])),
    materialNeeded: lead.materialNeeded || '',
    volumeNeeded: lead.volumeNeeded || '',
    deliveryLocation: lead.deliveryLocation || '',
    deliveryLocationConfirmed: Boolean(lead.deliveryLocationConfirmed),
    deliveryLatitude: Number.isFinite(Number(lead.deliveryLatitude)) ? Number(lead.deliveryLatitude) : null,
    deliveryLongitude: Number.isFinite(Number(lead.deliveryLongitude)) ? Number(lead.deliveryLongitude) : null,
    targetPrice: lead.targetPrice || '',
    sampleRequired: Boolean(lead.sampleRequired),
    sampleDocStatus: lead.sampleDocStatus || (lead.sampleRequired || lead.documentsRequired ? 'Required' : 'Unknown'),
    materialSampleNeeded: lead.materialSampleNeeded || '',
    sampleSubmissionLocation: lead.sampleSubmissionLocation || '',
    sampleReceivingContact: lead.sampleReceivingContact || '',
    sampleDeadline: lead.sampleDeadline || '',
    sampleStatus: lead.sampleStatus || 'Not started',
    sampleSubmittedDate: lead.sampleSubmittedDate || '',
    documentsRequired: lead.documentsRequired || '',
    quotationStatus: lead.quotationStatus || (lead.quoteReady ? 'Pricing queue' : 'Not started'),
    managementPricingNeeded: Boolean(lead.managementPricingNeeded || lead.inPricingQueue),
    pricingQueueAt: lead.pricingQueueAt || '',
    pricingStage: lead.pricingStage || (lead.inPricingQueue ? 'Needs pricing' : 'Needs pricing'),
    quotedPrice: lead.quotedPrice || '',
    submittedToSirLukeAt: lead.submittedToSirLukeAt || '',
    quotationSentAt: lead.quotationSentAt || '',
    pricingFollowUpDate: lead.pricingFollowUpDate || '',
    outcomeNotes: lead.outcomeNotes || '',
    urgency: lead.urgency || '',
    callsMade: Number(lead.callsMade || 0),
    callResults: Array.isArray(lead.callResults) ? lead.callResults : [],
    activityLog: Array.isArray(lead.activityLog) ? lead.activityLog : [],
    conversationNode: lead.conversationNode || 'opening',
    conversationPath: Array.isArray(lead.conversationPath) ? lead.conversationPath : [],
    notes: lead.notes || '',
    nextFollowUp: lead.nextFollowUp || '',
    contactRole: lead.contactRole || '',
    directPhone: lead.directPhone || '',
    emailConfirmed: Boolean(lead.emailConfirmed),
    canSendProfile: lead.canSendProfile === true ? true : lead.canSendProfile === false ? false : null,
    warmLead: Boolean(lead.warmLead),
    retryCountToday: Number(lead.retryCountToday || 0),
    retryDate: lead.retryDate || '',
    nextRetryTime: lead.nextRetryTime || '',
    retryStatus: lead.retryStatus || '',
    researchStatus: lead.researchStatus || (lead.status === 'Invalid Contact' ? 'Needs Research' : ''),
    researchUrl: lead.researchUrl || '',
    researchNotes: lead.researchNotes || '',
    researchPhone: lead.researchPhone || '',
    researchEmail: lead.researchEmail || '',
    verificationStatus: lead.verificationStatus || (lead.phone || lead.email ? 'Unverified' : 'Needs Research'),
    verifiedAt: lead.verifiedAt || '',
    leadSource: lead.leadSource || 'CRM',
    sourceName: lead.sourceName || '',
    sourceUrl: lead.sourceUrl || '',
    sourceFetchedAt: lead.sourceFetchedAt || '',
    sourceQuery: lead.sourceQuery || '',
    importedOnline: Boolean(lead.importedOnline),
    opportunityValue: lead.opportunityValue || '',
    commissionRate: lead.commissionRate || '',
    dealProbability: Number.isFinite(Number(lead.dealProbability)) ? Number(lead.dealProbability) : 25,
    quoteDueDate: lead.quoteDueDate || '',
    sirLukeNotes: lead.sirLukeNotes || '',
  }
}

export function phoneKey(value = '') {
  const digits = String(value).replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('63')) return `0${digits.slice(2)}`
  return digits
}

export function phoneCountsForLeads(leads = []) {
  const counts = new Map()
  leads.forEach((lead) => {
    const key = phoneKey(lead.phone)
    if (key) counts.set(key, (counts.get(key) || 0) + 1)
  })
  return counts
}

export function phoneQuality(phone = '', phoneCounts = null) {
  const digits = phoneKey(phone)
  if (!digits) return { label: 'Missing', tone: 'missing', detail: 'No phone number', score: -100 }
  if (digits.length < 7 || digits.length > 12) return { label: 'Invalid', tone: 'invalid', detail: digits.length < 7 ? 'Number is too short' : 'Number is too long', score: -100 }
  const duplicate = Number(phoneCounts?.get(digits) || 0) > 1
  const mobile = digits.length === 11 && digits.startsWith('09')
  const landline = digits.length >= 9 && digits.length <= 10
  if (duplicate) return { label: 'Check', tone: 'check', detail: 'Duplicate phone in CRM', score: 2 }
  if (mobile) return { label: 'Good', tone: 'good', detail: 'Likely PH mobile', score: 24 }
  if (landline) return { label: 'Good', tone: 'good', detail: 'Likely landline', score: 18 }
  return { label: 'Check', tone: 'check', detail: 'Unusual phone format', score: 5 }
}

export function phoneQualityForLead(lead, phoneCounts = null) {
  if (lead?.researchStatus === 'Needs Research' || lead?.status === 'Invalid Contact') {
    return { label: 'Invalid', tone: 'invalid', detail: 'Marked for contact research', score: -100 }
  }
  return phoneQuality(lead?.phone, phoneCounts)
}

export function profileOpportunityLeads(leads = []) {
  return leads.filter((lead) => lead.answered && !lead.profileSent)
}

export function followUpLeads(leads = []) {
  return leads
    .filter((lead) => lead.nextFollowUp || lead.pricingFollowUpDate)
    .sort((a, b) => (a.nextFollowUp || a.pricingFollowUpDate).localeCompare(b.nextFollowUp || b.pricingFollowUpDate))
}

export function reactivateLeadPatch() {
  return {
    researchStatus: 'Resolved',
    status: 'New Lead',
    lastResult: 'Contact repaired',
    retryStatus: '',
    nextRetryTime: '',
    retryCountToday: 0,
    retryDate: '',
  }
}

export function retryPatchForLead(lead, date = todayKey(), now = new Date()) {
  const retryCountToday = lead.retryDate === date ? Number(lead.retryCountToday || 0) + 1 : 1
  const retryAt = new Date(now)
  if (retryCountToday >= 2) { retryAt.setDate(retryAt.getDate() + 1); retryAt.setHours(9, 0, 0, 0) }
  else retryAt.setHours(retryAt.getHours() + 2, 0, 0, 0)
  return {
    answered: Boolean(lead.answered),
    status: 'Attempted',
    retryCountToday,
    retryDate: date,
    nextRetryTime: new Date(retryAt.getTime() - retryAt.getTimezoneOffset() * 60000).toISOString().slice(0, 16),
    retryStatus: retryCountToday >= 2 ? 'Retry Tomorrow' : 'Retry Later',
  }
}

export function commissionEstimate(lead) {
  const value = Number(String(lead?.opportunityValue || '').replace(/[^\d.]/g, ''))
  const rate = Number(String(lead?.commissionRate || '').replace(/[^\d.]/g, ''))
  return Number.isFinite(value) && Number.isFinite(rate) ? value * (rate / 100) : 0
}

export function withActivity(lead, patch, action, detail = '') {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    action,
    detail,
  }
  return { ...lead, ...patch, activityLog: [entry, ...(lead.activityLog || [])].slice(0, 120) }
}

export function hasQuotationBasics(lead) {
  return Boolean(lead.materialNeeded?.trim() && lead.deliveryLocation?.trim() && lead.deliveryLocationConfirmed)
}

export function canEnterPricingQueue(lead) {
  return pricingReadiness(lead).every((item) => item.ready)
}

export function pricingReadiness(lead) {
  return [
    { key: 'answered', label: 'Real person answered', ready: Boolean(lead.answered) },
    { key: 'profile', label: 'Company profile sent', ready: Boolean(lead.profileSent) },
    { key: 'material', label: 'Material needed captured', ready: Boolean(lead.materialNeeded?.trim()) },
    { key: 'delivery', label: 'Delivery/project location confirmed', ready: Boolean(lead.deliveryLocation?.trim() && lead.deliveryLocationConfirmed) },
    { key: 'price', label: 'Target/current price or explanation', ready: Boolean(lead.targetPrice?.trim() || lead.notes?.trim()) },
    { key: 'sampleDocs', label: 'Sample/docs marked required or not required', ready: Boolean(lead.sampleDocStatus && lead.sampleDocStatus !== 'Unknown') },
  ]
}

export function buildProfileEmail(lead, operatorName = 'Demo Operator') {
  const followUp = new Date()
  followUp.setDate(followUp.getDate() + 3)
  const subject = `Northstar Materials supply support for ${lead.company}`
  const body = [
    `Good day${lead.contactPerson ? ` ${lead.contactPerson}` : ''},`,
    '',
    `This is ${operatorName} from Northstar Materials. We support batching plants and projects with aggregates, sand, gravel, S1, 3/4, 3/8, G1, vibro sand, filling materials, hauling, and equipment leasing.`,
    '',
    'I am sharing our company profile for your reference. If you are open to an additional supplier, may we confirm the materials, volume, and delivery/project location you currently need?',
    '',
    'Thank you, and I look forward to supporting your requirements.',
  ].join('\n')
  return { subject, body, followUp: todayKeyFor(followUp) }
}

function todayKeyFor(date) {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

export function buildHandoffMessage(lead, distanceNotes = '', sourceContext = '') {
  const sampleDocs = lead.sampleDocStatus === 'Not required'
    ? 'Not required'
    : [lead.materialSampleNeeded || (lead.sampleRequired ? 'Sample required' : ''), lead.documentsRequired].filter(Boolean).join(' | ') || 'Needs confirmation'
  return [
    'Pricing Desk, for final quotation/pricing:',
    '',
    `Company: ${lead.company}`,
    `Lead location: ${lead.location || 'Not available'}`,
    `Procurement/contact: ${lead.contactPerson || 'Not captured'}`,
    `Phone / email: ${[lead.phone, lead.email].filter(Boolean).join(' | ') || 'Not available'}`,
    `Material needed: ${lead.materialNeeded || 'Not captured'}`,
    `Volume: ${lead.volumeNeeded || 'Not captured'}`,
    `Confirmed delivery/project location: ${lead.deliveryLocationConfirmed ? lead.deliveryLocation : 'Not confirmed'}`,
    `Distance notes: ${distanceNotes || 'Not available'}`,
    `Target/current price: ${lead.targetPrice || 'See notes / best price requested'}`,
    `Sample/doc requirement: ${sampleDocs}`,
    `Sample deadline/status: ${[lead.sampleDeadline, lead.sampleStatus].filter(Boolean).join(' | ') || 'Not applicable'}`,
    `Profile sent: ${lead.profileSent ? 'Yes' : 'No'}`,
    `Urgency/deadline: ${lead.urgency || 'Not captured'}`,
    `Pricing stage: ${lead.pricingStage || 'Needs pricing'}`,
    `Possible source context: ${sourceContext || 'Not matched yet'}`,
    `Notes: ${lead.notes || 'None'}`,
    '',
    'Reminder: final quotation/pricing requires Pricing Desk.',
  ].join('\n')
}

export function buildBatchHandoffMessage(leads = []) {
  const active = leads.filter(Boolean)
  return [
    `Pricing Desk, reference/final pricing request for ${active.length} lead${active.length === 1 ? '' : 's'}:`,
    '',
    ...active.flatMap((lead, index) => [
      `${index + 1}. ${lead.company}`,
      `Area: ${lead.deliveryLocationConfirmed ? lead.deliveryLocation : lead.deliveryLocation || lead.location || 'Needs confirmation'}`,
      `Contact: ${[lead.contactPerson, lead.directPhone || lead.phone, lead.email].filter(Boolean).join(' | ') || 'Not captured'}`,
      `Materials: ${lead.materialNeeded || 'Not captured'}`,
      `Volume: ${lead.volumeNeeded || 'Not yet provided'}`,
      `Target/current price: ${lead.targetPrice || lead.notes || 'Best/reference price requested'}`,
      `Sample/docs: ${lead.sampleDocStatus || 'Needs confirmation'}`,
      `Urgency: ${lead.urgency || 'Not captured'}`,
      '',
    ]),
    'Please advise price basis/unit, delivered or ex-plant basis, freight assumptions, VAT, minimum order, availability, and validity.',
    'Reminder: final quotations and availability require Pricing Desk confirmation.',
  ].join('\n')
}

export function dailyMetrics(daily) {
  const unique = (type) => new Set(daily.events.filter((event) => event.type === type).map((event) => event.leadId)).size
  return {
    calls: daily.calls.length,
    answered: new Set(daily.calls.filter((call) => call.answered).map((call) => call.leadId)).size,
    profiles: unique('profile'),
    quotes: unique('quoteReady'),
    samples: unique('sample'),
    pricing: unique('pricing'),
    followups: unique('followup'),
    deliveries: unique('deliveryConfirmed'),
    retries: unique('retry'),
    invalid: unique('research'),
    warm: unique('warm'),
    xpEarned: Number(daily.xpEarned || 0),
  }
}

export function miniQuestProgress(lead) {
  if (!lead) return 0
  return [
    lead.checklist?.[0],
    lead.materialNeeded,
    lead.checklist?.[2],
    lead.deliveryLocation && lead.deliveryLocationConfirmed,
    lead.targetPrice,
    lead.sampleDocStatus && lead.sampleDocStatus !== 'Unknown',
    lead.profileSent,
  ].filter(Boolean).length
}

const REGION_CENTERS = {
  ALL: [14.9, 121.15],
  NCR: [14.5995, 120.9842],
  NORTH: [16.18, 120.58],
  SOUTH: [13.75, 121.15],
}

const LOCATION_HINTS = [
  ['taguig', [14.5176, 121.0509]], ['pasig', [14.5764, 121.0851]],
  ['quezon city', [14.676, 121.0437]], ['manila', [14.5995, 120.9842]],
  ['makati', [14.5547, 121.0244]], ['valenzuela', [14.7011, 120.983]],
  ['paranaque', [14.4793, 121.0198]], ['las pinas', [14.4445, 120.9939]],
  ['caloocan', [14.6507, 120.9676]], ['malabon', [14.6625, 120.9567]],
  ['navotas', [14.6661, 120.9417]], ['mandaluyong', [14.5794, 121.0359]],
  ['muntinlupa', [14.4081, 121.0415]], ['marikina', [14.6507, 121.1029]],
  ['antipolo', [14.6255, 121.1245]], ['rodriguez', [14.7601, 121.1999]],
  ['montalban', [14.7601, 121.1999]], ['bulacan', [14.7943, 120.879]],
  ['pampanga', [15.0794, 120.62]], ['tarlac', [15.4755, 120.5963]],
  ['pangasinan', [15.8949, 120.2863]], ['baguio', [16.4023, 120.596]],
  ['la union', [16.6159, 120.3209]], ['nueva ecija', [15.5784, 121.1113]],
  ['cagayan', [17.6132, 121.727]], ['isabela', [16.9754, 121.8107]],
  ['ilocos norte', [18.1647, 120.7116]], ['ilocos sur', [17.2279, 120.5739]],
  ['cavite', [14.2456, 120.8786]], ['laguna', [14.2691, 121.4113]],
  ['batangas', [13.945, 121.1312]], ['rizal', [14.6037, 121.3084]],
  ['lucena', [13.9414, 121.6234]], ['quezon province', [13.9347, 121.9473]],
  ['naga', [13.6218, 123.1948]], ['bicol', [13.1391, 123.7438]],
  ['albay', [13.1775, 123.528]],
]

function hashOffset(value, amplitude) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash) + value.charCodeAt(index)
  return (((Math.abs(hash) % 1000) / 999) - 0.5) * amplitude
}

export function coordinatesForLocation(value = '', region = 'NCR') {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  const hint = LOCATION_HINTS.find(([token]) => normalized.includes(token))
  const center = hint?.[1] || REGION_CENTERS[region] || REGION_CENTERS.NCR
  const spread = hint ? 0.018 : region === 'NCR' ? 0.12 : 0.38
  return [center[0] + hashOffset(`${normalized}-lat`, spread), center[1] + hashOffset(`${normalized}-lng`, spread)]
}

export function coordinatesForLead(lead) {
  if (Number.isFinite(lead.latitude) && Number.isFinite(lead.longitude)) return [lead.latitude, lead.longitude]
  const haystack = `${lead.company} ${lead.location}`.toLowerCase()
  const point = coordinatesForLocation(haystack, lead.region)
  return point || REGION_CENTERS[lead.region] || REGION_CENTERS.NCR
}

export function deliveryCoordinatesForLead(lead) {
  if (Number.isFinite(lead.deliveryLatitude) && Number.isFinite(lead.deliveryLongitude)) return [lead.deliveryLatitude, lead.deliveryLongitude]
  return coordinatesForLocation(lead.deliveryLocation, lead.region)
}

export function territoryCenter(territory) {
  return REGION_CENTERS[territory] || REGION_CENTERS.ALL
}

export function distanceKm(a, b) {
  if (!a || !b) return null
  const radians = (degrees) => degrees * Math.PI / 180
  const earth = 6371
  const dLat = radians(b[0] - a[0])
  const dLng = radians(b[1] - a[1])
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a[0])) * Math.cos(radians(b[0])) * Math.sin(dLng / 2) ** 2
  return earth * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

const formatKm = (value) => value === null ? '' : `${value.toFixed(value < 10 ? 1 : 0)} km`

export function distanceIntelligence(lead, userPosition) {
  const leadPoint = coordinatesForLead(lead)
  const deliveryPoint = deliveryCoordinatesForLead(lead)
  const userToLead = distanceKm(userPosition, leadPoint)
  const leadToDelivery = distanceKm(leadPoint, deliveryPoint)
  const userToDelivery = distanceKm(userPosition, deliveryPoint)
  const notes = [
    userToLead !== null ? `You to lead: ${formatKm(userToLead)}` : '',
    leadToDelivery !== null ? `Lead to delivery: ${formatKm(leadToDelivery)}` : '',
    userToDelivery !== null ? `You to delivery: ${formatKm(userToDelivery)}` : '',
  ].filter(Boolean).join(' | ')
  return { leadPoint, deliveryPoint, userToLead, leadToDelivery, userToDelivery, notes }
}

export function sourceContextForLead(lead, suppliers = []) {
  const material = (lead.materialNeeded || '').toLowerCase()
  const location = `${lead.deliveryLocation} ${lead.location}`.toLowerCase()
  const scored = suppliers.map((supplier) => {
    let score = supplier.region === lead.region ? 3 : 0
    if (material && supplier.materialType?.some((item) => material.includes(item.toLowerCase()) || item.toLowerCase().includes(material))) score += 4
    if (supplier.location && location.includes(supplier.location.toLowerCase().split('/')[0])) score += 2
    return { supplier, score }
  }).sort((a, b) => b.score - a.score)
  const match = scored[0]?.supplier
  if (!match || scored[0].score === 0) return 'No close source reference matched yet. Verify source availability and final pricing with Pricing Desk.'
  return `${match.supplierName} for ${match.materialType.join(', ')}. ${match.status === 'Verified' ? 'Reference was recently verified.' : 'Data may be outdated and needs recheck.'} Verify availability and final pricing with Pricing Desk.`
}

export function autoPickScore(lead, territory, completedIds = new Set(), userPosition = null, phoneCounts = null) {
  const quality = phoneQualityForLead(lead, phoneCounts)
  if (territory !== 'ALL' && lead.region !== territory) return -1000
  if (quality.score < 0 || completedIds.has(lead.id) || lead.status === 'Invalid Contact' || lead.lastResult === 'Wrong Number') return -1000
  let score = 0
  score += 50
  if (String(lead.priority).toLowerCase() === 'high') score += 25
  if (String(lead.priority).toLowerCase() === 'medium') score += 12
  if (lead.email) score += 10
  if (lead.contactPerson) score += 10
  if (!lead.lastContacted) score += 18
  if (!lead.callsMade) score += 8
  score += quality.score
  if (lead.retryStatus === 'Retry Tomorrow') score -= 30
  const distance = distanceKm(userPosition, coordinatesForLead(lead))
  if (distance !== null) score += Math.max(0, 20 - Math.min(20, distance / 10))
  return score
}
