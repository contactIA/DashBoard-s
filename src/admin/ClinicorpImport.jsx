import { useState, useEffect } from 'react'
import { updateClinic, getClinicorpDirectory } from './adminApi'
import { hasClinicorp } from './clinicorpDirectory'

// Cruza a planilha da frota (nome, token, usuário API, agenda, ID Helena) com
// as clínicas já cadastradas no Supabase (por accountId) — vincula em 1 clique
// sem passar pelo wizard de novo. Clínicas que ainda não existem aqui precisam
// do cadastro completo primeiro (painel, steps) — Clinicorp entra junto lá.
//
// Uma clínica pode aparecer em VÁRIAS linhas da planilha com o mesmo ID Helena
// (duas contas Clinicorp, um painel só — ex: unidades Bueno/Eldorado da IBS).
// Nesse caso agrupamos por idHelena: o 1-clique só serve para grupo de 1
// unidade; grupo com 2+ precisa de etiqueta por unidade, que só o wizard tem
// (ele já carrega as etiquetas do painel) — aqui só linkamos para lá.
function groupByClinic(directory, clinics) {
  const byAccountId = new Map(clinics.map(c => [c.accountId, c]))
  const groups = new Map()
  for (const row of directory) {
    const g = groups.get(row.idHelena) ?? { idHelena: row.idHelena, rows: [] }
    g.rows.push(row)
    groups.set(row.idHelena, g)
  }
  return [...groups.values()].map(g => {
    const clinic = byAccountId.get(g.idHelena)
    const rowsComClinicorp = g.rows.filter(hasClinicorp)
    const jaVinculado = (clinic?.steps?._clinicorp?.units?.length ?? 0) > 0
    const status = !clinic
      ? 'pendente'
      : rowsComClinicorp.length === 0
      ? 'sem-clinicorp'
      : jaVinculado
      ? 'vinculado'
      : rowsComClinicorp.length > 1
      ? 'multi'          // 2+ contas Clinicorp no mesmo painel — precisa etiqueta por unidade
      : 'pronto'         // 1 conta só — vincula direto
    return { ...g, clinic, status, rowsComClinicorp }
  })
}

const STATUS_LABEL = {
  vinculado:       { text: 'Vinculado ✓',          cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  pronto:          { text: 'Pronto para vincular', cls: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
  multi:           { text: 'Múltiplas unidades',   cls: 'bg-violet-50 text-violet-600 border-violet-200' },
  'sem-clinicorp': { text: 'Não usa Clinicorp',     cls: 'bg-slate-50 text-slate-400 border-slate-200' },
  pendente:        { text: 'Cadastro pendente',     cls: 'bg-amber-50 text-amber-600 border-amber-200' },
}

export default function ClinicorpImport({ clinics, onDone, onError, onLinked, onEditClinic }) {
  const [groups, setGroups]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [linking, setLinking]   = useState(null)   // idHelena em progresso
  const [bulkLoading, setBulk]  = useState(false)

  useEffect(() => {
    getClinicorpDirectory()
      .then(({ directory }) => setGroups(groupByClinic(directory, clinics)))
      .catch(err => onError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const linkOne = async (group) => {
    if (!group.clinic || group.rowsComClinicorp.length !== 1) return
    const row = group.rowsComClinicorp[0]
    setLinking(group.idHelena)
    try {
      await updateClinic({
        accountId: group.clinic.accountId,
        name:      group.clinic.name,
        slug:      group.clinic.slug ?? group.clinic.accountId,
        panelId:   group.clinic.panelId,
        ticket:    group.clinic.ticket,
        steps: {
          ...group.clinic.steps,
          _clinicorp: {
            units: [{
              label: '', tagId: null, user: row.apiUser, token: row.token,
              ...(row.agenda && row.agenda !== '-' ? { codeLink: row.agenda } : {}),
            }],
          },
        },
      })
      setGroups(gs => gs.map(g => g.idHelena === group.idHelena ? { ...g, status: 'vinculado' } : g))
      onLinked?.()
    } catch (err) {
      onError(`${group.clinic.name}: ${err.message}`)
    } finally {
      setLinking(null)
    }
  }

  const linkAllReady = async () => {
    setBulk(true)
    for (const group of groups.filter(g => g.status === 'pronto')) {
      await linkOne(group)
    }
    setBulk(false)
  }

  const prontos = groups.filter(g => g.status === 'pronto').length

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
      ) : groups.length === 0 ? (
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
            {groups.map(group => {
              const s = STATUS_LABEL[group.status]
              const names = group.rows.map(r => r.name).join(' + ')
              const users = group.rowsComClinicorp.length
                ? group.rowsComClinicorp.map(r => r.apiUser).join(', ')
                : '—'
              return (
                <tr key={group.idHelena} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 text-slate-800">{names}</td>
                  <td className="px-4 py-2.5 text-slate-500 hidden md:table-cell">{group.clinic?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{users}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${s.cls}`}>{s.text}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {group.status === 'pronto' && (
                      <button onClick={() => linkOne(group)} disabled={linking === group.idHelena || bulkLoading}
                        className="text-xs px-2.5 py-1.5 rounded-md bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40">
                        {linking === group.idHelena ? 'Vinculando...' : 'Vincular'}
                      </button>
                    )}
                    {group.status === 'multi' && (
                      <button onClick={() => onEditClinic(group.clinic)}
                        className="text-xs px-2.5 py-1.5 rounded-md border border-violet-200 text-violet-600 hover:bg-violet-50">
                        Configurar unidades
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
        {' '}"Múltiplas unidades" = duas ou mais contas Clinicorp no mesmo painel Helena — abra "Configurar unidades" para escolher a etiqueta de cada uma.
      </p>
    </div>
  )
}
