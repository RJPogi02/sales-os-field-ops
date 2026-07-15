import { companyDifferentiator, defaultCompanyProfile, normalizeCompanyProfile } from '../config/companyProfile.js'

const normalizeWords = (value) => String(value || '').toLowerCase()

const VERTICAL_PATTERNS = [
  ['ready-mix', /batching|ready[ -]?mix|concrete|cement/],
  ['hardware-distributor', /hardware|building material|home depot|construction supply|trading/],
  ['equipment-lessor', /equipment|leasing|rental|heavy machinery|trucking|hauling/],
  ['contractor', /contractor|builder|construction|developer|engineering/],
]

const VERTICAL_LANGUAGE = {
  'ready-mix': {
    buyer: 'the person handling aggregate procurement for the plant',
    needs: 'aggregate requirements, mix demand, and delivery schedule',
    category: 'aggregates and sand',
  },
  'hardware-distributor': {
    buyer: 'the person handling purchasing or inventory replenishment',
    needs: 'fast-moving materials, stock gaps, and delivery schedule',
    category: 'construction materials',
  },
  'equipment-lessor': {
    buyer: 'the person handling fleet, dispatch, or procurement',
    needs: 'hauling, equipment, and overflow-capacity requirements',
    category: 'hauling and equipment support',
  },
  contractor: {
    buyer: 'the person handling project procurement',
    needs: 'project materials, required volume, and delivery schedule',
    category: 'construction materials and aggregates',
  },
  general: {
    buyer: 'the person handling construction-material purchasing',
    needs: 'materials, required volume, and delivery schedule',
    category: 'construction materials and aggregates',
  },
}

export function inferLeadVertical(lead = {}) {
  const explicit = normalizeWords(lead.vertical || lead.businessType || lead.category || lead.leadType)
  const haystack = [explicit, lead.company, lead.location, lead.notes, lead.materialNeeded].map(normalizeWords).join(' ')
  const exact = VERTICAL_PATTERNS.find(([id]) => explicit === id)
  if (exact) return exact[0]
  return VERTICAL_PATTERNS.find(([, pattern]) => pattern.test(haystack))?.[0] || 'general'
}

