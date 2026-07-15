# 1. Criar um Assistente

## Visão Geral

Este guia apresenta os primeiros passos para criar um agente de IA e configurar sua integração com assistentes usando a plataforma OpenAI.

---

## Como Criar uma Conta na OpenAI

**Descrição:** Processo de registro na plataforma OpenAI.

**Passos:**
1. Acesse https://platform.openai.com
2. Clique em "Sign Up" ou "Registrar-se"
3. Forneça endereço de e-mail (ou conecte Google/Microsoft) e crie senha
4. Verifique seu e-mail através do link enviado pela OpenAI
5. Preencha dados pessoais solicitados
6. Escolha entre plano gratuito ou pago

---

## Como Criar um Projeto dentro da OpenAI

**Descrição:** Etapas para criar um assistente IA no painel da OpenAI.

**Procedimento:**
1. Acesse o Dashboard em https://platform.openai.com
2. Navegue até "Assistants"
3. Clique em "Create"
4. Preencha o campo "Name" com o nome do assistente
5. Configure "System instruction" com o comportamento desejado

**Exemplo de Instrução do Sistema:**
```
Você deve se comportar como um corretor de imóveis. Pergunte sobre tipo de imóvel, localização, quartos, banheiros, vagas e faixa de preço.
```

**Configurações Adicionais:**

| Campo | Valor Recomendado |
|-------|-------------------|
| Model | gpt-4o-mini |
| File Search | Habilitado (permite ao assistente acessar arquivos carregados) |
| Code Interpreter | Opcional (permite execução de código) |
| Response Format | Text |
| Temperature | Padrão (ajuste futuramente conforme necessário) |
| Top P | Padrão (ajuste futuramente conforme necessário) |

---

## Como Criar uma Chave de API

**Descrição:** Geração de credenciais de autenticação para usar a API OpenAI.

**Passos:**
1. No menu lateral, clique em "API Keys"
2. Clique no botão "Create new secret key"
3. Copie a chave imediatamente (**não será exibida novamente**)

> **Aviso de Segurança:** A chave de API é privada e não deve ser compartilhada publicamente, pois fornece acesso à conta e aos créditos da OpenAI.

---

## Seções Relacionadas

- Autenticação
- Paginação
- Rate Limiting
- Webhooks
- Rastreio UTM
- Integração com IA (incluindo processamento de áudios e imagens)

---

*Última atualização: 11 meses atrás*
