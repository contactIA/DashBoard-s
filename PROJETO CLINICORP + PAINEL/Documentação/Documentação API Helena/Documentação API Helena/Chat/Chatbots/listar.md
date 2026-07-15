# Listar Chatbots

## Informações Gerais

**Descrição:** Listagem de chatbots.

---

## Detalhes da Requisição

### Método HTTP
`GET`

### Endpoint
```
https://api.wts.chat/chat/v1/chatbot
```

---

## Parâmetros de Query

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `Name` | string | Filtra chatbots pelo nome |
| `Types` | array of strings | Filtra por tipo de uso (múltiplos valores aceitos) |
| `ChannelIds` | array of uuids | Filtra por ID do canal (múltiplos valores aceitos) |
| `DefaultDepartmentIds` | array of uuids | Filtra por ID da equipe padrão (múltiplos valores) |
| `PublishStatuses` | array of strings | Filtra por status de publicação (múltiplos valores) |
| `AutomationUsages` | array of strings | Filtra por disponibilidade da automação |
| `CreatedAt.Before` | date-time | Limite superior de busca por data de criação (fuso UTC) |
| `CreatedAt.After` | date-time | Limite inferior de busca por data de criação (fuso UTC) |
| `UpdatedAt.Before` | date-time | Limite superior de busca por data de atualização (fuso UTC) |
| `UpdatedAt.After` | date-time | Limite inferior de busca por data de atualização (fuso UTC) |
| `PageNumber` | int32 | Número da página (padrão: 1) |
| `PageSize` | int32 | Tamanho da página, entre 1-100 (padrão: 15) |
| `OrderBy` | string | Campo utilizado como base para ordenação |
| `OrderDirection` | string | Direção da ordenação: `ASCENDING` ou `DESCENDING` |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Retorna a listagem de chatbots |
| 500 | Server Error | Erro no servidor |

---

## Autenticação

Autenticação via header é necessária.

---

## Observações

- Versão da API: **v1.0**
- Suporta múltiplas linguagens de exemplo: Shell, Node, Ruby, PHP, Python
