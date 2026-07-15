# Criar Assinatura de Webhook

## Informações Gerais

**Título:** Cria assinatura

**Descrição:** Esta operação realiza a criação de uma nova assinatura de webhook no sistema.

## Detalhes Técnicos

**Método HTTP:** `POST`

**URL do Endpoint:** `https://api.wts.chat/core/v1/webhook/subscription`

## Autenticação

Requerida via Header.

## Parâmetros

### Parâmetros do Corpo (Body Params)

| Parâmetro | Tipo | Obrigatório | Restrições | Descrição |
|-----------|------|-------------|------------|-----------|
| `name` | string | Sim | 1–100 caracteres | Nome para identificação da assinatura |
| `url` | string | Sim | 1–500 caracteres | URL destino para onde serão enviadas requisições POST |
| `enabled` | boolean \| null | Não | Padrão: `true` | Estado inicial da assinatura (ativa ou inativa) |
| `events` | array of strings | Sim | Mínimo 1 item | Eventos que deverão ser enviados para esta assinatura |

## Respostas

| Código | Descrição |
|--------|-----------|
| 200 | Assinatura criada com sucesso |
| 500 | Erro no processamento da requisição |

## Formato de Resposta

- **Content-Type:** application/json

## Linguagens Suportadas para Exemplos

Shell, Node, Ruby, PHP, Python
