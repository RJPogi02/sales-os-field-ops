import { Box, FileText, Globe2, List, RefreshCcw, Target } from 'lucide-react'

const items = [['mission', Target, 'Mission'], ['queue', List, 'Queue'], ['quotes', Box, 'Quotes'], ['conversion', RefreshCcw, 'Follow-ups'], ['finder', Globe2, 'Find'], ['crm', FileText, 'CRM']]

export function MobileNav({ activeView, onViewChange }) {
  return <nav className="mobile-nav">{items.map(([id, Icon, label]) => <button key={id} className={activeView === id ? 'active' : ''} onClick={() => onViewChange(id)}><Icon size={18} /><span>{label}</span></button>)}</nav>
}
