# Enviar Mensagem

## Informações Gerais

**Método HTTP:** POST

**URL do Endpoint:** `https://api.wts.chat/chat/v1/message/send`

**Fonte:** https://flwchat.readme.io/reference/post_v1-message-send

---

## Descrição

Este endpoint permite enviar mensagens através dos canais de atendimento configurados. Uma conversa só pode ser iniciada no WhatsApp utilizando um modelo de mensagem. O sistema cria automaticamente contatos não registrados antes do envio. As mensagens são processadas de forma assíncrona através de uma fila de disparo.

---

## Parâmetros do Body

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `from` | string \| null | Não | Número de telefone do canal cadastrado na conta |
| `to` | string | Sim | Número de telefone do destinatário (mínimo 1 caractere) |
| `botId` | uuid \| null | Não | ID do bot ativado após resposta do contato |
| `body` | object | Sim | Dados do corpo da mensagem |
| `department` | object | Não | Objeto de departamento |
| `user` | object | Não | Objeto de usuário |
| `options` | object | Não | Opções adicionais |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Sucesso |
| 500 | Server Error | Erro do Servidor |

---

## Observações Importantes

- Para verificar o status do envio, consulte o endpoint `GET /chat/v1/message/{id}/status`.
- O envio é assíncrono: a mensagem é enfileirada e processada posteriormente.
- Suporta múltiplas linguagens de requisição (Shell, Node, Ruby, PHP, Python).
