# Enviar Chatbot em Lote

## Informações Gerais

**Método HTTP:** POST

**URL do Endpoint:** `https://api.wts.chat/chat/v1/send/chatbot/batch`

**Fonte:** https://flwchat.readme.io/reference/post_v1-send-chatbot-batch

---

## Descrição

Enfileira o disparo de um chatbot para múltiplos contatos em uma única requisição. O identificador do chatbot (BotKey) é compartilhado entre todos os destinatários. O processamento é assíncrono, ocorrendo após o retorno do endpoint.

---

## Rate Limit

**1000 requisições a cada 2 minutos.**

---

## Parâmetros do Body

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `botKey` | uuid | Sim | Chave identificadora do chatbot |
| `from` | string \| null | Não | Canal de origem (ID do canal, número WhatsApp ou @usuário Instagram) |
| `options` | object | Não | Objeto com configurações adicionais |
| `messages` | array of objects | Sim | Lista de destinatários |

### Objeto dentro de `messages`

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `to` | string | Condicional | Número do destinatário (obrigatório se `sessionId` não for informado) |
| `sessionId` | uuid | Condicional | ID da conversa (obrigatório se `to` não for informado) |
| `sessionMetadata` | object | Não | Metadados de atendimento por destinatário |
| `contactMetadata` | object | Não | Metadados de contato por destinatário |
| `callbackUrl` | string | Não | URL para webhook individual |
| `senderId` | string | Não | ID de rastreamento individual |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Requisição bem-sucedida |
| 400 | Bad Request | Erro na solicitação |
| 401 | Unauthorized | Não autorizado |
| 429 | Too Many Requests | Limite de taxa excedido |
| 500 | Server Error | Erro no servidor |

---

## Observações

- Cada item da lista deve incluir o destinatário (`to`) ou o ID da conversa (`sessionId`).
- O processamento é assíncrono, ocorrendo após o retorno do endpoint.
- Suporte para múltiplas linguagens de programação (Shell, Node, Ruby, PHP, Python).
