# Remover Contato de Sequência

## Informações Gerais

**Título:** Remover contato

**Descrição:** Remova um contato de uma sequência.

**Método HTTP:** `DELETE`

**URL do Endpoint:** `https://api.wts.chat/chat/v1/sequence/{id}/contact`

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | UUID | Sim | Identificador único da sequência |

### Body Parameters

Filtro de busca do contato (ao menos um dos campos deve ser informado):

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `contactId` | uuid \| null | Não | Identificador único do contato |
| `phoneNumber` | string \| null | Não | Número de telefone do contato |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Contato removido com sucesso |
| 500 | Server Error | Erro no servidor |

---

## Observações

- Autenticação via header é obrigatória.
- O formato de resposta é `application/json`.
- Suporta exemplos de código em múltiplas linguagens: Shell, Node, Ruby, PHP, Python.
- Interface interativa com opção "Try It!" para testar requisições.

---

## Fonte

URL original: `https://flwchat.readme.io/reference/delete_v1-sequence-id-contact`
