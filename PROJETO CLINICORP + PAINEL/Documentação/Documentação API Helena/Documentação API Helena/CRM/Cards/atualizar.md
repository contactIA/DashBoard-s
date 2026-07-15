# Atualizar Card

## Informações Gerais

**Título:** Atualizar

**Descrição:** Endpoint para atualizar informações de um card (item) no CRM.

**Método HTTP:** `PUT`

**URL do Endpoint:** `https://api.wts.chat/crm/v2/panel/card/{id}`

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | string | Sim | Identificador único do card a ser atualizado |

### Body Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `fields` | array de strings | Não | Campos a serem atualizados (controle de quais campos serão alterados) |
| `stepId` | UUID | Não | ID da etapa do painel para mover o card |
| `title` | string | Não | Título do card |
| `description` | string | Não | Descrição do card |
| `position` | double | Não | Posição na etapa (0 a 2147483647) |
| `dueDate` | date-time | Não | Data de vencimento |
| `responsibleUserId` | UUID | Não | ID do usuário responsável |
| `tagIds` | array de UUIDs | Não | IDs das etiquetas atribuídas |
| `tagNames` | array de strings | Não | Nomes das etiquetas (ignorado se `tagIds` for definido) |
| `contactIds` | array de UUIDs | Não | IDs dos contatos relacionados |
| `sessionId` | UUID | Não | ID da conversa relacionada |
| `monetaryAmount` | double | Não | Valor monetário associado ao card |
| `archived` | boolean | Não | Status de arquivamento (`true` para arquivar, `false` para desarquivar) |
| `customFields` | object | Não | Campos personalizados em formato chave-valor |
| `metadata` | object | Não | Metadados adicionais em formato chave-valor |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Card atualizado com sucesso |
| 500 | Server Error | Erro no servidor |

---

## Observações

- O parâmetro `tagNames` é desconsiderado caso `tagIds` seja definido.
- Campos personalizados com chaves inválidas ou tipos incompatíveis serão ignorados.
- Para metadados: atribua `null` a uma chave para removê-la; chaves ausentes não são alteradas.
- Autenticação via header é necessária.
- Versão v2 do endpoint.
- Suporta exemplos de código em múltiplas linguagens: Shell, Node, Ruby, PHP, Python.

---

## Fonte

URL original: `https://flwchat.readme.io/reference/put_v2-panel-card-id`
