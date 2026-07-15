# Atualizar Etiquetas

## Informações Gerais

**Método HTTP:** POST

**Endpoint:** `https://api.wts.chat/core/v1/contact/{id}/tags`

**Descrição:** Gerencia etiquetas associadas a um contato pelo seu ID.

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | UUID | Sim | ID do contato ou número de telefone |

### Body Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `tagNames` | Array de strings | Não | Lista de nomes das etiquetas (opcional se IDs forem informados) |
| `tagIds` | Array de UUIDs | Não | Lista de identificadores das etiquetas (opcional se nomes forem informados) |
| `operation` | string (enum) | Sim | Tipo de operação a executar |

### Valores Permitidos para `operation`

| Valor | Descrição |
|-------|-----------|
| `InsertIfNotExists` | Insere etiquetas não vinculadas ao contato |
| `DeleteIfExists` | Remove etiquetas já vinculadas ao contato |
| `ReplaceAll` | Remove todas as etiquetas e adiciona as informadas |

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
