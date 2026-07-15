# Criar Card

## Informações Gerais

**Título:** Criar

**Descrição:** Endpoint para criar um novo card (item) em um painel de CRM.

**Método HTTP:** `POST`

**URL do Endpoint:** `https://api.wts.chat/crm/v1/panel/card`

---

## Parâmetros

### Body Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `stepId` | UUID | Sim | Identificador da etapa do painel onde o card será inserido |
| `title` | string | Sim | Título do card (1 a 500 caracteres) |
| `description` | string \| null | Não | Descrição complementar do card |
| `position` | double | Não | Posição do card na etapa (0 a 2147483647) |
| `dueDate` | date-time | Não | Data de vencimento do card |
| `responsibleUserId` | UUID | Não | ID do usuário responsável pelo card |
| `tagIds` | array de UUIDs | Não | IDs das etiquetas atribuídas ao card |
| `tagNames` | array de strings | Não | Nomes das etiquetas (ignorado se `tagIds` for definido) |
| `contactIds` | array de strings | Não | IDs dos contatos relacionados ao card |
| `sessionId` | UUID | Não | ID da conversa relacionada ao card |
| `monetaryAmount` | double | Não | Valor monetário associado ao card |
| `customFields` | object | Não | Objeto chave-valor para campos personalizados |
| `metadata` | object | Não | Dados adicionais em formato chave-valor |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Card criado com sucesso |
| 500 | Server Error | Erro no servidor |

---

## Observações

- O campo `tagNames` é ignorado quando `tagIds` está definido.
- Campos personalizados (`customFields`) com chaves inválidas ou tipos incompatíveis são ignorados silenciosamente.
- Para metadados (`metadata`): atribua `null` a uma chave para removê-la.
- Autenticação via header é necessária.
- Suporta exemplos de código em múltiplas linguagens: Shell, Node, Ruby, PHP, Python.

---

## Fonte

URL original: `https://flwchat.readme.io/reference/post_v1-panel-card`
