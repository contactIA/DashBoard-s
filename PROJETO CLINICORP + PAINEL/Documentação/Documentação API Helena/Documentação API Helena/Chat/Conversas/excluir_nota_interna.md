# Excluir uma Nota Interna

## Informações Gerais

**Descrição:** Este endpoint permite a exclusão de uma nota interna por meio de seu ID.

---

## Detalhes da Requisição

### Método HTTP
`DELETE`

### Endpoint
```
https://api.wts.chat/chat/v1/session/note/{id}
```

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | UUID | Sim | Identificador único da nota interna a ser excluída |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Nota interna excluída com sucesso |
| 500 | Server Error | Erro no servidor |

**Content-Type da resposta:** `application/json`

---

## Autenticação

Autenticação via header é necessária (conforme documentação).

---

## Observações

- Documentação em PT-BR
- Interface "Try It!" disponível para testes diretos na documentação
- Suporta múltiplas linguagens de exemplo: Shell, Node, Ruby, PHP, Python
