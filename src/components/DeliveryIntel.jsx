import { Check, Crosshair, LocateFixed, MapPin, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { coordinatesForLocation, distanceIntelligence } from '../lib/leadModel.js'
import { TerritoryMap } from './TerritoryMap.jsx'

export function DeliveryIntel({ lead, userLocation, onUpdateLead, compact = false }) {
  const [search, setSearch] = useState(lead.deliveryLocation || '')
  useEffect(() => setSearch(lead.deliveryLocation || ''), [lead.id, lead.deliveryLocation])
  const distances = useMemo(() => distanceIntelligence(lead, userLocation.position), [lead, userLocation.position])

  const searchLocation = () => {
    const point = coordinatesForLocation(search, lead.region)
    if (!point) return
    onUpdateLead({
      deliveryLocation: search,
      deliveryLatitude: point[0],
      deliveryLongitude: point[1],
      deliveryLocationConfirmed: false,
    }, 'Delivery/project location searched', search)
  }

  return (
    <section className={`delivery-intel ${compact ? 'compact' : ''}`}>
      <header><div><MapPin size={18} /><span>Delivery & distance intelligence</span></div><strong>{lead.deliveryLocationConfirmed ? 'CONFIRMED' : 'NEEDS CONFIRMATION'}</strong></header>
      <div className="delivery-search"><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && searchLocation()} placeholder="Search project, barangay, city, or delivery address" /><button onClick={searchLocation}><Search size={16} />Plot location</button></div>
      <button className={`delivery-confirm ${lead.deliveryLocationConfirmed ? 'complete' : ''}`} disabled={!lead.deliveryLocation} onClick={() => onUpdateLead({ deliveryLocationConfirmed: !lead.deliveryLocationConfirmed }, lead.deliveryLocationConfirmed ? 'Delivery location confirmation reopened' : 'Delivery location confirmed', lead.deliveryLocation)}>{lead.deliveryLocationConfirmed ? <Check size={16} /> : <i />}{lead.deliveryLocationConfirmed ? 'Delivery/project location confirmed' : 'Confirm this delivery/project location'}</button>
      <TerritoryMap compact leads={[lead]} selectedLead={lead} territory={lead.region} userPosition={userLocation.position} />
      <div className="distance-cards">
        <article><span>You → lead</span><strong>{distances.userToLead === null ? 'Enable location' : `${distances.userToLead.toFixed(distances.userToLead < 10 ? 1 : 0)} km`}</strong></article>
        <article><span>Lead → delivery</span><strong>{distances.leadToDelivery === null ? 'Plot delivery' : `${distances.leadToDelivery.toFixed(distances.leadToDelivery < 10 ? 1 : 0)} km`}</strong></article>
        <article><span>You → delivery</span><strong>{distances.userToDelivery === null ? 'Enable location' : `${distances.userToDelivery.toFixed(distances.userToDelivery < 10 ? 1 : 0)} km`}</strong></article>
      </div>
      <button className="enable-location" onClick={userLocation.enable}>{userLocation.enabled ? <Crosshair size={15} /> : <LocateFixed size={15} />}{userLocation.enabled ? `Live location ${userLocation.status}` : 'Enable my live location'}</button>
      <p>Local geocoder estimate. Verify the exact delivery point during the call before Pricing Desk pricing.</p>
    </section>
  )
}
