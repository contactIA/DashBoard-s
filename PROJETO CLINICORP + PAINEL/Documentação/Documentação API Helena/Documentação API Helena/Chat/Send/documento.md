# Enviar Documento

## Informações Gerais

**Método HTTP:** POST

**URL do Endpoint:** `https://api.wts.chat/chat/v1/send/document`

**Fonte:** https://flwchat.readme.io/reference/post_v1-send-document

---

## Descrição

Envia uma mensagem de documento para um contato. O arquivo pode ser fornecido como URL pública ou ID previamente registrado no sistema.

---

## Rate Limit

**1000 requisições a cada 2 minutos** (limite individual por endpoint).

---

## Parâmetros do Body

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `to` | string | Sim | Destinatário da mensagem (comprimento ≥ 1) |
| `from` | string | Sim | Remetente da mensagem (comprimento ≥ 1) |
| `fileIdOrUrl` | string | Sim | URL pública ou ID do arquivo previamente cadastrado (comprimento ≥ 1) |
| `options` | object | Não | Objeto contendo configurações adicionais |
| `options.sessionId` | uuid \| null | Não | ID do atendimento para respostas em tempo real |
| `options.refId` | uuid \| null | Não | ID da mensagem sendo respondida |
| `options.delayTyping` | int32 \| null | Não | Tempo em segundos para exibir "digitando..." (máx. 25s) |
| `options.callbackUrl` | string \| null | Não | URL para webhook de entrega/falha |
| `options.senderId` | string \| null | Não | ID de rastreamento no sistema cliente |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Sucesso |
| 400 | Bad Request | Requisição inválida |
| 401 | Unauthorized | Não autorizado |
| 429 | Too Many Requests | Limite de requisições excedido |
| 500 | Server Error | Erro do servidor |

---

## Observações

- O arquivo enviado deverá seguir as regras do canal de atendimento.
- Suporte para múltiplas linguagens de programação (Shell, Node, Ruby, PHP, Python).
