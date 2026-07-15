# Atualizar Assinatura de Webhook

## Informações Gerais

**Título:** Atualiza assinatura

**Descrição:** Atualiza assinatura de webhook.

## Detalhes Técnicos

**Método HTTP:** `PUT`

**URL do Endpoint:** `https://api.wts.chat/core/v1/webhook/subscription/{subscriptionId}`

## Autenticação

Requerida via Header.

## Parâmetros

### Parâmetros de Caminho (Path Params)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `subscriptionId` | uuid | Sim | ID da assinatura de webhook |

### Parâmetros do Corpo (Body Params)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `fields` | array of strings | Sim | Campos a serem atualizados |
| `name` | string \| null | Não | Nome para identificação da assinatura |
| `url` | string \| null | Não | URL destino para onde serão enviadas requisições POST |
| `enabled` | boolean \| null | Não | Estado da assinatura (ativa/inativa). Padrão: `true` |
| `events` | array of strings \| null | Não | Tópicos de webhook que deverão ser inscritos nesta assinatura |

> **Observação:** O campo `fields` é obrigatório e deve conter os nomes dos campos que serão atualizados na requisição.

## Respostas

| Código | Descrição |
|--------|-----------|
| 200 | Atualização realizada com sucesso |
| 500 | Erro no servidor |

## Formato de Resposta

- **Content-Type:** application/json

## Linguagens Suportadas para Exemplos

Shell, Node, Ruby, PHP, Python
