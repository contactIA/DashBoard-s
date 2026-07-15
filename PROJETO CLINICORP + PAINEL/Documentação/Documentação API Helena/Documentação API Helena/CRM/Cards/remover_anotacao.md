# Remover Anotação de Card

## Informações Gerais

**Título:** Remover anotação

**Descrição:** Endpoint para remover uma anotação específica de um card no CRM.

**Método HTTP:** `DELETE`

**URL do Endpoint:** `https://api.wts.chat/crm/v1/panel/card/{cardId}/note/{noteId}`

**Versão da API:** v1.0

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `cardId` | UUID | Sim | ID do card que contém a anotação |
| `noteId` | UUID | Sim | ID da anotação a ser removida |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Anotação removida com sucesso |
| 500 | Server Error | Erro no servidor |

---

## Observações

- Autenticação via header é necessária.
- Ambos os parâmetros de path são obrigatórios para identificar unicamente a anotação.
- Faz parte da estrutura hierárquica: CRM > Cards > Anotações.
- Suporta exemplos de código em múltiplas linguagens: Shell, Node, Ruby, PHP, Python.

---

## Fonte

URL original: `https://flwchat.readme.io/reference/delete_v1-panel-card-cardid-note-noteid`
