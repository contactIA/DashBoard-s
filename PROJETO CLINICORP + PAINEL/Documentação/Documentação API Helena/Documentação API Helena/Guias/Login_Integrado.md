Login integrado

# Login integrado

Ã‰ possÃ­vel integrar o login entre plataformas, gerando um token via API e direcionando o usuÃ¡rio

Para integrar o login, vocÃª precisarÃ¡ de um **token permanente**, que pode ser obtido em Ajustes â†’ IntegraÃ§Ã£o â†’ IntegraÃ§Ã£o via API.

Com esse token, sua aplicaÃ§Ã£o backend faz uma requisiÃ§Ã£o POST para autenticar um usuÃ¡rio, definindo em qual conta ele serÃ¡ logado e para qual pÃ¡gina serÃ¡ redirecionado.

***

## ParÃ¢metros da RequisiÃ§Ã£o

### IdentificaÃ§Ã£o do usuÃ¡rio

| ParÃ¢metro     | DescriÃ§Ã£o                                                                                                                                    |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------------------- |
| `phoneNumber` | NÃºmero de telefone do usuÃ¡rio. Para nÃºmeros nacionais, nÃ£o Ã© necessÃ¡rio formataÃ§Ã£o especial. Para internacionais, inclua o `+` antes do DDI. |
| `email`       | E-mail cadastrado na plataforma.                                                                                                             |
| `redirectUrl` | URL da pÃ¡gina que o usuÃ¡rio acessarÃ¡ apÃ³s autenticado. Ideal para direcionar diretamente a uma conversa especÃ­fica. *(opcional)*             |

***

## Componente de Conversas

O componente de conversas estÃ¡ disponÃ­vel na rota `/chat2/sessions/XXXXXX`, onde `XXXXXX` Ã© o ID da conversa. HÃ¡ duas variaÃ§Ãµes Ãºteis:

* **`/preview`** â€” Suprime o menu da plataforma, exibindo apenas a conversa.
* **`?interactive=true`** â€” PrÃ©-habilita a interaÃ§Ã£o na conversa.

Combinando os dois, a URL completa fica:

```
/chat2/sessions/XXXXXX/preview?interactive=true
```

***

## Fazendo a RequisiÃ§Ã£o

> ðŸš§ **AtenÃ§Ã£o:** nunca faÃ§a essa requisiÃ§Ã£o no front-end. Ela deve ser realizada exclusivamente via **backend** para preservar a seguranÃ§a dos seus dados.

Passe o token permanente no cabeÃ§alho usando autenticaÃ§Ã£o **Bearer**:

```
Authorization: Bearer ***TOKEN_REMOVIDO***
```

**POST** `https://api.flw.chat/auth/v1/login/authenticate`

**RequisiÃ§Ã£o**

```json
{
  "phoneNumber": "5531999999999",
  "email": "email@seudominio.com",
  "redirectUrl": "/chat2/sessions/df98b9fb-2280-45z5-bce1-3fe8aa7047e5/preview"
}
```

**Resposta**

```json
{
  "userId": "48525e80-43a7-4e06-86e0-f6b67b7d6629",
  "tenantId": "d4ed253d-f0c6-435c-8f7f-59a0598885fe",
  "urlRedirect": "https://xyz.flw.chat/auth/external-login?code=3aXTxVyWtU5p6x7PpGmtlL62XRjbmKUFIWxADykpaWQ&userId=58525e80-43z7-4e06-86e0-f6b67b7d6629&tenantId=d4ed253d-y0c6-435c-8f7f-59a0598885fe",
  "expiresIn": "2026-01-01T00:00:00Z"
}
```

ApÃ³s receber a resposta, utilize o campo `urlRedirect` para redirecionar o usuÃ¡rio, ele iniciarÃ¡ a sessÃ£o jÃ¡ autenticado.