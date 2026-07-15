# Atualizar Usuários da Equipe

## Informações Gerais

**Título:** Atualizar usuários

**Descrição:** Endpoint para atualizar usuários em uma equipe, permitindo operações de substituição completa, atualização ou remoção.

## Detalhes Técnicos

**Método HTTP:** `PUT`

**URL do Endpoint:** `https://api.wts.chat/core/v1/department/{id}/agents`

## Autenticação

Requerida via Header.

## Parâmetros

### Parâmetros de Caminho (Path Params)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | UUID | Sim | Identificador único da equipe |

### Parâmetros do Corpo (Body Params)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `action` | string (enum) | Sim | Define a operação a ser realizada |
| `items` | array of objects | Sim | Lista de objetos com dados dos usuários a atualizar |

#### Valores Permitidos para `action`

| Valor | Descrição |
|-------|-----------|
| `ReplaceAll` | Substitui todos os usuários da equipe |
| `Upsert` | Insere ou atualiza usuários |
| `Remove` | Remove usuários da equipe |

## Respostas

| Código | Descrição |
|--------|-----------|
| 200 | Sucesso na operação |
| 500 | Erro no servidor |

## Formato de Resposta

- **Content-Type:** application/json

## Linguagens Suportadas para Exemplos

Shell, Node, Ruby, PHP, Python
