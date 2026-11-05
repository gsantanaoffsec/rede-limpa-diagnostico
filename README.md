# Rede limpa + Diagnóstico — 1.2.1

Extensão para Chrome e Firefox em Windows e macOS. Captura filtros e respostas da aba escolhida, copia diagnósticos e integra o painel/bloqueio do [kspsk-block](https://github.com/gsantanaoffsec/kspsk-block).

## Correção desta versão

Corrigida a abertura intermitente em uma faixa estreita contendo apenas a barra de rolagem. O popup deixou de depender de `max-width: 100vw` durante o cálculo de tamanho: agora possui largura e largura mínima explícitas de 680 px no elemento raiz e no corpo. A janela flutuante mantém largura adaptável, com mínimo de 340 px.

## Instalar no Chrome

1. Extraia este ZIP para uma pasta fora dos projetos da aplicação.
2. Abra `chrome://extensions` e ative o modo do desenvolvedor.
3. Clique em **Carregar sem compactação** e selecione `dist/chrome`.
4. Se houver uma versão antiga instalada, remova-a ou recarregue-a apontando para esta pasta.

Chrome 120+. A captura sem F12 usa a API debugger e mostra o aviso padrão de depuração enquanto ativa. Feche o DevTools da aba antes de iniciar; **Parar captura** desanexa o debugger.

## Instalar no Firefox

1. Abra `about:debugging#/runtime/this-firefox`.
2. Remova a versão temporária anterior.
3. Clique em **Carregar extensão temporária** e selecione `dist/firefox/manifest.json`.

Firefox 140+. A instalação temporária termina ao reiniciar o Firefox; instalação permanente exige assinatura Mozilla. O ZIP não é assinado.

## Usar

1. Abra a extensão e escolha **Aba para capturar**.
2. Clique em **Iniciar captura** e repita a ação na aplicação.
3. Filtre por URL/método/status e selecione uma chamada.
4. Use **Copiar selecionada** ou **Copiar lista filtrada**.
5. Use **Parar captura** e **Limpar** ao terminar.

A captura só inclui chamadas novas. Mantém até 100 fetch/XHR e até 128 KiB de texto por corpo. Tokens e senhas comuns são ocultados no diagnóstico; revise dados pessoais antes de compartilhar. Sem envio externo/telemetria. As capturas ficam em memória; no Chrome elas podem desaparecer se o service worker encerrar após a captura parar.

## Temas e janela

Escolha Claro, Escuro ou Sistema. Use **Abrir janela flutuante** para manter o painel aberto ao trabalhar na aplicação. A janela é movível e redimensionável, sem forçar sempre-no-topo. **Sempre abrir em janela flutuante** salva essa preferência. O seletor de abas permite escolher a aplicação mesmo com a janela separada em foco.

## Bloqueio e painel original

O bloqueio ligado por padrão atua em GETs XHR/fetch para `ff.kes.v2.scr.kaspersky-labs.com`, HTTP/HTTPS nas portas padrão. Todas as chamadas desse host ficam ocultas nas duas listas. Não bloqueia POST, portas alternativas ou hosts parecidos.

O painel adicional **Rede limpa** continua no DevTools, com captura própria, cores, filtros, pausa e preservar ao navegar. No Firefox, abra Rede nativa uma vez e volte ao painel para ativar sua captura. O popup não precisa desse procedimento. O painel original permite inspecionar headers reais.

O contador de bloqueios é disponibilizado pelo Firefox; no Chrome é informado o estado da regra sem contador numérico. O bloqueio funciona mesmo com captura parada. Nenhuma configuração de Kaspersky, DNS, hosts, proxy ou firewall é alterada.

## Fontes e desenvolvimento

Documentação exclusivamente Markdown. Fontes compartilhados em `src/shared`, backends específicos em `src/chrome` e `src/firefox`. O build não depende de comandos de sistema e é utilizável em Windows/macOS. A instalação não precisa de executável nativo.

Node.js 20+, sem instalar dependências:

```bash
node scripts/build.mjs
node --test tests
```

Os ZIPs já incluem `dist/`. Ao clonar pelo GitHub, gere `dist/` com o comando acima. Após alterar fontes, gere novamente e recarregue a extensão no navegador.

## Validação e limitações

Veja [docs/VALIDACAO.md](docs/VALIDACAO.md). A correção de geometria foi comparada em Chrome headless com viewport inicial de 18 px: antes o corpo media 18 px; depois, 680 px. Também foi conferida a adaptação da janela flutuante a 360 e 960 px.

Não foi feita instalação completa nesta reconstrução nem teste em macOS. A captura usa APIs do navegador, sem integração nativa do sistema operacional. Iframes/workers em alvos separados e WebSocket não têm captura garantida.

## Permissões

`tabs`/`activeTab` identificam a aba; `storage` salva preferências e referência da janela; `clipboardWrite` copia o diagnóstico. Firefox usa `webRequest`/`webRequestBlocking` e acesso aos sites; Chrome usa `debugger`, `declarativeNetRequest` e acesso aos sites. Só a preferência de bloqueio e tema/modo é persistida; não há exportação automática de dados.

## Origem

Componentes do kspsk-block do usuário, revisão `3ee5b873c5c386462cb9571ae91738bc462388a0`: `network-core.js`, painel DevTools e regra de bloqueio. Diagnóstico, temas e janela adicionados nesta sessão. Os componentes de proxy de terminal não integram este pacote.
