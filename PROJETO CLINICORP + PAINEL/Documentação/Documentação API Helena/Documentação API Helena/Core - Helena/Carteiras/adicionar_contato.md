# Adicionar Contato em uma Carteira

## Informações Gerais

**Método HTTP:** POST

**Endpoint:** `https://api.wts.chat/core/v1/portfolio/{id}/contact`

**Descrição:** Adicione um contato em uma carteira.

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | uuid | Sim | ID da carteira |

### Body Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `contactId` | uuid \| null | Não | Identificador do contato (filtro de busca) |
| `phoneNumber` | string \| null | Não | Número de telefone (filtro de busca) |

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
