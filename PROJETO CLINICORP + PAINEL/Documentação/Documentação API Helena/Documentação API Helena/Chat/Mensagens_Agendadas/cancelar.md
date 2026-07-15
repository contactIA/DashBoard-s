# Cancelar Mensagem Agendada

## Informações Gerais

**Método HTTP:** POST

**URL do Endpoint:** `https://api.wts.chat/chat/v1/scheduled-message/{id}/cancel`

**Fonte:** https://flwchat.readme.io/reference/post_v1-scheduled-message-id-cancel

---

## Descrição

Cancela uma mensagem agendada específica. Apenas mensagens com status agendado podem ser canceladas.

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | uuid | Sim | Identificador único da mensagem agendada |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Cancelamento realizado com sucesso |
| 500 | Server Error | Erro no servidor |

---

## Observações Importantes

- O endpoint requer autenticação.
- **Apenas mensagens com status "agendado" podem ser canceladas** através deste endpoint.
- Para cancelar múltiplas mensagens de uma vez, use `POST /v1/scheduled-message/batch-cancel`.
- Suporte para múltiplas linguagens de programação (Shell, Node, Ruby, PHP, Python).
