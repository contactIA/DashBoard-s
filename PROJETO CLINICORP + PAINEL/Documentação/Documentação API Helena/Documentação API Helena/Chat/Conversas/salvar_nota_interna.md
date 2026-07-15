# Salvar Nota Interna em Conversa

## Informações Gerais

**Descrição:** Endpoint que permite salvar uma nota interna em uma conversa. As notas internas são utilizadas para anotações privadas durante o atendimento, acessíveis apenas pelos agentes.

---

## Detalhes da Requisição

### Método HTTP
`POST`

### Endpoint
```
https://api.wts.chat/chat/v1/session/{id}/note
```

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | UUID | Sim | Identificador único da conversa/sessão |

### Body Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `text` | string \| null | Não | Texto da mensagem |
| `filesUrls` | array of strings \| null | Não | Lista de arquivos (URLs) |
| `filesIds` | array of UUIDs \| null | Não | Lista de arquivos (IDs) |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Nota interna criada com sucesso |
| 500 | Server Error | Erro no servidor |

---

## Autenticação

Autenticação via header é necessária.

---

## Observações

- As notas internas são visíveis apenas para os atendentes/agentes, não para o contato
- Suporta tanto URLs de arquivo quanto IDs de arquivo já salvos no sistema
- Suporta múltiplas linguagens de exemplo: Shell, Node, Ruby, PHP, Python
