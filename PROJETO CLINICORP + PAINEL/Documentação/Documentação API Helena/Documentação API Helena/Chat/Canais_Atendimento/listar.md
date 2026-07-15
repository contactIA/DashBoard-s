# Listar Canais de Atendimento

## Informações Gerais

**Descrição:** Listagem de canais de atendimento.

---

## Detalhes da Requisição

### Método HTTP
`GET`

### Endpoint
```
https://api.wts.chat/chat/v1/channel
```

---

## Parâmetros de Query

| Parâmetro | Tipo | Descrição | Valores Permitidos |
|-----------|------|-----------|-------------------|
| `ChannelType` | string (enum) | Tipo do canal | `All`, `Whatsapp`, `Messenger`, `Instagram` |

---

## Respostas

| Código | Status | Descrição |
|--------|--------|-----------|
| 200 | Success | Retorna a listagem de canais conforme solicitado |
| 500 | Server Error | Erro no servidor |

**Content-Type da resposta:** `application/json`

---

## Autenticação

Autenticação via header é necessária para acessar a API.

---

## Observações

- Versão da API: **v1.0**
- Suporta múltiplas linguagens de exemplo: Shell, Node, Ruby, PHP, Python
- Interface "Try It!" disponível para testes diretos na documentação
