# 💵 Payment — Pagamentos

**Grupo:** `payment`  
**Descrição:** Retorna dados de pagamentos e conciliação.

---

## Endpoints

### [GET] `/payment/list`

Lista os pagamentos do período.

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |
| from | date | ✅ Sim | Data inicial (YYYY-MM-DD) |
| to | date | ✅ Sim | Data final (YYYY-MM-DD) |
| businessId | integer | ❌ Não | ID da Clínica |

**Exemplo de requisição:**

```http
GET https://api.clinicorp.com/rest/v1/payment/list?subscriber_id=SEU_ID&from=2024-01-01&to=2024-01-31
Authorization: Basic base64(usuario_api:token_api)
```

---

### [GET] `/payment/list_reconcile_claim`

Lista as cobranças para conciliação financeira.

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |
| from | date | ✅ Sim | Data inicial (YYYY-MM-DD) |
| to | date | ✅ Sim | Data final (YYYY-MM-DD) |

**Exemplo de requisição:**

```http
GET https://api.clinicorp.com/rest/v1/payment/list_reconcile_claim?subscriber_id=SEU_ID&from=2024-01-01&to=2024-01-31
Authorization: Basic base64(usuario_api:token_api)
```
