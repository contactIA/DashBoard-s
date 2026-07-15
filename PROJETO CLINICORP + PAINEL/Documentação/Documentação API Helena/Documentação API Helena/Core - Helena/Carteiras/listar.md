# Listar Carteiras

## Informações Gerais

**Método HTTP:** GET

**Endpoint:** `https://api.wts.chat/core/v1/portfolio`

**Descrição:** Listagem paginada de carteiras.

---

## Parâmetros de Query

| Parâmetro | Tipo | Intervalo | Padrão | Descrição |
|-----------|------|-----------|--------|-----------|
| `IncludeDetails` | array of strings | — | — | Detalhes adicionais a incluir na resposta |
| `CreatedAt.Before` | date-time | — | — | Limite superior de busca, sempre em fuso horário UTC |
| `CreatedAt.After` | date-time | — | — | Limite inferior de busca, sempre em fuso horário UTC |
| `UpdatedAt.Before` | date-time | — | — | Limite superior de busca, sempre em fuso horário UTC |
| `UpdatedAt.After` | date-time | — | — | Limite inferior de busca, sempre em fuso horário UTC |
| `PageNumber` | int32 | 0 a 2147483647 | 1 | Número da página a ser obtida |
| `PageSize` | int32 | 1 a 100 | 15 | Tamanho da página a ser obtida |
| `OrderBy` | string | — | — | Nome do campo para ser utilizado como pivô da ordenação |
| `OrderDirection` | string (enum) | ASCENDING / DESCENDING | — | Determina se a ordenação deve ser crescente ou decrescente |

---

## Respostas

| Código | Descrição |
|--------|-----------|
| 200 | Sucesso |
| 500 | Erro do servidor |

---

## Observações

- Requer autenticação via header.
- Suporta exemplos em múltiplas linguagens: Shell, Node, Ruby, PHP, Python.
- Interface interativa "Try It!" disponível para testar requisições.
