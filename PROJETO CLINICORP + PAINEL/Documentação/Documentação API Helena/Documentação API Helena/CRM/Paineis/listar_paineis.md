# Listar Painéis

## Informações Gerais

**Título:** Listar painéis

**Descrição:** Endpoint para recuperar uma lista de painéis do CRM com suporte a filtros, paginação e ordenação.

**Método HTTP:** `GET`

**URL do Endpoint:** `https://api.wts.chat/crm/v1/panel`

---

## Parâmetros de Query

| Parâmetro | Tipo | Obrigatório | Padrão | Descrição |
|-----------|------|-------------|--------|-----------|
| `Title` | string | Não | — | Filtro por título do painel |
| `IncludeDetails` | array de strings | Não | — | Especifica detalhes adicionais a incluir na resposta |
| `CreatedAt.Before` | date-time | Não | — | Limite superior de busca (fuso horário UTC) |
| `CreatedAt.After` | date-time | Não | — | Limite inferior de busca (fuso horário UTC) |
| `UpdatedAt.Before` | date-time | Não | — | Limite superior de busca (fuso horário UTC) |
| `UpdatedAt.After` | date-time | Não | — | Limite inferior de busca (fuso horário UTC) |
| `PageNumber` | int32 | Não | 1 | Número da página (0 a 2147483647) |
| `PageSize` | int32 | Não | 15 | Tamanho da página a ser obtida (1 a 100) |
| `OrderBy` | string | Não | — | Campo usado como base para ordenação |
| `OrderDirection` | string | Não | — | `ASCENDING` ou `DESCENDING` |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Requisição bem-sucedida |
| 500 | Server Error | Erro no servidor |

---

## Observações

- Autenticação via header (credenciais) é necessária.
- Todos os filtros de data utilizam fuso horário UTC.
- Suporta exemplos de código em múltiplas linguagens: Shell, Node, Ruby, PHP, Python.
- Interface interativa com opção "Try It!" para testar requisições.

---

## Fonte

URL original: `https://flwchat.readme.io/reference/get_v1-panel`
