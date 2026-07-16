import { useState, useEffect, Fragment } from 'react'
import { getSecret, setSecret, clearSecret, listClinics, deleteClinic, getSyncStatus } from './adminApi'
import { typeLabel } from './metricTypes'
import ClinicWizard from './ClinicWizard.jsx'
import ClinicorpImport from './ClinicorpImport.jsx'

const ToothIcon = ({ className = '' }) => (
  <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path
      d="M7 3c-2.2 0-3.5 1.8-3.5 4 0 1.7.5 3 .9 4.5.3 1.2.4 2.3.5 3.5.2 2.1.3 4 1.6 5.5.6.7 1.5 1.2 2.3.5.7-.6.7-1.8.8-2.9.1-1.3.4-2.7 1.4-2.7s1.3 1.4 1.4 2.7c.1 1.1.1 2.3.8 2.9.8.7 1.7.2 2.3-.5 1.3-1.5 1.4-3.4 1.6-5.5.1-1.2.2-2.3.5-3.5.4-1.5.9-2.8.9-4.5 0-2.2-1.3-4-3.5-4-1.6 0-2.6.9-3.5 1.5-.4.3-.7.5-1 .5s-.6-.2-1-.5C9.6 3.9 8.6 3 7 3z"
      stroke="white" strokeWidth="1.5" fill="white" fillOpacity="0.2"
    />
  </svg>
)

