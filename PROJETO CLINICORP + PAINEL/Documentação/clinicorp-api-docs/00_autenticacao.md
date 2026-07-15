# 🔐 Autenticação & Configuração

**API Clinicorp** | Versão 1.0.0 | OpenAPI 3.0

---

## Base URL

```
https://api.clinicorp.com/rest/v1
```

---

## Autenticação

A API utiliza **HTTP Basic Auth**:

- **Username:** ID de acesso ao Sistema (campo "Usuário API")
- **Password:** Token API

### Como obter as credenciais

1. Fazer login no Sistema
2. Clicar em **Gerenciar Assinatura**
3. Clicar em **Acesso Externo e Integrações**
4. Copiar:
   - **Integrações - Usuário API** → Username
   - **Token API** → Password

### Header de envio

```http
Authorization: Basic base64(username:password)
```

---

## Padrão de Requisições

### GET

```http
GET https://api.clinicorp.com/rest/v1/patient/get?subscriber_id=SEU_ID&patientId=123
Authorization: Basic base64(usuario_api:token_api)
Content-Type: application/json
```

### POST

```http
POST https://api.clinicorp.com/rest/v1/patient/create
Authorization: Basic base64(usuario_api:token_api)
Content-Type: application/json

{
  "subscriber_id": "SEU_ID",
  "Name": "João da Silva",
  "Email": "joao@email.com"
}
```

---

## Formato de Datas

| Formato | Exemplo | Uso |
|---------|---------|-----|
| `YYYY-MM-DD` | `2024-01-15` | Maioria dos endpoints |
| `YYYYMMDD` | `20240115` | Endpoints de agendamento (available times, days) |
| ISO 8601 | `2024-01-15T03:00:00.000Z` | Criação de agendamentos |

---

## Parâmetro `subscriber_id`

O parâmetro `subscriber_id` é **obrigatório** na grande maioria dos endpoints — é o identificador do seu assinante na Clinicorp.

---

## Erros Padrão

Todos os endpoints retornam o seguinte schema em caso de erro `HTTP 400`:

```json
{
  "Error": 0,
  "Message": "string"
}
```
