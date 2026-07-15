# Excluir Mensagem

## Informações Gerais

**Método HTTP:** DELETE

**URL do Endpoint:** `https://api.wts.chat/chat/v1/message/{id}`

**Fonte:** https://flwchat.readme.io/reference/delete_v1-message-id

---

## Descrição

Endpoint para excluir uma mensagem específica do sistema através de seu ID único.

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | UUID | Sim | ID da mensagem a ser excluída |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Mensagem excluída com sucesso (application/json) |
| 500 | Server Error | Erro no processamento da requisição (application/json) |

---

## Informações Adicionais

- **Autenticação:** Requerida (via headers)
- **Formato de Resposta:** application/json
- Linguagens suportadas para exemplos: Shell, Node, Ruby, PHP, Python
- Categorizado na seção **Chat → Mensagens** da documentação completa
