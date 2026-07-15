# Rate limiting

Para garantir a estabilidade, segurança e desempenho da API, aplicamos limites de requisições. Eles funcionam em duas camadas complementares:

1. **Limite principal (uso contínuo)**\
   Você pode realizar até **`1.000` requisições a cada `5` minutos**, o que equivale a uma média aproximada de `3` requisições por segundo.\
   Esse limite controla o uso regular da API ao longo do tempo.

2. **Limite de proteção contra picos (burst limit)**\
   Além do limite principal, existe um limite adicional de segurança: **`200` requisições a cada `5` segundos.**\
   Esse mecanismo evita picos repentinos de chamadas que poderiam impactar a saúde e a estabilidade da aplicação, mesmo que o limite principal ainda não tenha sido atingido.

**Comportamento em caso de excesso**

Requisições que ultrapassarem qualquer um desses limites receberão como resposta o status `429 – Too Many Requests`, você deve esperar para que o limite seja reestabelecido para voltar a disparar mensagem.

> 📘 Escopo
>
> Os limites citados acima são aplicados por conta

<br />

## Dicas para evitar atingir o limite

Algumas boas práticas ajudam a manter sua integração estável e evitam respostas `429 – Too Many Requests`.

* **Evite loops sem controle**\
  Laços que disparam requisições em sequência (especialmente for ou while) devem sempre ter algum tipo de atraso ou controle de volume.
* **Implemente retry com espera (backoff)**\
  Se receber um 429, aguarde alguns segundos antes de tentar novamente. Repetir imediatamente tende a piorar o problema.
* **Distribua as chamadas ao longo do tempo**\
  Em vez de disparar muitas requisições de uma vez, espalhe-as de forma uniforme para manter uma média estável.

## Dicas específicas para quem usa n8n\*\*

O n8n é poderoso, mas pode gerar picos de requisições sem perceber. Algumas configurações ajudam bastante:

* **Use o node Wait**\
  Após chamadas em massa ou dentro de loops, utilize o node Wait para inserir um atraso entre as execuções.\
  Mesmo um intervalo pequeno (ex: 500 ms) já reduz drasticamente o risco de atingir o limite.
* **Controle a concorrência**\
  Ao usar nodes como HTTP Request e Split In Batches, evite executar muitos itens em paralelo. Prefira processar em lotes menores e sequenciais.
* **Configure corretamente o Split In Batches**\
  Use tamanhos de lote menores (ex: 10 ou 20 itens).\
  Combine com o node Wait entre os lotes para suavizar o volume de chamadas.
* **Trate o erro 429 explicitamente**\
  Configure o fluxo para:\
  -Detectar o erro 429\
  -Aguardar alguns segundos\
  -Repetir a requisição automaticamente\
  -Isso evita falhas no workflow e respeita os limites da API.