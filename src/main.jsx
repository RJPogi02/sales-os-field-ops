import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import App from './App.jsx'
import { fetchTeamBootstrap } from './lib/teamBootstrap.js'
import './styles.css'
import './v0082.css'
import './v009.css'

async function start() {
  let hostedTeamConfig = null
  try {
    hostedTeamConfig = await fetchTeamBootstrap()
  } catch {
    // Desktop, GitHub Pages, and local packages keep the manual/local fallback.
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App hostedTeamConfig={hostedTeamConfig} />
    </StrictMode>,
  )
}

start()
