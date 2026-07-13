import { Building2, Compass, Network, Rocket } from 'lucide-react'
import { classForXp } from '../lib/leadModel.js'

const TIER_ICONS = { 1: Compass, 2: Rocket, 3: Network, 4: Building2 }

export function OperatorCompanion({ xp = 0, mode = 'idle', size = 'full', showLabel = true, reducedMotion = false }) {
  const operatorClass = classForXp(xp)
  const Icon = TIER_ICONS[operatorClass.tier] || Compass
  const assetTier = Math.max(2, operatorClass.tier)
  const safeMode = mode === 'rank-up' && assetTier === 4 ? 'xp' : mode
  const asset = `/companion/tier-${assetTier}/${safeMode}.gif`
  return (
    <div className={`operator-companion companion-${size} companion-${mode}`} aria-label={`${operatorClass.title} companion, tier ${operatorClass.tier}`}>
      <div className="companion-visual"><span className="companion-orbit" />{reducedMotion ? <span className="companion-core"><Icon size={size === 'tiny' ? 15 : size === 'minimal' ? 20 : size === 'pet' ? 42 : 30} /></span> : <img src={asset} alt="" />}<i>T{operatorClass.tier}</i></div>
      {showLabel && size !== 'tiny' ? <div><span>Operator class</span><strong>{operatorClass.title}</strong><small>{operatorClass.nextTitle === 'Mastery' ? 'Top class reached' : `${Math.max(0, operatorClass.nextXp - xp).toLocaleString()} XP to ${operatorClass.nextTitle}`}</small></div> : null}
    </div>
  )
}
