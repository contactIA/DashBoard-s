# Obter Mensagem Agendada por ID

## Informações Gerais

**Método HTTP:** GET

**URL do Endpoint:** `https://api.wts.chat/chat/v1/scheduled-message/{id}`

**Fonte:** https://flwchat.readme.io/reference/get_v1-scheduled-message-id

---

## Descrição

Retorna os detalhes de uma mensagem agendada específica.

---

## Parâmetros

### Parâmetros de Caminho (Path)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | UUID | Sim | Identificador único da mensagem agendada |

### Parâmetros de Query

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `includeDetails` | array de strings | Não | Detalhes adicionais a serem incluídos na resposta |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Requisição bem-sucedida |
| 500 | Server Error | Erro no servidor |

---

## Informações Adicionais

- **Formato de Resposta:** application/json
- Linguagens de exemplo disponíveis: Shell, Node, Ruby, PHP, Python
- Funcionalidade "Try It!" disponível para testar o endpoint diretamente
