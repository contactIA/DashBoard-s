# 3. Como Ler e Responder Textos

## Visão Geral

Este guia aborda a integração de leitura e resposta de textos utilizando ChatGPT através da plataforma N8N, permitindo criar um assistente IA com capacidades de processamento de mensagens e execução de funções automatizadas.

---

## Estrutura da Integração

### 1. Configuração Inicial do Webhook

- **Plataforma:** N8N
- Criar novo workflow e adicionar node **"On webhook call"**
- **Método HTTP:** POST

---

### 2. Armazenamento de Variáveis

Criar node **"Edit Fields"** para armazenar a variável `text` contendo o valor `lastMessagesAggregated` do webhook recebido.

---

### 3. Configuração do Assistente OpenAI

**Node:** OpenIA > "Message an assistant"

**Parâmetros obrigatórios:**

| Parâmetro | Valor |
|-----------|-------|
| Credencial | API do OpenAI |
| Assistente | Selecionar o assistente previamente criado |
| Prompt | Variável `text` com opção "Define below" |
| Memória | "Use memory connector" com ID de sessão do webhook |

> **Importante:** Definir a memória é essencial para que o assistente consiga compreender o contexto conversacional entre mensagens.

---

### 4. Ferramentas (Tools) do Assistente

Três funcionalidades principais implementadas via requisições HTTP:

#### Ferramenta 1: Listar Equipes

- **Descrição:** Enumera equipes disponíveis para transferência
- **Método HTTP:** GET
- **Endpoint:** `/v2/department`
- **Utilidade:** Contextualizar decisões de roteamento

#### Ferramenta 2: Transferir Conversa

- **Método HTTP:** PUT
- **Endpoint:** `/v1/session/{id}/transfer`

**Body (JSON):**
```json
{
  "type": "DEPARTMENT",
  "newDepartmentId": "{departmentId}"
}
```

**Parâmetros:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | path | ID da sessão/conversa |
| `type` | body | Tipo de transferência (ex: `DEPARTMENT`) |
| `newDepartmentId` | body | ID do departamento destino (preenchido dinamicamente pelo modelo de IA) |

#### Ferramenta 3: Concluir Atendimento

- **Método HTTP:** PUT
- **Endpoint:** `/v1/session/{id}/complete`

**Body (JSON):**
```json
{
  "reactivateOnNewMessage": true
}
```

**Parâmetros:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | path | ID da sessão/conversa |
| `reactivateOnNewMessage` | body | Se `true`, reativa o atendimento ao receber nova mensagem |

---

### 5. Envio de Resposta ao Contato

**Módulo WTS no N8N:**
- **Node:** Session Actions > "Send Message Text"
- **Autenticação:** Chave API criada em "Integrações Via API"
- **Campo "Text":** resposta gerada pelo agente IA
- **Campo "Session ID":** identificador da sessão (proveniente do webhook)

---

## Diretrizes para o Assistente

Instruções recomendadas de comportamento:
- Ser rápido e objetivo nas respostas
- Explicar processos técnicos de forma simplificada
- Demonstrar paciência em situações delicadas
- Manter tom positivo e otimista
- Não solicitar dados sensíveis do cliente

---

## Recursos Adicionais

- Arquivo de fluxo pronto: JSON disponível no GitHub para download e customização
