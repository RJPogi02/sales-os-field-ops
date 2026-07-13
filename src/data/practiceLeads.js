import { normalizeLead } from '../lib/leadModel.js'

export const practiceLeads = [
  {
    id: 'practice-north-star', company: 'North Star Ready Mix (Practice)', region: 'NORTH',
    location: 'Plaridel, Bulacan', phone: '0000 000 0401', email: 'purchasing@example.test',
    contactPerson: 'Maria Santos', contactRole: 'Purchasing', status: 'New Lead', priority: 'High',
  },
  {
    id: 'practice-cavite', company: 'Cavite BuildWorks (Practice)', region: 'SOUTH',
    location: 'General Trias, Cavite', phone: '0000 000 0402', email: '', status: 'New Lead', priority: 'Medium',
  },
  {
    id: 'practice-metro', company: 'Metro Concrete Lab (Practice)', region: 'NCR',
    location: 'Quezon City, Metro Manila', phone: '02 8000 3030', email: 'vendor@example.test', status: 'New Lead', priority: 'Medium',
  },
  {
    id: 'practice-research', company: 'Sunrise Aggregates (Practice)', region: 'NORTH',
    location: 'San Jose del Monte, Bulacan', phone: '', email: '', status: 'Invalid Contact', priority: 'Low',
    researchStatus: 'Needs Research', researchNotes: 'Practice repairing a missing contact before returning this lead to the call queue.',
  },
].map((lead) => normalizeLead({ ...lead, leadSource: 'Practice Mode', notes: 'Safe training lead. No real outreach.' }))
