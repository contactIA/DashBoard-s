# Adicionar Anotação em Card

## Informações Gerais

**Título:** Adicionar anotação

**Descrição:** Endpoint para adicionar uma anotação a um card no CRM.

**Método HTTP:** `POST`

**URL do Endpoint:** `https://api.wts.chat/crm/v1/panel/card/{cardId}/note`

**Versão da API:** v1.0

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `cardId` | UUID | Sim | ID do card ao qual a anotação será adicionada |

### Body Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `text` | string \| null | Não | Texto da anotação |
| `fileUrls` | array de strings \| null | Não | URLs públicas de arquivos a serem anexados à anotação |

> **Limitação de arquivo:** O tamanho máximo permitido para um arquivo é de **25MB**.

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Anotação criada com sucesso |
| 500 | Server Error | Erro no servidor |

---

## Observações

- Os arquivos informados em `fileUrls` devem ser URLs públicas acessíveis.
- Tamanho máximo por arquivo: 25MB.
- Autenticação via header é necessária.
- Suporta exemplos de código em múltiplas linguagens: Shell, Node, Ruby, PHP, Python.
- Interface interativa com opção "Try It!" para testar requisições.

---

## Fonte

URL original: `https://flwchat.readme.io/reference/post_v1-panel-card-cardid-note`
