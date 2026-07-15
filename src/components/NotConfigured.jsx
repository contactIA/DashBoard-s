import { useState } from 'react'
import { setSecret, listClinics } from '../admin/adminApi'

const ToothIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path
      d="M7 3c-2.2 0-3.5 1.8-3.5 4 0 1.7.5 3 .9 4.5.3 1.2.4 2.3.5 3.5.2 2.1.3 4 1.6 5.5.6.7 1.5 1.2 2.3.5.7-.6.7-1.8.8-2.9.1-1.3.4-2.7 1.4-2.7s1.3 1.4 1.4 2.7c.1 1.1.1 2.3.8 2.9.8.7 1.7.2 2.3-.5 1.3-1.5 1.4-3.4 1.6-5.5.1-1.2.2-2.3.5-3.5.4-1.5.9-2.8.9-4.5 0-2.2-1.3-4-3.5-4-1.6 0-2.6.9-3.5 1.5-.4.3-.7.5-1 .5s-.6-.2-1-.5C9.6 3.9 8.6 3 7 3z"
      stroke="white" strokeWidth="1.5" fill="white" fillOpacity="0.2"
    />
  </svg>
)

export default function NotConfigured({ slug }) {
  const [showAdmin, setShowAdmin] = useState(false)
  const [pw,        setPw]        = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)

  const enter = async (e) => {
    e.preventDefault()
    setLoading(true); setError(null)
    setSecret(pw)
    try {
      await listClinics()           // valida a senha antes de redirecionar
      window.location.href = '/setup'
    } catch (err) {
      setError(err.status === 401 ? 'Senha incorreta.' : err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-red-500 flex items-center justify-center mx-auto mb-5">
          <ToothIcon />
        </div>

        <h1 className="text-xl font-bold text-slate-900">Dashboard não disponível</h1>
        <p className="text-slate-500 mt-2 text-sm leading-relaxed">
          {slug
            ? <>A clínica <code className="bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded font-mono text-xs">{slug}</code> ainda não foi configurada.</>
            : 'Nenhuma clínica foi informada para este dashboard.'}
          <br />Entre em contato com o seu administrador.
        </p>

        {!showAdmin ? (
          <button
            onClick={() => setShowAdmin(true)}
            className="mt-6 text-sm text-slate-500 hover:text-slate-900 underline underline-offset-4 decoration-slate-300"
          >
            Sou o administrador
          </button>
        ) : (
          <form onSubmit={enter} className="mt-6 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm text-left">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Senha de administrador</span>
              <input
                type="password" value={pw} onChange={e => setPw(e.target.value)}
                placeholder="Senha admin" autoFocus autoComplete="current-password"
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
            </label>
            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
            <div className="flex items-center justify-between gap-2 mt-4">
              <button type="button" onClick={() => { setShowAdmin(false); setError(null); setPw('') }}
                className="text-xs text-slate-400 hover:text-slate-700">
                Voltar
              </button>
              <button type="submit" disabled={loading || !pw}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40">
                {loading ? 'Verificando...' : 'Acessar setup →'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
