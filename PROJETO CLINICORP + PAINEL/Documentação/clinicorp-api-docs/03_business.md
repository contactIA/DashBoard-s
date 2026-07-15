# 🏥 Business — Clínicas

**Grupo:** `business`  
**Descrição:** Retorna informações das Clínicas.

---

## Endpoints

### [GET] `/business/list`

Lista todas as clínicas do assinante.

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |

**Resposta HTTP 200:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| BusinessId | integer | ID da clínica |
| Name | string | Nome da clínica |
| Status | string | Status da clínica |

**Exemplo de requisição:**

```http
GET https://api.clinicorp.com/rest/v1/business/list?subscriber_id=SEU_ID
Authorization: Basic base64(usuario_api:token_api)
```

---

### [GET] `/business/list_chairs`

Lista todas as cadeiras/consultórios disponíveis.

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |
| businessId | integer | ✅ Sim | ID da Clínica |

**Resposta HTTP 200:** Lista de cadeiras/consultórios.

**Exemplo de requisição:**

```http
GET https://api.clinicorp.com/rest/v1/business/list_chairs?subscriber_id=SEU_ID&businessId=123
Authorization: Basic base64(usuario_api:token_api)
```

---

### [GET] `/business/list_available_times`

Lista todos os slots de horários disponíveis para os IDs e datas informados.

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| professionalId | integer | ✅ Sim | ID do Profissional |
| clinicId | integer | ✅ Sim | ID da Clínica |
| fromDate | string | ✅ Sim | Data inicial (YYYYMMDD) |
| toDate | integer | ✅ Sim | Data final (YYYYMMDD) |
| subscriber_id | string | ✅ Sim | ID do Assinante |

> ⚠️ **Atenção:** As datas neste endpoint usam o formato `YYYYMMDD` (sem hífens), ex: `20240115`.

**Resposta HTTP 200:** Lista de horários disponíveis.

**Exemplo de requisição:**

```http
GET https://api.clinicorp.com/rest/v1/business/list_available_times?subscriber_id=SEU_ID&professionalId=10&clinicId=5&fromDate=20240101&toDate=20240131
Authorization: Basic base64(usuario_api:token_api)
```
