# Adicionar Contato em Sequência

## Informações Gerais

**Título:** Adicionar contato

**Descrição:** Adicione um contato em uma sequência.

**Método HTTP:** `POST`

**URL do Endpoint:** `https://api.wts.chat/chat/v1/sequence/{id}/contact`

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | UUID | Sim | ID da sequência |

### Body Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `contactId` | uuid \| null | Não | ID do contato |
| `phoneNumber` | string \| null | Não | Número de telefone do contato |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Requisição bem-sucedida |
| 500 | Server Error | Erro no servidor |

---

## Observações

- Autenticação via header é necessária.
- A busca do contato utiliza um filtro que pode usar `contactId` ou `phoneNumber`.
- Ambos os parâmetros do corpo podem ser nulos, permitindo flexibilidade na identificação do contato.
- Suporta exemplos de código em múltiplas linguagens: Shell, Node, Ruby, PHP, Python.

---

## Fonte

URL original: `https://flwchat.readme.io/reference/post_v1-sequence-id-contact`
