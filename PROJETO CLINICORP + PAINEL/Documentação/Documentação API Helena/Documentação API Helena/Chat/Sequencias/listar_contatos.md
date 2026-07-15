# Listar Contatos de Sequência

## Informações Gerais

**Título:** Listar contatos

**Descrição:** Listagem paginada de contatos da sequência.

**Método HTTP:** `GET`

**URL do Endpoint:** `https://api.wts.chat/chat/v2/sequence/{id}/contact`

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | UUID | Sim | ID da sequência |

### Query Parameters

| Parâmetro | Tipo | Intervalo | Padrão | Descrição |
|-----------|------|-----------|--------|-----------|
| `Name` | string | — | — | Filtro por nome do contato |
| `ContactId` | UUID | — | — | Filtro por ID do contato |
| `PhoneNumber` | string | — | — | Filtro por número de telefone do contato |
| `CreatedAt.Before` | date-time | — | — | Limite superior de busca (fuso horário UTC) |
| `CreatedAt.After` | date-time | — | — | Limite inferior de busca (fuso horário UTC) |
| `UpdatedAt.Before` | date-time | — | — | Limite superior de busca (fuso horário UTC) |
| `UpdatedAt.After` | date-time | — | — | Limite inferior de busca (fuso horário UTC) |
| `PageNumber` | int32 | 0 a 2.147.483.647 | 1 | Número da página a ser obtida |
| `PageSize` | int32 | 1 a 100 | 15 | Tamanho da página a ser obtida |
| `OrderBy` | string | — | — | Campo utilizado como base para ordenação |
| `OrderDirection` | string | `ASCENDING`, `DESCENDING` | — | Direção da ordenação |
| `IncludeDetails` | array of strings | — | — | Detalhes adicionais para incluir na resposta |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Requisição bem-sucedida |
| 500 | Server Error | Erro no servidor |

---

## Observações

- Autenticação via token é necessária.
- Suporta exemplos de código em múltiplas linguagens: Shell, Node, Ruby, PHP, Python.
- Todos os filtros de data utilizam fuso horário UTC.
- Segue o padrão de paginação da API.

---

## Fonte

URL original: `https://flwchat.readme.io/reference/get_v2-sequence-id-contact`
