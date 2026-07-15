# Listar Mensagens

## Informações Gerais

**Método HTTP:** GET

**URL do Endpoint:** `https://api.wts.chat/chat/v1/message`

**Fonte:** https://flwchat.readme.io/reference/get_v1-message

---

## Descrição

Listagem paginada de mensagens por ID de uma conversa.

---

## Parâmetros de Query

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `SessionId` | UUID | Sim | Identificador único da conversa |
| `CreatedAt.Before` | date-time | Não | Limite superior de busca em UTC |
| `CreatedAt.After` | date-time | Não | Limite inferior de busca em UTC |
| `UpdatedAt.Before` | date-time | Não | Limite superior de busca em UTC |
| `UpdatedAt.After` | date-time | Não | Limite inferior de busca em UTC |
| `PageNumber` | int32 (0-2147483647) | Não | Número da página (padrão: 1) |
| `PageSize` | int32 (1-100) | Não | Quantidade por página (padrão: 15) |
| `OrderBy` | string | Não | Campo para ordenação |
| `OrderDirection` | string | Não | `ASCENDING` ou `DESCENDING` |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Retorna lista de mensagens paginada |
| 500 | Server Error | Erro do servidor |

---

## Informações Adicionais

- **Autenticação:** Requerida (via header)
- Suporta múltiplas linguagens de código (Shell, Node, Ruby, PHP, Python)
