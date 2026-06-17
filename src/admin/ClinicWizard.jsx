import { useState } from 'react'
import { listPanels, getPanelSteps, createClinic, updateClinic } from './adminApi'
import { METRIC_TYPES, guessType, typeColor, buildStepsConfig, kebabify } from './metricTypes'
import { extractWith } from '../utils/extract.js'

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

const WIZARD_STEPS = ['Credenciais', 'Painel', 'Métricas', 'Extração', 'Dimensões', 'Revisão']

const EXTRACT_FIELDS = [
  { key: 'date',  label: 'Data de agendamento', kind: 'date', hint: 'A data que filtra o dashboard. Sem ela o card some das métricas por período.' },
  { key: 'time',  label: 'Horário',             kind: 'text', hint: 'Opcional — usado na lista de agendamentos.' },
  { key: 'name',  label: 'Nome do paciente',    kind: 'text', hint: 'Exibido nas tabelas.' },
  { key: 'phone', label: 'Telefone',            kind: 'text', hint: 'Opcional.' },
]

const emptyExtract = () => ({
  date:  [{ from: 'description', regex: '', format: 'YMD' }],
  time:  [{ from: 'description', regex: '' }],
  name:  [{ from: 'title', regex: '' }],
  phone: [{ from: 'description', regex: '' }],
})

const hasAnyRule = (ex) => ex && Object.values(ex).some(rules => rules?.some(r => r.regex || r.from))

let _dimSeq = 0
const newDimId = () => `d${++_dimSeq}`

// _dims (config salva) → estado do editor: [{ id, label, tags: [{ tid, label }] }]
// O label de cada tag é o rótulo exibido no funil (pode diferir do nome da etiqueta).
function dimsToState(dims) {
  return Object.entries(dims ?? {}).map(([key, def]) => ({
    id:     newDimId(),
    label:  def.label ?? key,
    isUnit: def.isUnit ?? false,
    tags:   Object.entries(def.values ?? {}).map(([tid, label]) => ({ tid, label })),
  }))
}

// Pré-monta dimensões a partir das sugestões automáticas das tags do painel
// (Meta/Orgânico → Origem, IA/CRC → Agendador). O admin confirma/ajusta.
function seedFromSuggestions(panelTags) {
  const byDim = {}
  for (const t of panelTags ?? []) {
    const dim = t.suggestion?.dim
    if (!dim) continue
    ;(byDim[dim] ??= []).push({ tid: t.id, label: t.name })
  }
  return Object.entries(byDim).map(([label, tags]) => ({ id: newDimId(), label, tags }))
}

// estado do editor → _dims (config). Rótulo do valor = label customizado ou nome da tag.
function stateToDims(dimensions, tagName) {
  const out = {}
  for (const d of dimensions) {
    const label = d.label?.trim()
    const tags  = d.tags.filter(t => t.tid)
    if (!label || !tags.length) continue
    let key = kebabify(label).replace(/-/g, '') || 'dim'
    while (out[key]) key += '2'
    out[key] = {
      label, source: 'tag',
      values: Object.fromEntries(tags.map(t => [t.tid, (t.label?.trim() || tagName(t.tid))])),
      ...(d.isUnit ? { isUnit: true } : {}),
    }
  }
  return out
}

