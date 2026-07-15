# Criar Mensagem Agendada

## Informações Gerais

**Método HTTP:** POST

**URL do Endpoint:** `https://api.wts.chat/chat/v1/scheduled-message`

**Fonte:** https://flwchat.readme.io/reference/post_v1-scheduled-message

---

## Descrição

Realiza a criação de uma nova mensagem agendada utilizando os dados fornecidos no corpo da solicitação.

---

## Parâmetros do Body

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `from` | string \| null | Não | Número de telefone do canal cadastrado na conta |
| `to` | string | Sim | Número de telefone do destinatário (comprimento ≥ 1) |
| `department` | object | Não | Objeto contendo informações do departamento |
| `type` | string (enum) | Não | Tipo da mensagem: `TEMPLATE` ou `CHATBOT` |
| `templateId` | string \| null | Não | ID do modelo de mensagem a ser enviado |
| `botId` | uuid \| null | Não | ID do bot ativado após resposta do contato |
| `scheduling` | date-time | Não | Data e hora programada para envio |
| `hiddenSession` | boolean | Não | Define se a sessão fica oculta (padrão: false) |
| `templateParams` | object | Não | Parâmetros adicionais do modelo |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Mensagem agendada criada com sucesso |
| 500 | Server Error | Erro interno no processamento da solicitação |

---

## Informações Adicionais

- **Autenticação:** Requerida (via headers)
- **Formato de Resposta:** application/json
- Suporta múltiplas linguagens de programação (Shell, Node, Ruby, PHP, Python)
- Interface interativa disponível com botão "Try It!" para testes diretos
