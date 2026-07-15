# Salvar Contatos em Massa

## Informações Gerais

**Método HTTP:** POST

**Endpoint:** `https://api.wts.chat/core/v2/contact/batch`

**Descrição:** Persistir até 100 contatos em uma única solicitação. Caso um contato com idêntico número telefônico, Instagram ou e-mail já exista no sistema, apenas seus dados serão atualizados.

---

## Parâmetros

### Body Parameters

| Parâmetro | Tipo | Obrigatório | Restrições | Descrição |
|-----------|------|------------|-----------|-----------|
| `items` | array of objects | Sim | 1-100 elementos | Dados para criação dos contatos |
| `options` | object | Não | — | Opções adicionais de configuração |

---

## Respostas

| Código | Descrição |
|--------|-----------|
| 200 | Operação realizada com êxito |
| 500 | Erro no servidor |

---

## Observações

- Suporta até **100 contatos** por requisição.
- Se um contato já existir (mesmo telefone, Instagram ou e-mail), seus dados serão **atualizados** (não duplicados).
- Requer autenticação via header.
- Suporta exemplos em múltiplas linguagens: Shell, Node, Ruby, PHP, Python.
