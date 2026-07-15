# Listar Notas Internas de uma Conversa

## Informações Gerais

**Descrição:** Este endpoint permite a listagem de notas internas de um atendimento.

---

## Detalhes da Requisição

### Método HTTP
`GET`

### Endpoint
```
https://api.wts.chat/chat/v1/session/{id}/note
```

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | uuid | Sim | Identificador único da sessão/atendimento |

### Query Parameters

| Parâmetro | Tipo | Intervalo | Padrão | Descrição |
|-----------|------|-----------|--------|-----------|
| `PageNumber` | int32 | 0-2147483647 | 1 | Número da página a ser obtida |
| `PageSize` | int32 | 1-100 | 15 | Quantidade de registros por página |
| `OrderBy` | string | — | — | Campo utilizado para ordenação |
| `OrderDirection` | string | — | — | Direção da ordenação: `ASCENDING` ou `DESCENDING` |
| `CreatedAt.Before` | date-time | — | — | Limite superior de data de criação (UTC) |
| `CreatedAt.After` | date-time | — | — | Limite inferior de data de criação (UTC) |
| `UpdatedAt.Before` | date-time | — | — | Limite superior de data de atualização (UTC) |
| `UpdatedAt.After` | date-time | — | — | Limite inferior de data de atualização (UTC) |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Retorna listagem paginada de notas internas |
| 500 | Server Error | Erro no servidor |

**Content-Type da resposta:** `application/json`

---

## Autenticação

Autenticação via header é necessária.
