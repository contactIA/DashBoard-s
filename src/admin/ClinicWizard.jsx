import { useState } from 'react'
import { listPanels, getPanelSteps, createClinic, updateClinic, getClinicorpUsers } from './adminApi'
import { METRIC_TYPES, guessType, typeColor, buildStepsConfig, kebabify } from './metricTypes'
import { extractWith, autoDetectExtract, countExtractHits } from '../utils/extract.js'
import { DEFAULT_FUNNEL_CFG } from '../utils/parseCards.js'

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

const WIZARD_STEPS = ['Credenciais', 'Painel', 'Métricas', 'Funil', 'Extração', 'Dimensões', 'Clinicorp', 'Revisão']

// As 3 barras configuráveis do funil (depois da 1ª, "Leads totais", que é
// sempre o total de cards do período — não configurável, por isso fica fora
// desta lista).
const FUNNEL_STAGE_DEFS = [
  { key: 'agendou',    label: 'Agendaram' },
  { key: 'compareceu', label: 'Compareceram' },
  { key: 'fechou',     label: 'Fecharam' },
]

const EXTRACT_FIELDS = [
  { key: 'date',  label: 'Agendado Para (data/hora da consulta)', kind: 'date', hint: 'A data que filtra o dashboard e alimenta "agendamentos futuros". Sem ela o card some das métricas por período.', helenaSource: 'dueDate', helenaLabel: 'Data/hora da Helena (dueDate)' },
  { key: 'time',  label: 'Horário',             kind: 'text', hint: 'Opcional — usado na lista de agendamentos. Ignorado quando "Agendado Para" já é um campo único data+hora.', helenaSource: 'dueDate', helenaLabel: 'Data/hora da Helena (dueDate)' },
  { key: 'scheduledAt', label: 'Agendado em (dia que a CRC agendou)', kind: 'date', hint: 'Opcional — alimenta a barra "Agendaram" do funil. Diferente da data da consulta.', helenaSource: 'dueDate', helenaLabel: 'Data/hora da Helena (dueDate)', noSuggest: true, optional: true },
  { key: 'closedAt', label: 'Fechado em (dia que o orçamento foi aprovado)', kind: 'date', hint: 'Opcional — quando o contrato realmente fechou, pode ser meses após a consulta. Não mexe em "Agendado Para". Alimenta o KPI de fechamento por mês.', helenaSource: 'dueDate', helenaLabel: 'Data/hora da Helena (dueDate)', noSuggest: true, optional: true },
  { key: 'name',  label: 'Nome do paciente',    kind: 'text', hint: 'Exibido nas tabelas.', helenaSource: 'contactName', helenaLabel: 'Contato vinculado ao card' },
  { key: 'phone', label: 'Telefone',            kind: 'phone', hint: 'Opcional.', helenaSource: 'contactPhone', helenaLabel: 'Contato vinculado ao card' },
]

const emptyExtract = () => ({
  date:  [{ from: 'description', regex: '', format: 'YMD' }],
  time:  [{ from: 'description', regex: '' }],
  scheduledAt: [],
  closedAt: [],
  name:  [{ from: 'title', regex: '' }],
  phone: [{ from: 'description', regex: '' }],
})

const hasAnyRule = (ex) => ex && Object.values(ex).some(rules => rules?.some(r => r.regex || r.from))

// _dates (steps._dates) diz ao SYNC do Clinicorp em qual customField escrever
// "Agendado Para"/"Agendado em"/"Fechado em" — deriva do MESMO campo já
// escolhido no passo de Extração (1ª regra, quando aponta para
// customFields.<key>), em vez de pedir a mesma escolha duas vezes: uma única
// fonte de verdade por clínica, sem risco de a leitura (_extract) e a escrita
// (_dates) apontarem pra keys diferentes por engano.
function customFieldKeyOf(rules) {
  for (const r of rules ?? []) {
    if (r?.from?.startsWith('customFields.')) return r.from.slice(13) || null
  }
  return null
}
function deriveDatesConfig(extract) {
  const scheduledForKey = customFieldKeyOf(extract.date)
  const createdAtKey    = customFieldKeyOf(extract.scheduledAt)
  const closedAtKey     = customFieldKeyOf(extract.closedAt)
  if (!scheduledForKey && !createdAtKey && !closedAtKey) return null
  return {
    ...(scheduledForKey ? { scheduledFor: { key: scheduledForKey } } : {}),
    ...(createdAtKey    ? { createdAt:    { key: createdAtKey } }    : {}),
    ...(closedAtKey     ? { closedAt:     { key: closedAtKey } }     : {}),
  }
}

// Quando "Agendado Para" é um customField único data+hora, o campo Horário
// fica oculto na UI (ver filtro em EXTRACT_FIELDS) — gera a regra de extração
// da hora automaticamente a partir da MESMA key, via regex sobre a mesma
// string (ex: "2026-07-08T12:00:00.0000000" → "12:00").
function withAutoTime(extract) {
  const dateKey = customFieldKeyOf(extract.date)
  if (!dateKey) return extract
  return { ...extract, time: [{ from: `customFields.${dateKey}`, regex: '(\\d{1,2}:\\d{2})' }] }
}

let _dimSeq = 0
const newDimId = () => `d${++_dimSeq}`

let _ccSeq = 0
const newCcId = () => `cc${++_ccSeq}`

