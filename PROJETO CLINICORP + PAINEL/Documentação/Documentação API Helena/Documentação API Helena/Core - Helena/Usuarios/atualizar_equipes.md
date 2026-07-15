# Atualizar Equipes do Usuário

## Informações Gerais

**Título:** Atualizar equipes

**Descrição:** Endpoint para atualizar as equipes associadas a um usuário específico no sistema.

## Detalhes Técnicos

**Método HTTP:** `POST`

**URL do Endpoint:** `https://api.wts.chat/core/v1/agent/{id}/departments`

**Versão da API:** v1.0

## Autenticação

Requerida via Header.

## Parâmetros

### Parâmetros de Caminho (Path Params)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | UUID | Sim | ID do usuário |

### Parâmetros do Corpo (Body Params)

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `action` | string (enum) | Sim | Ação a ser realizada nas equipes |
| `items` | array of objects | Sim | Lista de equipes para atualização |

#### Valores Permitidos para `action`

| Valor | Descrição |
|-------|-----------|
| `ReplaceAll` | Substitui todas as equipes do usuário |
| `Upsert` | Insere ou atualiza equipes |
| `Remove` | Remove equipes do usuário |

## Respostas

| Código | Descrição |
|--------|-----------|
| 200 | Operação realizada com sucesso |
| 500 | Erro no servidor |

## Formato de Resposta

- **Content-Type:** application/json

## Linguagens Suportadas para Exemplos

Shell, Node, Ruby, PHP, Python
