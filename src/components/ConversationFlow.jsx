import { ArrowLeft, CircleHelp, RotateCcw, Target } from 'lucide-react'
import { useMemo, useState } from 'react'
import { defaultCompanyProfile } from '../config/companyProfile.js'
import { buildConversationFlow } from '../lib/conversationFlow.js'

export function ConversationFlow({ lead, onChoose, companyProfile = defaultCompanyProfile, operatorProfile = {}, compact = false }) {
  const [showWhy, setShowWhy] = useState(false)
  const flow = useMemo(
    () => buildConversationFlow(lead, companyProfile, operatorProfile),
    [companyProfile, lead, operatorProfile],
  )
  const current = flow.nodes[lead.conversationNode] || flow.nodes.opening
  const researchMode = current.kind === 'research'

  return (
    <div className={`conversation-coach conversation-flow ${compact ? 'compact' : ''}`}>
      <div className="coach-head flow-head">
        <div>
          <span>{current.stage}</span>
          <p><Target size={12} />{current.goal}</p>
          <small className="flow-context">{flow.context.vertical.replaceAll('-', ' ')} · {flow.context.statusMode.replaceAll('-', ' ')} · {researchMode ? 'call blocked until verified' : `opening ${flow.openingSeconds}s`}</small>
        </div>
        <div className="flow-head-actions">
          <button type="button" className={showWhy ? 'active' : ''} onClick={() => setShowWhy((value) => !value)} aria-expanded={showWhy}><CircleHelp size={13} />Why this line</button>
          <button type="button" onClick={() => onChoose('opening', 'Conversation reset', true)}><RotateCcw size={13} />Reset</button>
        </div>
      </div>
      {showWhy ? <aside className="flow-reason"><CircleHelp size={14} /><p><strong>Grounded guidance</strong>{current.why}</p></aside> : null}
      <blockquote><small>{researchMode ? 'Do this before calling' : 'Say this'}</small><p>{researchMode ? current.say : `“${current.say}”`}</p></blockquote>
      <div className="coach-tactics"><p><span>{researchMode ? 'Check these sources' : 'Ask this'}</span>{current.ask}</p><p><span>{researchMode ? 'When verified' : 'If yes'}</span>{current.yes}</p><p><span>{researchMode ? 'If unresolved' : 'If they object'}</span>{current.objection}</p><p><span>Capture in CRM</span>{current.capture}</p></div>
      {current.choices.length ? <div className="coach-choices"><span>Choose the path</span>{current.choices.map(([label, next]) => <button type="button" key={label} onClick={() => onChoose(next, label)}>{label}</button>)}</div> : <div className="coach-finish">Flow complete—record the result, save, and move to the next lead.</div>}
      {lead.conversationPath?.length ? <div className="coach-path"><span>Path</span>{lead.conversationPath.slice(-4).map((item, index) => <i key={`${item}-${index}`}>{index ? '→' : <ArrowLeft size={10} />}{item}</i>)}</div> : null}
    </div>
  )
}
