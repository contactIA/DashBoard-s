# Duplicar Card

## Informações Gerais

**Título:** Duplicar

**Descrição:** Endpoint para duplicar um card (cartão) no sistema CRM.

**Método HTTP:** `POST`

**URL do Endpoint:** `https://api.wts.chat/crm/v1/panel/card/{id}/duplicate`

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | UUID | Sim | ID do card a ser duplicado |

### Body Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `copyToStepId` | UUID \| null | Não | ID da etapa de destino. Pode ser uma etapa do mesmo painel ou de outro painel. Se vazio, a cópia permanece na mesma etapa do card original |
| `options` | object | Não | Objeto contendo dados adicionais para a duplicação |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Card duplicado com sucesso |
| 500 | Server Error | Erro no servidor |

---

## Observações

- Se `copyToStepId` não for informado, o card duplicado será criado na mesma etapa do original.
- É possível duplicar o card para uma etapa de outro painel.
- Autenticação via header é necessária.
- Suporta exemplos de código em múltiplas linguagens: Shell, Node, Ruby, PHP, Python.
- Interface interativa com opção "Try It!" para testar requisições.

---

## Fonte

URL original: `https://flwchat.readme.io/reference/post_v1-panel-card-id-duplicate`
