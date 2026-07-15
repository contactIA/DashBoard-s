# Atribuir Usuário a Conversa

## Informações Gerais

**Descrição:** Endpoint para atribuição de um usuário a uma conversa.

---

## Detalhes da Requisição

### Método HTTP
`PUT`

### Endpoint
```
https://api.wts.chat/chat/v1/session/{id}/assignee
```

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | uuid | Sim | ID da conversa |

### Body Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `userId` | uuid | Sim | ID do usuário |
| `options` | object | Não | Objeto com opções adicionais |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Usuário atribuído com sucesso |
| 500 | Server Error | Erro no servidor |

---

## Autenticação

Autenticação via header é necessária.

---

## Observações

- Suporta múltiplas linguagens de exemplo: Shell, Node, Ruby, PHP, Python
- Interface "Try It!" disponível para testes diretos na documentação
