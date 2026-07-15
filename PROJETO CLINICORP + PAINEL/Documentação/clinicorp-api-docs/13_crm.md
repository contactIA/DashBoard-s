# 📣 CRM — Campanhas e Leads

**Grupo:** `crm`  
**Descrição:** Gerencia leads e campanhas de marketing.

---

## Endpoints

### [POST] `/crm/add_leads`

Adiciona leads ao CRM.

**Request Body (application/json):**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |
| Name | string | ✅ Sim | Nome do lead |
| Email | string | ❌ Não | E-mail do lead |
| Phone | string | ❌ Não | Telefone do lead |
| campaignId | integer | ❌ Não | ID da campanha associada |

**Exemplo de requisição:**

```http
POST https://api.clinicorp.com/rest/v1/crm/add_leads
Authorization: Basic base64(usuario_api:token_api)
Content-Type: application/json

{
  "subscriber_id": "SEU_ID",
  "Name": "Carlos Oliveira",
  "Email": "carlos@email.com",
  "Phone": "(21) 98765-4321",
  "campaignId": 42
}
```

---

### [GET] `/crm/list_active_campaigns`

Lista as campanhas ativas do CRM.

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |

**Exemplo de requisição:**

```http
GET https://api.clinicorp.com/rest/v1/crm/list_active_campaigns?subscriber_id=SEU_ID
Authorization: Basic base64(usuario_api:token_api)
```
