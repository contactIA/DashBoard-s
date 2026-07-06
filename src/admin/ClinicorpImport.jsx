import { useState, useEffect } from 'react'
import { updateClinic, getClinicorpDirectory } from './adminApi'
import { hasClinicorp } from './clinicorpDirectory'

// Cruza a planilha da frota (nome, token, usuário API, agenda, ID Helena) com
// as clínicas já cadastradas no Supabase (por accountId) — vincula em 1 clique
// sem passar pelo wizard de novo. Clínicas que ainda não existem aqui precisam
// do cadastro completo primeiro (painel, steps) — Clinicorp entra junto lá.
function computeRows(directory, clinics) {
  const byAccountId = new Map(clinics.map(c => [c.accountId, c]))
  return directory.map(row => {
    const clinic = byAccountId.get(row.idHelena)
    const semClinicorp = !hasClinicorp(row)
    const jaVinculado = Boolean(clinic?.steps?._clinicorp?.user)
    const status = !clinic
      ? 'pendente'       // clínica ainda não tem dashboard cadastrado
      : semClinicorp
      ? 'sem-clinicorp'  // não usa Clinicorp (agenda Google, etc.)
      : jaVinculado
      ? 'vinculado'
      : 'pronto'         // clínica existe, tem token real, falta só vincular
    return { ...row, clinic, status }
  })
}

const STATUS_LABEL = {
  vinculado:     { text: 'Vinculado ✓',        cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  pronto:        { text: 'Pronto para vincular', cls: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
  'sem-clinicorp': { text: 'Não usa Clinicorp',  cls: 'bg-slate-50 text-slate-400 border-slate-200' },
  pendente:      { text: 'Cadastro pendente',   cls: 'bg-amber-50 text-amber-600 border-amber-200' },
}

export default function ClinicorpImport({ clinics, onDone, onError, onLinked }) {
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [linking, setLinking]   = useState(null)   // idHelena em progresso
  const [bulkLoading, setBulk]  = useState(false)

  useEffect(() => {
    getClinicorpDirectory()
      .then(({ directory }) => setRows(computeRows(directory, clinics)))
      .catch(err => onError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const linkOne = async (row) => {
    if (!row.clinic) return
    setLinking(row.idHelena)
    try {
      await updateClinic({
        accountId: row.clinic.accountId,
        name:      row.clinic.name,
        slug:      row.clinic.slug ?? row.clinic.accountId,
        panelId:   row.clinic.panelId,
        ticket:    row.clinic.ticket,
        steps: {
          ...row.clinic.steps,
          _clinicorp: {
            user: row.apiUser,
            token: row.token,
            subscriberId: row.apiUser,
            ...(row.agenda && row.agenda !== '-' ? { codeLink: row.agenda } : {}),
          },
        },
      })
      setRows(rs => rs.map(r => r.idHelena === row.idHelena ? { ...r, status: 'vinculado' } : r))
      onLinked?.()
    } catch (err) {
      onError(`${row.name}: ${err.message}`)
    } finally {
      setLinking(null)
    }
  }

  const linkAllReady = async () => {
    setBulk(true)
    for (const row of rows.filter(r => r.status === 'pronto')) {
      await linkOne(row)
    }
    setBulk(false)
  }

  const prontos = rows.filter(r => r.status === 'pronto').length

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-bold text-slate-900">Importar Clinicorp em massa</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cruza a planilha da frota com as clínicas já cadastradas — vincula sem reabrir o wizard.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {prontos > 0 && (
            <button onClick={linkAllReady} disabled={bulkLoading}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40">
              {bulkLoading ? 'Vinculando...' : `Vincular todos os prontos (${prontos})`}
            </button>
          )}
          <button onClick={onDone} className="text-xs text-slate-400 hover:text-slate-700">← Voltar</button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-400">
          Carregando planilha...
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-400">
          Nenhuma clínica na planilha — configure <code className="font-mono">CLINICORP_DIRECTORY_JSON</code> no servidor.
        </div>
      ) : (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-400">
              <th className="text-left px-4 py-2.5 font-semibold">Clínica (planilha)</th>
              <th className="text-left px-4 py-2.5 font-semibold hidden md:table-cell">No dashboard</th>
              <th className="text-left px-4 py-2.5 font-semibold">Usuário API</th>
              <th className="text-left px-4 py-2.5 font-semibold w-40">Status</th>
              <th className="text-right px-4 py-2.5 font-semibold w-32">Ação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const s = STATUS_LABEL[row.status]
              return (
                <tr key={row.idHelena + row.name} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 text-slate-800">{row.name}</td>
                  <td className="px-4 py-2.5 text-slate-500 hidden md:table-cell">{row.clinic?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">
                    {hasClinicorp(row) ? row.apiUser : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${s.cls}`}>{s.text}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {row.status === 'pronto' && (
                      <button onClick={() => linkOne(row)} disabled={linking === row.idHelena || bulkLoading}
                        className="text-xs px-2.5 py-1.5 rounded-md bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40">
                        {linking === row.idHelena ? 'Vinculando...' : 'Vincular'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}

      <p className="text-xs text-slate-400 mt-3">
        "Cadastro pendente" = a clínica ainda não tem dashboard configurado (painel/métricas) — cadastre pelo wizard normal primeiro; a aba Clinicorp já vem preenchível lá.
      </p>
    </div>
  )
}
