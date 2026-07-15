# Remover Contatos de Sequência (Batch)

## Informações Gerais

**Título:** Remover contatos

**Descrição:** Remova contatos de uma sequência adicionando um filtro.

**Método HTTP:** `DELETE`

**URL do Endpoint:** `https://api.wts.chat/chat/v1/sequence/{id}/contact/batch`

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | UUID | Sim | Identificador único da sequência de onde os contatos serão removidos |

### Body Parameters

Os filtros para remoção são cumulativos:

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `contactIds` | array de UUIDs \| null | Não | Filtra contatos pelos seus identificadores únicos |
| `phoneNumbers` | array de strings \| null | Não | Filtra contatos pelos números de telefone |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Operação realizada com sucesso |
| 500 | Server Error | Erro no servidor |

---

## Observações

- O formato de resposta é `application/json`.
- Os filtros `contactIds` e `phoneNumbers` são cumulativos.
- Autenticação via header é necessária.
- Suporta exemplos de código em múltiplas linguagens: Shell, Node, Ruby, PHP, Python.

---

## Fonte

URL original: `https://flwchat.readme.io/reference/delete_v1-sequence-id-contact-batch`
