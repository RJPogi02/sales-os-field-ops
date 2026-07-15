import { useEffect, useMemo } from 'react'
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import { coordinatesForLead, coordinatesForLocation, deliveryCoordinatesForLead, distanceKm, territoryCenter } from '../lib/leadModel.js'

const MAX_SERVICE_AREA_DISTANCE_KM = 1000

function plausiblePoint(point, territory = 'ALL') {
  if (!point || point.length !== 2 || !point.every(Number.isFinite)) return null
  const distanceFromTerritory = distanceKm(point, territoryCenter(territory))
  return distanceFromTerritory !== null && distanceFromTerritory <= MAX_SERVICE_AREA_DISTANCE_KM ? point : null
}

function safeLeadPoint(lead) {
  const storedPoint = plausiblePoint(coordinatesForLead(lead), lead.region)
  if (storedPoint) return storedPoint
  return coordinatesForLocation(`${lead.company} ${lead.location}`, lead.region) || territoryCenter(lead.region)
}

function safeDeliveryPoint(lead) {
  const storedPoint = plausiblePoint(deliveryCoordinatesForLead(lead), lead.region)
  if (storedPoint) return storedPoint
  return coordinatesForLocation(lead.deliveryLocation, lead.region)
}

function MapSync({ points, territory }) {
  const map = useMap()
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [18, 18], maxZoom: 10 })
    else map.setView(points[0] || territoryCenter(territory), territory === 'NCR' ? 10 : 7)
  }, [map, points, territory])
  return null
}

export function TerritoryMap({ leads, selectedLead, territory, userPosition, onOpenLead = () => {}, compact = false, operationalOverview = false }) {
  const mapped = useMemo(() => leads.map((lead) => ({ lead, point: safeLeadPoint(lead) })), [leads])
  const selectedPoint = selectedLead ? safeLeadPoint(selectedLead) : null
  const deliveryPoint = !operationalOverview && selectedLead ? safeDeliveryPoint(selectedLead) : null
  const safeUserPosition = plausiblePoint(userPosition)
  const syncPoints = useMemo(() => {
    const points = mapped.map((item) => item.point)
    if (safeUserPosition && !operationalOverview) points.push(safeUserPosition)
    if (deliveryPoint) points.push(deliveryPoint)
    return points
  }, [deliveryPoint, mapped, operationalOverview, safeUserPosition])
  const userToLead = distanceKm(safeUserPosition, selectedPoint)
  const leadToDelivery = distanceKm(selectedPoint, deliveryPoint)
  const userToDelivery = distanceKm(safeUserPosition, deliveryPoint)
  const formatDistance = (value) => value === null ? '' : `${value.toFixed(value < 10 ? 1 : 0)} km`

  return (
    <div className={`territory-map-wrap ${compact ? 'compact' : ''}`}>
      <MapContainer center={territoryCenter(territory)} zoom={territory === 'NCR' ? 10 : 7} zoomControl={false} attributionControl className="territory-map">
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapSync points={syncPoints} territory={territory} />
        {mapped.map(({ lead, point }) => (
          <CircleMarker key={lead.id} center={point} radius={lead.id === selectedLead?.id ? 7 : 4} pathOptions={{ color: lead.id === selectedLead?.id ? '#d54d16' : '#7c6a52', fillColor: lead.quoteReady ? '#567a48' : '#d97943', fillOpacity: .85, weight: lead.id === selectedLead?.id ? 3 : 1 }} eventHandlers={{ click: () => onOpenLead(lead.id) }}>
            <Popup><strong>{lead.company}</strong><br />{lead.location || `${lead.region} · approximate`}<br /><small>{lead.phone || 'No phone'}</small></Popup>
          </CircleMarker>
        ))}
        {safeUserPosition && !operationalOverview ? <CircleMarker center={safeUserPosition} radius={7} pathOptions={{ color: '#194f72', fillColor: '#2f8fc4', fillOpacity: .95, weight: 3 }}><Popup>Your live location</Popup></CircleMarker> : null}
        {deliveryPoint ? <CircleMarker center={deliveryPoint} radius={8} pathOptions={{ color: '#f5b844', fillColor: '#ffcf67', fillOpacity: .95, weight: 3 }}><Popup><strong>Delivery / project location</strong><br />{selectedLead.deliveryLocation}<br /><small>{selectedLead.deliveryLocationConfirmed ? 'Confirmed' : 'Needs confirmation'}</small></Popup></CircleMarker> : null}
        {safeUserPosition && selectedPoint && !operationalOverview ? <Polyline positions={[safeUserPosition, selectedPoint]} pathOptions={{ color: '#2f8fc4', dashArray: '5 7', weight: 2, opacity: .75 }} /> : null}
        {selectedPoint && deliveryPoint ? <Polyline positions={[selectedPoint, deliveryPoint]} pathOptions={{ color: '#f0a52a', dashArray: '6 6', weight: 2, opacity: .8 }} /> : null}
      </MapContainer>
      <div className="map-legend"><span><i className="lead-dot" />{mapped.length} leads</span>{!operationalOverview && userToLead !== null ? <span>You → lead {formatDistance(userToLead)}</span> : null}{!operationalOverview && leadToDelivery !== null ? <span>Lead → delivery {formatDistance(leadToDelivery)}</span> : null}{!operationalOverview && userToDelivery !== null ? <span>You → delivery {formatDistance(userToDelivery)}</span> : null}{operationalOverview || (userToLead === null && leadToDelivery === null) ? <span>Locations reflect CRM precision</span> : null}</div>
    </div>
  )
}
