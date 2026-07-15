# Listar Sequências

## Informações Gerais

**Título:** Listar Sequências

**Descrição:** Listagem paginada de sequências.

**Método HTTP:** `GET`

**URL do Endpoint:** `https://api.wts.chat/chat/v1/sequence`

---

## Parâmetros de Query

| Parâmetro | Tipo | Intervalo | Padrão | Descrição |
|-----------|------|-----------|--------|-----------|
| `IncludeDetails` | array de strings | — | — | Detalhes adicionais a incluir na resposta |
| `Name` | string | — | — | Filtro por nome da sequência |
| `ContactId` | uuid | — | — | Identificador do contato |
| `CreatedAt.Before` | date-time | — | — | Limite superior de busca, sempre em fuso horário UTC |
| `CreatedAt.After` | date-time | — | — | Limite inferior de busca, sempre em fuso horário UTC |
| `UpdatedAt.Before` | date-time | — | — | Limite superior de busca, sempre em fuso horário UTC |
| `UpdatedAt.After` | date-time | — | — | Limite inferior de busca, sempre em fuso horário UTC |
| `PageNumber` | int32 | 0 a 2147483647 | 1 | Número da página a ser obtida |
| `PageSize` | int32 | 1 a 100 | 15 | Tamanho da página a ser obtida |
| `OrderBy` | string | — | — | Campo utilizado como base para ordenação |
| `OrderDirection` | string | `ASCENDING`, `DESCENDING` | — | Define a direção da ordenação (crescente ou decrescente) |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Requisição bem-sucedida |
| 500 | Server Error | Erro no servidor |

---

## Observações

- Autenticação via header é necessária.
- Suporta exemplos de código em múltiplas linguagens: Shell, Node, Ruby, PHP, Python.
- Todos os filtros de data utilizam fuso horário UTC.
- A paginação é controlada pelos parâmetros `PageNumber` e `PageSize`.

---

## Fonte

URL original: `https://flwchat.readme.io/reference/get_v1-sequence`
