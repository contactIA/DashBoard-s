# Listar Mensagens de uma Conversa

## Informações Gerais

**Descrição:** Listagem paginada de mensagens por ID de uma conversa.

---

## Detalhes da Requisição

### Método HTTP
`GET`

### Endpoint
```
https://api.wts.chat/chat/v1/session/{id}/message
```

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | uuid | Sim | Identificador único da conversa |

### Query Parameters

| Parâmetro | Tipo | Intervalo | Padrão | Descrição |
|-----------|------|-----------|--------|-----------|
| `PageNumber` | int32 | 0 a 2147483647 | 1 | Número da página solicitada |
| `PageSize` | int32 | 1 a 100 | 15 | Quantidade de registros por página |
| `OrderBy` | string | — | — | Campo utilizado como critério de ordenação |
| `OrderDirection` | string | — | — | Direção da ordenação: `ASCENDING` ou `DESCENDING` |
| `CreatedAt.Before` | date-time | — | — | Limite superior de data de criação (UTC) |
| `CreatedAt.After` | date-time | — | — | Limite inferior de data de criação (UTC) |
| `UpdatedAt.Before` | date-time | — | — | Limite superior de data de atualização (UTC) |
| `UpdatedAt.After` | date-time | — | — | Limite inferior de data de atualização (UTC) |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Requisição bem-sucedida |
| 500 | Server Error | Erro no servidor |

---

## Autenticação

Autenticação via header é necessária.

---

## Observações

- A API suporta paginação completa com controle granular do tamanho e número da página
- Filtros temporais utilizam fuso horário UTC
- Ordenação flexível por qualquer campo disponível
