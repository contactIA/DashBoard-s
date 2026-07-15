# Enviar Chatbot

## Informações Gerais

**Método HTTP:** POST

**URL do Endpoint:** `https://api.wts.chat/chat/v1/send/chatbot`

**Fonte:** https://flwchat.readme.io/reference/post_v1-send-chatbot

---

## Descrição

Enfileira o disparo de um chatbot para um contato. O processamento ocorre de forma assíncrona após o retorno deste endpoint. O serviço segue as mesmas regras do canal de atendimento, registrando automaticamente contatos não cadastrados antes do envio.

---

## Rate Limit

**1.000 requisições a cada 2 minutos** (limite individual por endpoint).

---

## Parâmetros do Body

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `botKey` | uuid \| null | Não | Chave identificadora do chatbot a ser enviado |
| `from` | string \| null | Não | Número telefônico ou @usuarioinstagram do canal cadastrado |
| `to` | string \| null | Não | Número telefônico ou @usuarioinstagram do destinatário |
| `sessionId` | uuid \| null | Não | ID da conversa para execução do chatbot |
| `sessionMetadata` | object \| null | Não | Metadados de atendimento (chave-valor) utilizáveis em mensagens e condicionais |
| `contactMetadata` | object \| null | Não | Metadados de contato persistidos para atendimentos posteriores |
| `senderId` | string \| null | Não | ID de rastreamento no sistema do cliente |
| `callbackUrl` | string \| null | Não | URL para webhook quando chatbot inicia ou falha |
| `options` | object | Não | Objeto de opções adicionais |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Sucesso |
| 400 | Bad Request | Requisição inválida |
| 401 | Unauthorized | Não autorizado |
| 429 | Too Many Requests | Limite de taxa excedido |
| 500 | Server Error | Erro no servidor |