// Chip de etiqueta de card, com a cor real vinda da Helena.
function TagChip({ tag, onRemove }) {
  const colored = Boolean(tag.color)
  const style = colored ? { background: tag.color, color: tag.textColor || '#fff' } : {}
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${colored ? 'border border-black/5' : 'border border-slate-200 bg-slate-100 text-slate-500'}`}
      style={style}>
      {tag.name}
      {tag.count > 0 && <span className="opacity-70 font-mono text-[10px]">· {tag.count}</span>}
      {onRemove && (
        <button type="button" onClick={onRemove} className="ml-0.5 leading-none opacity-60 hover:opacity-100" title="Remover">✕</button>
      )}
    </span>
  )
}

function Stepper({ current }) {
  return (
    <div className="flex items-center gap-2 text-xs flex-wrap">
      {WIZARD_STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          {i > 0 && <div className="w-5 h-px bg-slate-200" />}
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

function StepHeader({ title, children }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      {children && <p className="text-sm text-slate-500 mt-1">{children}</p>}
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
const miniSelect = 'px-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:border-slate-400'
const miniInput  = 'px-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white font-mono focus:outline-none focus:border-slate-400'

// ── Editor de regras de extração para um campo, com preview ao vivo ──────────
function ExtractField({ field, rules, sampleCards, onChange }) {
  const setRule = (i, patch) => onChange(rules.map((r, j) => j === i ? { ...r, ...patch } : r))
  const addRule = () => onChange([...rules, { from: 'description', regex: '', ...(field.kind === 'date' ? { format: 'YMD' } : {}) }])
  const delRule = (i) => onChange(rules.filter((_, j) => j !== i))

  // Preview: primeiro card de amostra cujo resultado não é nulo, senão os primeiros
  const previews = sampleCards.slice(0, 6).map(c => ({
    title: c.title ?? '(sem título)',
    value: extractWith(rules, c, field.kind === 'date' ? 'date' : 'text'),
  }))
  const hits = previews.filter(p => p.value).length

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-baseline justify-between">
        <h4 className="text-sm font-semibold text-slate-800">{field.label}</h4>
        {sampleCards.length > 0 && (
          <span className={`text-[11px] font-mono ${hits ? 'text-emerald-600' : 'text-slate-400'}`}>
            {hits}/{previews.length} amostras
          </span>
        )}
      </div>
      <p className="text-[11px] text-slate-400 mt-0.5 mb-3">{field.hint}</p>

      <div className="space-y-2">
        {rules.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <select className={miniSelect} value={r.from} onChange={e => setRule(i, { from: e.target.value })}>
              <option value="title">Título</option>
              <option value="description">Descrição</option>
            </select>
            <input
              className={`${miniInput} flex-1`} placeholder="regex (grupo 1 = valor)"
              value={r.regex} onChange={e => setRule(i, { regex: e.target.value })}
            />
            {field.kind === 'date' && (
              <select className={miniSelect} value={r.format ?? 'YMD'} onChange={e => setRule(i, { format: e.target.value })}>
                <option value="YMD">AAAA-MM-DD</option>
                <option value="DMY">DD/MM/AAAA</option>
              </select>
            )}
            <button onClick={() => delRule(i)} disabled={rules.length === 1}
              className="text-slate-300 hover:text-red-500 disabled:opacity-30 px-1" title="Remover regra">✕</button>
          </div>
        ))}
        <button onClick={addRule} className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium">+ adicionar regra (fallback)</button>
      </div>

      {sampleCards.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
          {previews.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <span className="text-slate-400 truncate flex-1 font-mono">{p.title.slice(0, 42)}</span>
              <span className={`font-mono shrink-0 ${p.value ? 'text-emerald-600' : 'text-slate-300'}`}>
                {p.value ?? '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ClinicWizard({ clinic, onDone, onCancel }) {
  const isEdit = Boolean(clinic)

  const [step,     setStep]     = useState(0)
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)

  const [name,  setName]  = useState(clinic?.name ?? '')
  const [slug,  setSlug]  = useState(clinic?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(Boolean(clinic?.slug))
  const [token, setToken] = useState('')

  const [panels,        setPanels]        = useState([])
  const [selectedPanel, setSelectedPanel] = useState(null)

  const [mappedSteps, setMappedSteps] = useState([])
  const [ticket,      setTicket]      = useState(clinic?.ticket ?? 10000)

  const [sampleCards, setSampleCards] = useState([])
  const [panelTags,   setPanelTags]   = useState([])
  const [extract,     setExtract]     = useState(emptyExtract())
  const [dimensions,  setDimensions]  = useState([])

  const [savedUrl, setSavedUrl] = useState(null)
  const [copied,   setCopied]   = useState(false)

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
    const cleanSlug = kebabify(slug)
    if (!SLUG_RE.test(cleanSlug)) throw new Error('Slug inválido — use apenas letras minúsculas, números e hífens (ex: minha-clinica).')
    setSlug(cleanSlug)
    if (!isEdit && !token.trim()) throw new Error('Informe o token Helena (pn_...).')
    const { panels } = await listPanels(auth)
    if (!panels.length) throw new Error('Nenhum painel encontrado para este token.')
    setPanels(panels)
    setSelectedPanel(panels.find(p => p.id === clinic?.panelId) ?? null)
    setStep(1)
  })

  // ── Etapa 2 → 3: buscar steps + amostra de cards/tags ─────────────────────
  const fetchSteps = () => run(async () => {
    if (!selectedPanel) throw new Error('Selecione um painel.')
    const panel = await getPanelSteps(auth, selectedPanel.id)
    if (!panel.steps.length) throw new Error('Este painel não possui etapas (steps).')

    const existingById = {}
    for (const [k, cfg] of Object.entries(clinic?.steps ?? {})) {
      if (k.startsWith('_')) continue
      existingById[cfg.id] = cfg
    }

    setMappedSteps(panel.steps.map(s => {
      const existing = existingById[s.id]
      const type = existing?.type ?? guessType(s.title)
      return { id: s.id, title: s.title, cardCount: s.cardCount, type, color: existing?.color ?? typeColor(type) }
    }))

    setSampleCards(panel.sampleCards ?? [])
    setPanelTags(panel.tags ?? [])

    // pré-carrega config existente (edição)
    setExtract(hasAnyRule(clinic?.steps?._extract) ? clinic.steps._extract : emptyExtract())

    // dimensões: config salva tem prioridade; senão usa a sugestão automática
    const existingDims = clinic?.steps?._dims
    setDimensions(
      existingDims && Object.keys(existingDims).length
        ? dimsToState(existingDims)
        : seedFromSuggestions(panel.tags ?? [])
    )

    setStep(2)
  })

  // ── Salvar ───────────────────────────────────────────────────────────────
  const save = () => run(async () => {
    const payload = {
      accountId: selectedPanel.companyId,
      name:      name.trim(),
      slug,
      token:     token.trim(),
      panelId:   selectedPanel.id,
      ticket:    Number(ticket) || null,
      steps:     buildStepsConfig(mappedSteps, extract, stateToDims(dimensions, tagName)),
    }
    if (isEdit) await updateClinic(payload)
    else        await createClinic(payload)
    setSavedUrl(`${window.location.origin}/?clinic=${slug}`)
  })

  const copyUrl = async () => {
    await navigator.clipboard.writeText(savedUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const goMetrics = () => {
    if (!mappedSteps.filter(s => s.type !== 'ignore').length) { setError('Mapeie ao menos um step para uma métrica.'); return }
    setError(null); setStep(3)
  }

  const updateStep = (id, patch) =>
    setMappedSteps(steps => steps.map(s => {
      if (s.id !== id) return s
      const next = { ...s, ...patch }
      if (patch.type && !patch.color) next.color = typeColor(patch.type)
      return next
    }))

  // info de cada tag conhecida do painel + órfãs (atribuídas, mas já removidas do painel)
  const tagById = (() => {
    const m = new Map(panelTags.map(t => [t.id, t]))
    for (const d of dimensions) for (const t of d.tags) {
      if (!m.has(t.tid)) m.set(t.tid, { id: t.tid, name: '(etiqueta removida)', color: null, textColor: null, count: 0 })
    }
    return m
  })()
  const tagName = (tid) => tagById.get(tid)?.name ?? tid

  const assignedTagIds = new Set(dimensions.flatMap(d => d.tags.map(t => t.tid)))
  const unassignedTags = panelTags.filter(t => !assignedTagIds.has(t.id))

  const addDimension     = ()              => setDimensions(ds => [...ds, { id: newDimId(), label: '', isUnit: false, tags: [] }])
  const removeDimension  = (id)            => setDimensions(ds => ds.filter(d => d.id !== id))
  // Marca (ou desmarca) uma dimensão como a unidade — exclusivo: só uma pode ser
  const toggleUnitDim    = (id)            => setDimensions(ds => ds.map(d => ({ ...d, isUnit: d.id === id ? !d.isUnit : false })))
  const renameDimension  = (id, label)     => setDimensions(ds => ds.map(d => d.id === id ? { ...d, label } : d))
  const addTagToDim      = (id, tid)       => setDimensions(ds => ds.map(d => d.id === id ? { ...d, tags: [...d.tags, { tid, label: tagName(tid) }] } : d))
  const removeTagFromDim = (id, tid)       => setDimensions(ds => ds.map(d => d.id === id ? { ...d, tags: d.tags.filter(t => t.tid !== tid) } : d))
  const renameTagLabel   = (id, tid, label) => setDimensions(ds => ds.map(d => d.id === id ? { ...d, tags: d.tags.map(t => t.tid === tid ? { ...t, label } : t) } : d))

  // dimensões válidas (com nome e ao menos uma tag) — para revisão
  const reviewDims = dimensions
    .filter(d => d.label.trim() && d.tags.length)
    .map(d => ({ label: d.label.trim(), values: d.tags.map(t => t.label?.trim() || tagName(t.tid)) }))

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
            <input className={inputCls} value={name}
              onChange={e => {
                setName(e.target.value)
                if (!slugTouched) setSlug(kebabify(e.target.value))
              }}
              placeholder="Ex: OBClinic" autoFocus />
          </Field>
          <Field label="Slug (URL do dashboard)" hint={`O cliente acessa por /?clinic=${slug || 'slug-da-clinica'}`}>
            <input className={`${inputCls} font-mono`} value={slug}
              onChange={e => {
                setSlugTouched(true)
                setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-{2,}/g, '-'))
              }}
              placeholder="minha-clinica" />
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
          <StepHeader title="Selecione o painel">Escolha o painel do CRM que alimenta o dashboard desta clínica.</StepHeader>
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
              {loading ? 'Carregando...' : 'Configurar métricas →'}
            </button>
          </div>
        </div>
      )}

      {/* ── Etapa 3: mapeamento de métricas ──────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <StepHeader title="Mapeie as métricas">
            Defina o que cada etapa do painel <strong>{selectedPanel.title}</strong> representa no funil.
            Etapas marcadas como <em>Ignorar</em> ficam fora das métricas.
          </StepHeader>
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
            <button onClick={goMetrics}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-700">
              Extração de dados →
            </button>
          </div>
        </div>
      )}

      {/* ── Etapa 4: extração ────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <StepHeader title="Extração de dados">
            Cada chatbot escreve o card de um jeito. Defina como extrair os dados — o preview
            mostra o resultado em cards reais. A primeira regra que casar vence; as demais são fallback.
          </StepHeader>
          {sampleCards.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-700">
              Sem cards de amostra neste painel — você ainda pode configurar as regras manualmente.
            </div>
          )}
          <div className="grid grid-cols-1 gap-3">
            {EXTRACT_FIELDS.map(f => (
              <ExtractField
                key={f.key} field={f} rules={extract[f.key]} sampleCards={sampleCards}
                onChange={rules => setExtract(ex => ({ ...ex, [f.key]: rules }))}
              />
            ))}
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(2)} className="text-sm text-slate-500 hover:text-slate-900">← Voltar</button>
            <button onClick={() => setStep(4)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-700">
              Dimensões →
            </button>
          </div>
        </div>
      )}

      {/* ── Etapa 5: dimensões (etiquetas de card) ───────────────────────── */}
      {step === 4 && (
        <div className="space-y-4">
          <StepHeader title="Dimensões do funil">
            As <strong>etiquetas de card</strong> viram cortes do funil. Agrupe-as em <strong>dimensões</strong>
            {' '}— ex: <em>Origem</em> = Meta + Orgânico · <em>Agendador</em> = IA + CRC.
            O <strong>rótulo</strong> é como o valor aparece no funil (ex: a etiqueta <em>Meta</em> pode exibir como <em>Tráfego pago</em>).
            Etiquetas fora de qualquer dimensão são ignoradas nas métricas.
          </StepHeader>

          {panelTags.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-400">
              Este painel não possui etiquetas de card. A clínica fica sem quebras por dimensão — pode seguir para a revisão.
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {dimensions.map(d => (
                  <div key={d.id} className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        className="flex-1 px-2.5 py-1.5 text-sm font-semibold text-slate-800 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                        placeholder="Nome da dimensão (ex: Origem)"
                        value={d.label} onChange={e => renameDimension(d.id, e.target.value)} />
                      <button type="button" onClick={() => toggleUnitDim(d.id)}
                        title="Usar esta dimensão como filtro de unidade no topo do dashboard"
                        className={`text-xs px-2.5 py-1.5 rounded-md border shrink-0 font-medium transition-colors ${
                          d.isUnit
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}>
                        {d.isUnit ? '🏢 Unidade ✓' : 'É unidade?'}
                      </button>
                      <button onClick={() => removeDimension(d.id)}
                        className="text-xs px-2.5 py-1.5 rounded-md border border-red-200 text-red-500 hover:bg-red-50 shrink-0">
                        Remover
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {d.tags.length === 0 && (
                        <span className="text-[11px] text-slate-400">Nenhuma etiqueta ainda — escolha abaixo.</span>
                      )}
                      {d.tags.map(t => {
                        const info = tagById.get(t.tid) ?? { id: t.tid, name: t.label, color: null, textColor: null, count: 0 }
                        return (
                          <div key={t.tid} className="flex items-center gap-2">
                            <div className="w-32 shrink-0"><TagChip tag={info} /></div>
                            <span className="text-slate-300 text-xs shrink-0">→</span>
                            <input
                              className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:border-slate-400"
                              placeholder={`rótulo no funil (ex: ${info.name})`}
                              value={t.label} onChange={e => renameTagLabel(d.id, t.tid, e.target.value)} />
                            <button type="button" onClick={() => removeTagFromDim(d.id, t.tid)}
                              className="text-slate-300 hover:text-red-500 px-1 shrink-0" title="Remover etiqueta">✕</button>
                          </div>
                        )
                      })}
                    </div>

                    {unassignedTags.length > 0 && (
                      <div className="mt-2.5">
                        <select value="" onChange={e => { if (e.target.value) addTagToDim(d.id, e.target.value) }}
                          className="text-[11px] px-2 py-1 rounded-md border border-dashed border-slate-300 text-slate-500 bg-white hover:border-slate-400 focus:outline-none focus:border-slate-400 cursor-pointer">
                          <option value="">+ adicionar etiqueta</option>
                          {unassignedTags.map(t => (
                            <option key={t.id} value={t.id}>{t.name}{t.count ? ` (${t.count})` : ''}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button onClick={addDimension}
                className="w-full py-2.5 text-sm font-medium rounded-xl border border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700">
                + Nova dimensão
              </button>

              {unassignedTags.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="text-xs font-medium text-slate-500 mb-2">
                    Etiquetas sem dimensão <span className="text-slate-400 font-normal">· ignoradas nas métricas</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {unassignedTags.map(t => <TagChip key={t.id} tag={t} />)}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(3)} className="text-sm text-slate-500 hover:text-slate-900">← Voltar</button>
            <button onClick={() => setStep(5)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-700">
              Revisar →
            </button>
          </div>
        </div>
      )}

      {/* ── Etapa 6: revisão ─────────────────────────────────────────────── */}
      {step === 5 && (
        <div className="space-y-4">
          <StepHeader title="Revisão">Confira a configuração antes de {isEdit ? 'salvar as alterações' : 'cadastrar a clínica'}.</StepHeader>
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {[
              ['Clínica',     name],
              ['URL',         <code key="u" className="font-mono text-xs text-indigo-600">/?clinic={slug}</code>],
              ['Painel',      `${selectedPanel.title} (${selectedPanel.key})`],
              ['Account ID',  <code key="a" className="font-mono text-xs text-slate-500">{selectedPanel.companyId}</code>],
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
            {reviewDims.length > 0 && (
              <div className="px-4 py-3">
                <div className="text-sm text-slate-500 mb-2">Dimensões</div>
                <div className="space-y-1.5">
                  {reviewDims.map(def => (
                    <div key={def.label} className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-slate-700 shrink-0">{def.label}:</span>
                      <span className="text-xs text-slate-500">{def.values.join(', ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(4)} className="text-sm text-slate-500 hover:text-slate-900">← Voltar</button>
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
