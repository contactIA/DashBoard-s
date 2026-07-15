# Adicionar Contatos em Sequência (Batch)

## Informações Gerais

**Título:** Adicionar contatos

**Descrição:** Adicione contatos em uma sequência adicionando um filtro.

**Método HTTP:** `POST`

**URL do Endpoint:** `https://api.wts.chat/chat/v1/sequence/{id}/contact/batch`

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | UUID | Sim | ID da sequência |

### Body Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `contactIds` | array de UUIDs \| null | Não | Filtro por IDs de contatos |
| `phoneNumbers` | array de strings \| null | Não | Filtro por números de telefone. Caso o contato não exista, ele será criado automaticamente |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Operação realizada com sucesso |
| 500 | Server Error | Erro no servidor |

---

## Observações

- Autenticação via header (credenciais necessárias).
- Ambos os filtros aceitam valores nulos.
- É possível adicionar contatos usando IDs ou números de telefone.
- Se um contato não existir e `phoneNumbers` for informado, o contato será criado automaticamente.
- Suporta exemplos de código em múltiplas linguagens: Shell, Node, Ruby, PHP, Python.

---

## Fonte

URL original: `https://flwchat.readme.io/reference/post_v1-sequence-id-contact-batch`
