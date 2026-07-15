# Enviar Mensagem Síncrona em Conversa

## Informações Gerais

**Descrição:** Este endpoint permite enviar uma mensagem de forma síncrona dentro de uma conversa. Respeita as mesmas regras do canal de atendimento. O envio é síncrono com tempo máximo de espera de 25 segundos pela resposta do servidor.

---

## Detalhes da Requisição

### Método HTTP
`POST`

### Endpoint
```
https://api.wts.chat/chat/v1/session/{id}/message/sync
```

---

## Parâmetros

### Path Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | UUID | Sim | Identificador da sessão/conversa |

### Body Parameters

| Parâmetro | Tipo | Obrigatoriedade | Descrição |
|-----------|------|-----------------|-----------|
| `text` | string \| null | Condicional | Texto da mensagem. Obrigatório se `templateId` ou `fileUrl` não forem informados |
| `templateId` | string \| null | Condicional | ID do modelo de mensagem. Obrigatório se `text` ou `fileUrl` não forem informados |
| `parameters` | object \| null | Condicional | Parâmetros do modelo, obrigatório se o template possuir parâmetros |
| `fileUrl` | string \| null | Condicional | URL pública do arquivo a enviar |
| `fileId` | UUID \| null | Opcional | ID do arquivo obtido via `/core/v2/file` |
| `refId` | UUID \| null | Opcional | ID de referência para identificar resposta a mensagem anterior |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Mensagem enviada com sucesso |
| 500 | Server Error | Erro no servidor |

---

## Autenticação

Autenticação via header é necessária.

---

## Diferença entre Envio Assíncrono e Síncrono

| Característica | Assíncrono (`/message`) | Síncrono (`/message/sync`) |
|---------------|------------------------|---------------------------|
| Processamento | Em fila (assíncrono) | Aguarda resposta do servidor |
| Tempo máximo | Não especificado | 25 segundos |
| Retorno imediato | Não (apenas confirmação de enfileiramento) | Sim (resultado do envio) |

---

## Observações

- Conversas no WhatsApp requerem uso de modelo de mensagem
- Contatos não cadastrados são criados automaticamente
- Suporta múltiplas linguagens de exemplo: Shell, Node, Ruby, PHP, Python
