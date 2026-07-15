# Obter uma Nota Interna

## Informações Gerais

**Descrição:** Este endpoint permite a obtenção de uma nota interna por meio de seu ID.

---

## Detalhes da Requisição

### Método HTTP
`GET`

### Endpoint
```
https://api.wts.chat/chat/v1/session/note/{id}
```

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | uuid | Sim | Identificador único da nota interna |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Requisição bem-sucedida |
| 500 | Server Error | Erro no servidor |

**Content-Type da resposta:** `application/json`

---

## Autenticação

Autenticação via header é necessária.

---

## Observações

- Este endpoint faz parte da seção de **Conversas** na documentação da API
- Suporta múltiplas linguagens de exemplo: Shell, Node, Ruby, PHP, Python
