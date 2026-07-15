# Integração com Make.com

## Visão Geral

A plataforma **Make.com** permite criar fluxos de trabalho automatizados integrando diferentes aplicativos e serviços. A documentação apresenta um guia completo para instalar e utilizar o aplicativo **wtschat** no Make.

---

## Informações Gerais

| Campo | Descrição |
|-------|-----------|
| **Plataforma** | Make.com |
| **Aplicativo** | wtschat |
| **Descrição** | Plataforma de automação que permite criar fluxos de trabalho personalizados para integrar diferentes aplicativos e serviços |

---

## Modelo de Cobrança

- Baseado em **operações mensais**
- Cada execução de módulo = **1 operação**
- Planos incluem limite mensal (ex: plano Core = 10.000 operações/mês)
- Ao exceder o limite, execuções são bloqueadas até renovação do ciclo ou upgrade de plano

---

## Autenticação

- **Método:** Token permanente
- Elimina a necessidade de implementar OAuth 2.0
- Simplicidade: criar o token e utilizá-lo diretamente
- Consulte a documentação **"Criar Token para Integração"** para obter o token

---

## Guia de Instalação — 6 Passos

### Passo 1: Acesso ao Link
- Acessar o link específico do aplicativo wtschat no Make
- Clicar em **"Instalar"**

### Passo 2: Seleção de Organização
- Selecionar a organização desejada
- **Requisito:** Ter privilégios de administrador ou desenvolvedor

### Passo 3: Confirmação
- Aguardar notificação de sucesso
- Clicar em **"Finish Wizard"**

### Passo 4: Verificação
- Confirmar que o aplicativo aparece em **"Aplicativos Instalados"**

### Passo 5: Novo Cenário
- Navegar até **"Cenários"**
- Criar um novo cenário

### Passo 6: Adicionar Módulo
- Pesquisar **"wts chat"** na barra de busca do cenário
- Os módulos disponíveis aparecem agrupados por categorias

---

## Módulos Disponíveis

Os módulos estão organizados nas seguintes categorias:

- **Contatos**
- **Mensagens**
- **Painéis**
- **Outros**
