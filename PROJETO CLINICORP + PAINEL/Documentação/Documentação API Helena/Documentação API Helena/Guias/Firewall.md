# Informações para Firewall

Empresas que tem regras mais rígidas de firewall podem usar as informações abaixo para configurar suas regras

**Acesso web**\
`https://*.flw.chat` e  `https://*.wts.chat`

**API**\
`https://api.flw.chat` e  `https://api.wts.chat`

**Download de arquivos**\
`https://cdn.flw.chat` e  `https://cdn.wts.chat`

**Upload de arquivos**\
`https://wts-storage.s3.sa-east-1.amazonaws.com`

**Conexão websocket web**\
`wss://rt-web.flw.chat` e `wss://rt-web.wts.chat`

**Conexão websocket app mobile**\
`wss://rt.flw.chat` e  `wss://rt.wts.chat`

**IP de chamadas de webhook**\
`18.215.79.89`

**Distribuição de conteúdo / arquivos**\
`https://ip-ranges.amazonaws.com/ip-ranges.json`\
*Utilizamos o serviço `CLOUDFRONT `da AWS para fazer a distribuição de arquivos, para liberação no firewall é necessário adicionar os ranges de ips da AWS*