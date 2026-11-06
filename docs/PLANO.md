# Rede limpa 2.0 — plano e decisões

Escopo autorizado: todas as melhorias propostas na conversa. Implementação em cópia isolada, fora dos projetos DrMais. Sem publicação, push ou alteração da versão anterior.

Arquitetura: capturadores nativos por navegador, armazenamento e operações de sessão compartilhados, painel único usado no popup/janela/DevTools. Somente processamento local, sem bibliotecas remotas.

- [x] Testar e implementar análise local, comparação, agrupamento, exportação e revisão de dados.
- [x] Persistir captura sanitizada com limite de 6 MB, 300 registros e validade de 24 horas; reidratar após suspensão.
- [x] Configurar ocultação e bloqueio independentes de hosts exatos, com confirmação explícita ao salvar.
- [x] Unificar as interfaces e integrar agrupamento, ações, comparação A/B, linha do tempo e exportações.
- [x] Documentar privacidade, licença, validação e publicação; gerar pacotes separados e fontes.
- [x] Executar testes de regressão, novos testes comportamentais, validação de recursos e verificação visual.

Decisões: credenciais conhecidas removidas na coleta; revisão adicional de dados pessoais antes de exportar; prévia e edição do relatório antes de copiar. HAR/cURL sanitizados são aproximações de diagnóstico, sem replay automático. Ações agrupadas por marcador manual e janela temporal, sem afirmar causalidade. Nenhum diagnóstico heurístico afirma causa definitiva.

Validação pendente até execução: instalação real Chrome/Firefox, testes macOS, revisão das lojas. Não alegar cobertura desses ambientes com mocks.

## Resultado
45 testes aprovados; revisão independente com correções e regressões. UI e geometria verificadas em Chrome headless com mocks; web-ext sem erros, com um aviso de Android fora do escopo desktop. Instalação real nos navegadores, macOS e publicação permanecem explicitamente pendentes em VALIDACAO.md.
