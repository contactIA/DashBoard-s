# Atualizar Contato por Número de Telefone

## Informações Gerais

**Método HTTP:** PUT

**Endpoint:** `https://api.wts.chat/core/v1/contact/phonenumber/{phone}`

**Descrição:** Atualiza os dados de um contato utilizando o número de telefone como identificador.

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `phone` | string | Sim | Número de telefone |

### Body Parameters

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `fields` | array de strings | Campos a serem atualizados |
| `name` | string | Nome do contato |
| `phoneNumber` | string | Número no WhatsApp |
| `email` | string | Endereço de email |
| `instagram` | string | Nome de usuário no Instagram |
| `annotation` | string | Notas internas da equipe |
| `tagIds` | array de UUIDs | IDs das etiquetas atribuídas |
| `tagNames` | array de strings | Nomes das etiquetas (ignorado se `tagIds` for definido) |
| `portfolioIds` | array de UUIDs | IDs das carteiras atribuídas |
| `portfolioNames` | array de strings | Nomes das carteiras (ignorado se `portfolioIds` for definido) |
| `sequenceIds` | array de UUIDs | IDs das sequências atribuídas |
| `status` | string (enum) | Status do contato: `ACTIVE`, `ARCHIVED`, `BLOCKED` |
| `pictureUrl` | string | URL para definição da imagem do contato |
| `customFields` | object | Campos personalizados em estrutura chave-valor |
| `metadata` | object | Metadados adicionais em estrutura chave-valor |
| `utm` | object | Dados UTM |
| `options` | object | Opções adicionais |

---

## Respostas

| Código | Descrição |
|--------|-----------|
| 200 | Sucesso |
| 500 | Erro no servidor |

---

## Observações

- Metadados podem ser adicionados, atualizados ou removidos (atribuindo valor nulo).
- O campo `tagNames` será desconsiderado se `tagIds` for definido.
- O campo `portfolioNames` será desconsiderado se `portfolioIds` for definido.
- Valores incompatíveis em `customFields` serão ignorados.
- Requer autenticação via header.