export function detectPriorObjection(lead = {}) {
  const history = [
    lead.lastObjection,
    lead.status,
    lead.priorObjections,
    lead.objections,
    lead.outcomeNotes,
    lead.notes,
    ...(Array.isArray(lead.conversationPath) ? lead.conversationPath : []),
    ...(Array.isArray(lead.callResults) ? lead.callResults.slice(0, 4).map((item) => item?.result || item) : []),
  ].flat().map(normalizeWords).join(' ')
  if (/not interested|do not call|don['’]?t call/.test(history)) return 'not-interested'
  if (/already (have|has)|current supplier|existing supplier|regular supplier|loyal/.test(history)) return 'existing-supplier'
  if (/price|expensive|rate|quotation|quote/.test(history)) return 'price'
  if (/email|profile|send details/.test(history)) return 'email-first'
  if (/accredit|vendor|document|permit|test result/.test(history)) return 'accreditation'
  return ''
}

export function leadStatusMode(lead = {}) {
  const status = normalizeWords(lead.status)
  const researchState = [lead.researchStatus, lead.verificationStatus, status].map(normalizeWords).join(' ')
  if (/needs research|\bresearch\b|invalid contact/.test(researchState)) return 'research'
  if (lead.inPricingQueue || /pricing|quotation requested|quote.ready/.test(status)) return 'pricing'
  if (lead.profileSent || /profile sent/.test(status)) return 'profile-sent'
  if (/follow.up|contacted|attempted/.test(status) || Number(lead.callsMade || 0) > 0) return 'follow-up'
  return 'new'
}

export function estimateSpokenSeconds(text = '', wordsPerMinute = 150) {
  const words = String(text).trim().split(/\s+/).filter(Boolean).length
  return Math.round((words / Math.max(1, wordsPerMinute)) * 60 * 10) / 10
}

export function deriveLeadContext(lead = {}) {
  const vertical = inferLeadVertical(lead)
  return {
    vertical,
    language: VERTICAL_LANGUAGE[vertical] || VERTICAL_LANGUAGE.general,
    statusMode: leadStatusMode(lead),
    priorObjection: detectPriorObjection(lead),
  }
}

function openingFor(context, company, operator) {
  const differentiator = companyDifferentiator(company)
  const identity = `Good day, this is ${operator.name} from ${company.shortName}.`
  if (context.statusMode === 'profile-sent') {
    return `${identity} I’m following up on the profile we sent. ${differentiator} May I speak with ${context.language.buyer}?`
  }
  if (context.statusMode === 'follow-up') {
    return `${identity} I’m following up on our earlier call. ${differentiator} May I speak with ${context.language.buyer}?`
  }
  return `${identity} ${differentiator} May I speak with ${context.language.buyer}?`
}

function openingAsk(context) {
  if (context.priorObjection === 'existing-supplier') return 'Would your team be open to a backup or overflow supplier when volume, availability, or price needs another option?'
  if (context.priorObjection === 'price') return 'May I confirm one material, approximate volume, and delivery point so we can prepare a useful price comparison?'
  if (context.priorObjection === 'email-first') return 'Did the profile reach the right procurement contact, and may I confirm one requirement for a useful follow-up?'
  if (context.priorObjection === 'accreditation') return 'Who owns vendor accreditation, and what is the first required document or portal step?'
  return `Who normally evaluates new, backup, or overflow suppliers for your ${context.language.category}?`
}

export function buildConversationFlow(lead = {}, companyValue = defaultCompanyProfile, operatorValue = {}) {
  const company = normalizeCompanyProfile(companyValue)
  const context = deriveLeadContext(lead)
  const operator = {
    name: String(operatorValue.name || company.operatorName || 'Operator').trim(),
    role: String(operatorValue.role || operatorValue.position || company.operatorRole || '').trim(),
  }
  const approver = company.approverLabel || 'management'
  if (context.statusMode === 'research') {
    const reason = lead.researchNotes || (!lead.phone ? 'No callable phone is verified.' : 'The current contact is marked for verification or repair.')
    const researchNode = {
      kind: 'research',
      stage: 'Research / data repair',
      goal: 'Verify a callable contact trail before any outreach begins.',
      say: 'Pause outreach. Repair and verify this lead before placing a call.',
      ask: 'Check the official website, Google Maps listing, company page, or another public source for a current phone, procurement email, and contact name.',
      yes: 'Save the corrected details and source, mark verification as Verified, then use Verify + Call Queue.',
      objection: 'If no reliable source confirms the contact, keep the lead in Research instead of guessing or calling an unverified number.',
      capture: 'Verified phone, procurement email, contact name/role, source URL, and verification notes.',
      why: `This lead is blocked from call queues because its contact needs repair. ${reason}`,
      choices: [],
    }
    return {
      nodes: { opening: researchNode, research: researchNode },
      context,
      operator,
      company,
      callable: false,
      openingSeconds: 0,
    }
  }
  const opening = openingFor(context, company, operator)
  const objectionRecall = context.priorObjection
    ? `This lead previously signaled ${context.priorObjection.replaceAll('-', ' ')}; acknowledge that context before asking for a smaller next step.`
    : 'No prior objection is recorded, so the line asks for the correct buyer before attempting discovery.'

  const nodes = {
    opening: {
      stage: context.statusMode === 'new' ? 'Opening' : 'Contextual re-entry',
      goal: 'Reach the procurement contact with a factual, sub-15-second introduction.',
      say: opening,
      ask: openingAsk(context),
      yes: 'Confirm the contact name and role, then move into needs discovery.',
      objection: context.priorObjection === 'not-interested'
        ? 'Respect the prior no. Ask only whether circumstances changed or whether a future check-in is acceptable.'
        : 'If screened, ask for the best time, direct line, or procurement email.',
      capture: 'Procurement name, role, direct number, best callback time.',
      why: `${company.shortName} is named immediately and the proof point is drawn only from Company Profile. ${objectionRecall}`,
      choices: [['Procurement is available', 'discovery'], ['Guard / staff answered', 'gatekeeper'], ['Procurement unavailable', 'callback']],
    },
    gatekeeper: {
      stage: 'Guard / staff path',
      goal: 'Leave with a procurement name, direct line, email, or specific callback time.',
      say: `No problem—could I ask for the name of ${context.language.buyer} and the best time to reach them? I can send our company profile first.`,
      ask: 'Would email be easier, and who should I address it to?',
      yes: 'Confirm the spelling, send the profile, then schedule a follow-up.',
      objection: 'Position this as a two-minute backup-supplier introduction, not a long sales call.',
      capture: 'Staff name, procurement contact, email, callback schedule.',
      why: 'The request gives staff three easy ways to help without asking them to evaluate the offer.',
      choices: [['Contact shared', 'discovery'], ['Asks for email first', 'emailFirst'], ['No details given', 'callback']],
    },
    callback: {
      stage: 'Procurement unavailable',
      goal: 'Replace “call again” with a date, time, and person.',
      say: 'Understood. What day and time would be least disruptive for a quick two-minute supplier introduction?',
      ask: 'May I confirm the name and direct number of the person I should ask for?',
      yes: 'Repeat the schedule back and save it as the next follow-up.',
      objection: 'Offer to email the profile first so the next call has context.',
      capture: 'Contact name, callback date/time, email.',
      why: 'A named, timed callback is measurable and avoids creating another vague retry.',
      choices: [['Schedule agreed', 'emailFirst'], ['Try procurement now', 'discovery'], ['No schedule', 'close']],
    },
    emailFirst: {
      stage: 'Email-first path',
      goal: 'Plant the profile and create permission for the next contact.',
      say: `I’ll send ${company.shortName}’s company profile and material list today so your team has a clear reference.`,
      ask: 'Which email should I use, and when may I follow up after you receive it?',
      yes: 'Mark Profile Sent and schedule the exact next follow-up.',
      objection: 'If they will not give an email, ask for a public procurement or vendor-accreditation address.',
      capture: 'Confirmed email, profile sent, next follow-up.',
      why: 'The profile is treated as context for a scheduled next step, not as the end of the sales motion.',
      choices: [['Email confirmed', 'discovery'], ['Vendor requirements requested', 'accreditation'], ['Profile only for now', 'close']],
    },
    discovery: {
      stage: 'Needs discovery',
      goal: 'Find a useful opening: price comparison, backup capacity, availability, or urgent volume.',
      say: `We support buyers with ${company.materials.slice(0, 4).join(', ')}${company.materials.length > 4 ? ', and related requirements' : ''}. I’d like to understand where another supply option could be useful.`,
      ask: `What are your current ${context.language.needs}, and are you open to an additional supplier?`,
      yes: 'Move to quantities, delivery location, and commercial requirements.',
      objection: `Do not attack the incumbent supplier—position ${company.shortName} as backup or overflow capacity and a price-comparison option.`,
      capture: 'Materials, current supplier situation, openness to alternatives.',
      why: `The wording matches the lead’s ${context.vertical.replaceAll('-', ' ')} context and asks where support is useful instead of claiming a need.`,
      choices: [['Open to suppliers', 'requirements'], ['Already has supplier', 'objection'], ['Asks price immediately', 'priceImmediate']],
    },
    objection: {
      stage: 'Existing supplier path',
      goal: 'Earn backup-supplier permission without forcing replacement.',
      say: 'That makes sense. We do not need to replace a working supplier. We can be your backup for urgent volume, overflow, availability, or a price comparison.',
      ask: 'Would it help to keep our profile and a small reference price matrix on file?',
      yes: 'Capture one representative requirement and send the profile.',
      objection: 'Respect the no; ask permission for one profile email and a future check-in.',
      capture: 'Reason for loyalty, backup interest, future timing.',
      why: 'Backup and overflow framing lowers switching risk while preserving a real commercial next step.',
      choices: [['Open to backup', 'requirements'], ['Send profile only', 'emailFirst'], ['Not interested', 'close']],
    },
    priceImmediate: {
      stage: 'Price-first path',
      goal: 'Avoid guessing before delivery and volume are known.',
      say: `I can ask ${approver} for our best price, but I want it to match the actual requirement rather than give you a random number.`,
      ask: 'What material, approximate volume, and delivery point should the comparison cover? Do you have a target or current buying range?',
      yes: 'Capture the facts, then confirm when pricing will be returned.',
      objection: 'If they will not share price, record “best delivered price requested” in notes.',
      capture: 'Material, volume, delivery location, target/range or missing-price explanation.',
      why: 'Delivered pricing depends on material, volume, and location; the line avoids an unsupported quote.',
      choices: [['Requirements shared', 'requirements'], ['Best price only', 'profile'], ['Needs formal RFQ', 'accreditation']],
    },
    requirements: {
      stage: 'Small price matrix',
      goal: `Capture enough detail for ${approver} to prepare a useful comparison.`,
      say: 'To keep this useful, let’s start with a small price matrix rather than a broad quotation.',
      ask: 'Which material or size, approximate volume, confirmed delivery point, and target/current price should we compare? Are samples or documents required?',
      yes: 'Repeat the facts back, then mark each captured field.',
      objection: 'If price is confidential, ask for a range or record why it is unavailable.',
      capture: 'Material, volume, delivery, price, sample/docs.',
      why: 'A small matrix is easier for the buyer to request and still produces the minimum facts needed for a responsible handoff.',
      choices: [['Details provided', 'profile'], ['Price not disclosed', 'price'], ['Asks for samples', 'sample'], ['Needs vendor accreditation', 'accreditation']],
    },
    price: {
      stage: 'Missing-price path',
      goal: 'Get a usable benchmark without pressuring confidential disclosure.',
      say: 'No problem if the exact price is confidential. We can still submit our best delivered offer.',
      ask: 'Is there a range we should beat, or should I note that your team requested our best price?',
      yes: 'Record the range or exact wording in Target Price or Notes.',
      objection: 'Do not keep pushing; the explanation in Notes satisfies the handoff gate.',
      capture: 'Target range or missing-price explanation.',
      why: 'The line keeps the opportunity moving while respecting commercial confidentiality.',
      choices: [['Range shared', 'profile'], ['Best price requested', 'profile']],
    },
    sample: {
      stage: 'Sample request',
      goal: 'Clarify the sample, test standard, quantity, and destination.',
      say: 'We can coordinate samples. I’ll make sure the technical and delivery details are complete first.',
      ask: 'What sample quantity, specification, test document, and delivery address do you require?',
      yes: 'Mark Sample Required and list every document or test requirement.',
      objection: 'If specifications are not ready, schedule the person who can provide them.',
      capture: 'Sample quantity, specification, documents, delivery contact.',
      why: 'Technical specificity prevents an unusable sample or an avoidable second delivery.',
      choices: [['Requirements captured', 'profile'], ['Accreditation first', 'accreditation']],
    },
    accreditation: {
      stage: 'Vendor accreditation',
      goal: 'Turn compliance questions into a concrete document checklist.',
      say: 'We can prepare the vendor documents. I’ll record the exact list so we submit a complete pack once.',
      ask: 'Which accreditation form, permits, company documents, and product test results are mandatory?',
      yes: 'Capture each document and the receiving email or portal.',
      objection: 'Ask which single document should be submitted first to start evaluation.',
      capture: 'Document list, process owner, submission channel, deadline.',
      why: 'A defined checklist and owner turns a generic compliance objection into actionable work.',
      choices: [['Document list received', 'profile'], ['Email instructions first', 'emailFirst']],
    },
    profile: {
      stage: 'Profile and next step',
      goal: 'Send the profile and secure a specific follow-up.',
      say: `I’ll send ${company.shortName}’s company profile today and record this small price-matrix request for ${approver}.`,
      ask: 'May I use this email, and when would be a good time to follow up?',
      yes: 'Mark Profile Sent, confirm the next date, and prepare the pricing handoff.',
      objection: 'Send the profile when permission and a valid email are available, then choose a light follow-up date.',
      capture: 'Email, profile status, follow-up date, quotation status.',
      why: 'The close connects the profile to a named owner and follow-up instead of leaving an untracked attachment.',
      choices: [['Quotation requested', 'close'], ['Profile only', 'close'], ['Sample requested', 'sample']],
    },
    close: {
      stage: 'Close',
      goal: 'End with one clear next action and accurate CRM state.',
      say: `Thank you. I’ll send what we agreed and route the captured pricing facts to ${approver} for confirmation.`,
      ask: 'Before I go, is there anyone else who should be copied or one deadline I should note?',
      yes: 'Add the contact or deadline, then Save Call & Start Next Lead.',
      objection: 'Keep the close short and respectful.',
      capture: 'Final result, next action, deadline, copied contacts.',
      why: 'The final line confirms ownership without promising a price or availability that has not been approved.',
      choices: [],
    },
  }

  return {
    nodes,
    context,
    operator,
    company,
    callable: true,
    openingSeconds: estimateSpokenSeconds(opening),
  }
}
