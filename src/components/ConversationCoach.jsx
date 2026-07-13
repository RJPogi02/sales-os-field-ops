import { ArrowLeft, RotateCcw, Target } from 'lucide-react'

const nodes = {
  opening: {
    stage: 'Opening', goal: 'Reach the procurement contact without sounding scripted.',
    say: 'Good day, this is Alex from Northstar Materials. May I speak with the person handling aggregates or construction-material purchasing?',
    ask: 'Who normally evaluates new or backup suppliers for your plant?',
    yes: 'Thank them, confirm the contact name, and move into needs discovery.',
    objection: 'If they screen calls, ask for the best time, direct line, or email instead.',
    capture: 'Procurement name, role, direct number, best callback time.',
    choices: [['Procurement is available', 'discovery'], ['Guard / staff answered', 'gatekeeper'], ['Procurement unavailable', 'callback']],
  },
  gatekeeper: {
    stage: 'Guard / staff path', goal: 'Leave with a procurement name, direct line, email, or specific callback time.',
    say: 'No problem—could I ask for the name of your procurement contact and the best time to reach them? I can also send our profile for reference.',
    ask: 'Would it be easier if I email the company profile first?',
    yes: 'Confirm the email carefully, send the profile, then schedule a follow-up.',
    objection: 'Position the request as a two-minute backup-supplier introduction, not a long sales call.',
    capture: 'Staff name, procurement contact, email, callback schedule.',
    choices: [['Contact shared', 'discovery'], ['Asks for email first', 'emailFirst'], ['No details given', 'callback']],
  },
  callback: {
    stage: 'Procurement unavailable', goal: 'Replace “call again” with a date, time, and person.',
    say: 'Understood. What day and time would be least disruptive for a quick two-minute supplier introduction?',
    ask: 'May I confirm the name and direct number of the person I should ask for?',
    yes: 'Repeat the schedule back and save it as the next follow-up.',
    objection: 'Offer to email the profile first so the next call has context.',
    capture: 'Contact name, callback date/time, email.',
    choices: [['Schedule agreed', 'emailFirst'], ['Try procurement now', 'discovery'], ['No schedule', 'close']],
  },
  emailFirst: {
    stage: 'Email-first path', goal: 'Plant the profile and create permission for the next contact.',
    say: 'I’ll send our company profile and product list today. I’ll keep it concise so procurement can review it quickly.',
    ask: 'Which email should I use, and when may I follow up after you receive it?',
    yes: 'Mark Profile Sent and schedule the exact next follow-up.',
    objection: 'If they will not give an email, ask whether a public procurement or vendor-accreditation address is available.',
    capture: 'Confirmed email, profile sent, next follow-up.',
    choices: [['Email confirmed', 'discovery'], ['Vendor requirements requested', 'accreditation'], ['Profile only for now', 'close']],
  },
  discovery: {
    stage: 'Needs discovery', goal: 'Find a useful supplier opening: price, backup, availability, or urgent volume.',
    say: 'We support batching plants with aggregates, sand, gravel, hauling, equipment leasing, and related supply support. I’d like to understand where a second supplier could be useful.',
    ask: 'Which materials or support services do you source most often, and are you open to an additional supplier?',
    yes: 'Move to quantities, delivery location, and commercial requirements.',
    objection: 'Do not attack the incumbent supplier—position your company as backup capacity and price comparison.',
    capture: 'Materials, current supplier situation, openness to alternatives.',
    choices: [['Open to suppliers', 'requirements'], ['Already has supplier', 'objection'], ['Asks price immediately', 'priceImmediate']],
  },
  objection: {
    stage: 'Existing supplier objection', goal: 'Earn backup-supplier permission without forcing replacement.',
    say: 'That makes sense. We do not need to replace a working supplier. We can simply be your backup for urgent volume, availability, or price comparison.',
    ask: 'Would it help to keep our profile and a reference quotation on file?',
    yes: 'Capture one representative requirement and send the profile.',
    objection: 'Respect the no; ask permission for one profile email and a future check-in.',
    capture: 'Reason for loyalty, backup interest, future timing.',
    choices: [['Open to backup', 'requirements'], ['Send profile only', 'emailFirst'], ['Not interested', 'close']],
  },
  priceImmediate: {
    stage: 'Price-first path', goal: 'Avoid guessing a price before delivery and volume are known.',
    say: 'I can request our best price, but I want it to be accurate rather than a random number.',
    ask: 'What material, volume, and delivery location should the price cover? Do you have a target or current buying range?',
    yes: 'Capture the facts, then confirm when pricing will be returned.',
    objection: 'If they will not share price, record “best delivered price requested” in notes.',
    capture: 'Material, volume, delivery location, target/range or missing-price explanation.',
    choices: [['Requirements shared', 'requirements'], ['Best price only', 'profile'], ['Needs formal RFQ', 'accreditation']],
  },
  requirements: {
    stage: 'Quotation facts', goal: 'Capture enough detail for Pricing Desk to compute a useful price.',
    say: 'To make the quotation relevant, I’ll confirm the requirement before I send it for pricing.',
    ask: 'What aggregate or material type, volume, confirmed delivery location, target/current price, and sample or document requirement should we use?',
    yes: 'Repeat the facts back, then mark each captured field.',
    objection: 'If price is confidential, ask for a range or record why it is unavailable.',
    capture: 'Material, volume, delivery, price, sample/docs.',
    choices: [['Details provided', 'profile'], ['Price not disclosed', 'price'], ['Asks for samples', 'sample'], ['Needs vendor accreditation', 'accreditation']],
  },
  price: {
    stage: 'Missing-price path', goal: 'Get a usable benchmark without pressuring them to disclose confidential data.',
    say: 'No problem if the exact price is confidential. We can still submit our best delivered offer.',
    ask: 'Is there a range we should beat, or should I note that your team requested our best price?',
    yes: 'Record the range or exact wording in Target Price or Notes.',
    objection: 'Do not keep pushing; the explanation in Notes satisfies the handoff gate.',
    capture: 'Target range or missing-price explanation.',
    choices: [['Range shared', 'profile'], ['Best price requested', 'profile']],
  },
  sample: {
    stage: 'Sample request', goal: 'Clarify the sample, test standard, quantity, and destination.',
    say: 'We can coordinate samples. I’ll make sure the technical and delivery details are complete first.',
    ask: 'What sample quantity, specification, test document, and delivery address do you require?',
    yes: 'Mark Sample Required and list every document or test requirement.',
    objection: 'If specifications are not ready, schedule the person who can provide them.',
    capture: 'Sample quantity, specification, documents, delivery contact.',
    choices: [['Requirements captured', 'profile'], ['Accreditation first', 'accreditation']],
  },
  accreditation: {
    stage: 'Vendor accreditation', goal: 'Turn compliance questions into a concrete document checklist.',
    say: 'We can prepare the vendor documents. I’ll record the exact list so we submit a complete pack once.',
    ask: 'Which accreditation form, permits, company documents, and product test results are mandatory?',
    yes: 'Capture each document and the receiving email or portal.',
    objection: 'Ask which single document should be submitted first to start evaluation.',
    capture: 'Document list, process owner, submission channel, deadline.',
    choices: [['Document list received', 'profile'], ['Email instructions first', 'emailFirst']],
  },
  profile: {
    stage: 'Profile and next step', goal: 'Send the profile and secure a specific follow-up.',
    say: 'I’ll send our company profile today for reference and record the requirement for pricing.',
    ask: 'May I use this email, and when would be a good time to follow up?',
    yes: 'Mark Profile Sent, confirm the next date, and prepare the pricing handoff.',
    objection: 'Send the profile anyway when an email is available, then choose a light follow-up date.',
    capture: 'Email, profile status, follow-up date, quotation status.',
    choices: [['Quotation requested', 'close'], ['Profile only', 'close'], ['Sample requested', 'sample']],
  },
  close: {
    stage: 'Close', goal: 'End with a clear next action and accurate CRM state.',
    say: 'Thank you. I’ll send what we agreed, update the request, and make sure the next person follows through.',
    ask: 'Before I go, is there anyone else who should be copied or one deadline I should note?',
    yes: 'Add the contact or deadline, then Save Call & Start Next Lead.',
    objection: 'Keep the close short and respectful.',
    capture: 'Final result, next action, deadline, copied contacts.',
    choices: [],
  },
}

