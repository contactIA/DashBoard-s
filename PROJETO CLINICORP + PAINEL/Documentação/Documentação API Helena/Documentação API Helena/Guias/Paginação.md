Paginação

# Paginação

Entenda como a paginação nos endpoints de listagem funciona.

### Requisição

Vários endpoints de listagem de entidades possuem paginação, que é controlada através dos seguintes atributos `pageNumber` e `pageSize`, enviados no corpo da requisição.

```json
{
  "pageNumber": 1,
  "pageSize": 50,
  ...
}
```

Sendo:

* `pageNumber`: indica qual página deseja obter;
* `pageSize`: indica o tamanho desta página, ou seja, quantos itens serão retornados, sendo possível no máximo 100.

Observe que ao alterar o `pageSize` em requisições subsequentes, o `pageNumber` retornará resultados diferentes. Portanto, é importante manter um `pageSize` constante enquanto se itera sobre o `pageNumber`.

***

### Resposta

Os resultados retornados nos endpoints paginados possuem a seguinte estrutura:

```json
{
  "pageNumber": 1,
  "pageSize": 50,
  "totalPages": 5,
  "totalItems": 250,
  "hasMorePages": true,
  "items:" [{...}],
  ...
}
```

Sendo:

* `pageNumber`: indica qual página foi obtida;
* `pageSize`: indica o tamanho da página obtida;
* `totalPages`: total de páginas existentes para a consulta atual;
* `totalItems`: total de itens existentes para a consulta atual;
* `hasMorePages`: indica se há mais páginas a serem consultadas, ou seja, se `pageNumber` é menor que `totalPages`;
* `items`: array de entidades retornadas, cujo tamanho será menor ou igual a `pageSize`.