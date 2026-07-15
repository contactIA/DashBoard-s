# Obter Conversa por ID

## Informações Gerais

**Descrição:** Endpoint para recuperar os detalhes de uma conversa específica através de seu identificador único.

---

## Detalhes da Requisição

### Método HTTP
`GET`

### Endpoint
```
https://api.wts.chat/chat/v2/session/{id}
```

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | UUID | Sim | ID da conversa |

### Query Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `includeDetails` | array of strings | Não | Parâmetro opcional para incluir detalhes adicionais |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Requisição bem-sucedida com retorno dos dados da conversa |
| 500 | Server Error | Erro no servidor |

**Content-Type da resposta:** `application/json`

---

## Autenticação

Autenticação via header é necessária.

---

## Observações

- Suporta múltiplas linguagens de exemplo: Shell, Node, Ruby, PHP, Python
