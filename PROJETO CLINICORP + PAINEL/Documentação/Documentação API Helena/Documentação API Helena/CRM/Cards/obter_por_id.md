# Obter Card por ID

## Informações Gerais

**Título:** Obter por ID

**Descrição:** Endpoint para recuperar os detalhes de um card específico do CRM.

**Método HTTP:** `GET`

**URL do Endpoint:** `https://api.wts.chat/crm/v1/panel/card/{id}`

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | UUID | Sim | ID do card |

### Query Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `IncludeDetails` | array de strings | Não | Especifica quais detalhes adicionais devem ser incluídos na resposta |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Retorna os dados do card solicitado |
| 500 | Server Error | Erro no servidor |

**Tipo de conteúdo da resposta:** `application/json`

---

## Observações

- Autenticação via header é necessária.
- Versão da API: v1.0.
- Suporta exemplos de código em múltiplas linguagens: Shell, Node, Ruby, PHP, Python.
- Interface interativa com opção "Try It!" para testar requisições.

---

## Fonte

URL original: `https://flwchat.readme.io/reference/get_v1-panel-card-id`
