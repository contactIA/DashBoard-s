# Alterar Status do Usuário

## Informações Gerais

**Título:** Alterar status

**Descrição:** Endpoint para modificar o status de um usuário/agente no sistema.

## Detalhes Técnicos

**Método HTTP:** `POST`

**URL do Endpoint:** `https://api.wts.chat/core/v1/agent/{id}/status`

**Versão da API:** v1.0

## Autenticação

Requerida via Header.

## Parâmetros

### Parâmetros de Caminho (Path Params)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | UUID | Sim | ID do usuário |

### Parâmetros do Corpo (Body Params)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `status` | string (enum) | Sim | Novo status do usuário |

#### Valores Permitidos para `status`

| Valor | Descrição |
|-------|-----------|
| `Undefined` | Status indefinido |
| `Active` | Usuário ativo |
| `Blocked` | Usuário bloqueado |

## Respostas

| Código | Descrição |
|--------|-----------|
| 200 | Status alterado com sucesso |
| 500 | Erro no servidor |

## Formato de Resposta

- **Content-Type:** application/json

## Linguagens Suportadas para Exemplos

Shell, Node, Ruby, PHP, Python
