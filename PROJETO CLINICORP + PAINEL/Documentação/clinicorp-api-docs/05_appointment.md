# 📅 Appointment — Agendamentos

**Grupo:** `appointment`  
**Descrição:** Retorna e gerencia dados de Agendamentos.

---

## Endpoints

### [GET] `/appointment/list`

Lista os agendamentos do período.

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |
| from | date | ✅ Sim | Data inicial (YYYY-MM-DD) |
| to | date | ✅ Sim | Data final (YYYY-MM-DD) |
| businessId | integer | ❌ Não | ID da Clínica |
| professionalId | integer | ❌ Não | ID do Profissional |
| patientId | integer | ❌ Não | ID do Paciente |
| IncludeCanceled | string | ❌ Não | Incluir agendamentos desmarcados |

**Exemplo de requisição:**

```http
GET https://api.clinicorp.com/rest/v1/appointment/list?subscriber_id=SEU_ID&from=2024-01-01&to=2024-01-31
Authorization: Basic base64(usuario_api:token_api)
```

---

### [GET] `/appointment/get_appointment`

Retorna detalhes de um agendamento específico.

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |
| appointmentId | integer | ✅ Sim | ID do Agendamento |

**Exemplo de requisição:**

```http
GET https://api.clinicorp.com/rest/v1/appointment/get_appointment?subscriber_id=SEU_ID&appointmentId=456
Authorization: Basic base64(usuario_api:token_api)
```

---

### [GET] `/appointment/list_info`

Retorna informações gerais de agendamento.

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |
| appointmentId | integer | ✅ Sim | ID do Agendamento |

---

### [GET] `/appointment/list_categories`

Lista as categorias de agendamento disponíveis.

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |

---

### [GET] `/appointment/status_list`

Lista todos os status de agendamento disponíveis.

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |

---

### [GET] `/appointment/get_avaliable_days`

Retorna os dias disponíveis para agendamento.

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |
| professionalId | integer | ✅ Sim | ID do Profissional |
| businessId | integer | ✅ Sim | ID da Clínica |
| fromDate | string | ✅ Sim | Data inicial (YYYYMMDD) |
| toDate | string | ✅ Sim | Data final (YYYYMMDD) |

> ⚠️ **Atenção:** As datas neste endpoint usam o formato `YYYYMMDD` (sem hífens).

---

### [GET] `/appointment/get_avaliable_times_calendar`

Retorna horários disponíveis para exibição em calendário.

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |
| professionalId | integer | ✅ Sim | ID do Profissional |
| businessId | integer | ✅ Sim | ID da Clínica |
| fromDate | string | ✅ Sim | Data inicial (YYYYMMDD) |
| toDate | string | ✅ Sim | Data final (YYYYMMDD) |

> ⚠️ **Atenção:** As datas neste endpoint usam o formato `YYYYMMDD` (sem hífens).

---

### [GET] `/appointment/schedule_occupation`

Retorna o percentual de ocupação da agenda, tempo total de eventos (em minutos) e total de tempo em que os profissionais não estão disponíveis na clínica.

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |
| from | date | ✅ Sim | Data inicial (YYYY-MM-DD) |
| to | date | ✅ Sim | Data final (YYYY-MM-DD) |
| business_id | integer | ❌ Não | ID de uma clínica específica |
| group_by | string | ✅ Sim | Passar `month` para agrupar por mês |

**Resposta HTTP 200:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| TotalValidScheduleTime | integer | Total de tempo em minutos válidos na agenda dos profissionais |
| TotalAppointmentTime | integer | Total de tempo em minutos que a agenda esteve ocupada |
| TotalEvent | string | Total de tempo em minutos de eventos do profissional |
| TotalUnavailableTime | integer | Total de tempo em minutos em que os profissionais não estão disponíveis |
| ScheduleOccupation | number | Percentual de ocupação da agenda |

---

### [GET] `/appointment/change_status`

Altera o status de um agendamento.

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |
| appointmentId | integer | ✅ Sim | ID do Agendamento |
| status | string | ✅ Sim | Novo status do agendamento |

---

### [POST] `/appointment/confirm_appointment`

Confirma um agendamento existente.

**Request Body (application/json):**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |
| appointmentId | integer | ✅ Sim | ID do Agendamento a confirmar |

**Exemplo de requisição:**

