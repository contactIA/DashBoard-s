# Obter Contato por ID

## Informações Gerais

**Método HTTP:** GET

**Endpoint:** `https://api.wts.chat/core/v1/contact/{id}`

**Descrição:** Recupera informações de um contato específico através de seu identificador único.

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | uuid | Sim | ID do contato |

### Query Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `IncludeDetails` | array de strings | Não | Detalhes que devem ser incluídos na resposta |

---

## Respostas

| Código | Descrição |
|--------|-----------|
| 200 | Sucesso — retorna os dados do contato solicitado em formato JSON |
| 500 | Erro interno no servidor |

---

## Observações

- Requer autenticação via header.
- Suporta exemplos em múltiplas linguagens: Shell, Node, Ruby, PHP, Python.
- Endpoint complementar às operações de listagem e filtragem disponíveis na seção de Contatos.
