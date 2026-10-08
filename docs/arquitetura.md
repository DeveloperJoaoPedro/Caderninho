# Entendendo o Caderninho

## O caminho de uma ação

Ao clicar em “Registrar pagamento”, o formulário converte reais em centavos e valida os campos com Zod. A função `api()` faz uma requisição HTTP. O middleware de autenticação verifica o JWT e identifica a usuária. A rota valida os campos novamente: uma requisição pode ser enviada sem passar pelo formulário. O serviço confere saldo, data e situação da venda. O repositório executa as operações no PostgreSQL dentro de uma transação. A interface atualiza os saldos após a confirmação.

- **Tela/componente:** o que a usuária vê e como interage. Não decide se outra conta pode acessar um registro.
- **Schema compartilhado:** contrato dos campos e regras de formato. Usado no navegador para feedback rápido e no servidor para garantir validade.
- **Rota:** entrada e saída HTTP. Escolhe status e formato da resposta.
- **Serviço:** significado da ação: o que conta como lucro, quanto falta pagar, quando cancelar.
- **Repositório:** como buscar/gravar dados. Sempre recebe o identificador da usuária nos registros de negócio.
- **Prisma e migrações:** estrutura física do banco, tipos gerados e histórico das alterações.

Operações que precisam acontecer juntas usam os métodos do repositório transacional. Se gravar a venda falhar, nenhum item ou parcela fica salvo pela metade. Pagamentos usam isolamento serializable para evitar que dois cliques simultâneos ultrapassem o saldo.

## Etapa 1 — Conta e perfil

`features/Auth.tsx` contém cadastro, login e recuperação. `routes/auth.ts` conecta as URLs às ações. `services/auth.ts` cuida de senha, JWT e recuperação. `repositories/account.ts` localiza a conta e seleciona os campos públicos. `middleware/auth.ts` verifica a sessão antes de qualquer acesso aos módulos.

**Por quê:** autenticação é o ponto comum de todos os módulos. As marcas e seus descontos ficam associadas à conta e sugerem custo no cadastro do produto.

**Teste manual:** crie uma conta, saia, entre novamente, atualize seu nome e o desconto da Natura. Peça um link de recuperação e abra a mensagem no Mailpit. As sessões antigas devem deixar de funcionar depois da troca de senha.

## Etapa 2 — Clientes

`features/CustomersProducts.tsx` contém cadastro, edição, busca e histórico. O telefone é transformado em `55 + DDD + número` pelo schema compartilhado. O histórico soma apenas vendas ativas e recebimentos não estornados.

**Por quê:** a cliente é o elo entre a venda, as parcelas e a cobrança. Seu saldo é calculado a partir dos registros existentes, evitando um segundo valor que possa ficar desatualizado.

**Teste manual:** cadastre uma cliente com DDD, faça uma venda e confira o histórico. Entre com outra conta: essa cliente não deverá aparecer.

## Etapa 3 — Produtos

O formulário lê o desconto padrão da marca, calcula o custo sugerido e permite editar. A API calcula o mesmo custo se ele não for informado. Catálogo, custo e venda são campos diferentes.

**Por quê:** a revendedora pode dar um desconto à cliente diferente do desconto que recebe da marca. Guardar esses valores separadamente permite calcular a margem real.

**Teste manual:** configure 30% para Natura e cadastre preço de catálogo R$ 100,00. O custo sugerido deve ser R$ 70,00. Edite o custo e confirme que a margem muda.

## Etapa 4 — Vendas e parcelas

`features/Sales.tsx` organiza cliente, produtos e pagamento em três passos. `services/business.ts` monta a venda, calcula o desconto, distribui os centavos e cria parcelas. `repositories/business.ts` fornece a transação com escopo da usuária.

**Por quê:** custo e preço são copiados para o item vendido. Editar o produto depois não reescreve o passado. A soma das parcelas precisa bater com o total, inclusive quando a divisão deixa centavos restantes.

**Teste manual:** divida R$ 100,00 em três parcelas: R$ 33,34, R$ 33,33 e R$ 33,33. Receba parcialmente, estorne com motivo e confira que o saldo reabre. Cancelamento exige estornar recebimentos ativos e preserva o histórico.

## Etapa 5 — Cobrança

A situação da parcela é calculada pelo vencimento e pelo saldo. A tela oferece cliente, situação e período como filtros. O formulário de cobrança monta um link `wa.me` com o telefone normalizado e a mensagem codificada.

