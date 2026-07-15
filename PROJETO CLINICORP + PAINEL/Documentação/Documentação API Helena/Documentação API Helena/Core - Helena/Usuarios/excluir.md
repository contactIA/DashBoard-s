# Excluir Usuário

## Informações Gerais

**Título:** Excluir

**Descrição:** Endpoint para remover um usuário do sistema, com opções de resolução de sessões ativas.

## Detalhes Técnicos

**Método HTTP:** `DELETE`

**URL do Endpoint:** `https://api.wts.chat/core/v1/agent/{id}`

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
| `sessionResolution` | string (enum) | Não | Define como resolver sessões ativas do usuário |
| `transferUserId` | UUID | Condicional | ID do usuário que receberá os atendimentos em andamento — obrigatório quando `sessionResolution` = `TRANSFER` |

#### Valores Permitidos para `sessionResolution`

| Valor | Descrição |
|-------|-----------|
| `COMPLETE` | Completar as sessões ativas |
| `TRANSFER` | Transferir sessões para outro usuário |
| `RETURN_TO_PENDING` | Retornar sessões para a fila pendente |

## Respostas

| Código | Descrição |
|--------|-----------|
| 200 | Usuário excluído com sucesso |
| 500 | Erro no servidor |

## Formato de Resposta

- **Content-Type:** application/json

## Linguagens Suportadas para Exemplos

Shell, Node, Ruby, PHP, Python
