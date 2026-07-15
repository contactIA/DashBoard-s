# Criar Equipe

## Informações Gerais

**Título:** Criar Equipe

**Descrição:** Endpoint para criar uma nova equipe no sistema de chat.

## Detalhes Técnicos

**Método HTTP:** `POST`

**URL do Endpoint:** `https://api.wts.chat/core/v1/department`

## Autenticação

Requerida via Header.

## Parâmetros do Corpo (Body Params)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `name` | string \| null | Não | Nome da equipe |
| `isDefault` | boolean | Não | Indica se é a equipe padrão (true/false) |
| `distributionIsEnabled` | boolean | Não | Define se a distribuição está habilitada (true/false) |
| `distributionConfig` | object | Não | Configuração de distribuição |
| `restrictionType` | string \| null | Não | Tipo de restrição. Valores permitidos: `NONE`, `DEPARTMENT_RESTRICTION`, `USER_RESTRICTION` |
| `channelsConfig` | object | Não | Configuração de canais |
| `agents` | array of objects \| null | Não | Lista de usuários para criar na equipe |

## Respostas

| Código | Descrição |
|--------|-----------|
| 200 | Sucesso na criação da equipe |
| 500 | Erro no servidor |

## Formato de Resposta

- **Content-Type:** application/json

## Linguagens Suportadas para Exemplos

Shell, Node, Ruby, PHP, Python
