# Atualizar Contato

## Informações Gerais

**Método HTTP:** PUT

**Endpoint:** `https://api.wts.chat/core/v2/contact/{id}`

**Descrição:** Atualiza os dados de um contato pelo seu ID.

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | uuid | Sim | ID do contato |

### Body Parameters

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `fields` | array of strings | Campos a serem atualizados |
| `name` | string | Nome do contato |
| `phoneNumber` | string | Número no WhatsApp |
| `email` | string | Endereço de email |
| `instagram` | string | Nome de usuário no Instagram |
| `annotation` | string | Notas internas da equipe |
| `tagIds` | array of uuids | IDs das etiquetas atribuídas |
| `tagNames` | array of strings | Nomes das etiquetas (ignorado se `tagIds` for definido) |
| `portfolioIds` | array of uuids | IDs das carteiras atribuídas |
| `portfolioNames` | array of strings | Nomes das carteiras (ignorado se `portfolioIds` for definido) |
| `sequenceIds` | array of uuids | IDs das sequências atribuídas |
| `status` | string (enum) | Status do contato: `ACTIVE`, `ARCHIVED` ou `BLOCKED` |
| `pictureUrl` | string | URL para imagem do contato |
| `customFields` | object | Campos personalizados em estrutura chave-valor |
| `metadata` | object | Metadados adicionais em estrutura chave-valor |
| `utm` | object | Dados UTM |
| `options` | object | Opções adicionais |

---

## Respostas

| Código | Descrição |
|--------|-----------|
| 200 | Sucesso |
| 500 | Erro do servidor |

---

## Observações

- Requer autenticação via header.
- Suporta exemplos em múltiplas linguagens: Shell, Node, Ruby, PHP, Python.
