import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import './styles/theme.css'
import { AuthProvider } from './hooks/useAuth'
import ProtectedRoute from './pages/ProtectedRoute.tsx'
import Landing from './pages/Landing'
import LoginPage from './pages/LoginPage.tsx'
import SignupPage from './pages/SignupPage.tsx'
import CreateRoomPage from './pages/CreateRoomPage.tsx'
import JoinPage from './pages/JoinPage.tsx'
import Dashboard from './Dashboard'
import RoomPage from './pages/RoomPage.tsx'
import ReplayPage from './pages/ReplayPage.tsx'

// Routes:
//   /                          landing
//   /login, /signup            auth
//   /dashboard                 interviewer only - past rated sessions (Day 39/40)
//   /rooms/new                 interviewer only - create a session, get a shareable link
//   /join/:joinCode            any signed-in user - resolves the link, then enters the room
//   /room/:joinCode            the live editor/video/run screen (unchanged since Day 19)
//   /replay/:joinCode?recordingId=  session replay (unchanged since Day 25/39)
createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />

                    <Route element={<ProtectedRoute role="INTERVIEWER" />}>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/rooms/new" element={<CreateRoomPage />} />
                    </Route>

                    <Route element={<ProtectedRoute />}>
                        <Route path="/join/:joinCode" element={<JoinPage />} />
                        <Route path="/room/:joinCode" element={<RoomPage />} />
                        <Route path="/replay/:joinCode" element={<ReplayPage />} />
                    </Route>

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    </StrictMode>,
)