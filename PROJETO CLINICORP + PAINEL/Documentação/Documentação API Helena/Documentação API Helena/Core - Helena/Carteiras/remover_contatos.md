# Remover Contatos em Massa de uma Carteira

## Informações Gerais

**Método HTTP:** DELETE

**Endpoint:** `https://api.wts.chat/core/v1/portfolio/{id}/contact/batch`

**Descrição:** Remova contatos de uma carteira adicionando um filtro.

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | UUID | Sim | Identificador da carteira |

### Body Parameters (Filtro de busca dos contatos)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `contactIds` | Array de UUIDs | Não | Lista de IDs dos contatos a remover |
| `phoneNumbers` | Array de strings | Não | Lista de números de telefone dos contatos a remover |

---

## Respostas

| Código | Descrição |
|--------|-----------|
| 200 | Sucesso |
| 500 | Erro no servidor |

---

## Observações

- Requer autenticação via header.
- Suporta exemplos em múltiplas linguagens: Shell, Node, Ruby, PHP, Python.
- Integrado ao sistema de autenticação da plataforma flw.chat.
