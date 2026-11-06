# Rede limpa + Diagnóstico 2.0

Extensão para entender filtros e respostas de pesquisas HTTP, comparar capturas e compartilhar um diagnóstico revisado. Processamento local, sem conta, telemetria, serviço de IA ou envio de capturas a servidores.

## Instalar

Se você baixou ou clonou este repositório, os pacotes prontos estão em `dist/chrome` e `dist/firefox`. No Chrome, selecione a pasta `dist/chrome` em **Carregar sem compactação**. No Firefox, selecione `dist/firefox/manifest.json` em **Carregar extensão temporária**. As instruções abaixo também servem para os ZIPs gerados por `python scripts/package.py`.

### Chrome — Windows e macOS

Extraia `rede-limpa-chrome-2.0.0.zip`. Abra `chrome://extensions`, ative **Modo do desenvolvedor**, escolha **Carregar sem compactação** e selecione a pasta que contém `manifest.json`. Chrome 120 ou superior. Ao atualizar, recarregue a extensão nessa tela. A captura sem DevTools usa `debugger` e o navegador apresenta o aviso correspondente.

### Firefox — Windows e macOS

Extraia `rede-limpa-firefox-2.0.0.zip`. Abra `about:debugging#/runtime/this-firefox`, escolha **Carregar extensão temporária** e selecione `manifest.json`. Firefox 140 ou superior. A instalação temporária termina quando o navegador fecha. Para instalação permanente, a versão precisa ser assinada pela Mozilla; estes pacotes ainda não são assinados.

Não é necessário instalar Node.js para usar os pacotes prontos. O código não depende de comandos Windows para funcionar no macOS, mas a instalação e a captura no macOS ainda precisam de teste real.

## Capturar e investigar

1. Abra uma página HTTP/HTTPS, selecione a aba no painel e clique em **Iniciar captura**.
2. Faça a pesquisa na aplicação. Volte ao popup ou use a janela flutuante, que pode ser movida e redimensionada.
3. Filtre por URL, método, status ou nome da ação. **Somente erros** considera status HTTP a partir de 400 e falhas de rede.
4. Selecione uma chamada. O diagnóstico apresenta evidências e hipóteses locais; **Filtros explicados** mostra exatamente o que foi enviado.
5. Use **Agrupar chamadas repetidas** para agrupar por método + origem + caminho, independentemente dos valores da query. O grupo informa quantidade, erros, duração média e intervalo médio. Clique novamente no grupo para alternar entre seus registros; desmarque a opção para ver todas as linhas.

O diagnóstico reconhece listas `data: []`, possíveis datas compactas, erros de data/SQL conhecidos, erros HTTP/rede, demora a partir de 2 segundos e limitações da captura. A análise não conhece o schema nem o contrato do seu backend e não confirma a causa do erro.

## Marcar ações, linha do tempo e comparação A/B

- Em **Marcar uma ação**, informe a operação e escolha uma duração de 15 a 120 segundos. Marque e execute a operação na página. As chamadas dentro desse período recebem o marcador; chamadas em segundo plano também podem entrar. Sem marcador, intervalos de até 3 segundos formam grupos temporais.
- Capture a pesquisa que funciona e use **Salvar captura em A**. Limpe a captura atual, reproduza o problema e salve em **B**. Limpar a captura atual preserva os snapshots.
- **Comparar A × B** compara filtros (inclusive parâmetros repetidos), corpo enviado, status, resposta e avisos. A correspondência usa método, origem, caminho e ordem de ocorrência; até 500 diferenças e profundidade 12. Chamadas em outra ordem podem exigir interpretação manual. Tempos e IDs não entram na comparação.
- A linha do tempo usa a lista filtrada e permite voltar ao registro selecionado.

## Popup, janela e DevTools

As três interfaces consultam a mesma sessão, incluindo A/B e regras de hosts. O tema claro, escuro ou do sistema e o modo de janela são persistidos.

