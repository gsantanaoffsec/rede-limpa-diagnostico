# Publicação nas lojas

Os pacotes desta entrega não foram enviados às lojas nem assinados. Autenticação, pagamento, aceite de termos e envio devem ocorrer na conta do publicador. As instruções são baseadas na documentação oficial consultada em 06/11/2026; confira os formulários vigentes na submissão.

## Preparação comum

1. Execute testes/check/build. Instale a versão exata em Chrome e Firefox e valide Windows/macOS com a lista de `VALIDACAO.md`.
2. Escolha explicitamente a licença pública. O pacote anterior não informou licença; não foi inserida uma autorização MIT/GPL presumida nesta atualização. No Firefox é possível selecionar direitos reservados quando aplicável. Preserve qualquer licença já existente no repositório remoto.
3. Publique `PRIVACIDADE.md` em uma URL pública estável, por exemplo na documentação do próprio GitHub. A página interna não substitui o endereço público solicitado pela loja. Defina o contato/canal de suporte real.
4. Revise nome, ícones e texto abaixo. As imagens em `docs/assets` são demonstrações com dados fictícios, não provas de validação da captura real; para a loja prefira screenshots reais da extensão instalada. Não use capturas com dados de pacientes, credenciais ou informações internas.
5. A finalidade é diagnóstico local de requisições; a ocultação/bloqueio de ruído de rede dá suporte a esse objetivo. Explique essa relação e justifique cada permissão. Não prometa anonimização total, compatibilidade universal ou aprovação garantida.

## Textos iniciais

**Nome:** Rede limpa + Diagnóstico

**Resumo:** Compare pesquisas HTTP, entenda filtros e exporte diagnósticos revisados, com análise local e controle de ruído na rede.

**Descrição:** Capture fetch/XHR de uma aba escolhida. Compare uma pesquisa que funciona com outra que falha; consulte filtros, respostas, marcadores temporais e indícios de erros conhecidos. Agrupe chamadas repetidas, oculte hosts ruidosos e exporte JSON, Markdown, HAR ou cURL após revisar a prévia. Tema claro/escuro e janela flutuante. Sem envio de capturas a serviços externos. Os diagnósticos são heurísticos, os registros expiram em 24 horas quando a extensão é utilizada e as exportações podem ser parciais. O bloqueio configurável afeta fetch/XHR em todas as abas. No Chrome, a modalidade sem DevTools usa a permissão debugger e exibe o aviso do navegador.

## Chrome Web Store

- Acesse o [Developer Dashboard](https://chrome.google.com/webstore/devconsole), cadastre a conta e pague a taxa única apresentada. [Cadastro oficial](https://developer.chrome.com/docs/webstore/register).
- Envie `rede-limpa-chrome-2.0.0.zip`, nunca o ZIP completo de fontes. O manifest está na raiz.
- Preencha descrição, imagens, ícone, categoria, suporte, distribuição e a aba de privacidade. Declare a finalidade e o tratamento local dos dados fielmente. Mesmo sem transmissão externa, a extensão acessa conteúdo de requisições; não marque respostas incompatíveis com esse acesso.
- Justificativas: `debugger` observa fetch/XHR da aba selecionada sem F12; DNR bloqueia os hosts configurados; `tabs` identifica abas; `storage` guarda estado/preferências; `clipboardWrite` copia prévia; acesso aos hosts permite aplicações locais e servidores escolhidos pela pessoa. Revise se permissões amplas podem ser reduzidas antes da submissão final.
- Envie para revisão; acompanhe as respostas. [Fluxo oficial](https://developer.chrome.com/docs/webstore/publish). O uso de APIs permitidas não garante aprovação.

## Mozilla Add-ons

- Entre no [Developer Hub](https://addons.mozilla.org/developers/) com a conta Mozilla.
- Escolha publicação na loja (**On this site**) ou assinatura para distribuição própria (**On your own**).
- Envie `rede-limpa-firefox-2.0.0.zip`, complete nome, descrição, categoria, licença, suporte, política e declarações de dados. O manifest já contém ID estável e declaração de ausência de transmissão de dados; confira a adequação dessa declaração às políticas atuais e à versão efetivamente enviada.
- Submeta fontes/instruções de build se solicitadas. O código não é minificado nem ofuscado. O ZIP completo inclui fontes e testes; o build só copia arquivos locais.
- Aguarde validação/revisão/assinatura. Distribua o XPI assinado retornado pela Mozilla, não renomeie o ZIP como se fosse assinado. [Submissão oficial](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/) e [assinatura/distribuição](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/).

## Atualizações

Preserve o ID Firefox, incremente a versão nos dois manifests e em package.json, atualize changelog/testes, gere pacotes, valide e envie a nova versão a cada loja. Não há credenciais de publicação nem upload automático no projeto.
