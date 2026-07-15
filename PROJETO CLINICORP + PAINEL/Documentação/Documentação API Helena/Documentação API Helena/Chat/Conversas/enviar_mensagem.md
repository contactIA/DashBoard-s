# Enviar Mensagem em Conversa

## Informações Gerais

**Descrição:** Este endpoint permite enviar mensagens em conversas existentes. Segue as mesmas regras do canal de atendimento (ex: no WhatsApp é necessário usar modelo de mensagem). Contatos não cadastrados são registrados automaticamente. O envio é assíncrono e processado em fila.

---

## Detalhes da Requisição

### Método HTTP
`POST`

### Endpoint
```
https://api.wts.chat/chat/v1/session/{id}/message
```

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | uuid | Sim | Identificador único da sessão/conversa |

### Body Parameters

| Parâmetro | Tipo | Obrigatoriedade | Descrição |
|-----------|------|-----------------|-----------|
| `text` | string \| null | Condicional | Texto da mensagem. Obrigatório se não informado `templateId` ou `fileUrl` |
| `templateId` | string \| null | Condicional | ID do modelo de mensagem. Obrigatório se não informado `text` ou `fileUrl` |
| `parameters` | object \| null | Condicional | Parâmetros do modelo (obrigatório se o modelo os possuir) |
| `fileUrl` | string \| null | Condicional | URL pública do arquivo a enviar |
| `fileId` | uuid \| null | Opcional | ID do arquivo obtido via `/core/v2/file` |
| `refId` | uuid \| null | Opcional | ID de referência para identificar resposta a mensagem anterior |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Mensagem enviada com sucesso |
| 500 | Server Error | Erro no servidor |

---

## Autenticação

Autenticação via header é necessária.

---

## Observações Importantes

- O processamento é **assíncrono** (salvo em fila)
- Para verificar o status do envio, consulte: `GET /chat/v1/message/{id}/status`
- No WhatsApp, é necessário usar modelo de mensagem conforme regras do canal
- Suporta múltiplas linguagens de exemplo: Shell, Node, Ruby, PHP, Python
