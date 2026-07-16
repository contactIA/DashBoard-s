# Plano UX/UI — reorganização do dashboard

> **Para o executor (Sonnet):** este plano é de UX/UI APENAS — zero mudança de
> régua/cálculo (as métricas são as de `REGRAS_DASHBOARD.md`; correções de
> lógica estão em `PLANO_AGENDADOR_CAMPANHA.md`, executar aquele primeiro).
> O usuário pediu que você COMPLEMENTE este plano: os itens marcados
> [COMPLEMENTAR] são deliberadamente abertos para você propor a solução
> concreta antes de codar, apresentando ao usuário quando indicado.

## Diagnóstico (por que "a ordem está muito ruim")

1. **Masonry imprevisível**: o bloco Funil + quebras usa CSS `columns`
   (`src/App.jsx` ~linha 331) — os cartões fluem por ALTURA, então a ordem
   visual muda conforme o conteúdo cresce/encolhe. O usuário não consegue
   prever onde cada informação está; em telas diferentes a ordem é outra.
2. **Sem hierarquia de leitura**: Hero (4 números) → KPIs → Funil vêm em
   sequência, mas as quebras por dimensão (Agendador/Origem/Unidade) disputam
   espaço com o funil no mesmo bloco, e Receita detalhada aparece DEPOIS das
   quebras — o fluxo "visão geral → detalhe → ação" não existe.
3. **Nomenclatura inconsistente**: títulos de coluna variam por clínica
   (`typeLabels`) — o usuário decidiu nomenclatura FIXA (Agendados/
   Compareceram/Não fecharam/Fecharam). Padronizar em TODOS os componentes,
   não só na tabela de CRC.
4. **Avisos empilhados**: os banners de diagnóstico (cards não mapeados, sem
   data) aparecem como blocos amarelos grandes acima de tudo — informação de
   admin misturada com a visão do cliente final.
5. **Header carregado**: filtro de unidade + 4 atalhos de período + date
   picker + refresh na mesma linha; quebra mal no mobile.
6. **Tabelas de ação sem chamada**: Próximos agendamentos / Perdidos /
   Orçamentos em aberto são as partes ACIONÁVEIS (ligar para o paciente!) e
   estão visualmente iguais a tudo o resto, no fim da página.

## Nova ordem proposta (de cima para baixo)

Racional: **o dono da clínica lê de cima para baixo em 3 níveis — saúde geral
→ diagnóstico → ação**.

1. **Header** (filtros enxutos)
2. **Hero** — os 4 números que importam (mantém)
3. **Funil de pipeline** — sozinho, largura total ou 2/3 + taxas ao lado
4. **Quebras por dimensão** — grid FIXO de 2 colunas (não masonry), ordem
   fixa: Agendador → Origem → demais; donut de receita ao lado da tabela
   correspondente, não intercalado
5. **Receita** (detalhe + sem-valor por etapa)
6. **Tendência no tempo + distribuição por etapa** (mantém lado a lado)
7. **Bloco de AÇÃO** (destaque visual próprio): Próximos agendamentos →
   Perdidos (recuperáveis) → Orçamentos em aberto
8. **Campanhas** (novo, ver PLANO_AGENDADOR_CAMPANHA fase 3)
9. Footer

## Mudanças concretas

### U1 — Matar o masonry
Trocar `columns-1 lg:columns-2` por CSS Grid explícito
(`grid grid-cols-1 lg:grid-cols-2 gap-5` com posições fixas). O funil e o
card de contratos têm posição determinada; cada dimensão ocupa uma linha do
grid (tabela + donut juntos). Ordem estável em qualquer tela.

### U2 — Nomenclatura fixa em todo o dash
Auditar TODOS os componentes que usam `typeLabels` como TÍTULO (FunnelChart
rodapé, DimensionBreakdown, KpiStrip, RevenueRow, StepDistribution) e trocar
por rótulos fixos, mantendo o vocabulário da clínica apenas como texto
auxiliar (tooltip/subtítulo). [COMPLEMENTAR: propor a lista exata de rótulos
por componente e validar com o usuário antes de aplicar.]

### U3 — Avisos de admin discretos
Banners de diagnóstico viram uma linha compacta/recolhível (ex: ícone ⚠ no
header com contagem; expande ao clicar). Cliente final não precisa ver um
bloco amarelo gigante sobre steps não mapeados que só o admin resolve.

### U4 — Header responsivo
Agrupar período (atalhos + picker) num único controle; filtro de unidade
permanece à esquerda dos períodos; refresh vira ícone pequeno. Testar em
375px de largura. [COMPLEMENTAR: propor o layout mobile do header.]

### U5 — Bloco de ação com identidade
Seção "Para agir agora" com os 3 cartões (Próximos/Perdidos/Em aberto), com
contagem no título e destaque visual (borda/fundo levemente diferente) — é a
parte que gera ligação/receita, deve parecer diferente de relatório.

### U6 — Estados de carregamento e vazio
Skeleton loaders nos blocos principais (hoje só há um spinner central);
mensagens de vazio consistentes (hoje cada componente escreve a sua).
[COMPLEMENTAR: padrão único de empty-state.]

### U7 — Mobile pass
Depois de U1-U6, passada completa em 375/768px: tabelas com scroll horizontal
próprio, hero em 2x2, funil legível. [COMPLEMENTAR: relatório de problemas
encontrados + correções.]

## Ordem de execução sugerida
1. U1 (grid fixo) — resolve a reclamação principal ("ordem ruim") sozinho.
2. U2 (nomenclatura) — junto com a FASE 2 do plano de Agendador.
3. U5 (bloco de ação) + posição da seção Campanhas.
4. U3, U4, U6, U7.

## Guardrails
- ❌ Nenhuma mudança de cálculo/régua — só apresentação e ordem.
- ❌ Não esconder dado que existe hoje (mover ≠ remover); qualquer remoção
  precisa de aprovação explícita do usuário.
- ❌ Screenshot antes/depois de cada fase para o usuário aprovar visual.
- ❌ Commit por fase, push com aprovação.
