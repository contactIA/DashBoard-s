# 🧑‍⚕️ Patient — Pacientes

**Grupo:** `patient`  
**Descrição:** Retorna e gerencia dados de Pacientes.

---

## Endpoints

### [GET] `/patient/get`

Retorna os dados de um paciente específico.

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |
| patientId | integer | ✅ Sim | ID do Paciente |

**Resposta HTTP 200:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| PatientId | integer | ID do Paciente |
| Name | string | Nome do Paciente |
| Email | string | E-mail do Paciente |
| Phone | string | Telefone ou Celular |
| OtherDocumentId | string | CPF do Paciente |
| Status | string | Status: `ACTIVE`, `INACTIVE` ou `DELETED` |
| BirthDate | string | Data de nascimento |

**Exemplo de requisição:**

```http
GET https://api.clinicorp.com/rest/v1/patient/get?subscriber_id=SEU_ID&patientId=123
Authorization: Basic base64(usuario_api:token_api)
```

---

### [POST] `/patient/create`

Cria um novo paciente no sistema.

**Request Body (application/json):**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |
| Name | string | ✅ Sim | Nome completo do paciente |
| Email | string | ❌ Não | E-mail do paciente |
| Phone | string | ❌ Não | Telefone do paciente |
| BirthDate | string | ❌ Não | Data de nascimento (YYYY-MM-DD) |
| OtherDocumentId | string | ❌ Não | CPF do paciente |

**Exemplo de requisição:**

```http
POST https://api.clinicorp.com/rest/v1/patient/create
Authorization: Basic base64(usuario_api:token_api)
Content-Type: application/json

{
  "subscriber_id": "SEU_ID",
  "Name": "Maria Souza",
  "Email": "maria@email.com",
  "Phone": "(11) 91234-5678",
  "BirthDate": "1990-05-20",
  "OtherDocumentId": "123.456.789-00"
}
```

---

### [GET] `/patient/birthdays`

Lista os pacientes aniversariantes do dia (ou de uma data específica).

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |
| date | string | ❌ Não | Data para buscar aniversariantes (YYYY-MM-DD). Se não informado, usa a data atual |

**Resposta HTTP 200:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| PatientId | integer | ID do paciente |
| Name | string | Nome do paciente |
| BirthDate | string | Data de nascimento |
| Age | integer | Idade do paciente |

**Exemplo de requisição:**

```http
GET https://api.clinicorp.com/rest/v1/patient/birthdays?subscriber_id=SEU_ID
Authorization: Basic base64(usuario_api:token_api)
```

**Com data específica:**

```http
GET https://api.clinicorp.com/rest/v1/patient/birthdays?subscriber_id=SEU_ID&date=2024-06-15
Authorization: Basic base64(usuario_api:token_api)
```

---

### [GET] `/patient/list_appointments`

Lista os agendamentos de um paciente específico.

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |
| patientId | integer | ✅ Sim | ID do Paciente |

**Exemplo de requisição:**

```http
GET https://api.clinicorp.com/rest/v1/patient/list_appointments?subscriber_id=SEU_ID&patientId=123
Authorization: Basic base64(usuario_api:token_api)
```

---

### [GET] `/patient/list_estimates`

Lista os orçamentos de um paciente específico.

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |
| patientId | integer | ✅ Sim | ID do Paciente |

**Exemplo de requisição:**

```http
GET https://api.clinicorp.com/rest/v1/patient/list_estimates?subscriber_id=SEU_ID&patientId=123
Authorization: Basic base64(usuario_api:token_api)
```
