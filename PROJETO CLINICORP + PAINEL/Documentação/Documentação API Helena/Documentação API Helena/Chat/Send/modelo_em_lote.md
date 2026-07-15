# Enviar Modelo de Mensagem em Lote

## Informações Gerais

**Método HTTP:** POST

**URL do Endpoint:** `https://api.wts.chat/chat/v1/send/template/batch`

**Fonte:** https://flwchat.readme.io/reference/post_v1-send-template-batch

---

## Descrição

Endpoint para enviar modelos de mensagem para múltiplos destinatários em uma única requisição. Permite até 100 mensagens por requisição.

---

## Rate Limit

**1000 requisições a cada 2 minutos.**

---

## Parâmetros do Body

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `from` | string | Sim | Canal de origem (comprimento mínimo: 1) |
| `templateId` | string | Sim | ID do modelo de mensagem (comprimento mínimo: 1) |
| `options` | object | Não | Configurações aplicáveis a todos os atendimentos |
| `messages` | array of objects | Sim | Lista de destinatários com parâmetros específicos |

### Objeto dentro de `messages`

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `to` | string | Sim | Número do destinatário |
| `parameters` | object | Não | Parâmetros específicos do template para este destinatário |
| `fileIdOrUrl` | string | Não | URL ou ID do arquivo (necessário apenas para templates com mídia) |
| `callbackUrl` | string | Não | URL para webhook individual por mensagem |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Sucesso |
| 400 | Bad Request | Requisição inválida |
| 401 | Unauthorized | Não autorizado |
| 429 | Too Many Requests | Limite de taxa excedido |
| 500 | Server Error | Erro do servidor |

---

## Características Principais

- Cada mensagem na lista requer um campo `to` (destinatário).
- Parâmetros e arquivos podem variar por item.
- Campo `fileIdOrUrl` necessário apenas para templates com mídia.
- `callbackUrl` individual permite receber webhooks por mensagem.
- Opções como User, Department e EnableBot aplicam-se globalmente.
