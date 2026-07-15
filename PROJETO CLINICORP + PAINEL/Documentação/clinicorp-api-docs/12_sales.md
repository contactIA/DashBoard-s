# 📈 Sales — Vendas

**Grupo:** `sales`  
**Descrição:** Retorna dados de vendas, orçamentos e conversão.

---

## Endpoints

### [GET] `/sales/estimates_and_conversion`

Retorna dados de orçamentos e conversão de vendas no período.

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |
| from | date | ✅ Sim | Data inicial (YYYY-MM-DD) |
| to | date | ✅ Sim | Data final (YYYY-MM-DD) |
| businessId | integer | ❌ Não | ID da Clínica |

**Exemplo de requisição:**

```http
GET https://api.clinicorp.com/rest/v1/sales/estimates_and_conversion?subscriber_id=SEU_ID&from=2024-01-01&to=2024-01-31
Authorization: Basic base64(usuario_api:token_api)
```

---

### [GET] `/sales/expertise_revenue`

Retorna dados de vendas por especialidade (mês de referência e valor total de vendas para cada especialidade).

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| subscriber_id | string | ✅ Sim | ID do Assinante |
| from | date | ✅ Sim | Data inicial (YYYY-MM-DD) |
| to | date | ✅ Sim | Data final (YYYY-MM-DD) |
| businessId | integer | ❌ Não | ID da Clínica |
| patientId | integer | ❌ Não | ID do Paciente |

**Resposta HTTP 200:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| month | string | Mês de referência |
| Expertise | string | Nome de cada especialidade como chave + total de vendas no período |

**Exemplo de requisição:**

```http
GET https://api.clinicorp.com/rest/v1/sales/expertise_revenue?subscriber_id=SEU_ID&from=2024-01-01&to=2024-12-31
Authorization: Basic base64(usuario_api:token_api)
```
