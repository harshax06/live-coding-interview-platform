import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ReplayPlayer from './ReplayPlayer.tsx'
import Dashboard from './Dashboard.tsx'

// No router yet - the URL picks the screen:
//   /?room=<code>                        live editor in that room   (no parameter = "default-room")
//   /?replay=<code>                      replay of that room's recorded session (latest recording)
//   /?replay=<code>&recordingId=<id>     replay of one specific recording (from the dashboard)
//   /?dashboard=1                        the interviewer's list of past rated sessions
const params = new URLSearchParams(window.location.search)
const replayRoom = params.get('replay')
const showDashboard = params.get('dashboard') != null

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        {showDashboard
            ? <Dashboard />
            : replayRoom
                ? <ReplayPlayer roomCode={replayRoom} initialRecordingId={params.get('recordingId') ?? undefined} />
                : <App roomJoinCode={params.get('room') ?? undefined} />}
    </StrictMode>,
)