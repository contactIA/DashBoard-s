# Enviar Vídeo

## Informações Gerais

**Método HTTP:** POST

**URL do Endpoint:** `https://api.wts.chat/chat/v1/send/video`

**Fonte:** https://flwchat.readme.io/reference/post_v1-send-video

---

## Descrição

Endpoint para enviar mensagens de vídeo a contatos. O campo `fileIdOrUrl` é obrigatório, podendo ser uma URL pública ou ID de arquivo cadastrado. O arquivo deve respeitar as regras do canal de atendimento quanto a formato e tamanho.

---

## Rate Limit

**1000 requisições a cada 2 minutos.**

---

## Parâmetros do Body

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `to` | string | Sim | Destinatário (comprimento ≥ 1) |
| `from` | string | Sim | Remetente (comprimento ≥ 1) |
| `fileIdOrUrl` | string | Sim | URL pública ou ID do arquivo (comprimento ≥ 1) |
| `options` | object | Não | Objeto contendo configurações opcionais |
| `options.sessionId` | uuid \| null | Não | ID do atendimento para interações em tempo real |
| `options.refId` | uuid \| null | Não | ID da mensagem sendo respondida |
| `options.delayTyping` | int32 \| null | Não | Tempo em segundos do indicador "digitando" (máx. 25s) |
| `options.callbackUrl` | string \| null | Não | URL para webhook de entrega/falha |
| `options.senderId` | string \| null | Não | ID de rastreamento no sistema do cliente |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Sucesso |
| 400 | Bad Request | Requisição inválida |
| 401 | Unauthorized | Não autorizado |
| 429 | Too Many Requests | Limite de requisições excedido |
| 500 | Server Error | Erro no servidor |
