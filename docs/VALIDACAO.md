# Validação 1.2.1

- 23 testes Node passaram: captura Firefox/Chrome simulada, configuração, janela, bloqueio, credenciais e painel DevTools original.
- Abertura estreita reproduzida em Chrome headless com iframe de 18 px usando os mesmos fontes da interface.
- CSS antigo: corpo de 18 px, reproduzindo a faixa estreita.
- CSS novo: corpo e raiz de 680 px mesmo com viewport inicial de 18 px.
- Popup normal: corpo de 680 px.
- Janela flutuante: corpo de 345 px em viewport de 360 px e de 945 px em viewport de 960 px; diferença corresponde à rolagem vertical.
- Sintaxe dos JavaScripts e integridade dos ZIPs verificadas.
- Não foi realizada instalação completa da reconstrução nos navegadores nem validação em macOS.

## Resultado da geometria

```json
[
  {
    "name": "before",
    "viewport": 18,
    "width": 18,
    "root": 3
  },
  {
    "name": "after",
    "viewport": 18,
    "width": 680,
    "root": 680
  },
  {
    "name": "popup-normal",
    "viewport": 680,
    "width": 680,
    "root": 680
  },
  {
    "name": "floating-small",
    "viewport": 360,
    "width": 345,
    "root": 345
  },
  {
    "name": "floating-large",
    "viewport": 960,
    "width": 945,
    "root": 945
  }
]
```
