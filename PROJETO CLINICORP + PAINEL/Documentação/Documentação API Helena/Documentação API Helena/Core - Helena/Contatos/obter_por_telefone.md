# Obter Contato por Número de Telefone

## Informações Gerais

**Método HTTP:** GET

**Endpoint:** `https://api.wts.chat/core/v1/contact/phonenumber/{phone}`

**Descrição:** Recupera informações de um contato através de seu número de telefone.

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `phone` | string | Sim | Número de telefone do contato a ser consultado |

### Query Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `IncludeDetails` | array de strings | Não | Detalhes que devem ser incluídos na resposta |

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
- Faz parte da seção "Core" > "Contatos" da API.
