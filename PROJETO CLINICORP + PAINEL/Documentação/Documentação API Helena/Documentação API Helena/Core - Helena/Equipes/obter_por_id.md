# Obter Equipe por ID

## Informações Gerais

**Título:** Obter por ID

**Descrição:** Endpoint para recuperar informações de um departamento/equipe específico através de seu identificador único.

## Detalhes Técnicos

**Método HTTP:** `GET`

**URL do Endpoint:** `https://api.wts.chat/core/v1/department/{id}`

## Autenticação

Requerida via Header.

## Parâmetros

### Parâmetros de Caminho (Path Params)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | uuid | Sim | Identificador único do departamento a ser consultado |

### Parâmetros de Consulta (Query Params)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `includeDetails` | string (enum) | Não | Define quais detalhes adicionais devem ser incluídos na resposta. Valores permitidos: `All`, `Agents`, `Channels` |

## Respostas

| Código | Descrição |
|--------|-----------|
| 200 | Retorna os dados do departamento solicitado |
| 500 | Erro no servidor |

## Formato de Resposta

- **Content-Type:** application/json

## Linguagens Suportadas para Exemplos

Shell, Node, Ruby, PHP, Python
