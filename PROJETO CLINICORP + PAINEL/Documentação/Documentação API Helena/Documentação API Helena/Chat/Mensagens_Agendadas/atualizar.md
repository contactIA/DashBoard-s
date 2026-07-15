# Atualizar Mensagem Agendada

## Informações Gerais

**Método HTTP:** PUT

**URL do Endpoint:** `https://api.wts.chat/chat/v1/scheduled-message/{id}`

**Fonte:** https://flwchat.readme.io/reference/put_v1-scheduled-message-id

---

## Descrição

Atualiza uma mensagem agendada existente. Mensagens já enviadas não podem ser editadas.

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | uuid | Sim | ID da mensagem agendada |

### Body Parameters

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `fields` | array of strings | Sim | Campos que devem ser atualizados |
| `to` | string \| null | Não | Número de telefone do destinatário |
| `from` | string \| null | Não | Número de telefone do canal cadastrado |
| `department` | object | Não | Objeto de departamento |
| `type` | string \| null | Não | Tipo da mensagem: `TEMPLATE` ou `CHATBOT` |
| `templateId` | string \| null | Não | ID do modelo de mensagem |
| `botId` | uuid \| null | Não | ID do bot a ativar após resposta |
| `scheduling` | date-time \| null | Não | Data e hora programada para envio |
| `hiddenSession` | boolean \| null | Não | Se a sessão fica oculta (padrão: false) |
| `templateParams` | object | Não | Objeto com parâmetros do template |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Atualização realizada com sucesso |
| 500 | Server Error | Erro do servidor |

---

## Informações Adicionais

- **Restrição:** Mensagens já enviadas não podem ser editadas.
- Suporta múltiplas linguagens (Shell, Node, Ruby, PHP, Python)
