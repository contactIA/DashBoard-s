# Chatbot Status

## Informações Gerais

**Método HTTP:** GET

**URL do Endpoint:** `https://api.wts.chat/chat/v1/send/chatbot/{id}`

**Fonte:** https://flwchat.readme.io/reference/get_v1-send-chatbot-id

---

## Descrição

Consulta o status atual de um disparo de chatbot enfileirado anteriormente pelos endpoints de envio. O parâmetro `id` deve ser o valor retornado quando o chatbot foi enviado.

---

## Rate Limit

**1000 requisições a cada 2 minutos** (limite individual por endpoint).

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | string | Sim | ID do disparo para consultar o status |

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

## Informações Adicionais

- Suporte para múltiplas linguagens de programação (Shell, Node, Ruby, PHP, Python).
- Permite teste interativo através da opção "Try It!".
