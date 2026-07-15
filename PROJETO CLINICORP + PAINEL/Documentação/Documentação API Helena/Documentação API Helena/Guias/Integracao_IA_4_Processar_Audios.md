# 4. Como Processar Áudios

## Visão Geral

Este guia ensina como adicionar capacidade de processar áudios a uma IA integrada, incluindo separação de tipos de mensagem, download de arquivos de áudio e transcrição automática utilizando a plataforma N8N.

---

## Fluxo Principal

### 1. Separando Tipos de Mensagem

**Objetivo:** Distinguir mensagens de texto de mensagens com arquivos.

**Processo:**
- Utilizar node **"Filter"** para validar se o tipo "Text" está vazio
- Se contiver **texto**: usar node "Set" para gravar variável `lastMessagesAggregated.text`
- Se contiver **arquivos**: dividir usando node "Split Out"
- Classificar arquivos por tipo com node **"Switch"**, verificando `file.mimeType`

---

### 2. Tratando Arquivo de Áudio

**Processo:**
- Realizar requisição HTTP **GET** na URL pública do arquivo de áudio
- Fazer download do arquivo binário para processamento subsequente

---

### 3. Transcrevendo o Áudio

**Etapas:**
1. Criar node **OpenAI > "Transcribe Recording"**
2. Configurar campo "Input Data Field Name" com o nome do campo contendo os dados binários
3. Armazenar output em variável
4. Usar node **"Merge"** para agrupar inputs
5. Gravar valores `text` e `sessionId` em node "Set"

**Código JavaScript (node "Code"):**

```javascript
var text = "";
var sessionId = $('Webhook').first().json.body.sessionId;

for (const item of $input.all()) {
  text += item.json.text + " \n";
}

return { "text": text, "sessionId": sessionId };
```

**Descrição do Código:**

| Linha | Função |
|-------|--------|
| `var text = ""` | Inicializa string vazia para concatenar os textos |
| `var sessionId = ...` | Recupera o `sessionId` do webhook anterior |
| `for (const item of $input.all())` | Itera sobre todos os itens de entrada |
| `text += item.json.text + " \n"` | Concatena textos com quebras de linha |
| `return { "text": text, "sessionId": sessionId }` | Retorna objeto com texto e sessionId |

---

### 4. Integração Final

- Conectar o node **"Code"** ao assistente de IA
- O assistente encaminha o resultado para o node **"Enviar mensagem"**

---

## Fluxo Resumido

```
Webhook → Filter (tipo de mensagem?)
    ├── Texto → Set (variável text) → Assistente IA → Enviar Mensagem
    └── Arquivo → Split Out → Switch (mimeType?)
            └── Áudio → HTTP GET (download) → OpenAI Transcribe → Code (concatenar) → Merge → Set → Assistente IA → Enviar Mensagem
```

---

## Recursos Adicionais

- JSON com fluxo pronto disponível em repositório GitHub para download e customização
