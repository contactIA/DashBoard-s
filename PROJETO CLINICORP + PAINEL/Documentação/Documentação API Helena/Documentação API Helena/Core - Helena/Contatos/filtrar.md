# Filtrar Contatos

## Informações Gerais

**Método HTTP:** POST

**Endpoint:** `https://api.wts.chat/core/v1/contact/filter`

**Descrição:** Filtragem paginada de contatos. Os filtros são aditivos.

---

## Parâmetros do Body

### Paginação

| Parâmetro | Tipo | Padrão | Intervalo | Descrição |
|-----------|------|--------|-----------|-----------|
| `pageNumber` | int32 | 1 | 0-2147483647 | Número da página a ser obtida |
| `pageSize` | int32 | 15 | 1-100 | Tamanho da página |

### Ordenação

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `orderBy` | string | Nome do campo para ordenação |
| `orderDirection` | string (enum) | `ASCENDING` ou `DESCENDING` |

### Filtros Temporais

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `createdAt` | object | Filtro por data de criação |
| `updatedAt` | object | Filtro por data de atualização |

### Filtros de Status e Texto

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `status` | string (enum) | ACTIVE | `ACTIVE`, `ARCHIVED` ou `BLOCKED` |
| `textFilter` | string | — | Busca em atributos textuais relevantes |
| `includeDetails` | array | — | Detalhes adicionais na resposta |

### Filtros por Dados de Contato

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `name` | string | Filtro por nome |
| `phoneNumber` | string | Filtro por número de telefone |
| `email` | string | Filtro por email |
| `instagram` | string | Filtro por usuário Instagram |

### Filtros por Categorias

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `tagIds` | array de UUIDs | IDs das etiquetas |
| `tagNames` | array de strings | Nomes das etiquetas |
| `portfolioIds` | array de UUIDs | IDs das carteiras |
| `portfolioNames` | array de strings | Nomes das carteiras |
| `origin` | string (enum) | `CREATED_BY_USER`, `CREATED_FROM_HUB` ou `IMPORTED` |

### Filtros Avançados

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `customFields` | object | Valores de campos personalizados |
| `metadata` | object | Metadados para filtragem |

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
