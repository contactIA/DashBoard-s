# Enviar Indicador de Digitando

## Informações Gerais

**Método HTTP:** POST

**URL do Endpoint:** `https://api.wts.chat/chat/v1/send/typing`

**Fonte:** https://flwchat.readme.io/reference/post_v1-send-typing

---

## Descrição

Envia um indicador de "digitando" para o contato em uma conversa específica. Esta funcionalidade está disponível **apenas para canais CloudAPI** (WhatsApp Business API oficial). Em outros tipos de canal, a requisição é aceita mas não produz efeito.

---

## Parâmetros do Body

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `sessionId` | uuid | Sim | ID da sessão ativa para enviar o indicador de digitação |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Requisição bem-sucedida |
| 204 | No Content | Sem conteúdo na resposta |
| 400 | Bad Request | Requisição inválida |
| 401 | Unauthorized | Autenticação necessária/inválida |
| 404 | Not Found | Recurso não encontrado |
| 429 | Too Many Requests | Limite de requisições excedido |
| 500 | Server Error | Erro no servidor |

---

## Informações Adicionais

- **Restrição:** Apenas disponível para canais CloudAPI (WhatsApp Business API oficial).
- **Formato de Resposta:** application/json
- Suporte a múltiplas linguagens: Shell, Node, Ruby, PHP, Python
