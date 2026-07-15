# Alterar Conversa (Atualização Parcial)

## Informações Gerais

**Descrição:** Atualiza um ou mais atributos de uma conversa. Para usar você deve informar o novo valor do atributo e quais atributos serão atualizados.

---

## Detalhes da Requisição

### Método HTTP
`PUT`

### Endpoint
```
https://api.wts.chat/chat/v2/session/{id}/partial
```

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | uuid | Sim | Identificador único da conversa |

### Body Parameters

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `companyId` | uuid | Código da empresa |
| `status` | string \| null | Situação do atendimento |
| `endAt` | date-time \| null | Data de conclusão |
| `number` | string \| null | Código de identificação |
| `departmentId` | uuid \| null | Código da equipe |
| `userId` | uuid \| null | Código do usuário/atendente |
| `classification` | object | Objeto de classificação |
| `metadata` | object \| null | Definição dos metadados |
| `options` | object | Objeto de opções |
| `fields` | array of strings \| null | Definição dos campos a serem atualizados |

#### Valores permitidos para `status`

| Valor |
|-------|
| `UNDEFINED` |
| `STARTED` |
| `PENDING` |
| `IN_PROGRESS` |
| `COMPLETED` |
| `HIDDEN` |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Conversa atualizada com sucesso |
| 500 | Server Error | Erro no servidor |

---

## Autenticação

Autenticação via header é necessária.
