# Obter Usuário por ID

## Informações Gerais

**Título:** Obter por ID

**Descrição:** Endpoint para recuperar informações de um usuário específico através de seu identificador único.

## Detalhes Técnicos

**Método HTTP:** `GET`

**URL do Endpoint:** `https://api.wts.chat/core/v1/agent/{id}`

**Versão da API:** v1.0

## Autenticação

Requerida via Header.

## Parâmetros

### Parâmetros de Caminho (Path Params)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | uuid | Sim | ID do usuário |

### Parâmetros de Consulta (Query Params)

Nenhum parâmetro de query especificado.

### Body

Não há body necessário para esta requisição (GET).

## Respostas

| Código | Descrição |
|--------|-----------|
| 200 | Retorna os dados do usuário solicitado |
| 500 | Erro no servidor |

## Formato de Resposta

- **Content-Type:** application/json

## Linguagens Suportadas para Exemplos

Shell, Node, Ruby, PHP, Python