// _clinicorp (config salva) → estado do editor: uma "unidade" por conta
// Clinicorp. Clínicas com só 1 unidade não precisam de etiqueta (tagId null);
// com 2+, a etiqueta do card decide qual conta consultar (ex: BUENO/ELDORADO
// no mesmo painel Helena). Aceita o formato antigo (objeto único, sem
// `units`) para não quebrar clínicas já vinculadas antes desta mudança.
// `syncSince` (gravado na 1ª vinculação, nunca recalculado depois) trava o
// corte de histórico na data real da vinculação — sem isso o sync usaria
// "início do mês corrente" e um fato antigo demais nunca mais criaria card.
function clinicorpToUnits(cc) {
  const list = cc?.units ?? (cc ? [cc] : [])
  if (!list.length) return [{ id: newCcId(), label: '', tagId: '', user: '', token: '', existingToken: null, codeLink: '', syncSince: null, crcNames: {} }]
  return list.map(u => ({
    id: newCcId(), label: u.label ?? '', tagId: u.tagId ?? '',
    user: u.user ?? '', token: '', existingToken: u.token ?? null, codeLink: u.codeLink ?? '',
    syncSince: u.syncSince ?? null,
    // Mapa CRC desta unidade (unit.crcMap salvo) → estado do editor por tagId.
    // Por unidade porque a MESMA pessoa pode ter usuário diferente cadastrado
    // em cada conta Clinicorp (ex: "Gabriela Vieira Da Silva" no Bueno vs.
    // "Gabriela Vieira" no Eldorado).
    crcNames: Object.fromEntries((u.crcMap ?? []).filter(m => m.tagId).map(m => [m.tagId, m.clinicorpName ?? ''])),
  }))
}

