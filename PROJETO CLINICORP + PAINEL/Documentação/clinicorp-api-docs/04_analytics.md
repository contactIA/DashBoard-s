# 📊 Analytics — Análise de Dados

**Grupo:** `analytics`  
**Descrição:** Retorna dados de análise das Clínicas do assinante.

---

## Endpoints

### [GET] `/analytics/list_results`

Retorna dados analíticos das clínicas.

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |
| from | date | ✅ Sim | Data inicial (YYYY-MM-DD) |
| to | date | ✅ Sim | Data final (YYYY-MM-DD) |
| businessId | integer | ❌ Não | ID da Clínica |

**Exemplo de requisição:**

```http
GET https://api.clinicorp.com/rest/v1/analytics/list_results?subscriber_id=SEU_ID&from=2024-01-01&to=2024-01-31
Authorization: Basic base64(usuario_api:token_api)
```

**Exemplo com clínica específica:**

```http
GET https://api.clinicorp.com/rest/v1/analytics/list_results?subscriber_id=SEU_ID&from=2024-01-01&to=2024-01-31&businessId=5
Authorization: Basic base64(usuario_api:token_api)
```
