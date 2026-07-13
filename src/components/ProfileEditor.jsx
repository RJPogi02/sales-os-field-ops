import { Camera, X } from 'lucide-react'
import { useRef } from 'react'

async function resizeAvatar(file) {
  const source = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 320
  const context = canvas.getContext('2d')
  const scale = Math.max(320 / source.width, 320 / source.height)
  const width = source.width * scale
  const height = source.height * scale
  context.drawImage(source, (320 - width) / 2, (320 - height) / 2, width, height)
  source.close()
  return canvas.toDataURL('image/jpeg', .82)
}

export function ProfileEditor({ profile, onChange, onClose }) {
  const fileRef = useRef(null)
  const setField = (field, value) => onChange({ ...profile, [field]: value })

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="profile-modal panel" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <header><div><span className="section-label">Operator profile</span><h2 id="profile-title">Make Sales OS yours.</h2></div><button onClick={onClose} aria-label="Close profile editor"><X size={18} /></button></header>
        <div className="profile-form">
          <button className="profile-photo-control" onClick={() => fileRef.current?.click()}>
            {profile.photo ? <img src={profile.photo} alt="Operator" /> : <span>{profile.initials || 'DO'}</span>}
            <i><Camera size={15} />Change photo</i>
          </button>
          <input ref={fileRef} hidden type="file" accept="image/*" onChange={async (event) => {
            const file = event.target.files?.[0]
            if (file) setField('photo', await resizeAvatar(file))
          }} />
          <div className="profile-fields">
            <label><span>Display name</span><input value={profile.name} onChange={(event) => setField('name', event.target.value)} /></label>
            <label><span>Initials</span><input maxLength={3} value={profile.initials} onChange={(event) => setField('initials', event.target.value.toUpperCase())} /></label>
            <label><span>Company</span><input value={profile.company} onChange={(event) => setField('company', event.target.value)} /></label>
            <label><span>Position</span><input value={profile.position} onChange={(event) => setField('position', event.target.value)} /></label>
            <label><span>Email</span><input type="email" value={profile.email} onChange={(event) => setField('email', event.target.value)} /></label>
            <label><span>Phone</span><input value={profile.phone} onChange={(event) => setField('phone', event.target.value)} /></label>
            <label><span>Territory focus</span><select value={profile.territoryFocus || 'ALL'} onChange={(event) => setField('territoryFocus', event.target.value)}><option value="ALL">All territories</option><option value="NCR">NCR</option><option value="NORTH">North Luzon</option><option value="SOUTH">South Luzon</option></select></label>
            <label><span>Preferred theme</span><select value={profile.preferredTheme || 'glass'} onChange={(event) => setField('preferredTheme', event.target.value)}><option value="field">Light</option><option value="midnight">Dark</option><option value="glass">Liquid Glass</option><option value="frosted">Frosted Glass</option></select></label>
            <label><span>Current sales goal</span><input value={profile.currentSalesGoal || ''} onChange={(event) => setField('currentSalesGoal', event.target.value)} placeholder="e.g. 5 quote-ready leads daily" /></label>
            <label><span>Rank title</span><input value={profile.rankTitle || ''} onChange={(event) => setField('rankTitle', event.target.value)} placeholder="Leave blank to use earned rank" /></label>
            <label><span>Motivational quote / battle cry</span><input value={profile.battleCry || ''} onChange={(event) => setField('battleCry', event.target.value)} placeholder="One call at a time." /></label>
            <label><span>Commission / reward goal</span><input value={profile.commissionGoal || ''} onChange={(event) => setField('commissionGoal', event.target.value)} placeholder="The reward you are working toward" /></label>
          </div>
        </div>
        <footer><p>Saved locally on this computer.</p><button className="primary-action" onClick={onClose}>Save profile</button></footer>
      </section>
    </div>
  )
}
