# Concluir Conversa

## Informações Gerais

**Descrição:** Endpoint para finalizar uma conversa (sessão) no sistema de chat.

---

## Detalhes da Requisição

### Método HTTP
`PUT`

### Endpoint
```
https://api.wts.chat/chat/v1/session/{id}/complete
```

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | uuid | Sim | Identificador único da conversa a ser concluída |

### Body Parameters

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `reactivateOnNewMessage` | boolean | false | Define se a conversa deve ser reativada ao receber uma nova mensagem do contato |
| `stopBotInExecution` | boolean | false | Define se o chatbot de automação em execução deve ser interrompido |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Conversa concluída com sucesso |
| 500 | Server Error | Erro no servidor |

---

## Autenticação

Autenticação via header é necessária.

---

## Observações

- Versão da API: **v1.0**
- Suporta múltiplas linguagens de exemplo: Shell, Node, Ruby, PHP, Python
