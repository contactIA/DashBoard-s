# 2. Criar o Loop no Chatbot

## Descrição Geral

Este guia documenta o processo de configuração de um chatbot integrado com IA, focando na criação de um sistema de loop que garante o processamento contínuo de mensagens através de webhooks.

---

## Como Criar o Modelo do Chatbot

### Passos Iniciais

1. **Acesso à Plataforma:** Faça login como administrador
2. **Navegação:** Apps > Chatbot > Novo
3. **Configuração Básica:**
   - Designar nome ao chatbot
   - Associar a um canal (Z-API ou WhatsApp oficial)
   - Definir equipe padrão

---

## Estrutura do Fluxo

| Etapa | Descrição |
|-------|-----------|
| 1 | Criar nó com mensagem receptiva inicial |
| 2 | Configurar ação de espera com "Limite de espera: Sem limite" e "Tolerância: 5 segundos" |
| 3 | Implementar ponto de retorno acima do nó de aguardamento (essencial para funcionalidade do loop) |
| 4 | Configurar disparo webhook para envio de informações |

### Configuração do Webhook

> No campo **URL**, copie a URL do webhook que deverá ser criado no N8N e cole no campo "URL".

---

## Como Criar os Loops

### Subfluxo de Sucesso

- Redirecionar para o ponto de retorno denominado **"GPT"**
- Permite que mensagens sejam processadas continuamente

### Subfluxo de Falha

- Adicionar mensagem informando falha/incompreensão
- Incluir ponto de retorno **"GPT"** similar ao fluxo de sucesso

---

## Finalização

Após a configuração completa:
1. Salvar o chatbot
2. Publicar
3. Associar o chatbot ao canal de atendimento
