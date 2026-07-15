import { Box, Command, FileText, Globe2, List, ListTodo, RefreshCcw, Target, Users } from 'lucide-react'

const items = [['mission', Target, 'Mission'], ['manager', Command, 'Command'], ['tasks', ListTodo, 'Tasks'], ['queue', List, 'Queue'], ['quotes', Box, 'Quotes'], ['conversion', RefreshCcw, 'Follow-ups'], ['finder', Globe2, 'Find'], ['crm', FileText, 'CRM'], ['team', Users, 'Team']]

export function MobileNav({ activeView, onViewChange, showManager = true }) {
  return <nav className="mobile-nav">{items.filter(([id]) => id !== 'manager' || showManager).map(([id, Icon, label]) => <button key={id} className={activeView === id ? 'active' : ''} onClick={() => onViewChange(id)}><Icon size={18} /><span>{label}</span></button>)}</nav>
}
