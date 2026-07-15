# 🛒 Products — Produtos e Ordens de Compra

**Grupo:** `products`  
**Descrição:** Gerencia ordens de compra de produtos.

---

## Endpoints

### [POST] `/products/orders`

Criação de uma nova ordem de compra.

**Request Body (application/json):** Dados da ordem de compra.

**Exemplo de requisição:**

```http
POST https://api.clinicorp.com/rest/v1/products/orders
Authorization: Basic base64(usuario_api:token_api)
Content-Type: application/json

{
  // Dados da ordem de compra
}
```
