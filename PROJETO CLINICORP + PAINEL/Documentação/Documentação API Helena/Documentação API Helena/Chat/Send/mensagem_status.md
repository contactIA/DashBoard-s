# Mensagem Status

## Informações Gerais

**Método HTTP:** GET

**URL do Endpoint:** `https://api.wts.chat/chat/v1/send/message/{id}`

**Fonte:** https://flwchat.readme.io/reference/get_v1-send-message-id

---

## Descrição

Consulta o estado atual de uma mensagem enviada previamente através dos endpoints de envio. O parâmetro `id` recebe o identificador da mensagem retornado no instante do envio.

---

## Rate Limit

**1000 requisições a cada 2 minutos** (limite individual por endpoint).

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | string | Sim | Identificador da mensagem para consultar o estado |

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

- **Formato de Resposta:** application/json
- **Autenticação:** Via header
- Linguagens de código suportadas: Shell, Node, Ruby, PHP, Python
