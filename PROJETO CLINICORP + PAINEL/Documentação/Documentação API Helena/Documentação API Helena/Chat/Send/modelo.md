# Enviar Modelo de Mensagem

## Informações Gerais

**Método HTTP:** POST

**URL do Endpoint:** `https://api.wts.chat/chat/v1/send/template`

**Fonte:** https://flwchat.readme.io/reference/post_v1-send-template

---

## Descrição

Endpoint para enviar um modelo de mensagem a um único destinatário. O template deve estar cadastrado no canal, e parâmetros são obrigatórios se o template contiver variáveis.

---

## Rate Limit

**1000 requisições a cada 2 minutos.**

---

## Parâmetros do Body

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `to` | string | Sim | Destinatário (comprimento ≥ 1) |
| `from` | string | Sim | Remetente (comprimento ≥ 1) |
| `templateId` | string | Sim | ID do modelo de mensagem a ser enviado |
| `parameters` | object | Condicional | Parâmetros do template (obrigatório se o template tiver variáveis) |
| `fileIdOrUrl` | string | Não | URL pública ou ID do arquivo a enviar com o template |
| `callbackUrl` | string | Não | URL para receber webhook de entrega ou falha |
| `sessionId` | uuid | Não | ID do atendimento para respostas de IA externa |
| `senderId` | string | Não | ID para rastreamento no sistema do cliente |
| `sessionMetadata` | object | Não | Metadados do atendimento em estrutura chave-valor |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Sucesso |
| 400 | Bad Request | Solicitação inválida |
| 401 | Unauthorized | Não autorizado |
| 429 | Too Many Requests | Muitas requisições |
| 500 | Server Error | Erro no servidor |

---

## Observações

- Suporta múltiplas linguagens de programação (Shell, Node, Ruby, PHP, Python).
