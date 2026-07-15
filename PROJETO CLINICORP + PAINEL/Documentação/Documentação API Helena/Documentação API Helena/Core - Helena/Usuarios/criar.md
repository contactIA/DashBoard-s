# Criar Usuário

## Informações Gerais

**Título:** Criar

**Descrição:** Endpoint para criar um novo usuário/agente no sistema.

## Detalhes Técnicos

**Método HTTP:** `POST`

**URL do Endpoint:** `https://api.wts.chat/core/v1/agent`

## Autenticação

Requerida via Header.

## Parâmetros

### Parâmetros do Corpo (Body Params)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `name` | string | Sim | Nome do usuário (entre 1 e 100 caracteres) |
| `email` | string \| null | Não | Email do usuário |
| `phoneNumber` | string \| null | Não | Telefone do usuário |
| `profile` | string (enum) | Sim | Perfil do usuário. Valores permitidos: `Admin`, `Agent`, `RestrictedAgent` |
| `availability` | string \| null (enum) | Não | Disponibilidade do usuário. Valores permitidos: `AVAILABLE`, `UNAVAILABLE` |

## Respostas

| Código | Descrição |
|--------|-----------|
| 200 | Usuário criado com sucesso |
| 500 | Erro no servidor |

## Formato de Resposta

- **Content-Type:** application/json

## Linguagens Suportadas para Exemplos

Shell, Node, Ruby, PHP, Python
