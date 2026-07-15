# Enviar OTP (One Time Password)

## Informações Gerais

**Método HTTP:** POST

**URL do Endpoint:** `https://api.wts.chat/chat/v1/send/otp`

**Fonte:** https://flwchat.readme.io/reference/post_v1-send-otp

---

## Descrição

Endpoint para envio de senhas únicas (OTP) para autenticação via WhatsApp. O sistema gera automaticamente um código de 5 dígitos aleatórios caso nenhum código seja fornecido.

---

## Rate Limit

**1000 requisições a cada 2 minutos** por usuário.

---

## Parâmetros do Body

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `code` | string \| null | Não | Código customizado; se omitido, gera aleatoriamente |
| `templateId` | string \| null | Não | ID do modelo de autenticação |
| `from` | string | Sim | Número do canal registrado (mínimo 1 caractere) |
| `to` | string | Sim | Número telefônico destinatário (mínimo 1 caractere) |
| `callbackUrl` | string \| null | Não | URL para webhook de entrega/falha |
| `senderId` | string \| null | Não | ID de rastreamento no sistema cliente |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Sucesso |
| 400 | Bad Request | Requisição inválida |
| 401 | Unauthorized | Não autorizado |
| 429 | Too Many Requests | Limite de requisições excedido |
| 500 | Server Error | Erro no servidor |
