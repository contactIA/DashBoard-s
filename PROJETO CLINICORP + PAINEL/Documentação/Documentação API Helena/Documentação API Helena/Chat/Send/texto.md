# Enviar Texto

## Informações Gerais

**Método HTTP:** POST

**URL do Endpoint:** `https://api.wts.chat/chat/v1/send/text`

**Fonte:** https://flwchat.readme.io/reference/post_v1-send-text

---

## Descrição

Responsável pelo envio de mensagens de texto simples para contatos. O campo de texto é obrigatório, e há suporte para simular digitação e callbacks de entrega.

---

## Rate Limit

**1.000 requisições a cada 2 minutos.**

---

## Parâmetros do Body

### Parâmetros Obrigatórios

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `to` | string | Sim | Destinatário (comprimento ≥ 1) |
| `from` | string | Sim | Remetente (comprimento ≥ 1) |
| `text` | string | Sim | Conteúdo da mensagem (comprimento ≥ 1) |

### Objeto `options` (Parâmetros Opcionais)

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `sessionId` | uuid \| null | ID do atendimento para interações em tempo real |
| `refId` | uuid \| null | ID da mensagem sendo respondida |
| `delayTyping` | int32 \| null | Segundos de indicador "digitando..." (máximo 25) |
| `callbackUrl` | string \| null | URL para receber webhook de status |
| `senderId` | string \| null | Identificador interno para rastreamento |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Sucesso |
| 400 | Bad Request | Requisição inválida |
| 401 | Unauthorized | Não autorizado |
| 429 | Too Many Requests | Limite excedido |
| 500 | Server Error | Erro do servidor |

---

## Notas Importantes

- O campo `delayTyping` simula o indicador "digitando..." antes da entrega.
- O `callbackUrl` notifica quando a mensagem é entregue ou falha.
