import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { Landing } from './pages/Landing.tsx'
import { Onboarding } from './pages/Onboarding.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { RequireAuth } from './components/RequireAuth.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/app" element={<RequireAuth><App /></RequireAuth>} />
          <Route path="/app/*" element={<RequireAuth><App /></RequireAuth>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