**Por quê:** a usuária precisa revisar o texto antes de falar com a cliente. Não há envio automático nem acesso à conta de WhatsApp.

**Teste manual:** abra uma parcela pendente, clique em “Cobrar”, edite a mensagem e confira telefone e texto ao abrir o WhatsApp. Sem telefone, a ação fica indisponível.

## Etapa 6 — Gastos e campanhas

`features/ExpensesCampaigns.tsx` contém as telas. A campanha tem marca e período. Cada item de venda pode apontar para uma campanha da sua marca; um gasto também pode ser associado.

**Por quê:** uma mesma compra pode conter marcas diferentes. Associar o ciclo ao item permite separar o resultado de cada marca sem duplicar a venda.

**Teste manual:** crie um ciclo, associe um produto vendido e um frete. Confira o resultado. Tente associar a uma marca diferente: o servidor deve rejeitar.

## Etapa 7 — Dashboard

`features/Dashboard.tsx` mostra as informações calculadas pelo serviço: saldo total, recebido no mês, lucro das vendas, gastos e próximas parcelas. A divisão do lucro recebido usa a proporção de pagamentos das vendas do mês, não o total recebido de vendas antigas.

**Por quê:** vender e receber são eventos diferentes. A usuária deve saber quanto ganhou em vendas e quanto desse resultado depende de pagamentos futuros.

**Teste manual:** uma venda de R$ 90,00 com custo R$ 70,00 tem margem de R$ 20,00. Ao receber R$ 30,00, aproximadamente R$ 6,66 da margem será marcada como recebida e R$ 13,34 continuará a receber. A soma permanece R$ 20,00.

## Etapa 8 — Relatórios e privacidade

`features/ReportsSettings.tsx` contém período, exportações, perfil e direitos sobre dados. O serviço agrega vendas, custos, gastos e recebimentos. O PDF é gerado no servidor, e o CSV escapa fórmulas potencialmente interpretadas por planilhas.

**Por quê:** PDF facilita compartilhar/guardar um resumo; CSV permite analisar em planilhas. O backup JSON inclui o histórico próprio, inclusive estornos e cancelamentos, sem senhas ou tokens.

**Teste manual:** gere um relatório, exporte PDF e CSV, confira os números e baixe seu JSON. Exclua uma conta de teste confirmando a senha; o login e o acesso ao histórico devem deixar de funcionar.

## Como continuar desenvolvendo

Rode os comandos a partir da raiz: `npm run dev` inicia as duas aplicações usando apenas processos do Node e npm workspaces. Execute `npm test` para validar regras e segurança com PostgreSQL; `npm run test:e2e` exercita o navegador em celular e desktop; `npm run typecheck` verifica os contratos TypeScript; `npm run build` gera os arquivos de produção.

Para adicionar um campo: altere o schema Prisma, crie uma migração com `npm exec -w @caderninho/api -- prisma migrate dev --name nome_da_mudanca`, atualize o schema Zod compartilhado e os tipos da resposta, implemente a regra no serviço/repositório e exponha o campo no formulário. Nunca edite migrações já aplicadas em ambientes compartilhados.

## Busca de produtos na loja pública

O componente `CatalogSearch` pede nome ou código, mostra resultados e devolve a escolha ao formulário. O formulário preenche os campos e calcula o custo sugerido, mas a usuária confirma o cadastro normalmente. A busca externa não grava produtos: só o botão Salvar usa a rota já existente de cadastro.

A rota `/api/catalog/boticario` exige login, valida o texto e limita consultas por usuária. O serviço `catalog.ts` consulta um domínio fixo, segue apenas redirecionamentos no mesmo domínio e lê os cartões da busca ou os dados estruturados do produto. Há limites de tempo, tamanho e concorrência, com cache de dados públicos em memória. Falhas mantêm o cadastro manual disponível. Não há acesso ao banco nessa consulta; o repositório continua responsável por gravar o produto com o id da usuária, incluindo o código opcional. A migração mantém todos os registros existentes.

Valores de preço são convertidos de texto decimal em centavos inteiros. Vendas mantêm seus próprios valores registrados, independentemente de consultas futuras à loja.

Validação: testes automatizados cobrem leitura de lista e página de produto, centavos, cache, falhas e bloqueio de links/redirecionamentos externos. O teste de navegador simula a fonte para verificar erro, escolha, custo sugerido, edição e gravação em celular e desktop. A disponibilidade real da loja deve ser conferida separadamente, pois esses testes não dependem dela.
