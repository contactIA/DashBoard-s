# Alterar Status de Conversa

## Informações Gerais

**Descrição:** Endpoint para modificar o status de uma conversa existente no sistema.

---

## Detalhes da Requisição

### Método HTTP
`PUT`

### Endpoint
```
https://api.wts.chat/chat/v1/session/{id}/status
```

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | UUID | Sim | ID da conversa |

### Body Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `newStatus` | string (enum) | Sim | Novo status para a conversa |
| `options` | object | Não | Objeto com opções adicionais |

#### Valores permitidos para `newStatus`

| Valor | Descrição |
|-------|-----------|
| `UNDEFINED` | Status indefinido |
| `STARTED` | Iniciada |
| `PENDING` | Pendente |
| `IN_PROGRESS` | Em andamento |
| `COMPLETED` | Concluída |
| `HIDDEN` | Oculta |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Status alterado com sucesso |
| 500 | Server Error | Erro no servidor |

---

## Autenticação

Autenticação via header é necessária.

---

## Observações

- Suporta múltiplas linguagens de exemplo: Shell, Node, Ruby, PHP, Python
- Interface "Try It!" disponível para testes diretos na documentação
