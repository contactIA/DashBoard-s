# 💰 Estimates — Orçamentos

**Grupo:** `estimates`  
**Descrição:** Retorna dados dos Orçamentos.

---

## Endpoints

### [GET] `/estimates/list`

Lista os orçamentos de um período.

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |
| from | date | ✅ Sim | Data inicial (YYYY-MM-DD) |
| to | date | ✅ Sim | Data final (YYYY-MM-DD) |
| businessId | integer | ❌ Não | ID da Clínica |
| patientId | integer | ❌ Não | ID do Paciente |

**Exemplo de requisição:**

```http
GET https://api.clinicorp.com/rest/v1/estimates/list?subscriber_id=SEU_ID&from=2024-01-01&to=2024-01-31
Authorization: Basic base64(usuario_api:token_api)
```

---

### [GET] `/estimates/get`

Retorna um orçamento específico.

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |
| estimateId | integer | ✅ Sim | ID do Orçamento |

**Exemplo de requisição:**

```http
GET https://api.clinicorp.com/rest/v1/estimates/get?subscriber_id=SEU_ID&estimateId=789
Authorization: Basic base64(usuario_api:token_api)
```
