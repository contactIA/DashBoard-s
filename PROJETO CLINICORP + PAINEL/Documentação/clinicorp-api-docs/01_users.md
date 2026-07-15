# 👤 Users — Usuários

**Grupo:** `users`  
**Descrição:** Retorna a lista de Usuários do assinante.

---

## Endpoints

### [GET] `/security/list_users`

Lista todos os usuários do sistema.

**Parâmetros (Query):**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| subscriber_id | any | ✅ Sim | ID do Assinante |

**Resposta HTTP 200:** Lista de usuários do sistema.

**Exemplo de requisição:**

```http
GET https://api.clinicorp.com/rest/v1/security/list_users?subscriber_id=SEU_ID
Authorization: Basic base64(usuario_api:token_api)
```
