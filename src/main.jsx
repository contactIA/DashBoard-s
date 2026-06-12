import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AdminApp from './admin/AdminApp.jsx'

const isSetup = window.location.pathname.startsWith('/setup')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isSetup ? <AdminApp /> : <App />}
  </StrictMode>,
)
