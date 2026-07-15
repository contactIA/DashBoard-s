# Listar Mensagens Agendadas

## Informações Gerais

**Método HTTP:** GET

**URL do Endpoint:** `https://api.wts.chat/chat/v1/scheduled-message`

**Fonte:** https://flwchat.readme.io/reference/get_v1-scheduled-message

---

## Descrição

Listagem paginada de mensagens agendadas com filtros opcionais.

---

## Parâmetros de Query

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `ScheduledAt.Before` | date-time | Não | Limite superior de busca em UTC |
| `ScheduledAt.After` | date-time | Não | Limite inferior de busca em UTC |
| `IncludeDetails` | array de strings | Não | Detalhes a incluir na resposta |
| `Status` | string (enum) | Não | Filtrar por status: `SCHEDULED`, `PROCESSED`, `SENT`, `DELIVERED`, `READ`, `CANCELED`, `FAILED` |
| `Type` | string (enum) | Não | Filtrar por tipo de mensagem: `TEMPLATE`, `CHATBOT` |
| `From` | string | Não | ID ou número de telefone do canal |
| `To` | string | Não | ID ou número de telefone do destinatário |
| `User` | string | Não | ID ou nome do usuário |
| `Department` | string | Não | ID ou nome da equipe |
| `CreatedAt.Before` | date-time | Não | Limite superior de criação em UTC |
| `CreatedAt.After` | date-time | Não | Limite inferior de criação em UTC |
| `UpdatedAt.Before` | date-time | Não | Limite superior de atualização em UTC |
| `UpdatedAt.After` | date-time | Não | Limite inferior de atualização em UTC |
| `PageNumber` | int32 | Não | Número da página (padrão: 1) |
| `PageSize` | int32 (1-100) | Não | Tamanho da página (padrão: 15) |
| `OrderBy` | string | Não | Campo para ordenação |
| `OrderDirection` | string (enum) | Não | `ASCENDING` ou `DESCENDING` |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Sucesso |
| 500 | Server Error | Erro no servidor |

---

## Informações Adicionais

- **Autenticação:** Requerida (via header)
- Suporta integração com plataformas como MAKE e N8N