```http
POST https://api.clinicorp.com/rest/v1/appointment/confirm_appointment
Authorization: Basic base64(usuario_api:token_api)
Content-Type: application/json

{
  "subscriber_id": "SEU_ID",
  "appointmentId": 456
}
```

---

### [POST] `/appointment/cancel_appointment`

Cancela um agendamento existente.

**Request Body (application/json):**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |
| appointmentId | integer | ✅ Sim | ID do Agendamento a cancelar |

**Exemplo de requisição:**

```http
POST https://api.clinicorp.com/rest/v1/appointment/cancel_appointment
Authorization: Basic base64(usuario_api:token_api)
Content-Type: application/json

{
  "subscriber_id": "SEU_ID",
  "appointmentId": 456
}
```

---

### [POST] `/appointment/create_appointment_by_api`

Cria um agendamento diretamente na Agenda do Sistema.

**Request Body (application/json):**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| Patient_PersonId | integer | ❌ Não | ID do paciente |
| PatientName | string | ❌ Não | Nome completo do paciente |
| MobilePhone | string | ❌ Não | Telefone de contato |
| Email | string | ❌ Não | Email de contato |
| fromTime | string | ❌ Não | Hora de início (HH:MM) |
| toTime | string | ❌ Não | Hora de término (HH:MM) |
| date | string | ❌ Não | Data do agendamento (ISO 8601) |
| Dentist_PersonId | integer | ❌ Não | ID do profissional |
| Clinic_BusinessId | integer | ❌ Não | ID da clínica |

**Resposta HTTP 200:**

| Campo | Tipo |
|-------|------|
| MobilePhone | String |
| SK_DateFirstTime | Number |
| Deleted | String |
| OtherDocumentId | String |
| ToTime | String |
| FromTime | String |
| Email | String |
| Clinic_BusinessId | Number |
| Dentist_PersonId | Number |
| NotesPatient | String |
| PatientName | String |
| IsOnlineScheduling | Boolean |
| ShedulingAccepted | Boolean |

**Exemplo de requisição:**

```http
POST https://api.clinicorp.com/rest/v1/appointment/create_appointment_by_api
Authorization: Basic base64(usuario_api:token_api)
Content-Type: application/json

{
  "PatientName": "João da Silva",
  "MobilePhone": "(11) 91234-5678",
  "fromTime": "14:00",
  "toTime": "15:00",
  "date": "2024-01-15T03:00:00.000Z",
  "Dentist_PersonId": 10,
  "Clinic_BusinessId": 5
}
```

---

### [POST] `/appointment/create_online_scheduling`

Cria uma solicitação de agendamento online.

**Request Body (application/json):**

| Campo | Tipo | Obrigatório | Descrição / Exemplo |
|-------|------|-------------|---------------------|
| CodeLink | integer | ✅ Sim | ex: `27478` |
| PatientName | string | ✅ Sim | ex: `"Nome do paciente"` |
| SchedulingReason | string | ❌ Não | ex: `"Razao da consulta"` |
| MobilePhone | string | ✅ Sim | ex: `"(47) 90000-0000"` |
| OtherPhones | string | ❌ Não | ex: `"(47) 90000-0000"` |
| OtherDocumentId | string | ❌ Não | ex: `"567 (apenas 3 primeiros dígitos)"` |
| Email | string | ❌ Não | ex: `"joaosilva@yahoo.com"` |
| NotesPatient | string | ❌ Não | ex: `"preciso dessa consulta urgente"` |
| fromTime | string | ✅ Sim | ex: `"14:30"` |
| toTime | string | ✅ Sim | ex: `"15:30"` |
| IsOnlineScheduling | boolean | ✅ Sim | ex: `true` |
| date | string | ✅ Sim | ex: `"2021-07-15T03:00:00.000Z"` |
| Type | string | ❌ Não | ex: `"CLOUDIA"` |
| Dentist_PersonId | integer | ✅ Sim | ex: `0` |
| Clinic_BusinessId | integer | ✅ Sim | ex: `0` |
| AlreadyPatient | boolean | ✅ Sim | ex: `true` |

**Resposta HTTP 200:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| Status | string | ex: `"CREATED"` |
| id | integer | ID do agendamento criado |

**Resposta HTTP 400:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| Error | any | Código do erro |
| Message | string | Descrição do erro |
