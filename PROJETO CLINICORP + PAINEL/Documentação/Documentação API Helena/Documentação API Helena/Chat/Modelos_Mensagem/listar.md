# Listar Modelos de Mensagem

## Informações Gerais

**Método HTTP:** GET

**URL do Endpoint:** `https://api.wts.chat/chat/v1/template`

**Fonte:** https://flwchat.readme.io/reference/get_v1-template

---

## Descrição

Listagem paginada de modelos de mensagem.

---

## Parâmetros de Query

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `Archived` | boolean | Não | Filtra modelos arquivados |
| `Name` | string | Não | Busca pelo nome do modelo |
| `SearchableText` | string | Não | Filtra pelo conteúdo do modelo |
| `ChannelId` | uuid | Não | Filtra por identificador do canal |
| `ApprovedOnly` | boolean | Não | Filtra pelo status de aprovação |
| `Type` | string (enum) | Não | Tipo do modelo: `QUICKREPLY`, `ATTENDANCE`, `CAMPAIGN`, `SEQUENCE`, `SCHEDULEDMESSAGE`, `AUTHENTICATION` |
| `IncludeDetails` | array of strings | Não | Detalhes adicionais para incluir na resposta |
| `CreatedAt.Before` | date-time | Não | Limite superior da data de criação (UTC) |
| `CreatedAt.After` | date-time | Não | Limite inferior da data de criação (UTC) |
| `UpdatedAt.Before` | date-time | Não | Limite superior da data de atualização (UTC) |
| `UpdatedAt.After` | date-time | Não | Limite inferior da data de atualização (UTC) |
| `PageNumber` | int32 | Não | Número da página (padrão: 1) |
| `PageSize` | int32 (1-100) | Não | Quantidade de registros por página (padrão: 15) |
| `OrderBy` | string | Não | Campo para ordenação |
| `OrderDirection` | string (enum) | Não | `ASCENDING` ou `DESCENDING` |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Retorna listagem paginada com os modelos de mensagem conforme filtros aplicados |
| 500 | Server Error | Indica falha no processamento da requisição |