function LoginGate({ onAuthed }) {
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true); setError(null)
    setSecret(password)
    try {
      const { clinics } = await listClinics()
      onAuthed(clinics)
    } catch (err) {
      clearSecret()
      setError(err.status === 401 ? 'Senha incorreta.' : err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-8 w-full max-w-sm shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-red-500 flex items-center justify-center mb-4">
          <ToothIcon />
        </div>
        <h1 className="text-lg font-bold text-slate-900">Setup de clínicas</h1>
        <p className="text-sm text-slate-500 mt-1">Área restrita — informe a senha de administrador.</p>
        <input
          type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="Senha admin" autoFocus
          className="mt-4 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
        />
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        <button type="submit" disabled={loading || !password}
          className="mt-4 w-full py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40">
          {loading ? 'Verificando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}

const SYNC_BADGE = {
  green:  { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100', label: 'Sync ok' },
  yellow: { dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50 border-amber-100',     label: 'Pendências' },
  red:    { dot: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50 border-red-100',         label: 'Atenção' },
}

function fmtWhen(iso) {
  if (!iso) return 'nunca'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// Badge de saúde do sync (PLANO_AGENDADOR_CAMPANHA.md FASE 7) — verde (última
// rodada ok), amarelo (unmatchedCrc pendente), vermelho (failed>0 ou sem
// rodada há 2h+). Clique expande detalhes (última rodada + agregado 24h).
function SyncBadge({ status, expanded, onToggle }) {
  const s = SYNC_BADGE[status.status] ?? SYNC_BADGE.red
  return (
    <button type="button" onClick={onToggle}
      className={`text-[10px] px-1.5 py-0.5 rounded border font-medium flex items-center gap-1 ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
      <span className="text-slate-300">{expanded ? '▲' : '▼'}</span>
    </button>
  )
}

function SyncDetails({ status }) {
  return (
    <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-600 space-y-2">
      <div>
        <span className="font-semibold text-slate-700">Última rodada:</span>{' '}
        {fmtWhen(status.lastRun?.executedAt)}
        {status.lastRun && (
          <span className="text-slate-400"> · {status.lastRun.moved} movidos · {status.lastRun.created} criados · {status.lastRun.failed} falhas</span>
        )}
      </div>
      {status.lastRun?.errors?.length > 0 && (
        <div className="text-red-600">
          Erros: {status.lastRun.errors.slice(0, 3).join(' · ')}{status.lastRun.errors.length > 3 ? ` (+${status.lastRun.errors.length - 3})` : ''}
        </div>
      )}
      <div>
        <span className="font-semibold text-slate-700">Últimas 24h:</span>{' '}
        {status.last24h.runs} rodada{status.last24h.runs !== 1 ? 's' : ''} · {status.last24h.moved} movidos · {status.last24h.created} criados · {status.last24h.failed} falhas
      </div>
      {status.unmatchedCrc.length > 0 && (
        <div className="text-amber-600">
          CRC sem etiqueta mapeada: {status.unmatchedCrc.join(', ')}
        </div>
      )}
    </div>
  )
}

function ClinicList({ clinics, syncStatusByAccount, onNew, onEdit, onDeleted, onError, onImportClinicorp }) {
  const [copiedId, setCopiedId] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  const copyUrl = async (clinic) => {
    const url = clinic.slug
      ? `${window.location.origin}/?clinic=${clinic.slug}`
      : `${window.location.origin}/?accountId=${clinic.accountId}`
    await navigator.clipboard.writeText(url)
    setCopiedId(clinic.accountId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const remove = async (clinic) => {
    if (!window.confirm(`Excluir a clínica "${clinic.name}"? O dashboard dela deixará de funcionar.`)) return
    setDeleting(clinic.accountId)
    try { await deleteClinic(clinic.accountId); onDeleted() }
    catch (err) { onError(err.message) }
    finally { setDeleting(null) }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-bold text-slate-900">Clínicas cadastradas</h2>
          <p className="text-xs text-slate-400 mt-0.5">{clinics.length} clínica{clinics.length !== 1 ? 's' : ''} ativa{clinics.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onImportClinicorp}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
            Importar Clinicorp
          </button>
          <button onClick={onNew}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-700">
          + Nova clínica
        </button>
        </div>
      </div>

      {clinics.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
          <div className="text-3xl mb-2">🦷</div>
          <p className="text-sm text-slate-500">Nenhuma clínica cadastrada ainda.</p>
          <p className="text-xs text-slate-400 mt-1">Clique em "Nova clínica" para iniciar o setup.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-400">
                <th className="text-left px-4 py-2.5 font-semibold">Clínica</th>
                <th className="text-left px-4 py-2.5 font-semibold hidden md:table-cell">Métricas & dimensões</th>
                <th className="text-right px-4 py-2.5 font-semibold hidden sm:table-cell">Ticket</th>
                <th className="text-right px-4 py-2.5 font-semibold w-56">Ações</th>
              </tr>
            </thead>
            <tbody>
              {clinics.map(c => {
                const types = [...new Set(
                  Object.entries(c.steps ?? {})
                    .filter(([k]) => !k.startsWith('_'))
                    .map(([, s]) => s.type)
                )]
                const dims = Object.values(c.steps?._dims ?? {}).map(d => d.label).filter(Boolean)
                const hasClinicorp = c.steps?._clinicorp?.units?.length > 0
                const status = syncStatusByAccount?.[c.accountId] ?? null
                const isExpanded = expandedId === c.accountId
                return (
                  <Fragment key={c.accountId}>
                    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{c.name}</div>
                        <div className="text-[10px] font-mono text-slate-400 truncate max-w-[220px]">
                          {c.slug ? `/?clinic=${c.slug}` : c.accountId}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1 items-center">
                          {types.map(t => (
                            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{typeLabel(t)}</span>
                          ))}
                          {dims.map(d => (
                            <span key={d} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">{d}</span>
                          ))}
                          {hasClinicorp && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 font-medium">
                              Clinicorp ✓{c.steps._clinicorp.units.length > 1 ? ` (${c.steps._clinicorp.units.length})` : ''}
                            </span>
                          )}
                          {hasClinicorp && status && (
                            <SyncBadge status={status} expanded={isExpanded}
                              onToggle={() => setExpandedId(isExpanded ? null : c.accountId)} />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600 hidden sm:table-cell">
                        {c.ticket ? `R$ ${Number(c.ticket).toLocaleString('pt-BR')}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => copyUrl(c)}
                            className="text-xs px-2.5 py-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50">
                            {copiedId === c.accountId ? 'Copiado ✓' : 'Copiar URL'}
                          </button>
                          <button onClick={() => onEdit(c)}
                            className="text-xs px-2.5 py-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50">
                            Editar
                          </button>
                          <button onClick={() => remove(c)} disabled={deleting === c.accountId}
                            className="text-xs px-2.5 py-1.5 rounded-md border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40">
                            {deleting === c.accountId ? '...' : 'Excluir'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && status && (
                      <tr>
                        <td colSpan={4} className="p-0">
                          <SyncDetails status={status} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function AdminApp() {
  const [authed,  setAuthed]  = useState(false)
  const [clinics, setClinics] = useState([])
  const [syncStatusByAccount, setSyncStatusByAccount] = useState({})
  const [view,    setView]    = useState('list')   // 'list' | 'wizard' | 'clinicorp-import'
  const [editing, setEditing] = useState(null)
  const [error,   setError]   = useState(null)

  const loadSyncStatus = () => {
    getSyncStatus()
      .then(({ clinics: statuses }) => {
        setSyncStatusByAccount(Object.fromEntries(statuses.map(s => [s.accountId, s])))
      })
      .catch(() => {}) // widget é best-effort — não bloqueia a lista de clínicas
  }

  const refresh = async () => {
    try {
      const { clinics } = await listClinics()
      setClinics(clinics)
      loadSyncStatus()
    } catch (err) {
      if (err.status === 401) { clearSecret(); setAuthed(false) }
      else setError(err.message)
    }
  }

  // sessão anterior ainda válida? entra direto
  useEffect(() => {
    if (!getSecret()) return
    listClinics()
      .then(({ clinics }) => { setClinics(clinics); setAuthed(true); loadSyncStatus() })
      .catch(() => clearSecret())
  }, [])

  if (!authed) {
    return <LoginGate onAuthed={(clinics) => { setClinics(clinics); setAuthed(true); loadSyncStatus() }} />
  }

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="px-5 h-14 flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-red-500 flex items-center justify-center">
              <ToothIcon />
            </div>
            <div className="text-sm font-bold text-slate-900">
              Setup <span className="text-slate-400 font-normal">· Dashboards Odontológicos</span>
            </div>
          </div>
          <button onClick={() => { clearSecret(); setAuthed(false) }}
            className="text-xs text-slate-400 hover:text-slate-700">
            Sair
          </button>
        </div>
      </header>

      <main className="p-5 max-w-5xl mx-auto">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {view === 'list' ? (
          <ClinicList
            clinics={clinics}
            syncStatusByAccount={syncStatusByAccount}
            onNew={() => { setEditing(null); setView('wizard') }}
            onEdit={(c) => { setEditing(c); setView('wizard') }}
            onDeleted={refresh}
            onError={setError}
            onImportClinicorp={() => setView('clinicorp-import')}
          />
        ) : view === 'clinicorp-import' ? (
          <ClinicorpImport
            clinics={clinics}
            onDone={() => { setView('list'); refresh() }}
            onError={setError}
            onLinked={refresh}
            onEditClinic={(c) => { setEditing(c); setView('wizard') }}
          />
        ) : (
          <ClinicWizard
            clinic={editing}
            onDone={() => { setView('list'); refresh() }}
            onCancel={() => setView('list')}
          />
        )}
      </main>
    </div>
  )
}
