# Adicionar Contatos em Massa em uma Carteira

## Informações Gerais

**Método HTTP:** POST

**Endpoint:** `https://api.wts.chat/core/v1/portfolio/{id}/contact/batch`

**Descrição:** Adicione contatos em uma carteira adicionando um filtro.

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | uuid | Sim | Identificador único da carteira |

### Body Parameters (Filtro de busca dos contatos)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `contactIds` | array de uuids \| null | Não | Lista de identificadores de contatos |
| `phoneNumbers` | array de strings \| null | Não | Lista de números de telefone |

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
- Interface interativa "Try It!" disponível para testar requisições.
