# Obter Status de Mensagem por ID

## Informações Gerais

**Método HTTP:** GET

**URL do Endpoint:** `https://api.wts.chat/chat/v1/message/{id}/status`

**Fonte:** https://flwchat.readme.io/reference/get_v1-message-id-status

---

## Descrição

Endpoint para recuperar o estado de uma mensagem específica através de seu identificador único.

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | UUID | Sim | ID da mensagem |

### Query Parameters

Nenhum parâmetro de query documentado.

### Body Parameters

Não aplicável para requisições GET.

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Retorna o status da mensagem com sucesso (application/json) |
| 500 | Server Error | Indica erro do servidor |

---

## Informações Adicionais

- **Autenticação:** Requerida (via header)
- **Formato de Resposta:** application/json
- Linguagens de exemplo suportadas: Shell, Node, Ruby, PHP, Python
