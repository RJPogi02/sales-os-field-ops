import { CheckCircle2, Clock3 } from 'lucide-react'

export function ActivityTimeline({ items = [], limit = 8, compact = false }) {
  const visible = items.slice(0, limit)
  return (
    <section className={`activity-timeline ${compact ? 'compact' : ''}`}>
      <header><span>Activity timeline</span><strong>{items.length} events</strong></header>
      <div>
        {visible.map((item, index) => (
          <article key={item.id || `${item.at}-${index}`}>
            <i>{index === 0 ? <CheckCircle2 size={15} /> : <Clock3 size={14} />}</i>
            <time>{new Date(item.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>
            <strong>{item.action}</strong>
            {item.detail ? <span>{item.detail}</span> : null}
          </article>
        ))}
        {!visible.length ? <p>No activity yet. Start a call to build the lead history.</p> : null}
      </div>
    </section>
  )
}
