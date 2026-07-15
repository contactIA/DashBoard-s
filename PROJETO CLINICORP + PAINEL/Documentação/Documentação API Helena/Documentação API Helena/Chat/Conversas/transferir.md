# Transferir Conversa

## Informações Gerais

**Descrição:** Endpoint para transferir uma conversa entre equipes ou usuários no sistema de chat.

---

## Detalhes da Requisição

### Método HTTP
`PUT`

### Endpoint
```
https://api.wts.chat/chat/v1/session/{id}/transfer
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
| `type` | string (enum) | Sim | Determina se a transferência deverá ser entre equipes ou usuários |
| `newDepartmentId` | uuid \| null | Não | ID da nova equipe para a conversa |
| `newUserId` | uuid \| null | Não | ID do novo usuário para a conversa |
| `options` | object | Não | Objeto com opções adicionais de transferência |

#### Valores permitidos para `type`

| Valor | Descrição |
|-------|-----------|
| `DEPARTMENT` | Transferência para uma equipe |
| `USER` | Transferência para um usuário |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Transferência realizada com sucesso |
| 500 | Server Error | Erro no servidor |

**Content-Type da resposta:** `application/json`

---

## Autenticação

Autenticação via header é necessária.

---

## Observações

- Versão da API: **v1.0**
- Suporta múltiplas linguagens de exemplo: Shell, Node, Ruby, PHP, Python
