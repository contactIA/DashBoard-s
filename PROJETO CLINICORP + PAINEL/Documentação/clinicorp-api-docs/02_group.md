# 🏢 Group — Assinantes e Clínicas

**Grupo:** `group`  
**Descrição:** Retorna informações sobre assinantes e Clínicas.

---

## Endpoints

### [GET] `/group/list_subscribers_clinics`

Lista todos os assinantes e suas clínicas vinculadas.

**Parâmetros:** Nenhum

**Resposta HTTP 200:** Lista de assinantes e clínicas vinculadas.

**Exemplo de requisição:**

```http
GET https://api.clinicorp.com/rest/v1/group/list_subscribers_clinics
Authorization: Basic base64(usuario_api:token_api)
```

---

### [GET] `/group/list_subscribers`

Lista todos os assinantes.

**Parâmetros:** Nenhum

**Resposta HTTP 200:** Lista de assinantes.

**Exemplo de requisição:**

```http
GET https://api.clinicorp.com/rest/v1/group/list_subscribers
Authorization: Basic base64(usuario_api:token_api)
```
