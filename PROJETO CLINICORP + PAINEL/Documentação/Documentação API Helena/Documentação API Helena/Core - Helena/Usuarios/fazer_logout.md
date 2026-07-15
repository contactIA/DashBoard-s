# Fazer Logout do Usuário

## Informações Gerais

**Título:** Fazer logout

**Descrição:** Endpoint para realizar logout de um usuário/agente do sistema.

## Detalhes Técnicos

**Método HTTP:** `POST`

**URL do Endpoint:** `https://api.wts.chat/core/v1/agent/{id}/logout`

**Versão da API:** v1.0

## Autenticação

Requerida via Header.

## Parâmetros

### Parâmetros de Caminho (Path Params)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | UUID | Sim | ID do usuário |

### Parâmetros de Consulta (Query Params)

Nenhum parâmetro de query documentado.

### Body

Nenhum parâmetro de body documentado.

## Respostas

| Código | Descrição |
|--------|-----------|
| 200 | Logout realizado com sucesso |
| 500 | Erro interno do servidor |

## Formato de Resposta

- **Content-Type:** application/json

## Linguagens Suportadas para Exemplos

Shell, Node, Ruby, PHP, Python
