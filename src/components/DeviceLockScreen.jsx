import { Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'

export function DeviceLockScreen({ operatorName = 'Operator', company = '', theme = 'glass', onUnlock, onReset }) {
  const [pin, setPin] = useState('')
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (!pin) return setError('Enter your PIN.')
    setWorking(true)
    setError('')
    try {
      const accepted = await onUnlock?.(pin)
      if (!accepted) {
        setPin('')
        setError('That PIN did not match. Try again.')
      }
    } catch (unlockError) {
      setError(unlockError?.message || 'Sales OS could not verify this PIN.')
    } finally {
      setWorking(false)
    }
  }

  return <main className={`device-lock-screen theme-${theme}`}>
    <div className="device-lock-ambient" aria-hidden="true"><i /><i /><i /></div>
    <section className="device-lock-card" aria-labelledby="device-lock-title">
      <header><span><LockKeyhole size={21} /></span><div><small>Sales OS · private session</small><strong>{company || 'Field Operations'}</strong></div></header>
      <div className="device-lock-copy"><span className="section-label">Welcome back</span><h1 id="device-lock-title">Unlock {operatorName}&rsquo;s cockpit.</h1><p>Your CRM remains in this browser. Enter the local device PIN to continue.</p></div>
      <form onSubmit={submit}>
        <label><span>Device PIN</span><div><KeyRound size={17} /><input type={visible ? 'text' : 'password'} inputMode="numeric" maxLength="8" value={pin} onChange={(event) => { setPin(event.target.value.replace(/\D/g, '')); setError('') }} placeholder="••••" autoFocus autoComplete="current-password" /><button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? 'Hide PIN' : 'Show PIN'}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
        {error ? <p className="device-lock-error" role="alert">{error}</p> : null}
        <button className="primary-action device-unlock-button" disabled={working || pin.length < 4}>{working ? 'Checking…' : 'Unlock Sales OS'}</button>
      </form>
      <div className="device-lock-trust"><ShieldCheck size={15} /><p><strong>Local privacy gate</strong><span>The PIN is not your team account and does not encrypt browser storage. Closing this tab locks the next session.</span></p></div>
      <button className="device-lock-reset" onClick={onReset}><Trash2 size={13} />Forgot PIN? Reset all local Sales OS data</button>
    </section>
  </main>
}
