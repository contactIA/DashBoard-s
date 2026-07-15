# Enviar Chatbot

## Informações Gerais

**Descrição:** Permite iniciar a execução de um chatbot. Durante a execução do chatbot, a interação com a conversa fica desabilitada para atendentes na central de atendimento.

---

## Detalhes da Requisição

### Método HTTP
`POST`

### Endpoint
```
https://api.wts.chat/chat/v1/chatbot/send
```

---

## Parâmetros do Body

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `botKey` | uuid \| null | Identificação única do chatbot a ser executado |
| `from` | string \| null | Identificador do canal (número telefônico ou usuário Instagram) |
| `to` | string \| null | Destinatário da mensagem (telefone ou Instagram) |
| `sessionId` | uuid \| null | Identificador da conversa para envio do chatbot |
| `options` | object | Configurações adicionais de execução |
| `sessionMetadata` | object \| null | Dados da sessão em formato chave-valor |
| `contactMetadata` | object \| null | Dados do contato salvos permanentemente |
| `senderId` | string \| null | Identificador interno para rastreamento |
| `callbackUrl` | string \| null | URL para webhook de notificações |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Execução do chatbot iniciada com sucesso |
| 500 | Server Error | Erro no servidor |

---

## Observações Importantes

- Segue as mesmas regras do canal de atendimento
- Contatos não cadastrados são criados automaticamente
- A execução pode ser cancelada via API ou central de atendimento
- Metadados podem ser utilizados como parâmetros nas mensagens
- Suporta múltiplas linguagens de exemplo: Shell, Node, Ruby, PHP, Python
