import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ReplayPlayer from './ReplayPlayer.tsx'

// No router yet - the URL picks the screen:
//   /?room=<code>    live editor in that room   (no parameter = "default-room")
//   /?replay=<code>  replay of that room's recorded session
const params = new URLSearchParams(window.location.search)
const replayRoom = params.get('replay')

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        {replayRoom
            ? <ReplayPlayer roomCode={replayRoom} />
            : <App roomJoinCode={params.get('room') ?? undefined} />}
    </StrictMode>,
)