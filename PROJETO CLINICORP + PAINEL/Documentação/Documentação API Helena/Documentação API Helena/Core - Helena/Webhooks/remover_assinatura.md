# Remover Assinatura de Webhook

## Informações Gerais

**Título:** Remove assinatura

**Descrição:** Remove assinatura de webhook.

## Detalhes Técnicos

**Método HTTP:** `DELETE`

**URL do Endpoint:** `https://api.wts.chat/core/v1/webhook/subscription/{subscriptionId}`

## Autenticação

Requerida via Header.

## Parâmetros

### Parâmetros de Caminho (Path Params)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `subscriptionId` | uuid | Sim | ID da assinatura de webhook |

## Respostas

| Código | Descrição |
|--------|-----------|
| 200 | Assinatura removida com sucesso |
| 500 | Erro no servidor |

## Formato de Resposta

- **Content-Type:** application/json

## Linguagens Suportadas para Exemplos

Shell, Node, Ruby, PHP, Python
