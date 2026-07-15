# Listar Cards

## Informações Gerais

**Título:** Listar Cards

**Descrição:** Listagem paginada de cards.

**Método HTTP:** `GET`

**URL do Endpoint:** `https://api.wts.chat/crm/v1/panel/card`

---

## Parâmetros de Query

| Parâmetro | Tipo | Obrigatório | Padrão | Descrição |
|-----------|------|-------------|--------|-----------|
| `PanelId` | UUID | Sim | — | Identificador do painel |
| `StepId` | UUID | Não | — | Filtro por ID da etapa |
| `ContactId` | UUID | Não | — | Filtro por ID do contato |
| `ResponsibleUserId` | UUID | Não | — | Filtro por ID do usuário responsável |
| `TextFilter` | string | Não | — | Busca realizada nos atributos textuais relevantes |
| `IncludeArchived` | boolean | Não | false | Inclui itens arquivados na listagem |
| `IncludeDetails` | array of strings | Não | — | Detalhes adicionais na resposta |
| `CreatedAt.Before` | date-time | Não | — | Limite superior de data de criação (UTC) |
| `CreatedAt.After` | date-time | Não | — | Limite inferior de data de criação (UTC) |
| `UpdatedAt.Before` | date-time | Não | — | Limite superior de data de atualização (UTC) |
| `UpdatedAt.After` | date-time | Não | — | Limite inferior de data de atualização (UTC) |
| `PageNumber` | int32 | Não | 1 | Número da página a ser obtida |
| `PageSize` | int32 | Não | 15 | Tamanho da página (1 a 100) |
| `OrderBy` | string | Não | — | Campo utilizado como base para ordenação |
| `OrderDirection` | string | Não | — | `ASCENDING` ou `DESCENDING` |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Retorna a listagem paginada de cards |
| 500 | Server Error | Erro no servidor |

---

## Observações

- O parâmetro `PanelId` é obrigatório para a listagem.
- Autenticação via header é necessária.
- Suporta exemplos de código em múltiplas linguagens: Shell, Node, Ruby, PHP, Python.
- Interface interativa com opção "Try It!" para testar requisições.

---

## Fonte

URL original: `https://flwchat.readme.io/reference/get_v1-panel-card`
