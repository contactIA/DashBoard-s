# Listar Anotações de Card

## Informações Gerais

**Título:** Listar anotações

**Descrição:** Listagem paginada de anotações de um card no sistema de CRM.

**Método HTTP:** `GET`

**URL do Endpoint:** `https://api.wts.chat/crm/v1/panel/card/{cardId}/note`

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `cardId` | UUID | Sim | Identificador único do card |

### Query Parameters

| Parâmetro | Tipo | Intervalo | Padrão | Descrição |
|-----------|------|-----------|--------|-----------|
| `PageNumber` | int32 | 0 a 2147483647 | 1 | Número da página a ser obtida |
| `PageSize` | int32 | 1 a 100 | 15 | Quantidade de registros por página |
| `OrderBy` | string | — | — | Campo utilizado como base para ordenação |
| `OrderDirection` | string | `ASCENDING`, `DESCENDING` | — | Direção da ordenação |
| `CreatedAt.Before` | date-time | — | — | Data/hora máxima de criação (UTC) |
| `CreatedAt.After` | date-time | — | — | Data/hora mínima de criação (UTC) |
| `UpdatedAt.Before` | date-time | — | — | Data/hora máxima de atualização (UTC) |
| `UpdatedAt.After` | date-time | — | — | Data/hora mínima de atualização (UTC) |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Requisição bem-sucedida |
| 500 | Server Error | Erro no servidor |

---

## Observações

- Requer autenticação via headers.
- Todos os timestamps utilizam fuso horário UTC.
- A resposta é estruturada em formato JSON.
- Suporta exemplos de código em múltiplas linguagens: Shell, Node, Ruby, PHP, Python.

---

## Fonte

URL original: `https://flwchat.readme.io/reference/get_v1-panel-card-cardid-note`
