# 🦷 Procedures — Procedimentos

**Grupo:** `procedures`  
**Descrição:** Retorna dados de Procedimentos e Especialidades.

---

## Endpoints

### [GET] `/procedures/list`

Lista todos os procedimentos cadastrados.

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |
| businessId | integer | ❌ Não | ID da Clínica |

**Exemplo de requisição:**

```http
GET https://api.clinicorp.com/rest/v1/procedures/list?subscriber_id=SEU_ID
Authorization: Basic base64(usuario_api:token_api)
```

**Filtrado por clínica:**

```http
GET https://api.clinicorp.com/rest/v1/procedures/list?subscriber_id=SEU_ID&businessId=5
Authorization: Basic base64(usuario_api:token_api)
```

---

### [GET] `/procedures/list_specialties`

Lista todas as especialidades cadastradas.

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |

**Exemplo de requisição:**

```http
GET https://api.clinicorp.com/rest/v1/procedures/list_specialties?subscriber_id=SEU_ID
Authorization: Basic base64(usuario_api:token_api)
```
