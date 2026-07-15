# Buscar Assinatura de Webhook por ID

## Informações Gerais

**Título:** Busca assinatura por ID

**Descrição:** Endpoint para recuperar os detalhes de uma assinatura de webhook específica através de seu identificador único.

## Detalhes Técnicos

**Método HTTP:** `GET`

**URL do Endpoint:** `https://api.wts.chat/core/v1/webhook/subscription/{subscriptionId}`

**Versão da API:** v1.0

## Autenticação

Requerida via Header.

## Parâmetros

### Parâmetros de Caminho (Path Params)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `subscriptionId` | uuid | Sim | Identificador único da assinatura de webhook |

## Respostas

| Código | Descrição |
|--------|-----------|
| 200 | Retorna os dados da assinatura de webhook solicitada |
| 500 | Erro no servidor |

## Formato de Resposta

- **Content-Type:** application/json

## Operações Relacionadas

- Listar assinaturas: `GET /core/v1/webhook/subscription`
- Criar assinatura: `POST /core/v1/webhook/subscription`
- Atualizar assinatura: `PUT /core/v1/webhook/subscription/{subscriptionId}`
- Remover assinatura: `DELETE /core/v1/webhook/subscription/{subscriptionId}`

## Linguagens Suportadas para Exemplos

Shell, Node, Ruby, PHP, Python
