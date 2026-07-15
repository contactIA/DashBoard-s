# Listar Canais da Equipe

## Informações Gerais

**Título:** Listar canais

**Descrição:** Endpoint para listar os canais de atendimento associados a uma equipe específica.

## Detalhes Técnicos

**Método HTTP:** `GET`

**URL do Endpoint:** `https://api.wts.chat/core/v1/department/{id}/channel`

**Versão da API:** v1.0

## Autenticação

Requerida via Header.

## Parâmetros

### Parâmetros de Caminho (Path Params)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | UUID | Sim | Identificador único da equipe |

### Parâmetros de Consulta (Query Params)

Nenhum parâmetro de query documentado.

### Body

Não há body necessário para esta requisição (GET).

## Respostas

| Código | Descrição |
|--------|-----------|
| 200 | Retorna informações sobre os canais da equipe |
| 500 | Erro interno no servidor |

## Formato de Resposta

- **Content-Type:** application/json

## Linguagens Suportadas para Exemplos

Shell, Node, Ruby, PHP, Python
