import { useState } from 'react'
import { listPanels, getPanelSteps, createClinic, updateClinic } from './adminApi'
import { METRIC_TYPES, guessType, typeColor, buildStepsConfig } from './metricTypes'

const WIZARD_STEPS = ['Credenciais', 'Painel', 'Métricas', 'Revisão']

function Stepper({ current }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {WIZARD_STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          {i > 0 && <div className="w-6 h-px bg-slate-200" />}
          <div className={`flex items-center gap-1.5 ${i === current ? 'text-slate-900 font-semibold' : i < current ? 'text-emerald-600' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono border ${
              i === current ? 'border-slate-900 bg-slate-900 text-white'
              : i < current ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
              : 'border-slate-200 bg-white'
            }`}>
              {i < current ? '✓' : i + 1}
            </span>
            {label}
          </div>
        </div>
      ))}
    </div>
  )
}

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-400 mt-1">{hint}</span>}
    </label>
  )
}

const inputCls = 'mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 bg-white'

export default function ClinicWizard({ clinic, onDone, onCancel }) {
  const isEdit = Boolean(clinic)

  const [step,     setStep]     = useState(0)
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)

  const [name,  setName]  = useState(clinic?.name ?? '')
  const [token, setToken] = useState('')

  const [panels,        setPanels]        = useState([])
  const [selectedPanel, setSelectedPanel] = useState(null)

  const [mappedSteps, setMappedSteps] = useState([])
  const [ticket,      setTicket]      = useState(clinic?.ticket ?? 10000)

  const [savedUrl, setSavedUrl] = useState(null)
  const [copied,   setCopied]   = useState(false)

  // credencial usada nas chamadas à Helena: token digitado ou accountId já cadastrado
  const auth = token.trim()
    ? { helenaToken: token.trim() }
    : isEdit ? { accountId: clinic.accountId } : {}

  const run = async (fn) => {
    setLoading(true); setError(null)
    try { await fn() }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  // ── Etapa 1 → 2: buscar painéis ──────────────────────────────────────────
  const fetchPanels = () => run(async () => {
    if (!name.trim()) throw new Error('Informe o nome da clínica.')
    if (!isEdit && !token.trim()) throw new Error('Informe o token Helena (pn_...).')
    const { panels } = await listPanels(auth)
    if (!panels.length) throw new Error('Nenhum painel encontrado para este token.')
    setPanels(panels)
    setSelectedPanel(panels.find(p => p.id === clinic?.panelId) ?? null)
    setStep(1)
  })

  // ── Etapa 2 → 3: buscar steps do painel ──────────────────────────────────
  const fetchSteps = () => run(async () => {
    if (!selectedPanel) throw new Error('Selecione um painel.')
    const panel = await getPanelSteps(auth, selectedPanel.id)
    if (!panel.steps.length) throw new Error('Este painel não possui etapas (steps).')

    // reaproveita o mapeamento salvo (edição); steps novos recebem sugestão automática
    const existingById = {}
    for (const cfg of Object.values(clinic?.steps ?? {})) existingById[cfg.id] = cfg

    setMappedSteps(panel.steps.map(s => {
      const existing = existingById[s.id]
      const type = existing?.type ?? guessType(s.title)
      return {
        id:        s.id,
        title:     s.title,
        cardCount: s.cardCount,
        type,
        color:     existing?.color ?? typeColor(type),
      }
    }))
    setStep(2)
  })

  // ── Etapa 3 → 4: validar mapeamento ──────────────────────────────────────
  const goReview = () => {
    const active = mappedSteps.filter(s => s.type !== 'ignore')
    if (!active.length) { setError('Mapeie ao menos um step para uma métrica.'); return }
    setError(null)
    setStep(3)
  }

  // ── Salvar ───────────────────────────────────────────────────────────────
  const save = () => run(async () => {
    const payload = {
      accountId: selectedPanel.companyId,
      name:      name.trim(),
      token:     token.trim(),
      panelId:   selectedPanel.id,
      ticket:    Number(ticket) || null,
      steps:     buildStepsConfig(mappedSteps),
    }
    if (isEdit) await updateClinic(payload)
    else        await createClinic(payload)
    setSavedUrl(`${window.location.origin}/?accountId=${selectedPanel.companyId}`)
  })

  const copyUrl = async () => {
    await navigator.clipboard.writeText(savedUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const updateStep = (id, patch) =>
    setMappedSteps(steps => steps.map(s => {
      if (s.id !== id) return s
      const next = { ...s, ...patch }
      // ao trocar o tipo, a cor acompanha o padrão do novo tipo
      if (patch.type && !patch.color) next.color = typeColor(patch.type)
      return next
    }))

  // ── Tela de sucesso ───────────────────────────────────────────────────────
  if (savedUrl) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4 text-emerald-600 text-xl">✓</div>
        <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Clínica atualizada' : 'Clínica cadastrada'}</h2>
        <p className="text-sm text-slate-500 mt-1">O dashboard de <strong>{name}</strong> já está disponível:</p>
        <div className="mt-4 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <code className="text-xs text-indigo-600 font-mono truncate flex-1 text-left">{savedUrl}</code>
          <button onClick={copyUrl} className="text-xs px-3 py-1.5 rounded-md bg-slate-900 text-white font-medium shrink-0 hover:bg-slate-700">
            {copied ? 'Copiado ✓' : 'Copiar'}
          </button>
        </div>
        <button onClick={onDone} className="mt-6 text-sm text-slate-500 hover:text-slate-900 underline underline-offset-2">
          Voltar à lista de clínicas
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-bold text-slate-900">{isEdit ? `Editar · ${clinic.name}` : 'Nova clínica'}</h2>
          <div className="mt-2"><Stepper current={step} /></div>
        </div>
        <button onClick={onCancel} className="text-xs text-slate-400 hover:text-slate-700">Cancelar</button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* ── Etapa 1: credenciais ─────────────────────────────────────────── */}
      {step === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <Field label="Nome da clínica">
            <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Ex: OBClinic" autoFocus />
          </Field>
          <Field
            label="Token Helena"
            hint={isEdit
              ? `Token atual: ${clinic.tokenMasked} — deixe em branco para mantê-lo.`
              : 'Token de API da plataforma Helena (começa com pn_). Fica salvo apenas no servidor.'}
          >
            <input className={`${inputCls} font-mono`} value={token} onChange={e => setToken(e.target.value)}
              placeholder={isEdit ? clinic.tokenMasked : 'pn_...'} type="password" autoComplete="off" />
          </Field>
          <div className="flex justify-end pt-2">
            <button onClick={fetchPanels} disabled={loading}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40">
              {loading ? 'Buscando painéis...' : 'Buscar painéis →'}
            </button>
          </div>
        </div>
      )}

      {/* ── Etapa 2: seleção de painel ───────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Selecione o painel do CRM que alimenta o dashboard:</p>
          {panels.map(p => (
            <button key={p.id} onClick={() => setSelectedPanel(p)}
              className={`w-full text-left bg-white border rounded-xl p-4 transition-colors ${
                selectedPanel?.id === p.id ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-slate-200 hover:border-slate-300'
              }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    {p.title}
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{p.key}</span>
                    {p.scope !== 'COMPANY' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200">pessoal</span>
                    )}
                  </div>
                  {p.description && <div className="text-xs text-slate-500 mt-1 truncate">{p.description}</div>}
                </div>
                <span className={`w-4 h-4 rounded-full border shrink-0 ${
                  selectedPanel?.id === p.id ? 'border-slate-900 bg-slate-900 shadow-[inset_0_0_0_3px_white]' : 'border-slate-300'
                }`} />
              </div>
            </button>
          ))}
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(0)} className="text-sm text-slate-500 hover:text-slate-900">← Voltar</button>
            <button onClick={fetchSteps} disabled={loading || !selectedPanel}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40">
              {loading ? 'Carregando steps...' : 'Configurar métricas →'}
            </button>
          </div>
        </div>
      )}

      {/* ── Etapa 3: mapeamento de métricas ──────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Defina o que cada etapa do painel <strong>{selectedPanel.title}</strong> representa nas métricas.
            A sugestão automática foi aplicada — ajuste se necessário.
          </p>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-400">
                  <th className="text-left px-4 py-2.5 font-semibold">Step do painel</th>
                  <th className="text-right px-4 py-2.5 font-semibold w-20">Cards</th>
                  <th className="text-left px-4 py-2.5 font-semibold w-64">Métrica</th>
                  <th className="text-left px-4 py-2.5 font-semibold w-16">Cor</th>
                </tr>
              </thead>
              <tbody>
                {mappedSteps.map(s => (
                  <tr key={s.id} className={`border-b border-slate-100 last:border-0 ${s.type === 'ignore' ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: s.color }} />
                      {s.title}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500">{s.cardCount}</td>
                    <td className="px-4 py-3">
                      <select value={s.type} onChange={e => updateStep(s.id, { type: e.target.value })}
                        className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:border-slate-400">
                        {METRIC_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.label} — {t.hint}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input type="color" value={s.color} onChange={e => updateStep(s.id, { color: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer border border-slate-200 bg-white p-0.5" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 max-w-xs">
            <Field label="Ticket médio de referência (R$)" hint="Usado quando os cards não têm valor preenchido.">
              <input className={`${inputCls} font-mono`} type="number" min="0" step="100"
                value={ticket} onChange={e => setTicket(e.target.value)} />
            </Field>
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(1)} className="text-sm text-slate-500 hover:text-slate-900">← Voltar</button>
            <button onClick={goReview}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-700">
              Revisar →
            </button>
          </div>
        </div>
      )}

      {/* ── Etapa 4: revisão ─────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {[
              ['Clínica',     name],
              ['Painel',      `${selectedPanel.title} (${selectedPanel.key})`],
              ['Account ID',  <code key="a" className="font-mono text-xs text-indigo-600">{selectedPanel.companyId}</code>],
              ['Token',       token.trim() ? 'Novo token informado' : (isEdit ? `Mantém o atual (${clinic.tokenMasked})` : '—')],
              ['Ticket médio', `R$ ${Number(ticket).toLocaleString('pt-BR')}`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-slate-500">{k}</span>
                <span className="font-medium text-slate-800 text-right">{v}</span>
              </div>
            ))}
            <div className="px-4 py-3">
              <div className="text-sm text-slate-500 mb-2">Métricas mapeadas</div>
              <div className="flex flex-wrap gap-1.5">
                {mappedSteps.filter(s => s.type !== 'ignore').map(s => (
                  <span key={s.id} className="text-[11px] px-2 py-1 rounded-md border border-slate-200 bg-slate-50 text-slate-700 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                    {s.title}
                    <span className="text-slate-400">→ {METRIC_TYPES.find(t => t.value === s.type)?.label}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(2)} className="text-sm text-slate-500 hover:text-slate-900">← Voltar</button>
            <button onClick={save} disabled={loading}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40">
              {loading ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Cadastrar clínica'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
