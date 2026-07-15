# 5. Como Processar Imagens

## Visão Geral

Este guia apresenta como adicionar capacidade de processamento de imagens a um assistente de IA integrado com a plataforma, expandindo o fluxo criado no passo anterior (processamento de áudios) utilizando a plataforma N8N.

---

## Pré-requisito

Este guia pressupõe que o fluxo de processamento de áudios (passo 4) já está configurado, pois a integração de imagens expande esse mesmo fluxo.

---

## Passos de Configuração

### 1. Configuração do Node Switch

- Expandir o node **"Switch"** previamente criado para processamento de áudios
- Adicionar uma nova rota para identificar arquivos de imagem

### 2. Identificação do Tipo de Arquivo

**Condição a ser configurada no Switch:**
- Comparar o parâmetro `file.mimeType` para verificar se inicia com `"image/"`
- Aplicar a mesma lógica utilizada para detecção de arquivos de áudio

**Exemplos de mimeType de imagem:**
- `image/jpeg`
- `image/png`
- `image/gif`
- `image/webp`

### 3. Armazenamento do Resultado

- Gravar o conteúdo processado (resultado da análise de imagem) em uma variável
- Utilizar um node **"Set"** para esta operação

### 4. Conexão dos Componentes

- Conectar o node **"Set"** (contendo a variável de processamento) ao node **"Merge"**
- Confirmar a integração conforme diagrama visual fornecido na plataforma

### 5. Finalização

- Salvar o workflow após implementar as modificações

---

## Fluxo Resumido

```
Switch (mimeType?)
    ├── Áudio (audio/*) → HTTP GET → OpenAI Transcribe → Code → Merge
    └── Imagem (image/*) → [Processamento de Imagem] → Set → Merge
                                                                  ↓
                                                         Assistente IA → Enviar Mensagem
```

---

## Recursos Adicionais

- Arquivo JSON com o fluxo completo disponível para download no repositório do projeto
- Permite adaptações personalizadas conforme necessidade