// _dims (config salva) → estado do editor: [{ id, label, tags: [{ tid, label }] }]
// O label de cada tag é o rótulo exibido no funil (pode diferir do nome da etiqueta).
// Dimensão de campo personalizado (source: 'customFields.<key>') não tem tags —
// o valor é o texto livre do campo (ex: Campanhas), sem lista fixa pra mapear.
function dimsToState(dims) {
  return Object.entries(dims ?? {}).map(([key, def]) => ({
    id:     newDimId(),
    label:  def.label ?? key,
    isUnit: def.isUnit ?? false,
    customFieldKey: def.source?.startsWith('customFields.') ? def.source.slice(13) : null,
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
    if (!label) continue
    if (d.customFieldKey) {
      // Campo personalizado: sem lista fixa de valores (texto livre) — o
      // corte é derivado dos cards direto no backend (api/dashboard.js).
      let key = kebabify(label).replace(/-/g, '') || 'dim'
      while (out[key]) key += '2'
      out[key] = { label, source: `customFields.${d.customFieldKey}` }
      continue
    }
    const tags = d.tags.filter(t => t.tid)
    if (!tags.length) continue
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
function ExtractField({ field, rules = [], sampleCards, customFields, onChange }) {
  const setRule = (i, patch) => onChange(rules.map((r, j) => j === i ? { ...r, ...patch } : r))
  const addRule = () => onChange([...rules, { from: 'description', regex: '', ...(field.kind === 'date' ? { format: 'YMD' } : {}) }])
  const delRule = (i) => onChange(rules.filter((_, j) => j !== i))

  // Preview: primeiro card de amostra cujo resultado não é nulo, senão os primeiros
  const previews = sampleCards.slice(0, 6).map(c => ({
    title: c.title ?? '(sem título)',
    value: extractWith(rules, c, field.kind),
  }))
  const hits = previews.filter(p => p.value).length

  // Sugestão: se o campo real da Helena bate em mais amostras do que a regra
  // atual (comparando na amostra toda, não só no preview de 6), oferece trocar.
  // noSuggest: dueDate é a data da CONSULTA, não a de agendamento — sugerir
  // aqui (ex: no campo "Agendado em") induziria a semântica errada do funil.
  const usingHelena = rules.some(r => r.from === field.helenaSource)
  const totalHits   = countExtractHits(rules, sampleCards, field.kind)
  const helenaHits  = countExtractHits([{ from: field.helenaSource }], sampleCards, field.kind)
  const suggestHelena = !field.noSuggest && !usingHelena && sampleCards.length > 0 && helenaHits > totalHits

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

      {suggestHelena && (
        <div className="mb-3 flex items-center justify-between gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
          <span className="text-[11px] text-indigo-700">
            💡 "{field.helenaLabel}" bate em {helenaHits}/{sampleCards.length} amostras (regra atual: {totalHits}/{sampleCards.length})
          </span>
          <button
            onClick={() => onChange([{ from: field.helenaSource }, ...rules])}
            className="text-[11px] px-2.5 py-1 rounded-md bg-indigo-600 text-white font-medium hover:bg-indigo-700 shrink-0"
          >
            Usar
          </button>
        </div>
      )}

      <div className="space-y-2">
        {rules.map((r, i) => {
          const isHelenaSource = r.from === field.helenaSource
          const isMetadata     = r.from?.startsWith('metadata.')
          const isCustomField  = r.from?.startsWith('customFields.')
          const kind = isMetadata ? 'metadata' : isCustomField ? 'customFields' : r.from
          const key  = isMetadata ? r.from.slice(9) : isCustomField ? r.from.slice(13) : ''
          // Campo apontado por nome exato (Helena/metadata/customFields) já traz o
          // valor certo — não precisa de regex. Só texto livre (título/descrição)
          // exige recorte manual.
          const hidesRegex = isHelenaSource || isMetadata || isCustomField
          return (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              <select className={miniSelect} value={kind} onChange={e => {
                const v = e.target.value
                const isKeyed = v === 'metadata' || v === 'customFields'
                setRule(i, { from: isKeyed ? `${v}.` : v, ...(isKeyed || v === field.helenaSource ? { regex: '' } : {}) })
              }}>
                <option value={field.helenaSource}>{field.helenaLabel}</option>
                <option value="title">Título</option>
                <option value="description">Descrição</option>
                <option value="metadata">Metadado (metadata)</option>
                <option value="customFields">Campo personalizado (customFields)</option>
              </select>
              {isMetadata && (
                <input
                  className={miniInput} placeholder="nome do campo"
                  value={key} onChange={e => setRule(i, { from: `metadata.${e.target.value}` })}
                />
              )}
              {isCustomField && (() => {
                // card.customFields é indexado pelo id interno do campo (às vezes
                // pela "key") — nunca pelo nome exibido. Testa os dois contra as
                // amostras e usa o que realmente bate, sem o admin precisar saber.
                // Guarda contra key vazia: vários campos podem ter key "" na Helena,
                // e sem essa checagem o primeiro deles "casava" por engano.
                const current = key ? customFields.find(cf => cf.key === key || cf.id === key) : null
                return (
                  <select className={miniSelect} value={current?.id ?? ''} onChange={e => {
                    const cf = customFields.find(f => f.id === e.target.value)
                    if (!cf) { setRule(i, { from: 'customFields.' }); return }
                    const candidates = [cf.key, cf.id].filter(Boolean)
                    let bestKey = candidates[0], bestHits = -1
                    for (const k of candidates) {
                      const hits = countExtractHits([{ from: `customFields.${k}` }], sampleCards, field.kind)
                      if (hits > bestHits) { bestHits = hits; bestKey = k }
                    }
                    setRule(i, { from: `customFields.${bestKey}` })
                  }}>
                    <option value="">{customFields.length ? 'Selecione o campo…' : 'Nenhum campo encontrado — digite a key ao lado'}</option>
                    {customFields.map(cf => (
                      <option key={cf.id} value={cf.id}>{cf.name}{cf.type ? ` (${cf.type})` : ''}</option>
                    ))}
                  </select>
                )
              })()}
              {isCustomField && (
                <input
                  className={miniInput} placeholder="ou digite a key (ex: data)"
                  value={key} onChange={e => setRule(i, { from: `customFields.${e.target.value}` })}
                />
              )}
              {hidesRegex ? (
                <span className="flex-1 text-[11px] text-slate-400 italic">
                  {isHelenaSource ? 'campo real da Helena' : 'pega o valor do campo direto'} — sem regex necessária
                </span>
              ) : (
                <input
                  className={`${miniInput} flex-1`} placeholder="regex (grupo 1 = valor) — vazio usa o campo inteiro"
                  value={r.regex} onChange={e => setRule(i, { regex: e.target.value })}
                />
              )}
              {field.kind === 'date' && !isHelenaSource && (
                <select className={miniSelect} value={r.format ?? 'YMD'} onChange={e => setRule(i, { format: e.target.value })}>
                  <option value="YMD">AAAA-MM-DD</option>
                  <option value="DMY">DD/MM/AAAA</option>
                </select>
              )}
              {/* Campo opcional (ex: "Agendado em") pode voltar a zero regras —
                  sem isso, uma regra adicionada por engano ficava presa. */}
              <button onClick={() => delRule(i)} disabled={rules.length === 1 && !field.optional}
                className="text-slate-300 hover:text-red-500 disabled:opacity-30 px-1" title="Remover regra">✕</button>
            </div>
          )
        })}
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
  const [quick,    setQuick]    = useState(false)  // modo rápido (confirmação) x avançado (passo-a-passo)
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
  const [hasIA,       setHasIA]       = useState(clinic?.steps?._flags?.hasIA ?? false)

  const [sampleCards, setSampleCards] = useState([])
  const [panelTags,   setPanelTags]   = useState([])
  const [panelCustomFields, setPanelCustomFields] = useState([])
  const [extract,     setExtract]     = useState(emptyExtract())
  const [dimensions,  setDimensions]  = useState([])

  // Usuários (CRCs) cadastrados nas contas Clinicorp — alimenta o autocomplete
  // do mapa de CRC (digitar "gabriela" sugere "GABRIELA RONCATO" em vez do
  // admin ter que descobrir/digitar o nome completo de cabeça).
  const [ccUsers,        setCcUsers]        = useState([])
  const [ccUsersLoading, setCcUsersLoading] = useState(false)
  const [ccUsersError,   setCcUsersError]   = useState(null)

  const [funnelStages,      setFunnelStages]      = useState({})
  const [mergeCancelReagend, setMergeCancelReagend] = useState(false)

  // Integração Clinicorp (OPCIONAL — nem toda clínica usa; suporta múltiplas
  // unidades, cada uma com sua própria conta Clinicorp + etiqueta no painel)
  const existingClinicorp = clinic?.steps?._clinicorp ?? null
  const [ccUnits, setCcUnits] = useState(() => clinicorpToUnits(existingClinicorp))

  // Mapa CRC é POR UNIDADE (unit.crcNames, ver clinicorpToUnits) — a mesma
  // pessoa pode ter usuário diferente cadastrado em cada conta Clinicorp.
  const setCrcName = (unitId, tagId, value) =>
    setCcUnits(us => us.map(u => u.id === unitId ? { ...u, crcNames: { ...u.crcNames, [tagId]: value } } : u))

  const addCcUnit    = () => setCcUnits(us => [...us, { id: newCcId(), label: '', tagId: '', user: '', token: '', existingToken: null, codeLink: '', syncSince: null, crcNames: {} }])
  const removeCcUnit = (id) => setCcUnits(us => us.length > 1 ? us.filter(u => u.id !== id) : us)
  const updateCcUnit = (id, patch) => setCcUnits(us => us.map(u => u.id === id ? { ...u, ...patch } : u))

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

    const mapped = panel.steps.map(s => {
      const existing = existingById[s.id]
      const type = existing?.type ?? guessType(s.title)
      return { id: s.id, title: s.title, cardCount: s.cardCount, type, color: existing?.color ?? typeColor(type) }
    })
    setMappedSteps(mapped)

    setSampleCards(panel.sampleCards ?? [])
    setPanelTags(panel.tags ?? [])
    setPanelCustomFields(panel.customFields ?? [])

    // funil: config salva tem prioridade; senão usa o default, restrito aos tipos
    // realmente usados nesta clínica (evita oferecer checkbox de tipo inexistente)
    const usedTypes = new Set(mapped.filter(s => s.type !== 'ignore').map(s => s.type))
    const existingFunnel = clinic?.steps?._funnel
    if (existingFunnel?.stages) {
      setFunnelStages(existingFunnel.stages)
      setMergeCancelReagend(Boolean(existingFunnel.mergeCancelledRescheduled))
    } else {
      const seeded = {}
      for (const [stageKey, types] of Object.entries(DEFAULT_FUNNEL_CFG.stages)) {
        seeded[stageKey] = types.filter(t => usedTypes.has(t))
      }
      setFunnelStages(seeded)
      setMergeCancelReagend(false)
    }

    // extração: config salva (edição) tem prioridade; senão tenta auto-detectar
    const savedExtract = clinic?.steps?._extract
    setExtract(
      hasAnyRule(savedExtract)
        ? { ...emptyExtract(), ...savedExtract }
        : autoDetectExtract(panel.sampleCards ?? [])
    )

    // dimensões: config salva tem prioridade; senão usa a sugestão automática
    const existingDims = clinic?.steps?._dims
    setDimensions(
      existingDims && Object.keys(existingDims).length
        ? dimsToState(existingDims)
        : seedFromSuggestions(panel.tags ?? [])
    )

    setQuick(true)   // cai na tela de confirmação; "Ajustar manualmente" abre o passo-a-passo
    setStep(2)
  })

  // Config Clinicorp a salvar: cada unidade com usuário + token preenchidos
  // ativa a integração dela; token em branco na edição mantém o existente.
  // subscriber_id da Clinicorp é sempre igual ao Usuário API — não duplica.
  // crcMap vai POR UNIDADE (u.crcNames): só as linhas com nome preenchido.
  const clinicorpConfig = () => {
    const units = ccUnits
      .map(u => ({
        label: u.label.trim(),
        tagId: u.tagId || null,
        user:  u.user.trim(),
        token: u.token.trim() || u.existingToken || '',
        // Grava a data de HOJE só na 1ª vinculação desta unidade; edições
        // depois preservam o valor original — o corte de histórico do sync
        // fica travado na vinculação real, nunca recalculado.
        syncSince: u.syncSince || new Date().toISOString().slice(0, 10),
        ...(u.codeLink.trim() ? { codeLink: u.codeLink.trim() } : {}),
        crcMap: Object.entries(u.crcNames ?? {})
          .filter(([, name]) => name.trim())
          .map(([tagId, name]) => ({ tagId, tagName: tagName(tagId), clinicorpName: name.trim() })),
      }))
      .filter(u => u.user && u.token)
    return units.length ? { units } : null
  }

  // ── Salvar ───────────────────────────────────────────────────────────────
  const save = () => run(async () => {
    const finalExtract = withAutoTime(extract)
    const payload = {
      accountId: selectedPanel.companyId,
      name:      name.trim(),
      slug,
      token:     token.trim(),
      panelId:   selectedPanel.id,
      ticket:    Number(ticket) || null,
      steps:     buildStepsConfig(mappedSteps, finalExtract, stateToDims(dimensions, tagName), {
        stages: funnelStages,
        mergeCancelledRescheduled: mergeCancelReagend,
      }, clinicorpConfig(), deriveDatesConfig(finalExtract), { hasIA }),
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

  const addDimension     = ()              => setDimensions(ds => [...ds, { id: newDimId(), label: '', isUnit: false, customFieldKey: null, tags: [] }])
  const removeDimension  = (id)            => setDimensions(ds => ds.filter(d => d.id !== id))
  // customFieldKey: null = fonte "Etiquetas" · '' = "Campo personalizado" com
  // campo ainda não escolhido · 'key' = escolhido. `?? null` (não `|| null`):
  // o `||` engolia o '' e o seletor voltava sozinho para "Etiquetas".
  const setDimCustomField = (id, key)      => setDimensions(ds => ds.map(d => d.id === id ? { ...d, customFieldKey: key ?? null, ...(key != null ? { isUnit: false } : {}) } : d))
  // Marca (ou desmarca) uma dimensão como a unidade — exclusivo: só uma pode ser
  const toggleUnitDim    = (id)            => setDimensions(ds => ds.map(d => ({ ...d, isUnit: d.id === id ? !d.isUnit : false })))
  const renameDimension  = (id, label)     => setDimensions(ds => ds.map(d => d.id === id ? { ...d, label } : d))
  const addTagToDim      = (id, tid)       => setDimensions(ds => ds.map(d => d.id === id ? { ...d, tags: [...d.tags, { tid, label: tagName(tid) }] } : d))
  const removeTagFromDim = (id, tid)       => setDimensions(ds => ds.map(d => d.id === id ? { ...d, tags: d.tags.filter(t => t.tid !== tid) } : d))
  const renameTagLabel   = (id, tid, label) => setDimensions(ds => ds.map(d => d.id === id ? { ...d, tags: d.tags.map(t => t.tid === tid ? { ...t, label } : t) } : d))

  // Tipos de métrica realmente em uso nesta clínica (exclui "Ignorar") — só eles
  // aparecem como opção de checkbox no passo do funil.
  const usedTypes = [...new Set(mappedSteps.filter(s => s.type !== 'ignore').map(s => s.type))]
  const toggleStageType = (stageKey, type) =>
    setFunnelStages(fs => {
      const current = fs[stageKey] ?? []
      return { ...fs, [stageKey]: current.includes(type) ? current.filter(t => t !== type) : [...current, type] }
    })

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
          {!quick && <div className="mt-2"><Stepper current={step} /></div>}
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

      {/* ── Configuração rápida: detecta tudo, admin confirma ────────────── */}
      {step === 2 && quick && (() => {
        const usableSteps = mappedSteps.filter(s => s.type !== 'ignore')
        const extractRows = EXTRACT_FIELDS.map(f => ({
          ...f,
          hits: countExtractHits(extract[f.key], sampleCards, f.kind),
        }))
        const dateRow = extractRows.find(r => r.key === 'date')
        const total   = sampleCards.length
        const unitLabel = dimensions.find(d => d.isUnit && d.label.trim() && d.tags.length)?.label.trim() ?? null
        const Check = ({ ok }) => (
          <span className={`shrink-0 text-sm ${ok ? 'text-emerald-600' : 'text-amber-500'}`}>{ok ? '✓' : '⚠'}</span>
        )
        return (
          <div className="space-y-4">
            <StepHeader title="Configuração rápida">
              Detectamos tudo a partir do painel <strong>{selectedPanel.title}</strong>. Confira e ative —
              ou abra o passo-a-passo para ajustar.
            </StepHeader>

            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              {/* Métricas */}
              <div className="flex items-start gap-3 px-4 py-3.5">
                <Check ok={usableSteps.length > 0} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-800">{usableSteps.length} etapas mapeadas</div>
                  <div className="text-xs text-slate-400 mt-0.5 truncate">
                    {usableSteps.map(s => s.title).join(' · ') || 'Nenhuma etapa mapeada — ajuste manualmente.'}
                  </div>
                </div>
              </div>

              {/* Extração */}
              <div className="flex items-start gap-3 px-4 py-3.5">
                <Check ok={!total || dateRow.hits > 0} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-800">Dados do paciente</div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400 mt-0.5">
                    {extractRows.map(r => (
                      <span key={r.key}>
                        {r.label.replace(' de agendamento', '')}:{' '}
                        <span className={`font-mono ${r.hits ? 'text-emerald-600' : 'text-slate-300'}`}>
                          {total ? `${r.hits}/${total}` : '—'}
                        </span>
                      </span>
                    ))}
                  </div>
                  {total > 0 && dateRow.hits === 0 && (
                    <div className="text-[11px] text-amber-600 mt-1">
                      Não achamos a data nos cards — sem ela o dashboard fica vazio. Ajuste manualmente.
                    </div>
                  )}
                </div>
              </div>

              {/* Dimensões */}
              <div className="flex items-start gap-3 px-4 py-3.5">
                <Check ok />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-800">
                    {reviewDims.length} {reviewDims.length === 1 ? 'dimensão' : 'dimensões'}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 truncate">
                    {reviewDims.length
                      ? reviewDims.map(d => d.label + (d.label === unitLabel ? ' (unidade)' : '')).join(' · ')
                      : 'Sem etiquetas para separar atendimentos.'}
                  </div>
                </div>
              </div>

              {/* Ticket */}
              <div className="flex items-start gap-3 px-4 py-3.5">
                <Check ok />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-800">Ticket médio · R$ {Number(ticket).toLocaleString('pt-BR')}</div>
                  <div className="text-xs text-slate-400 mt-0.5">Usado quando o card não tem valor.</div>
                </div>
              </div>

              {/* IA no agendamento */}
              <div className="flex items-start gap-3 px-4 py-3.5">
                <label className="flex items-start gap-3 cursor-pointer w-full">
                  <input type="checkbox" className="mt-0.5" checked={hasIA} onChange={e => setHasIA(e.target.checked)} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-800">Esta clínica usa IA para agendar?</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Habilita/oculta o KPI "Tempo até agendar" (só faz sentido medir tempo humano quando não há IA).
                    </div>
                  </div>
                </label>
              </div>

              {/* Clinicorp (opcional) */}
              <div className="flex items-start gap-3 px-4 py-3.5">
                <Check ok />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-800">
                    Clinicorp · {clinicorpConfig()
                      ? `vinculado (${clinicorpConfig().units.map(u => u.user).join(', ')})`
                      : 'não vinculado'}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Opcional — para vincular, use "Ajustar manualmente" e informe Usuário API + Token na aba Clinicorp.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button onClick={() => setStep(1)} className="text-sm text-slate-500 hover:text-slate-900">← Voltar</button>
              <div className="flex items-center gap-2">
                <button onClick={() => setQuick(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                  Ajustar manualmente
                </button>
                <button onClick={save} disabled={loading}
                  className="px-5 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40">
                  {loading ? 'Salvando...' : isEdit ? 'Salvar e ativar' : 'Ativar dashboard'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Etapa 3: mapeamento de métricas ──────────────────────────────── */}
      {step === 2 && !quick && (
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
          <div className="bg-white border border-slate-200 rounded-xl p-4 max-w-xs">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" className="mt-0.5" checked={hasIA} onChange={e => setHasIA(e.target.checked)} />
              <div>
                <div className="text-sm font-medium text-slate-800">Esta clínica usa IA para agendar?</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Habilita/oculta o KPI "Tempo até agendar" (só faz sentido medir tempo humano quando não há IA).
                </div>
              </div>
            </label>
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(1)} className="text-sm text-slate-500 hover:text-slate-900">← Voltar</button>
            <button onClick={goMetrics}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-700">
              Funil →
            </button>
          </div>
        </div>
      )}

      {/* ── Etapa 4: funil de pipeline ───────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <StepHeader title="Componha o funil de pipeline">
            Escolha quais etapas somam em cada barra do funil mostrado no dashboard —
            cada clínica organiza o painel Helena do seu jeito.
          </StepHeader>

          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            <div className="px-4 py-3.5">
              <div className="text-sm font-semibold text-slate-800">Leads totais</div>
              <p className="text-xs text-slate-400 mt-0.5">
                1ª barra do funil — sempre o total de cards que entraram no período. Não é configurável.
              </p>
            </div>
            {FUNNEL_STAGE_DEFS.map(stage => (
              <div key={stage.key} className="px-4 py-3.5">
                <div className="text-sm font-semibold text-slate-800 mb-2">{stage.label}</div>
                <div className="flex flex-wrap gap-1.5">
                  {usedTypes.length === 0 && (
                    <span className="text-xs text-slate-400">Mapeie etapas na tela anterior primeiro.</span>
                  )}
                  {usedTypes.map(type => {
                    const t = METRIC_TYPES.find(m => m.value === type)
                    const checked = (funnelStages[stage.key] ?? []).includes(type)
                    return (
                      <button type="button" key={type} onClick={() => toggleStageType(stage.key, type)}
                        className={`text-xs px-2.5 py-1.5 rounded-md border font-medium transition-colors ${
                          checked ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}>
                        {t?.label ?? type}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-slate-800 mb-0.5">Não agendou <span className="font-normal text-slate-400">(estatística ao lado do funil, não é uma das barras)</span></div>
            <p className="text-xs text-slate-400 mb-2">Aparece junto com Faltaram/Cancelaram/Remarcaram, embaixo do funil.</p>
            <div className="flex flex-wrap gap-1.5">
              {usedTypes.length === 0 && (
                <span className="text-xs text-slate-400">Mapeie etapas na tela anterior primeiro.</span>
              )}
              {usedTypes.map(type => {
                const t = METRIC_TYPES.find(m => m.value === type)
                const checked = (funnelStages.naoAgendou ?? []).includes(type)
                return (
                  <button type="button" key={type} onClick={() => toggleStageType('naoAgendou', type)}
                    className={`text-xs px-2.5 py-1.5 rounded-md border font-medium transition-colors ${
                      checked ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}>
                    {t?.label ?? type}
                  </button>
                )
              })}
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-slate-600 bg-white border border-slate-200 rounded-xl p-4 cursor-pointer">
            <input type="checkbox" checked={mergeCancelReagend} onChange={e => setMergeCancelReagend(e.target.checked)} />
            Unificar "Cancelou" e "Reagendamento" em uma única métrica no rodapé do funil
          </label>
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(2)} className="text-sm text-slate-500 hover:text-slate-900">← Voltar</button>
            <button onClick={() => setStep(4)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-700">
              Extração de dados →
            </button>
          </div>
        </div>
      )}

      {/* ── Etapa 5: extração ────────────────────────────────────────────── */}
      {step === 4 && (
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
            {EXTRACT_FIELDS
              // "Agendado Para" é campo único data+hora (customField) → o campo
              // Horário é redundante (a hora já vem embutida na mesma string) e
              // seria sobrescrito automaticamente ao salvar, ver deriveDatesConfig.
              .filter(f => f.key !== 'time' || !customFieldKeyOf(extract.date))
              .map(f => (
                <ExtractField
                  key={f.key} field={f} rules={extract[f.key]} sampleCards={sampleCards}
                  customFields={panelCustomFields}
                  onChange={rules => setExtract(ex => ({ ...ex, [f.key]: rules }))}
                />
              ))}
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(3)} className="text-sm text-slate-500 hover:text-slate-900">← Voltar</button>
            <button onClick={() => setStep(5)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-700">
              Dimensões →
            </button>
          </div>
        </div>
      )}

      {/* ── Etapa 6: dimensões (etiquetas de card) ───────────────────────── */}
      {step === 5 && (
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
                        placeholder="Nome da dimensão (ex: Origem, Campanha)"
                        value={d.label} onChange={e => renameDimension(d.id, e.target.value)} />
                      <select
                        value={d.customFieldKey != null ? 'customField' : 'tag'}
                        onChange={e => setDimCustomField(d.id, e.target.value === 'customField' ? (d.customFieldKey ?? '') : null)}
                        title="Fonte do corte"
                        className="text-xs px-2 py-1.5 rounded-md border border-slate-200 text-slate-600 bg-white shrink-0 cursor-pointer">
                        <option value="tag">Etiquetas</option>
                        <option value="customField">Campo personalizado</option>
                      </select>
                      {d.customFieldKey == null && (
                        <button type="button" onClick={() => toggleUnitDim(d.id)}
                          title="Usar esta dimensão como filtro de unidade no topo do dashboard"
                          className={`text-xs px-2.5 py-1.5 rounded-md border shrink-0 font-medium transition-colors ${
                            d.isUnit
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                              : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}>
                          {d.isUnit ? '🏢 Unidade ✓' : 'É unidade?'}
                        </button>
                      )}
                      <button onClick={() => removeDimension(d.id)}
                        className="text-xs px-2.5 py-1.5 rounded-md border border-red-200 text-red-500 hover:bg-red-50 shrink-0">
                        Remover
                      </button>
                    </div>

                    {d.customFieldKey !== null ? (() => {
                      // Mesma convenção da Extração: card.customFields é indexado por
                      // id interno ou key (nunca pelo nome exibido) — testa os dois
                      // contra as amostras e usa o que bate, sem o admin precisar saber.
                      const current = d.customFieldKey
                        ? panelCustomFields.find(cf => cf.key === d.customFieldKey || cf.id === d.customFieldKey)
                        : null
                      return (
                        <div className="flex items-center gap-2">
                          <select
                            value={current?.id ?? ''}
                            onChange={e => {
                              const cf = panelCustomFields.find(f => f.id === e.target.value)
                              if (!cf) { setDimCustomField(d.id, ''); return }
                              const candidates = [cf.key, cf.id].filter(Boolean)
                              let bestKey = candidates[0], bestHits = -1
                              for (const k of candidates) {
                                const hits = countExtractHits([{ from: `customFields.${k}` }], sampleCards, 'text')
                                if (hits > bestHits) { bestHits = hits; bestKey = k }
                              }
                              setDimCustomField(d.id, bestKey)
                            }}
                            className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:border-slate-400">
                            <option value="">{panelCustomFields.length ? 'Selecione o campo…' : 'Nenhum campo personalizado encontrado'}</option>
                            {panelCustomFields.map(cf => (
                              <option key={cf.id} value={cf.id}>{cf.name}{cf.type ? ` (${cf.type})` : ''}</option>
                            ))}
                          </select>
                          {/* Paridade com a Extração: campo que não aparece no dropdown
                              (ex: vazio em todos os cards) entra pela key digitada. */}
                          <input
                            className="w-44 shrink-0 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:border-slate-400 font-mono"
                            placeholder="ou digite a key"
                            value={d.customFieldKey ?? ''}
                            onChange={e => setDimCustomField(d.id, e.target.value)}
                          />
                        </div>
                      )
                    })() : (
                      <>
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
                      </>
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
            <button onClick={() => setStep(4)} className="text-sm text-slate-500 hover:text-slate-900">← Voltar</button>
            <button onClick={() => setStep(6)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-700">
              Clinicorp →
            </button>
          </div>
        </div>
      )}

      {/* ── Etapa 7: integração Clinicorp (OPCIONAL, N unidades) ─────────── */}
      {step === 6 && (() => {
        const multiUnit = ccUnits.length > 1
        // Etiquetas candidatas ao mapa CRC: exclui as usadas para IDENTIFICAR
        // unidade (BUENO/ELDORADO) — essas nunca são "quem agendou". Se existir
        // uma dimensão de agendador (label contém "agendador"/"crc"), restringe
        // a essas tags; senão, mostra todas as não-unidade.
        const unitTagIds = new Set(ccUnits.map(u => u.tagId).filter(Boolean))
        const agendadorDim = dimensions.find(d => /agendador|crc/i.test(d.label))
        const crcTags = agendadorDim
          ? panelTags.filter(t => agendadorDim.tags.some(dt => dt.tid === t.id))
          : panelTags.filter(t => !unitTagIds.has(t.id))
        return (
        <div className="space-y-4">
          <StepHeader title="Integração Clinicorp (opcional)">
            Clínicas que usam o Clinicorp têm o painel movimentado automaticamente
            (compareceu, faltou, cancelou, orçamento aprovado com valor).
            Sem Clinicorp? Só avance — nada muda para esta clínica.
            {' '}Clínica com mais de uma unidade (ex: dois endereços, uma conta
            Clinicorp cada) que compartilham o mesmo painel Helena? Adicione uma
            unidade para cada e escolha a etiqueta que identifica os cards dela.
          </StepHeader>

          <div className="space-y-3">
            {ccUnits.map((u, i) => (
              <div key={u.id} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-800">
                    {multiUnit ? `Unidade ${i + 1}` : 'Credenciais Clinicorp'}
                  </h4>
                  {ccUnits.length > 1 && (
                    <button onClick={() => removeCcUnit(u.id)}
                      className="text-xs px-2.5 py-1.5 rounded-md border border-red-200 text-red-500 hover:bg-red-50">
                      Remover
                    </button>
                  )}
                </div>

                {multiUnit && (
                  <Field label="Rótulo da unidade" hint="Só para você identificar nesta tela (ex: Bueno, Eldorado).">
                    <input className={inputCls} value={u.label}
                      onChange={e => updateCcUnit(u.id, { label: e.target.value })} placeholder="ex: Bueno" />
                  </Field>
                )}

                <Field label="Usuário API" hint='Em Gerenciar Assinatura → Acesso Externo e Integrações → "Integrações - Usuário API". Também é o subscriber_id.'>
                  <input className={`${inputCls} font-mono`} value={u.user}
                    onChange={e => updateCcUnit(u.id, { user: e.target.value })} placeholder="ex: lumineodonto" autoComplete="off" />
                </Field>
                <Field
                  label="Token API"
                  hint={u.existingToken
                    ? `Token atual: ${u.existingToken.slice(0, 8)}…${u.existingToken.slice(-4)} — deixe em branco para mantê-lo.`
                    : 'Campo "Token API" da mesma tela. Fica salvo apenas no servidor.'}
                >
                  <input className={`${inputCls} font-mono`} type="password" value={u.token}
                    onChange={e => updateCcUnit(u.id, { token: e.target.value })}
                    placeholder={u.existingToken ? '(mantém o atual)' : 'ex: 3ca6bf45-db46-...'} autoComplete="off" />
                </Field>
                <Field label="Code Link da agenda (opcional)" hint="Só é usado para criar agendamento online via API — pode deixar vazio.">
                  <input className={`${inputCls} font-mono`} value={u.codeLink}
                    onChange={e => updateCcUnit(u.id, { codeLink: e.target.value })} placeholder="ex: 86816" autoComplete="off" />
                </Field>

                {multiUnit && (
                  <Field label="Etiqueta que identifica esta unidade" hint="O sync usa a etiqueta do card para saber em qual conta Clinicorp buscar o paciente.">
                    {panelTags.length === 0 ? (
                      <p className="mt-1 text-xs text-amber-600">
                        Este painel não tem etiquetas — sem elas o sync não sabe separar as unidades. Crie uma etiqueta por unidade na Helena antes de vincular.
                      </p>
                    ) : (
                      <select className={inputCls} value={u.tagId} onChange={e => updateCcUnit(u.id, { tagId: e.target.value })}>
                        <option value="">Selecione a etiqueta…</option>
                        {panelTags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    )}
                  </Field>
                )}

                {u.user.trim() && !u.token.trim() && !u.existingToken && (
                  <p className="text-xs text-amber-600">Informe o Token API para ativar esta unidade — ou remova-a para seguir sem Clinicorp.</p>
                )}

                {crcTags.length > 0 && u.user.trim() && (u.token.trim() || u.existingToken) && (() => {
                  const unitKey = u.label || u.user
                  const unitUsers = ccUsers.filter(cu => cu.unit === unitKey)
                  const datalistId = `cc-users-list-${u.id}`
                  return (
                    <div className="pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between gap-3">
                        <h5 className="text-xs font-semibold text-slate-700">Mapa de CRC desta unidade (quem agendou)</h5>
                        <button
                          onClick={() => run(async () => {
                            setCcUsersLoading(true); setCcUsersError(null)
                            try {
                              const { users, errors } = await getClinicorpUsers(clinicorpConfig().units, clinic?.accountId)
                              setCcUsers(users)
                              if (errors?.length) setCcUsersError(errors.join(' · '))
                            } finally { setCcUsersLoading(false) }
                          })}
                          disabled={ccUsersLoading}
                          className="text-[11px] px-2 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 shrink-0">
                          {ccUsersLoading ? 'Buscando...' : ccUsers.length ? 'Recarregar usuários ↻' : 'Buscar usuários do Clinicorp'}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 mb-2">
                        Por unidade: a mesma pessoa pode ter usuário diferente cadastrado em cada conta
                        Clinicorp. Sem vínculo aqui, o card desta unidade é criado sem etiqueta de CRC.
                      </p>
                      {ccUsersError && <p className="text-[11px] text-amber-600 mb-2">{ccUsersError}</p>}
                      <datalist id={datalistId}>
                        {unitUsers.map(cu => <option key={cu.fullName} value={cu.fullName} />)}
                      </datalist>
                      <div className="space-y-1.5">
                        {crcTags.map(t => (
                          <div key={t.id} className="flex items-center gap-2">
                            <div className="w-28 shrink-0"><TagChip tag={t} /></div>
                            <span className="text-slate-300 text-xs shrink-0">→</span>
                            <input
                              list={datalistId}
                              className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:border-slate-400"
                              placeholder="Nome no Clinicorp — comece a digitar para sugerir"
                              value={u.crcNames?.[t.id] ?? ''} onChange={e => setCrcName(u.id, t.id, e.target.value)} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            ))}
          </div>

          <button onClick={addCcUnit}
            className="w-full py-2.5 text-sm font-medium rounded-xl border border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700">
            + Adicionar unidade (outra conta Clinicorp no mesmo painel)
          </button>

          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(5)} className="text-sm text-slate-500 hover:text-slate-900">← Voltar</button>
            <button onClick={() => setStep(7)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-700">
              Revisar →
            </button>
          </div>
        </div>
        )
      })()}

      {/* ── Etapa 8: revisão ─────────────────────────────────────────────── */}
      {step === 7 && (() => {
        const finalExtractReview = withAutoTime(extract)
        const datesCfg = deriveDatesConfig(finalExtractReview)
        return (
        <div className="space-y-4">
          <StepHeader title="Revisão">Confira a configuração antes de {isEdit ? 'salvar as alterações' : 'cadastrar a clínica'}.</StepHeader>
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {[
              ['Clínica',     name],
              ['URL',         <code key="u" className="font-mono text-xs text-indigo-600">/?clinic={slug}</code>],
              ['Painel',      `${selectedPanel.title} (${selectedPanel.key})`],
              ['Account ID',  <code key="a" className="font-mono text-xs text-slate-500">{selectedPanel.companyId}</code>],
              ['Token',       token.trim() ? 'Novo token informado' : (isEdit ? `Mantém o atual (${clinic.tokenMasked})` : '—')],
              ['Agendado Para', datesCfg?.scheduledFor?.key
                ? <code key="sf" className="font-mono text-xs text-emerald-600">customFields.{datesCfg.scheduledFor.key}</code>
                : <span key="sf" className="text-slate-400">— não configurado (legado)</span>],
              ['Agendado em', datesCfg?.createdAt?.key
                ? <code key="ca" className="font-mono text-xs text-emerald-600">customFields.{datesCfg.createdAt.key}</code>
                : <span key="ca" className="text-slate-400">— não configurado (opcional)</span>],
              ['Fechado em', datesCfg?.closedAt?.key
                ? <code key="fe" className="font-mono text-xs text-emerald-600">customFields.{datesCfg.closedAt.key}</code>
                : <span key="fe" className="text-slate-400">— não configurado (opcional)</span>],
              ['Clinicorp',   clinicorpConfig()
                ? <span key="cc" className="text-emerald-600 font-medium">
                    Vinculado · {clinicorpConfig().units.map(u => u.label ? `${u.label} (${u.user})` : u.user).join(' · ')}
                  </span>
                : <span key="cc" className="text-slate-400">Sem Clinicorp (opcional)</span>],
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
            <div className="px-4 py-3">
              <div className="text-sm text-slate-500 mb-2">Funil</div>
              <div className="space-y-1.5">
                {FUNNEL_STAGE_DEFS.map(stage => (
                  <div key={stage.key} className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-slate-700 shrink-0">{stage.label}:</span>
                    <span className="text-xs text-slate-500">
                      {(funnelStages[stage.key] ?? []).map(t => METRIC_TYPES.find(m => m.value === t)?.label ?? t).join(', ') || '—'}
                    </span>
                  </div>
                ))}
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-slate-700 shrink-0">Não agendou (estatística):</span>
                  <span className="text-xs text-slate-500">
                    {(funnelStages.naoAgendou ?? []).map(t => METRIC_TYPES.find(m => m.value === t)?.label ?? t).join(', ') || '—'}
                  </span>
                </div>
                {mergeCancelReagend && (
                  <div className="text-xs text-slate-500">Cancelou e Reagendamento unificados no rodapé do funil</div>
                )}
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
            {clinicorpConfig() && (
              <div className="px-4 py-3">
                <div className="text-sm text-slate-500 mb-2">Mapa de CRC</div>
                <div className="space-y-2">
                  {clinicorpConfig().units.map(u => {
                    const pairs = u.crcMap ?? []
                    return (
                      <div key={u.user} className="flex items-baseline gap-2">
                        <span className="text-xs font-semibold text-slate-700 shrink-0">{u.label || u.user}:</span>
                        <span className="text-xs text-slate-500">
                          {pairs.length
                            ? pairs.map(p => `${p.tagName} → ${p.clinicorpName}`).join(', ')
                            : 'nenhuma etiqueta vinculada — cards desta unidade ficam sem CRC'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(6)} className="text-sm text-slate-500 hover:text-slate-900">← Voltar</button>
            <button onClick={save} disabled={loading}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40">
              {loading ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Cadastrar clínica'}
            </button>
          </div>
        </div>
        )
      })()}
    </div>
  )
}
