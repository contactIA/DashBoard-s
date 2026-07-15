# Obter Painel por ID

## Informações Gerais

**Título:** Obter por ID

**Descrição:** Endpoint para recuperar informações de um painel específico através de seu identificador único.

**Método HTTP:** `GET`

**URL do Endpoint:** `https://api.wts.chat/crm/v1/panel/{id}`

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | UUID | Sim | ID do painel |

### Query Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `IncludeDetails` | array de strings | Não | Detalhes adicionais que devem ser incluídos na resposta |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Retorna os dados do painel solicitado |
| 500 | Server Error | Erro no servidor |

**Tipo de conteúdo da resposta:** `application/json`

---

## Observações

- Autenticação via header é necessária.
- O painel faz parte da seção CRM da API.
- Suporta exemplos de código em múltiplas linguagens: Shell, Node, Ruby, PHP, Python.
- Interface interativa com opção "Try It!" para testar requisições.

---

## Fonte

URL original: `https://flwchat.readme.io/reference/get_v1-panel-id`
