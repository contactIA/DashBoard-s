# Remover Contato de uma Carteira

## Informações Gerais

**Método HTTP:** DELETE

**Endpoint:** `https://api.wts.chat/core/v1/portfolio/{id}/contact`

**Descrição:** Remova um contato de uma carteira.

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | uuid | Sim | Identificador único da carteira |

### Body Parameters (Filtro de busca do contato)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `contactId` | uuid \| null | ID do contato a ser removido |
| `phoneNumber` | string \| null | Número de telefone do contato |

---

## Respostas

| Código | Descrição |
|--------|-----------|
| 200 | Sucesso na operação |
| 500 | Erro no servidor |

---

## Observações

- Requer autenticação via header.
- Suporta exemplos em múltiplas linguagens: Shell, Node, Ruby, PHP, Python.
- Interface interativa disponível para testar requisições.
