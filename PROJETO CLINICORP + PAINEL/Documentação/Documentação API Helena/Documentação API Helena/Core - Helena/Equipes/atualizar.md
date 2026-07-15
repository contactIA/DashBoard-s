# Atualizar Equipe

## Informações Gerais

**Título:** Atualizar Equipe

**Descrição:** Endpoint para atualização de dados de uma equipe existente no sistema.

## Detalhes Técnicos

**Método HTTP:** `PUT`

**URL do Endpoint:** `https://api.wts.chat/core/v1/department/{id}`

## Autenticação

Requerida via Header.

## Parâmetros

### Parâmetros de Caminho (Path Params)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | UUID | Sim | Identificador único da equipe a ser atualizada |

### Parâmetros do Corpo (Body Params)

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `name` | string \| null | Não | Nome da equipe |
| `isDefault` | boolean | Não | Define se é a equipe padrão (true/false) |
| `distributionIsEnabled` | boolean | Não | Indica se a distribuição está habilitada |
| `distributionConfig` | object | Não | Configuração de distribuição |
| `restrictionType` | string \| null | Não | Tipo de restrição. Valores permitidos: `NONE`, `DEPARTMENT_RESTRICTION`, `USER_RESTRICTION` |
| `channelsConfig` | object | Não | Configuração de canais |
| `fields` | array de strings | Sim | Campos que devem ser atualizados |

## Respostas

| Código | Descrição |
|--------|-----------|
| 200 | Equipe atualizada com sucesso |
| 500 | Erro no servidor |

## Formato de Resposta

- **Content-Type:** application/json

## Linguagens Suportadas para Exemplos

Shell, Node, Ruby, PHP, Python
