# Listar Etiquetas

## Informações Gerais

**Título:** Listar

**Descrição:** Endpoint para listar as etiquetas (tags) disponíveis no sistema.

## Detalhes Técnicos

**Método HTTP:** `GET`

**URL do Endpoint:** `https://api.wts.chat/core/v1/tag`

**Versão da API:** v1.0

## Autenticação

Requerida via Header.

## Parâmetros

Nenhum parâmetro de query, path ou body especificado para este endpoint.

## Respostas

| Código | Descrição |
|--------|-----------|
| 200 | Retorna a lista de etiquetas disponíveis |
| 500 | Erro no servidor |

## Formato de Resposta

- **Content-Type:** application/json

## Observações

- A documentação menciona suporte a Rate limiting e Paginação.

## Linguagens Suportadas para Exemplos

Shell, Node, Ruby, PHP, Python