No Chrome, a captura pelo botão da extensão usa `debugger`. Abrir o DevTools pode encerrar essa conexão. Nesse caso, abra o painel **Rede limpa** no DevTools e clique em **Iniciar captura**: ele passa a alimentar a mesma sessão pelo evento de rede do DevTools, sem disputar o depurador. Essa modalidade depende da identificação fetch/XHR (`_resourceType`) fornecida pelo Chrome e exige o DevTools aberto. Para voltar a capturar sem F12, feche o DevTools e inicie pelo popup. Após fechar o DevTools, a interface pode indicar o modo anterior até você parar ou reiniciar a captura.

No Firefox, o mesmo capturador `webRequest` atende popup e DevTools. Em ambos os navegadores são capturadas chamadas fetch/XHR, não navegações, imagens, WebSocket ou todo o tráfego do computador. Iframes e workers em alvos separados podem não ser capturados.

## Ocultar ou bloquear hosts

Cadastre até 30 hosts ASCII exatos. Exemplos: `localhost`, `api.exemplo.com`. URLs, portas, caminhos, curingas, IPv6 e nomes Unicode não são aceitos; para domínio internacional use sua representação ASCII.

**Ocultar** evita mostrar o host na lista, sem impedir a requisição. **Bloquear** impede fetch/XHR desse host em todas as abas, mesmo com a captura parada. Para hosts adicionados, todos os métodos e portas HTTP/HTTPS são abrangidos. O padrão Kaspersky mantém o comportamento anterior: host `ff.kes.v2.scr.kaspersky-labs.com`, somente GET em portas padrão. Os controles de ocultação e bloqueio são independentes. As mudanças só entram em vigor em **Aplicar regras**; remover uma linha exige aplicar novamente. No Chrome o contador de bloqueios não está disponível sem permissões adicionais.

## Revisar e exportar

Escolha chamada selecionada, lista filtrada ou snapshot A/B. Formatos: JSON, Markdown, HAR, cURL ou comparação A/B em Markdown. cURL usa sintaxe Bash/zsh (no Windows, Git Bash); não execute diretamente no PowerShell. Nenhuma chamada é repetida automaticamente.

Credenciais comuns são removidas antes de apresentar ou persistir a captura. A revisão adicional remove e-mails, CPF e campos comuns de contato e aceita nomes de campos extras, como `nm_pessoa`, `nome` ou `documento`. A identificação é heurística e pode remover textos legítimos ou deixar dados pessoais não reconhecidos. **Preparar prévia** mostra o conteúdo editável e a contagem de ocorrências adicionais protegidas. Confirme que revisou para copiar ou baixar; editar a prévia invalida a confirmação.

HAR/cURL são versões sanitizadas para diagnóstico: não incluem autenticação nem cabeçalhos originais, podem omitir corpos e não equivalem a uma reprodução completa. O HAR não conhece o tamanho original nem a decomposição real de tempos. Alterações manuais na prévia podem invalidar JSON/HAR; confira antes de importar.

## Persistência e privacidade

Até 300 chamadas e 128 KiB UTF-8 de cada corpo. Captura atual + snapshots A/B dividem até 6 MB; os registros mais antigos são descartados primeiro. Se snapshots precisarem ser reduzidos, a interface sinaliza. Dados expiram após 24 horas; a limpeza ocorre ao utilizar a extensão. Fechar o popup ou suspender o worker não apaga a captura. Chamadas interrompidas podem não recuperar o corpo. Após reiniciar o navegador, as chamadas antigas podem ser consultadas, mas a captura deve ser iniciada novamente.

**Apagar capturas e comparações** remove os dados coletados e A/B, mantendo tema e hosts. Downloads e texto já copiado não são apagados. Não existe sincronização pela conta do navegador. Veja [PRIVACIDADE.md](PRIVACIDADE.md).

## Desenvolver e validar

Node.js 20+, Python 3 apenas para empacotar:

```bash
npm ci --ignore-scripts
npm test
npm run check
npm run build
python scripts/package.py
```

Não há dependências de execução na extensão. `jsdom` é usado somente nos testes. `src/shared/popup.html` é a fonte da interface; o build gera `panel.html` a partir dela. `dist/firefox` e `dist/chrome` são regeneráveis. `release` recebe os três ZIPs, com `manifest.json` na raiz dos pacotes de navegador.

Veja [validação](docs/VALIDACAO.md), [publicação nas lojas](docs/PUBLICACAO.md), [histórico](CHANGELOG.md) e [origem dos componentes](NOTICE.md).
