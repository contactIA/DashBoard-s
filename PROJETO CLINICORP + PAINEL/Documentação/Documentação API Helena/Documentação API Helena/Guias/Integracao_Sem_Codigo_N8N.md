# Integração com N8N

## Visão Geral

A documentação apresenta o guia de integração com **n8n**, plataforma LowCode para automações, permitindo conectar a plataforma WTS Chat com diversos serviços externos via API.

---

## Modalidades de Uso

### n8n.cloud (Nuvem)

| Característica | Detalhes |
|----------------|----------|
| Hospedagem | Serviço em nuvem gerenciado |
| Cobrança | Por execução / pacotes mensais com limites |
| Ideal para | Usuários que buscam simplicidade sem gerenciar infraestrutura |
| Link | https://n8n.io |

### Auto-hospedado (Self-hosted)

| Característica | Detalhes |
|----------------|----------|
| Hospedagem | Servidor próprio |
| Execuções | Ilimitadas |
| Cobrança | Apenas pelo custo do servidor |
| Ideal para | Alto volume de integrações (reduz custos) |
| Link | https://docs.n8n.io/hosting/ |

---

## Módulo Nativo (Community Node) — Instalação

### Requisitos

> **Atenção:** O módulo nativo está disponível apenas para instalações **self-hosted**. Usuários do n8n.cloud ainda não têm acesso à funcionalidade "Community Nodes".

### Passos de Instalação

#### 1. Acessar Configurações
- Menu inferior esquerdo → **"Settings"**

#### 2. Navegar para Community Nodes
- Menu de opções → **"Community nodes"**

#### 3. Instalar o Pacote
- Clicar em **"Install community nodes"**
- **Nome do pacote NPM:** `n8n-nodes-wts`
- Aceitar os termos de uso
- Confirmar a instalação

---

## Uso do Módulo

### Configuração Inicial

1. Abrir o painel de nós (canto superior direito do editor de workflow)
2. Buscar por **"wts chat"**
3. Selecionar a ação desejada

### Autenticação

1. Clicar em **"Credential to connect with"**
2. Selecionar **"Create new credential"**
3. Atribuir um nome identificador à credencial
4. Inserir o **token permanente** (consulte a documentação "Criar Token para Integração")
5. Salvar a credencial

### Execução

1. Preencher as demais opções do nó conforme necessidade
2. Executar o fluxo

---

## Notas

- Para usuários do n8n.cloud sem acesso ao Community Nodes, a integração pode ser feita via nós HTTP Request utilizando a API diretamente com autenticação por token.
- A documentação foi atualizada há 8 dias.
