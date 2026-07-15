# Enviar Imagem

## Informações Gerais

**Método HTTP:** POST

**URL do Endpoint:** `https://api.wts.chat/chat/v1/send/image`

**Fonte:** https://flwchat.readme.io/reference/post_v1-send-image

---

## Descrição

Endpoint para enviar mensagens contendo imagens para um contato. O sistema aceita tanto URLs públicas quanto IDs de arquivos previamente cadastrados no sistema.

---

## Rate Limit

**1000 requisições a cada 2 minutos.**

---

## Parâmetros do Body

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `to` | string | Sim | Destinatário da mensagem (comprimento ≥ 1) |
| `from` | string | Sim | Remetente da mensagem (comprimento ≥ 1) |
| `fileIdOrUrl` | string | Sim | URL pública ou ID do arquivo cadastrado (comprimento ≥ 1) |
| `options` | object | Não | Objeto contendo configurações adicionais |
| `options.sessionId` | uuid \| null | Não | ID do atendimento para respostas em tempo real |
| `options.refId` | uuid \| null | Não | ID da mensagem sendo respondida |
| `options.delayTyping` | int32 \| null | Não | Segundos de "digitando..." (máximo 25) |
| `options.callbackUrl` | string \| null | Não | URL para webhook de status |
| `options.senderId` | string \| null | Não | ID para rastreamento no seu sistema |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Sucesso |
| 400 | Bad Request | Requisição inválida |
| 401 | Unauthorized | Não autorizado |
| 429 | Too Many Requests | Limite de requisições excedido |
| 500 | Server Error | Erro do servidor |
