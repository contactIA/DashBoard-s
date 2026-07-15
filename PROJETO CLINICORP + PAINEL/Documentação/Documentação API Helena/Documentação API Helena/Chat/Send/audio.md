# Enviar Áudio

## Informações Gerais

**Método HTTP:** POST

**URL do Endpoint:** `https://api.wts.chat/chat/v1/send/audio`

**Fonte:** https://flwchat.readme.io/reference/post_v1-send-audio

---

## Descrição

Endpoint para envio de mensagens de áudio para contatos. O arquivo pode ser fornecido como URL pública ou ID de um arquivo previamente cadastrado, devendo estar em conformidade com as regras do canal de atendimento.

---

## Rate Limit

**1000 requisições a cada 2 minutos** por endpoint.

---

## Parâmetros do Body

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `to` | string | Sim | Destinatário da mensagem (comprimento ≥ 1) |
| `from` | string | Sim | Remetente da mensagem (comprimento ≥ 1) |
| `fileIdOrUrl` | string | Sim | URL com acesso público do arquivo ou ID de um arquivo (comprimento ≥ 1) |
| `options` | object | Não | Objeto contendo configurações adicionais |

### Parâmetros do Objeto `options`

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `sessionId` | uuid \| null | ID do atendimento para respostas de IA em tempo real |
| `refId` | uuid \| null | ID da mensagem sendo respondida |
| `delayTyping` | int32 \| null | Tempo em segundos do indicador "digitando" (máx. 25s) |
| `callbackUrl` | string \| null | URL para webhook de entrega ou falha |
| `senderId` | string \| null | ID de rastreamento no sistema do cliente |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Requisição bem-sucedida |
| 400 | Bad Request | Requisição inválida |
| 401 | Unauthorized | Falha na autenticação |
| 429 | Too Many Requests | Limite de requisições excedido |
| 500 | Server Error | Erro no servidor |

---

## Observações

- **Autenticação:** Requerida (via headers).
- O arquivo deve estar em conformidade com as regras do canal de atendimento.
