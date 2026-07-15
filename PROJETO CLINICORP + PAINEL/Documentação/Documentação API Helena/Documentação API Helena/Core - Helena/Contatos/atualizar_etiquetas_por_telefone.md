# Atualizar Etiquetas por Número de Telefone

## Informações Gerais

**Método HTTP:** POST

**Endpoint:** `https://api.wts.chat/core/v1/contact/phonenumber/{phone}/tags`

**Descrição:** Gerencia etiquetas associadas a um contato utilizando seu número de telefone como identificador.

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `phone` | string | Sim | O número de telefone do contato a ser atualizado |

### Body Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `tagNames` | array de strings | Não | Lista contendo os nomes das etiquetas a serem processadas |
| `tagIds` | array de UUIDs | Não | Identificadores únicos das etiquetas (alternativa ao `tagNames`) |
| `operation` | string (enum) | Sim | Tipo de operação a executar |

### Valores Permitidos para `operation`

| Valor | Descrição |
|-------|-----------|
| `InsertIfNotExists` | Adiciona etiquetas não associadas ao contato |
| `DeleteIfExists` | Remove etiquetas já vinculadas ao contato |
| `ReplaceAll` | Substitui todas as etiquetas existentes pelas informadas |

---

## Respostas

| Código | Descrição |
|--------|-----------|
| 200 | Operação realizada com êxito |
| 500 | Erro no servidor |

---

## Observações

- Requer autenticação via header.
- Suporta exemplos em múltiplas linguagens: Shell, Node, Ruby, PHP, Python.
