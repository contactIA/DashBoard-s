# OTP Status

## Informações Gerais

**Método HTTP:** GET

**URL do Endpoint:** `https://api.wts.chat/chat/v1/send/otp/{id}`

**Fonte:** https://flwchat.readme.io/reference/get_v1-send-otp-id

---

## Descrição

Permite consultar o status atual de uma mensagem OTP (One-Time Password) enviada anteriormente através da API.

---

## Rate Limit

**1000 requisições a cada 2 minutos** (limite individual por endpoint).

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | string | Sim | ID da mensagem ou SenderId para consultar o status |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Sucesso |
| 400 | Bad Request | Requisição inválida |
| 401 | Unauthorized | Não autorizado |
| 404 | Not Found | Não encontrado |
| 429 | Too Many Requests | Limite de requisições excedido |
| 500 | Server Error | Erro do servidor |

---

## Observações

- O parâmetro `id` aceita tanto o identificador da mensagem quanto o `senderId` fornecido no momento do envio.
