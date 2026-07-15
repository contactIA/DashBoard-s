# 🎯 Operational — Metas Operacionais

**Grupo:** `operational`  
**Descrição:** Retorna metas operacionais de faltas e vendas.

---

## Endpoints

### [GET] `/operational/list_misses_goals`

Retorna as metas de faltas referentes ao período.

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |
| from | date | ✅ Sim | Data inicial (YYYY-MM-DD) |
| to | date | ✅ Sim | Data final (YYYY-MM-DD) |
| businessId | integer | ❌ Não | ID da Clínica |

**Exemplo de requisição:**

```http
GET https://api.clinicorp.com/rest/v1/operational/list_misses_goals?subscriber_id=SEU_ID&from=2024-01-01&to=2024-01-31
Authorization: Basic base64(usuario_api:token_api)
```

---

### [GET] `/operational/list_sales_goals`

Retorna as metas de vendas do período.

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |
| from | date | ✅ Sim | Data inicial (YYYY-MM-DD) |
| to | date | ✅ Sim | Data final (YYYY-MM-DD) |
| businessId | integer | ❌ Não | ID da Clínica |

**Exemplo de requisição:**

```http
GET https://api.clinicorp.com/rest/v1/operational/list_sales_goals?subscriber_id=SEU_ID&from=2024-01-01&to=2024-01-31
Authorization: Basic base64(usuario_api:token_api)
```
