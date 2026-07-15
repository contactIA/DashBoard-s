# Campos Personalizados

## Informações Gerais

**Método HTTP:** GET

**Endpoint:** `https://api.wts.chat/core/v1/contact/custom-field`

**Descrição:** Retorna os campos personalizados disponíveis para contatos.

---

## Parâmetros de Query

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `NestedList` | boolean | false | Determina a estrutura da lista retornada. Se verdadeiro, os campos serão retornados de forma aninhada |

---

## Respostas

| Código | Descrição |
|--------|-----------|
| 200 | Sucesso — retorna os campos personalizados em formato JSON |
| 500 | Erro no servidor |

---

## Observações

- Requer autenticação via header.
- Suporta exemplos em múltiplas linguagens: Shell, Node, Ruby, PHP, Python.
- Interface interativa "Try It!" disponível para testar requisições.
