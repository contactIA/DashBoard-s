import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AdminApp from './admin/AdminApp.jsx'

const isOnboarding = window.location.pathname.startsWith('/onboarding')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isOnboarding ? <AdminApp /> : <App />}
  </StrictMode>,
)
