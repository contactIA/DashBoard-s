# Campos Personalizados de Painel

## Informações Gerais

**Título:** Campos personalizados

**Descrição:** Endpoint para recuperar os campos personalizados de um painel CRM.

**Método HTTP:** `GET`

**URL do Endpoint:** `https://api.wts.chat/crm/v1/panel/{id}/custom-fields`

**Seção:** CRM > Painéis

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | UUID | Sim | Identificador único do painel |

### Query Parameters

| Parâmetro | Tipo | Obrigatório | Padrão | Descrição |
|-----------|------|-------------|--------|-----------|
| `NestedList` | boolean | Não | false | Define se os campos serão retornados de forma aninhada/estruturada em grupos. Aceita: `true` ou `false` |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Retorna os campos personalizados do painel, conforme parametrizado |
| 500 | Server Error | Erro no servidor durante o processamento |

---

## Observações

- Autenticação via header é necessária.
- O parâmetro `NestedList` controla a estrutura de retorno dos campos: quando `true`, os campos são retornados de forma agrupada/aninhada; quando `false` (padrão), são retornados em lista plana.
- Faz parte da estrutura hierárquica: Core > CRM > Painéis > Campos personalizados.
- Suporta exemplos de código em múltiplas linguagens: Shell, Node, Ruby, PHP, Python.

---

## Fonte

URL original: `https://flwchat.readme.io/reference/get_v1-panel-id-custom-fields`
