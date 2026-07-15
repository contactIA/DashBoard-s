# Criar Contato

## Informações Gerais

**Método HTTP:** POST

**Endpoint:** `https://api.wts.chat/core/v1/contact`

**Descrição:** Criação de um novo contato no sistema.

---

## Parâmetros do Body

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `name` | string \| null | Nome do contato |
| `phoneNumber` | string \| null | Número no WhatsApp |
| `email` | string \| null | Endereço de email |
| `instagram` | string \| null | Nome de usuário no Instagram |
| `annotation` | string \| null | Notas internas da equipe |
| `tagIds` | array de UUIDs \| null | IDs das etiquetas atribuídas |
| `tagNames` | array de strings \| null | Nomes das etiquetas (ignorado se `tagIds` for definido) |
| `portfolioIds` | array de UUIDs \| null | IDs das carteiras atribuídas |
| `portfolioNames` | array de strings \| null | Nomes das carteiras (ignorado se `portfolioIds` for definido) |
| `sequenceIds` | array de UUIDs \| null | IDs das sequências atribuídas |
| `customFields` | object \| null | Pares chave-valor para campos personalizados |
| `metadata` | object \| null | Metadados adicionais em estrutura chave-valor |
| `options` | object | Opções adicionais |

---

## Respostas

| Código | Descrição |
|--------|-----------|
| 200 | Sucesso |
| 500 | Erro do servidor |

---

## Observações Importantes

- Campos marcados como `| null` são opcionais.
- O parâmetro `tagNames` é desconsiderado caso `tagIds` já esteja definido.
- O parâmetro `portfolioNames` é desconsiderado caso `portfolioIds` já esteja definido.
- Requer autenticação via header.
