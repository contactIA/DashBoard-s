# Excluir Equipe

## Informações Gerais

**Título:** Excluir

**Descrição:** Endpoint para exclusão de um departamento/equipe específico no sistema.

## Detalhes Técnicos

**Método HTTP:** `DELETE`

**URL do Endpoint:** `https://api.wts.chat/core/v1/department/{id}`

## Autenticação

Requerida via Header.

## Parâmetros

### Parâmetros de Caminho (Path Params)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | uuid | Sim | Identificador único do departamento a ser excluído |

## Respostas

| Código | Descrição |
|--------|-----------|
| 200 | Exclusão do departamento realizada com êxito |
| 500 | Erro do servidor durante o processamento da solicitação |

## Formato de Resposta

- **Content-Type:** application/json

## Linguagens Suportadas para Exemplos

Shell, Node, Ruby, PHP, Python
