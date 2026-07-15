# 📦 Migration & Upload — Migração e Arquivos

---

## Grupo: `migration`

Gerencia migrações de dados para o sistema.

### [POST] `/migration/file/upload`

Cria uma migração de dados via upload de arquivo.

**Request Body:** `multipart/form-data` ou `application/json`

**Resposta HTTP 200:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| SubscriptionId | string | ID da assinatura |
| UploadSignedUrl | string | URL assinada para upload do arquivo |

**Exemplo de requisição:**

```http
POST https://api.clinicorp.com/rest/v1/migration/file/upload
Authorization: Basic base64(usuario_api:token_api)
Content-Type: application/json
```

---

### [POST] `/migration/file`

Cria múltiplas migrações de dados via arquivo.

**Resposta HTTP 200:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| SubscriptionId | string | ID da assinatura |
| Status | string | Status da migração |

---

### [POST] `/migration/connection`

Cria múltiplas migrações de dados via conexão direta.

**Resposta HTTP 200:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| SubscriptionId | string | ID da assinatura |
| Status | string | Status da migração |

---

## Grupo: `upload`

Carrega arquivos para o sistema.

### [POST] `/file/upload`

Carrega arquivos, imagens e documentos para o sistema.

**Resposta HTTP 200:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| PatientName | string | Nome do paciente associado |
| Url | string | URL do arquivo carregado |
| LocalFile | string | Caminho local do arquivo |
| Status | string | Status do upload |

**Exemplo de requisição:**

```http
POST https://api.clinicorp.com/rest/v1/file/upload
Authorization: Basic base64(usuario_api:token_api)
Content-Type: multipart/form-data
```
