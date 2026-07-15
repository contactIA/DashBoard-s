# Atualizar Usuário

## Informações Gerais

**Título:** Atualizar

**Descrição:** Endpoint para atualizar informações de um usuário (agente) no sistema.

## Detalhes Técnicos

**Método HTTP:** `PUT`

**URL do Endpoint:** `https://api.wts.chat/core/v1/agent/{id}`

## Autenticação

Requerida via Header.

## Parâmetros

### Parâmetros de Caminho (Path Params)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | UUID | Sim | ID do usuário |

### Parâmetros do Corpo (Body Params)

| Campo | Tipo | Obrigatório | Descrição | Valores Permitidos |
|-------|------|-------------|-----------|-------------------|
| `name` | string \| null | Não | Nome do usuário | — |
| `shortName` | string \| null | Não | Nome curto/apelido do usuário | — |
| `email` | string \| null | Não | Email do usuário | — |
| `phoneNumber` | string \| null | Não | Número de telefone do usuário | — |
| `profile` | string (enum) | Não | Perfil do usuário | `Admin`, `Agent`, `RestrictedAgent` |
| `availability` | string (enum) | Não | Disponibilidade do usuário | `AVAILABLE`, `UNAVAILABLE` |
| `fields` | array of strings | Sim | Campos que devem ser atualizados | — |

> **Observação:** O campo `fields` é obrigatório e especifica quais campos devem ser atualizados na requisição.

## Respostas

| Código | Descrição |
|--------|-----------|
| 200 | Atualização realizada com sucesso |
| 500 | Erro no servidor |

## Formato de Resposta

- **Content-Type:** application/json

## Linguagens Suportadas para Exemplos

Shell, Node, Ruby, PHP, Python
