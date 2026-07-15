# Listar Contatos de uma Carteira

## Informações Gerais

**Método HTTP:** GET

**Endpoint:** `https://api.wts.chat/core/v1/portfolio/{id}/contact`

**Descrição:** Listagem de contatos associados a uma carteira específica.

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | UUID | Sim | Identificador da carteira |

### Query Parameters

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `CreatedAt.Before` | date-time | Data inicial de criação |
| `CreatedAt.After` | date-time | Data final de criação |
| `CreatedAt.ApplyCompanyTimezone` | boolean | Aplicar fuso horário da empresa |
| `UpdatedAt.Before` | date-time | Data inicial de atualização |
| `UpdatedAt.After` | date-time | Data final de atualização |
| `ContactIds` | array of UUIDs | Filtrar por IDs específicos |
| `Page` | int32 | Número da página |
| `PageSize` | int32 | Quantidade de itens por página |
| `OrderBy` | string | Campo para ordenação ascendente |
| `OrderByDesc` | string | Campo para ordenação descendente |
| `Type` | string (enum) | `Undefined`, `PageNumber`, `Timestamp`, `Token` |
| `NextPageToken` | string | Token para próxima página |
| `SkipCount` | boolean | Ignorar contagem total |

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