export function ConversationCoach({ lead, onChoose, compact = false }) {
  const current = nodes[lead.conversationNode] || nodes.opening
  return (
    <div className={`conversation-coach ${compact ? 'compact' : ''}`}>
      <div className="coach-head"><div><span>{current.stage}</span><p><Target size={12} />{current.goal}</p></div><button onClick={() => onChoose('opening', 'Conversation reset', true)}><RotateCcw size={13} />Reset</button></div>
      <blockquote><small>Say this</small><p>“{current.say}”</p></blockquote>
      <div className="coach-tactics"><p><span>Ask this</span>{current.ask}</p><p><span>If yes</span>{current.yes}</p><p><span>If they object</span>{current.objection}</p><p><span>Capture in CRM</span>{current.capture}</p></div>
      {current.choices.length ? <div className="coach-choices"><span>Choose the path</span>{current.choices.map(([label, next]) => <button key={label} onClick={() => onChoose(next, label)}>{label}</button>)}</div> : <div className="coach-finish">Flow complete—record the result, save, and move to the next lead.</div>}
      {lead.conversationPath?.length ? <div className="coach-path"><span>Path</span>{lead.conversationPath.slice(-4).map((item, index) => <i key={`${item}-${index}`}>{index ? '→' : <ArrowLeft size={10} />}{item}</i>)}</div> : null}
    </div>
  )
}
