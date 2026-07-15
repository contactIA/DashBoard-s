# Cancelar Mensagens Agendadas em Massa

## Informações Gerais

**Método HTTP:** POST

**URL do Endpoint:** `https://api.wts.chat/chat/v1/scheduled-message/batch-cancel`

**Fonte:** https://flwchat.readme.io/reference/post_v1-scheduled-message-batch-cancel

---

## Descrição

Cancela em massa mensagens agendadas. Apenas mensagens com status agendado podem ser canceladas.

---

## Parâmetros do Body

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| Lista de IDs | array de UUIDs | Sim | IDs das mensagens agendadas a serem canceladas |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Cancelamento em massa realizado com sucesso |
| 500 | Server Error | Erro no servidor ao processar a solicitação |

---

## Observações Importantes

- **Restrição:** Apenas mensagens com status "agendado" podem ser canceladas.
- **Versão da API:** v1.0
- **Formato de resposta:** application/json
- Para cancelar uma única mensagem, use `POST /v1/scheduled-message/{id}/cancel`.
