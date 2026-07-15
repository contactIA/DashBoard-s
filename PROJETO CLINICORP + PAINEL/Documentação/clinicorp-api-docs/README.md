# 📋 API Clinicorp — Índice Geral

**Versão:** 1.0.0 | **Padrão:** OpenAPI 3.0  
**Base URL:** `https://api.clinicorp.com/rest/v1`  
**Autenticação:** HTTP Basic Auth

---

## 📂 Arquivos desta documentação

| Arquivo | Grupo | Descrição | Endpoints |
|---------|-------|-----------|-----------|
| [00_autenticacao.md](./00_autenticacao.md) | — | Autenticação, Base URL e padrões | — |
| [01_users.md](./01_users.md) | `users` | Usuários do sistema | 1 |
| [02_group.md](./02_group.md) | `group` | Assinantes e Clínicas (grupo) | 2 |
| [03_business.md](./03_business.md) | `business` | Clínicas, cadeiras e horários | 3 |
| [04_analytics.md](./04_analytics.md) | `analytics` | Análise de dados | 1 |
| [05_appointment.md](./05_appointment.md) | `appointment` | Agendamentos (listar, criar, confirmar, cancelar) | 11 |
| [06_estimates.md](./06_estimates.md) | `estimates` | Orçamentos | 2 |
| [07_procedures.md](./07_procedures.md) | `procedures` | Procedimentos e Especialidades | 2 |
| [08_financial.md](./08_financial.md) | `financial` | Dados financeiros (caixa, faturas, recibos) | 6 |
| [09_patient.md](./09_patient.md) | `patient` | Pacientes (criar, buscar, aniversários) | 5 |
| [10_payment.md](./10_payment.md) | `payment` | Pagamentos e conciliação | 2 |
| [11_professional.md](./11_professional.md) | `professional` | Profissionais | 1 |
| [12_sales.md](./12_sales.md) | `sales` | Vendas e conversão | 2 |
| [13_crm.md](./13_crm.md) | `crm` | Leads e campanhas | 2 |
| [14_operational.md](./14_operational.md) | `operational` | Metas operacionais | 2 |
| [15_migration_upload.md](./15_migration_upload.md) | `migration` / `upload` | Migração de dados e upload de arquivos | 4 |
| [16_products.md](./16_products.md) | `products` | Ordens de compra | 1 |

**Total: 49 endpoints em 16 grupos**

---

## 🔐 Autenticação Rápida

```http
Authorization: Basic base64(usuario_api:token_api)
```

Credenciais em: **Sistema → Gerenciar Assinatura → Acesso Externo e Integrações**

---

## ⚠️ Erros Padrão

```json
{
  "Error": 0,
  "Message": "string"
}
```

---

## 📅 Formatos de Data

| Formato | Exemplo | Usado em |
|---------|---------|----------|
| `YYYY-MM-DD` | `2024-01-15` | Maioria dos endpoints |
| `YYYYMMDD` | `20240115` | `business/list_available_times`, `appointment/get_avaliable_days`, `appointment/get_avaliable_times_calendar` |
| ISO 8601 | `2024-01-15T03:00:00.000Z` | Criação de agendamentos |
