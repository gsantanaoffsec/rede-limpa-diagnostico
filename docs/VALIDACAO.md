# Validação da versão 2.0.0

## Executado nesta entrega

- 45 testes automatizados aprovados (`node --test tests`). Incluem capturadores com APIs simuladas Chrome/Firefox, adaptador DevTools, sessão, snapshots, limite de bytes, expiração, comparação, diagnósticos, revisão e interface DOM via jsdom.
- Sintaxe dos arquivos JavaScript e JSON, versões dos manifests, IDs e recursos HTML conferidos por `node scripts/check.mjs`.
- Builds separados gerados para Chrome MV3 e Firefox MV2; arquivos compartilhados locais, sem código remoto nem dependências de execução.
- Layout real renderizado em Chrome headless com API simulada, dados fictícios e perfil temporário. Temas claro e escuro em `assets/demo-light.png` e `assets/demo-dark.png`. O popup foi medido dentro de viewport inicial de 18 px: corpo e raiz mantiveram 680 px; duas chamadas foram renderizadas. Isso confirma layout/execução da UI, não a captura por APIs reais do navegador.
- Validador oficial `web-ext lint` no pacote Firefox: zero erros e um aviso referente ao suporte Android da chave `data_collection_permissions` no mínimo Firefox 140. A versão entregue destina-se a desktop Windows/macOS; Android não foi validado e não deve ser marcado como suportado na loja.
- Revisão independente dos novos módulos. Foram reproduzidos e corrigidos: descarte incorreto de chamadas novas quando snapshots ocupavam o limite, proteção de credencial com espaços em JSON truncado, regex lenta em texto longo, associação de ações pelo término da resposta e respostas atrasadas do DevTools após limpar. Os testes de regressão estão na suíte.
- Empacotamento verifica integridade ZIP, manifest na raiz dos pacotes de navegador e exclusão de node_modules/arquivos temporários. As fontes completas incluem testes, lockfile e instruções de build.

## Limites da verificação

Não foi instalada esta versão em uma sessão real de Firefox ou Chrome com captura de aplicações externas. Não houve teste real em macOS, publicação, assinatura ou revisão das lojas. Mocks não comprovam compatibilidade de todas as permissões, estados do depurador ou formatos HAR expostos pelo navegador. O adaptador Chrome DevTools usa o campo específico `_resourceType` para identificar fetch/XHR; sem esse campo a entrada não é coletada. Nenhuma garantia de revisão das lojas foi dada.

## Roteiro manual antes de publicar

- [ ] Instalar em Chrome e Firefox no Windows; repetir no macOS.
- [ ] Capturar GET/POST/PATCH, JSON com UTF-8, resposta vazia, erro HTTP, erro de rede, corpo binário e resposta acima de 128 KiB; conferir que a página recebe a resposta original no Firefox.
- [ ] Fechar/reabrir popup e janela; verificar seleção da aba, tema, largura e ausência de janela duplicada.
- [ ] Suspender/recriar worker Chrome; consultar registros preservados e retomar captura quando necessário.
- [ ] Abrir/fechar DevTools, iniciar pelo painel Rede limpa e conferir que o popup mostra os mesmos dados sem duplicação. Testar fetch lento, marcador e limpeza durante leitura do corpo.
- [ ] Testar host semelhante, subdomínio, URL com nome do host na query, portas padrão/customizadas; ocultar sem bloquear e bloquear sem ocultar. Conferir as outras abas.
- [ ] Capturar A, limpar, capturar B e comparar; conferir parâmetros repetidos, mesmo endpoint com várias ocorrências e resposta alterada.
- [ ] Revisar dados sensíveis nos filtros, JSON aninhado, caminho da URL e texto; testar campos extras. Exportar todos os formatos e importar HAR em uma ferramenta compatível. Revisar cURL antes de executar em Bash/zsh.
- [ ] Confirmar que editar prévia exige nova revisão; apagar dados e verificar captura/snapshots no armazenamento. Downloads anteriores devem permanecer.
- [ ] Conferir retenção de 24 horas, descarte por limite e snapshots sinalizados como reduzidos.
- [ ] Escolher licença, publicar política pública, confirmar contato, obter screenshots reais, declarar permissões e enviar à revisão das lojas.
