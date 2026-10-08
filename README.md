# Caderninho

Web app mobile-first para revendedoras de O Boticário, Natura e Avon acompanharem clientes, produtos, vendas, fiado, recebimentos e resultados. Interface em português do Brasil, baseada na skill `minimalist-ui` do pacote taste-skill.

## Tecnologias

React 19, Vite, TypeScript, Tailwind CSS 4, Express 5, PostgreSQL 17 e Prisma 6. Autenticação JWT em cookie HttpOnly e hash bcrypt (implementação JavaScript bcryptjs). npm workspaces; sem Nx, Turborepo ou framework de monorepo. O campo `overrides` fixa versões corrigidas de duas dependências indiretas da CLI Prisma; a instalação, geração e migrações são verificadas com essas versões. A fonte DM Sans é instalada e servida pelo aplicativo, sem depender do Google Fonts.

## Instalação e execução

Requisitos: Node.js 24 LTS, npm 11 e Docker com Compose. Execute na raiz do repositório:

```bash
npm ci
npm run setup
docker compose up -d --wait
npm run db:generate
npm run db:migrate
npm run dev
```

`npm run setup` cria um `.env` local a partir do exemplo, com uma chave JWT aleatória. Preserva um arquivo existente. Os dados de conexão do Compose são exclusivos para desenvolvimento: configure credenciais próprias em produção. Se você já tem PostgreSQL, ajuste `DATABASE_URL` em `.env` e use esse banco no lugar do serviço `db`.

Frontend: porta 5173. API: porta 3001. O Vite encaminha `/api` ao backend; o navegador usa uma única origem. A API de saúde `/api/health` verifica também a conexão com o banco.

Crie sua conta pela interface. Não existem senhas padrão, cadastros fictícios nem dados de demonstração inseridos automaticamente.

### Recuperação de senha local

