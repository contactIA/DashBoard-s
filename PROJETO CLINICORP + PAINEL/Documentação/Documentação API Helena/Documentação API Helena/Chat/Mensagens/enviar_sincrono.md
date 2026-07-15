# Enviar Síncrono

## Informações Gerais

**Método HTTP:** POST

**URL do Endpoint:** `https://api.wts.chat/chat/v1/message/send-sync`

**Fonte:** https://flwchat.readme.io/reference/post_v1-message-send-sync

---

## Descrição

Este endpoint permite enviar mensagens de forma síncrona através dos canais de atendimento integrados. A funcionalidade segue as mesmas regras do canal, como a necessidade de usar modelos de mensagem para iniciar conversas no WhatsApp. Contatos não cadastrados são registrados automaticamente antes do envio. O método espera até 25 segundos pela resposta do servidor do canal, retornando o último status conhecido após esse período.

---

## Parâmetros do Body

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `from` | string \| null | Não | Número de telefone do canal cadastrado na conta |
| `to` | string | Sim | Número de telefone do destinatário (comprimento ≥ 1) |
| `botId` | uuid \| null | Não | ID do bot a ser ativado após resposta do contato |
| `body` | object | Sim | Dados para envio da mensagem |
| `department` | object | Não | Objeto contendo dados do departamento |
| `user` | object | Não | Objeto contendo dados do usuário |
| `options` | object | Não | Objeto com opções adicionais |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Mensagem enviada com sucesso |
| 500 | Server Error | Erro no servidor |

---

## Observações Importantes

- O envio é síncrono: aguarda resposta do servidor do canal.
- Tempo máximo de espera: **25 segundos**.
- Caso o contato não esteja cadastrado, ele será cadastrado automaticamente antes do envio.
- Suporta múltiplas linguagens de requisição (Shell, Node, Ruby, PHP, Python).
