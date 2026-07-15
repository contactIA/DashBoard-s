# Listar Contatos

## Informações Gerais

**Método HTTP:** GET

**Endpoint:** `https://api.wts.chat/core/v1/contact`

**Descrição:** Listagem paginada de contatos. Para resultados mais específicos, utilize o endpoint `/filter`.

---

## Parâmetros de Query

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `IncludeDetails` | array de strings | — | Especifica detalhes adicionais a incluir na resposta |
| `Status` | string (enum) | ACTIVE | Status dos contatos a serem listados. Valores: `ACTIVE`, `ARCHIVED`, `BLOCKED` |
| `CreatedAt.Before` | date-time | — | Limite superior de busca em UTC |
| `CreatedAt.After` | date-time | — | Limite inferior de busca em UTC |
| `UpdatedAt.Before` | date-time | — | Limite superior de busca em UTC |
| `UpdatedAt.After` | date-time | — | Limite inferior de busca em UTC |
| `PageNumber` | int32 (0-2147483647) | 1 | Número da página a ser obtida |
| `PageSize` | int32 (1-100) | 15 | Tamanho da página a ser obtida |
| `OrderBy` | string | — | Campo utilizado como pivô da ordenação |
| `OrderDirection` | string (enum) | — | Determina se a ordenação deve ser crescente ou decrescente. Valores: `ASCENDING`, `DESCENDING` |

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
