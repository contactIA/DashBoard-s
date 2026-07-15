# 👨‍⚕️ Professional — Profissionais

**Grupo:** `professional`  
**Descrição:** Retorna dados dos profissionais cadastrados no sistema.

---

## Endpoints

### [GET] `/professional/list_all_professionals`

Lista todos os profissionais do sistema.

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| fromOnlineScheduling | boolean | ❌ Não | `true` para buscar apenas profissionais disponíveis no agendamento online |

**Resposta HTTP 200:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | number | ID do profissional (inteiro) |
| name | string | Nome do profissional |
| cpf | string | CPF do profissional |

**Exemplo — todos os profissionais:**

```http
GET https://api.clinicorp.com/rest/v1/professional/list_all_professionals
Authorization: Basic base64(usuario_api:token_api)
```

**Exemplo — somente do agendamento online:**

```http
GET https://api.clinicorp.com/rest/v1/professional/list_all_professionals?fromOnlineScheduling=true
Authorization: Basic base64(usuario_api:token_api)
```
