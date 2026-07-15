# Criar Token para Integração

## Visão Geral

Esta página aborda a criação e uso de tokens permanentes para autenticação na API do flw.chat, eliminando a necessidade de implementar fluxos contínuos de login (como OAuth 2.0).

---

## Como Criar um Token

**Navegação:**
1. Acesse **Ajustes > Integrações > Integração via API (Configurar)**
2. Clique em **Novo**
3. Atribua um nome identificador ao token
4. Copie e armazene o token gerado em local seguro

---

## Autenticação via HTTP

### Formato do Header

Para utilizar o token permanente nas requisições à API, inclua-o no cabeçalho HTTP no seguinte formato:

```
Authorization: Bearer {seu_token_aqui}
```

### Exemplo com cURL

```bash
curl -X GET "https://api.flw.chat/v1/channel" \
  -H "Authorization: Bearer pn_TOKEN_PERMANENTE"
```

---

## Boas Práticas de Segurança

| Ponto | Orientação |
|-------|-----------|
| **Identificação** | Nomeie o token conforme a plataforma ou integração para controle futuro |
| **Proteção** | Mantenha-o seguro — o token fornece acesso direto à conta |
| **Revogação** | A exclusão é possível a qualquer momento e desabilita todas as integrações vinculadas |
| **Compartilhamento** | Evite compartilhar com terceiros |
| **Comprometimento** | Se houver suspeita de uso indevido, exclua imediatamente e gere um novo token |

---

## Notas

- O token permanente é a forma recomendada de autenticação para integrações com N8N, Make.com e demais plataformas de automação.
- Consulte a documentação de cada integração para ver como utilizar o token nas credenciais.
