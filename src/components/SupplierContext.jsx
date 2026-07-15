import { AlertTriangle, Database, MapPinned } from 'lucide-react'
import { seedSuppliers } from '../data/suppliers.js'
import { sourceContextForLead } from '../lib/leadModel.js'

export function SupplierContext({ lead, companyProfile = {}, compact = false }) {
  const approverLabel = companyProfile.approverLabel || 'the pricing approver'
  const context = sourceContextForLead(lead, seedSuppliers, approverLabel)
  const material = (lead.materialNeeded || '').toLowerCase()
  const matches = seedSuppliers
    .map((supplier) => ({
      supplier,
      score: (supplier.region === lead.region ? 2 : 0) + (supplier.materialType.some((item) => material && (material.includes(item.toLowerCase()) || item.toLowerCase().includes(material))) ? 3 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, compact ? 1 : 3)

  return (
    <section className={`supplier-context ${compact ? 'compact' : ''}`}>
      <header><span><Database size={15} />Possible source context</span><em>Reference only</em></header>
      <p className="source-summary">{context}</p>
      <div className="source-matches">
        {matches.map(({ supplier }) => <article key={supplier.id}>
          <i><MapPinned size={14} /></i>
          <div><strong>{supplier.supplierName}</strong><span>{supplier.materialType.join(' · ')}</span><small>{supplier.location} · {supplier.status}</small></div>
        </article>)}
      </div>
      <footer><AlertTriangle size={13} />Reference only. Final quote requires {approverLabel}.</footer>
    </section>
  )
}
