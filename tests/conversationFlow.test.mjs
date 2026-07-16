import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultCompanyProfile } from '../src/config/companyProfile.js'
import {
  buildConversationFlow,
  detectPriorObjection,
  inferLeadVertical,
  leadStatusMode,
} from '../src/lib/conversationFlow.js'

test('new batching lead gets a concise verified procurement opening', () => {
  const company = { ...defaultCompanyProfile, shortName: 'Sample Supply', quarryLocations: ['North Hub'] }
  const flow = buildConversationFlow({ company: 'Sample Ready Mix', status: 'New Lead' }, company, { name: 'Alex' })
  assert.equal(flow.context.vertical, 'ready-mix')
  assert.match(flow.nodes.opening.say, /Alex from Sample Supply/i)
  assert.match(flow.nodes.opening.say, /owned quarry operations in North Hub/i)
  assert.equal(flow.nodes.opening.say.includes('100'), false)
  assert.ok(flow.openingSeconds < 15, `expected a sub-15-second opening, got ${flow.openingSeconds}s`)
  assert.match(flow.nodes.opening.why, /Company Profile/i)
})

test('prior supplier objection changes the next question to backup and overflow framing', () => {
  const lead = { company: 'Existing Buyer', status: 'Contacted', notes: 'Already has a regular existing supplier.' }
  const flow = buildConversationFlow(lead)
  assert.equal(detectPriorObjection(lead), 'existing-supplier')
  assert.equal(leadStatusMode(lead), 'follow-up')
  assert.match(flow.nodes.opening.ask, /backup or overflow supplier/i)
  assert.match(flow.nodes.objection.say, /do not need to replace/i)
})

test('vertical inference and configurable approver shape the flow without changing state keys', () => {
  assert.equal(inferLeadVertical({ businessType: 'hardware distributor' }), 'hardware-distributor')
  const flow = buildConversationFlow(
    { company: 'Buildmart Hardware', conversationNode: 'requirements', status: 'Profile Sent', profileSent: true },
    { ...defaultCompanyProfile, approverLabel: 'Pricing Manager', shortName: 'Field Supply' },
    { name: 'Ana' },
  )
  assert.match(flow.nodes.requirements.goal, /Pricing Manager/i)
  assert.match(flow.nodes.opening.say, /following up on the profile/i)
  assert.ok(flow.nodes.requirements.choices.some(([, next]) => next === 'profile'))
})

test('Needs Research leads receive a data-repair workflow instead of cold-call guidance', () => {
  const lead = {
    company: 'Incomplete Plant',
    status: 'New Lead',
    researchStatus: 'Needs Research',
    verificationStatus: 'Needs Research',
    researchNotes: 'Phone source could not be confirmed.',
  }
  const flow = buildConversationFlow(lead)

  assert.equal(leadStatusMode(lead), 'research')
  assert.equal(flow.callable, false)
  assert.equal(flow.openingSeconds, 0)
  assert.equal(flow.nodes.opening.kind, 'research')
  assert.match(flow.nodes.opening.stage, /research \/ data repair/i)
  assert.match(flow.nodes.opening.say, /pause outreach/i)
  assert.match(flow.nodes.opening.yes, /verify \+ call queue/i)
  assert.doesNotMatch(flow.nodes.opening.say, /supplier|procurement/i)
})
