# Listar Conversas

## Informações Gerais

**Descrição:** Listagem paginada de conversas.

---

## Detalhes da Requisição

### Método HTTP
`GET`

### Endpoint
```
https://api.wts.chat/chat/v2/session
```

---

## Parâmetros de Query

### Filtros de Status e Organização

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `Status` | array of strings | Filtra conversas pelo seu estado |
| `DepartmentId` | uuid | Identifica equipes para filtro |
| `UserId` | uuid | Seleciona usuário específico |
| `ChannelsId` | array of uuids | Filtra por canais |

### Filtros de Etiquetas e Contatos

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `TagsId` | array of uuids | Busca por identificadores de etiquetas |
| `TagsName` | array of strings | Busca por nomes de etiquetas |
| `ContactId` | uuid | Filtra conversa de contato específico |

### Filtros Temporais

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `EndAt.Before` | date-time | Limite superior de data de término (UTC) |
| `EndAt.After` | date-time | Limite inferior de data de término (UTC) |
| `ActiveAt.Before` | date-time | Limite superior de atividade (UTC) |
| `ActiveAt.After` | date-time | Limite inferior de atividade (UTC) |
| `LastInteractionAt.Before` | date-time | Limite superior de última interação (UTC) |
| `LastInteractionAt.After` | date-time | Limite inferior de última interação (UTC) |
| `CreatedAt.Before` | date-time | Limite superior de data de criação (UTC) |
| `CreatedAt.After` | date-time | Limite inferior de data de criação (UTC) |
| `UpdatedAt.Before` | date-time | Limite superior de data de atualização (UTC) |
| `UpdatedAt.After` | date-time | Limite inferior de data de atualização (UTC) |

### Filtros Adicionais

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `Type` | enum | Tipo de conversa: `INDIVIDUAL` ou `GROUP` |
| `Metadata` | object | Filtro por metadados customizados |
| `IncludeDetails` | array of strings | Inclui detalhes de outras entidades |

### Paginação e Ordenação

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `PageNumber` | int32 | 1 | Número da página |
| `PageSize` | int32 | 15 | Tamanho da página (1 a 100) |
| `OrderBy` | string | — | Campo para ordenação |
| `OrderDirection` | enum | — | `ASCENDING` ou `DESCENDING` |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Retorna listagem paginada de conversas |
| 500 | Server Error | Erro no servidor |

**Content-Type da resposta:** `application/json`

---

## Autenticação

Autenticação via header é necessária.
