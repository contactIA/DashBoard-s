# Listar Eventos de Webhook

## Informações Gerais

**Título:** Listar eventos

**Descrição:** Listagem dos eventos de webhook que podem ser assinados.

## Detalhes Técnicos

**Método HTTP:** `GET`

**URL do Endpoint:** `https://api.wts.chat/core/v1/webhook/event`

**Versão da API:** v1.0

## Autenticação

Requerida via Header.

## Parâmetros

Nenhum parâmetro de query, path ou body especificado para este endpoint.

## Respostas

| Código | Descrição |
|--------|-----------|
| 200 | Retorna a lista de eventos de webhook disponíveis para assinatura |
| 500 | Erro no servidor |

## Formato de Resposta

- **Content-Type:** application/json

## Linguagens Suportadas para Exemplos

Shell, Node, Ruby, PHP, Python