O Mailpit recebe e-mails pela porta SMTP 1025 e disponibiliza a caixa de mensagens na porta 8025. Na tela de entrada, escolha “Esqueci minha senha”. Abra o e-mail recebido na caixa local e use o link, válido por 30 minutos. Configure `APP_URL` com a origem real do frontend. Em produção, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` e, quando necessário, `SMTP_USER`, `SMTP_PASSWORD` e `SMTP_SECURE=true`.

### Comandos úteis

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Os testes da API criam um schema PostgreSQL aleatório, aplicam as migrações e removem apenas esse schema no fim. Nunca limpam o schema de desenvolvimento. O usuário do banco precisa poder criar schemas. Você pode definir `TEST_DATABASE_URL` para usar um banco de testes separado.

Os testes de navegador precisam do `npm run dev` em outro terminal. Usam Chromium instalado em `/usr/bin/chromium`; ajuste `CHROMIUM_PATH` para seu executável. Criam contas temporárias para executar o fluxo e as excluem ao terminar com sucesso. Capturas e traces ficam em `test-results/`, ignorado pelo Git. Se interromper um teste de navegador, sua conta temporária pode permanecer no banco local.

## Funcionalidades

- Conta, login, recuperação de senha, perfil e marcas.
- Desconto padrão por marca, em pontos-base: `3000` significa 30%.
- Clientes com telefone normalizado, busca, observações e histórico.
- Produtos com preço de catálogo, sugestão automática de custo editável e margem.
- Venda em três passos, desconto, pagamento à vista ou fiado, parcelas e vencimentos editáveis.
- Pagamentos totais e parciais, estorno com motivo e data, cancelamento com histórico.
- Fiado com filtros por cliente, situação e vencimento; cobrança editável pelo WhatsApp.
- Gastos, campanhas e resultado por ciclo.
- Dashboard com saldo, recebido, gastos, devedoras e lucro das vendas dividido em recebido/a receber.
- Relatórios por período, cliente e produto; exportação em PDF e CSV.
- Exportação dos próprios dados em JSON e exclusão da conta confirmada por senha.
- Manifesto e service worker de PWA; lembretes de vencimento dentro do aplicativo.

## Regras financeiras

Dinheiro é armazenado como inteiro em centavos. A entrada `25,90` é convertida por separação dos dígitos, sem multiplicar um decimal por 100. A divisão de parcelas distribui os centavos restantes nas primeiras parcelas. Preço e custo da venda são snapshots: alterações futuras no produto não mudam vendas antigas.

O desconto da venda é distribuído proporcionalmente entre os itens pelo método dos maiores restos. O cálculo usa `BigInt`, e a soma dos valores líquidos dos itens é exatamente igual ao total da venda.

- **Lucro das vendas:** vendas após descontos menos o custo dos produtos vendidos.
- **Lucro líquido:** lucro das vendas menos despesas operacionais (frete, embalagem e outros).
- **Pedidos à marca:** saídas de caixa; não são descontados novamente do lucro, pois o custo vendido já foi considerado.
- **Lucro recebido/a receber:** divisão proporcional da margem das vendas do mês pelos pagamentos dessas mesmas vendas. Pode ser negativa se a venda tiver prejuízo. Não significa dinheiro separado em caixa.
- **Recebido no período:** pagamentos feitos no período menos estornos realizados no período, inclusive estorno de pagamento antigo.
- **Saldo a receber:** apenas vendas ativas, considerando pagamentos não estornados.

Cancelamento não apaga a venda. Para cancelar uma venda já paga, primeiro estorne cada recebimento. Estorno é integral por registro; um pagamento parcial é um registro próprio e também pode ser estornado. O saldo volta a ficar em aberto. Vendas canceladas ficam visíveis no histórico e saem dos resultados e da cobrança. Relatórios refletem o estado atual de cancelamento, não são fechamentos contábeis imutáveis.

Na seleção de pagamento, Pix, dinheiro e cartão representam valores já recebidos. Para combinar qualquer pagamento futuro, use “Fiado · pagar depois”; no recebimento, informe o meio efetivo. O produto ainda não concilia taxas de cartão, liquidação da operadora nem estoque físico.

Datas comerciais usam o calendário de São Paulo. Vencimentos são `DATE` no PostgreSQL. Ciclos devem pertencer à mesma marca do item e incluir a data da venda/gasto.

## Arquitetura e aprendizado

Leia [Como o projeto funciona](docs/arquitetura.md) para acompanhar as etapas, localizar cada regra e entender os testes.

```text
apps/web/src/features/       Telas e formulários por funcionalidade
apps/web/src/components/     Componentes de interface compartilhados
apps/web/src/lib/            Comunicação HTTP e tipos das respostas
apps/api/src/routes/        Endpoints, validação de entrada e respostas HTTP
apps/api/src/services/      Regras financeiras e de negócio
apps/api/src/repositories/  Consultas e persistência com escopo da usuária
apps/api/src/middleware/    Autenticação e tratamento de requisições
apps/api/prisma/            Modelo de dados e migrações versionadas
packages/shared/src/        Schemas Zod e utilitários usados nos dois lados
scripts/                    Inicialização e isolamento dos testes
```

## Segurança e privacidade

O `userId` vem da sessão autenticada. As relações entre dados de negócio usam chaves compostas com `userId`, reforçando o isolamento também no banco. Validação Zod acontece nos formulários e na API. Senhas nunca são retornadas, exportadas ou registradas em logs. Tokens de recuperação são armazenados apenas como SHA-256 e consumidos uma vez; alterar a senha invalida sessões anteriores. Login e recuperação têm limite de tentativas. A API valida a origem de requisições de alteração. A sessão usa cookie HttpOnly, SameSite=Lax e Secure em produção.

A exportação JSON é uma cópia dos registros da usuária, não um mecanismo de importação/restauração automática. A exclusão remove registros do banco ativo; o responsável pela operação deve definir retenção e expurgo de backups externos. A política inicial é acessível antes e depois do login e precisa ser completada com identificação e contato do operador antes da abertura comercial.

## PWA, notificações e limites desta versão

As parcelas que vencem hoje aparecem no dashboard e no fiado. Push em segundo plano não está implementado nesta versão: exige inscrição com permissão, chaves VAPID, servidor de envio e validação nos dispositivos do público. O PWA não permite registrar vendas offline; a conexão com a API é necessária para manter dados e saldos consistentes. Não armazena respostas autenticadas em cache.

Esta é uma primeira versão funcional para validar com revendedoras. Os cadastros são carregados sem paginação; volumes grandes exigirão paginação e busca no servidor. Assinatura SaaS, cobrança de planos, controle de estoque, conciliação de cartões e importação de backups são evoluções separadas.

## Publicação da aplicação

Não há deploy automático. Para produção:

1. Configure PostgreSQL e SMTP reais, segredos próprios e `NODE_ENV=production`.
2. Gere o frontend com `npm run build`, sirva `apps/web/dist` por HTTPS e encaminhe `/api` para Express na mesma origem.
3. Use `npm run start -w @caderninho/api` para iniciar a API. Configure `APP_URL` com a origem pública exata e `PORT` conforme a hospedagem.
4. Execute `npm run db:migrate` nas atualizações e configure backups e retenção do PostgreSQL.
5. Complete a política de privacidade e valide o fluxo real de recuperação de senha na sua hospedagem.

Nunca use o servidor de desenvolvimento Vite como servidor de produção.

## Rodar diretamente pelo GitHub Codespaces

Se o cadastro mostrar **“Requisição não permitida.”**, atualize o código e reinicie pelo terminal do Codespaces:

```bash
git pull origin main
bash scripts/codespaces-start.sh --restart
```

Depois atualize a página aberta pela porta **5173**. A API reconhece automaticamente o endereço do próprio Codespace em desenvolvimento, inclusive com `npm run dev`.

O repositório inclui um Dev Container que instala Node.js 24 e Docker, prepara o PostgreSQL e inicia o aplicativo. É um ambiente de desenvolvimento acessível pelo navegador.

1. No GitHub, abra o repositório **DeveloperJoaoPedro/Caderninho**.
2. Clique em **Code → Codespaces → Create codespace on main**.
3. Aguarde a preparação. Abra a aba **Ports** e clique no endereço da porta **5173**, identificada como **Caderninho**.
4. Crie sua conta no aplicativo e registre sua primeira cliente, produto e venda.

A porta **8025** permite consultar os e-mails de recuperação de senha na caixa local de teste. Mantenha as portas privadas. Quando terminar, pare o Codespace pelo menu do GitHub para não consumir recursos sem necessidade. O serviço tem cotas e pode gerar cobrança conforme sua conta; confira o painel de uso do GitHub.

O código é persistido com commits; os registros das clientes ficam no volume PostgreSQL do Codespace. Exporte seus dados antes de excluir ou recriar esse ambiente. A exclusão do Codespace não deve ser usada como backup. Para hospedar um serviço público de uso contínuo, será necessário um deploy com banco e SMTP próprios, conforme a seção de publicação.

## Buscar produtos do Boticário sem serviço pago

Em **Produtos → Novo produto**, use **Buscar no Boticário** por nome ou código (com ou sem B). Escolha um resultado, confira os valores e salve. O código também pode ser preenchido manualmente e usado na busca de **Meus produtos**. Natura e Avon continuam com cadastro manual.

A fonte é a loja pública, não o catálogo da revendedora: promoções e valores podem diferir do seu ciclo. O formulário mostra a fonte e a data da consulta. Nome, código, catálogo, custo e venda continuam editáveis; o custo sugerido aplica o desconto configurado para Boticário. Importações nunca atualizam automaticamente produtos ou vendas anteriores.

Não usa Apify, assinatura ou chave. A integração depende da disponibilidade e do formato do site; pode deixar de funcionar, com mensagem para usar o cadastro manual. Cada usuária tem até 20 consultas a cada 10 minutos. Resultados públicos ficam em memória por uma hora (máximo 100 buscas), com no máximo 12 produtos por busca e 2 consultas externas simultâneas. Não envia dados de clientes nem credenciais ao Boticário. Não contorna bloqueios.

Para atualizar um Codespaces existente após esta mudança:

```bash
git pull origin main
npm run db:generate
bash scripts/codespaces-start.sh --restart
```

A reinicialização aplica a migração que adiciona o código, preservando produtos existentes. Faça a geração do Prisma com o app parado se ele estiver em um terminal com `npm run dev` (Ctrl+C), e inicie novamente ao terminar. Em ambientes com proxy HTTP de saída, Node 24 pode exigir `NODE_USE_ENV_PROXY=1` para consultar a fonte.
