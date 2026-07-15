# Obter Mensagem por ID

## Informações Gerais

**Método HTTP:** GET

**URL do Endpoint:** `https://api.wts.chat/chat/v1/message/{id}`

**Fonte:** https://flwchat.readme.io/reference/get_v1-message-id

---

## Descrição

Endpoint para recuperar uma mensagem específica utilizando seu identificador único.

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | UUID | Sim | ID da mensagem |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Retorna os dados da mensagem solicitada em formato JSON |
| 500 | Server Error | Indica falha no processamento da requisição pelo servidor |

---

## Informações Adicionais

- **Autenticação:** Requerida (baseada em credenciais de header)
- **Formato de Resposta:** application/json
- Suporta múltiplas linguagens de cliente (Shell, Node, Ruby, PHP, Python)
- Possui funcionalidade "Try It!" para testar requisições interativas
