# 🏗️ Arquitetura e Fluxo dos Pacotes

Este documento explica como os módulos do Selecto se comunicam e a lógica de geração de seletores e tours.

---

## 1. Visão Geral da Arquitetura

```text
[ Página Web do Usuário ]
        │
   (Hover / Click)
        │
        ▼
[ packages/selector-sdk ] ─── Gera seletores semânticos e únicos (CSS, XPath, Playwright, Cypress)
        │
        ├──► [ apps/chrome-extension ] ─── Exibe Sidebar isolada em Shadow DOM e sincroniza iframes
        │
        └──► [ packages/onboarding-sdk ] ─── Cria passos de tour guiado dinâmico ou declarativo
                     │
                     ▼
             [ apps/dashboard ] ─── Persistência (Postgres/SQLite com Drizzle ORM)
```

---

## 2. Lógica do `selector-sdk`

O `selector-sdk` é agnóstico a frameworks e segue uma cadeia estrita de prioridades para gerar seletores limpos, estáveis e resistentes a mudanças de layout:

1. **Atributos Semânticos de Teste (Maior Prioridade)**:
   - Checa a presença de: `data-testid`, `data-qa`, `data-cy`, `data-test`, `data-onboarding-id`.
   - Se for único no documento, utiliza imediatamente como seletor primário (ex: `[data-testid="submit-btn"]`).
2. **Identificador Único (`#id`)**:
   - Se possuir atributo `id` e ele for único na página, gera `#meu-id`.
3. **Formatação de Locators Modernos**:
   - **Playwright**:
     - Botões com texto: `page.getByRole('button', { name: 'Texto' })`
     - Inputs com placeholder: `page.getByPlaceholder('Email')`
     - Textos e rótulos: `page.getByText('...')` ou `page.locator('...')`
   - **Cypress**:
     - Gera chamada no formato `cy.get('...')`.
   - **XPath**:
     - Constrói caminho hierárquico preciso a partir da tag e atributos únicos ou índices de irmãos (`//button[@id="..."]` ou `/html/body/...`).

---

## 3. Lógica do `onboarding-sdk`

O SDK de onboarding consome as capacidades do `selector-sdk` para executar tours guiados na aplicação do cliente:

* **Modo Manual/Programático**:
  - Passos definidos via código TypeScript/JavaScript passando o seletor, título, mensagem e posição do balão.
* **Modo Declarativo (`discoverFromDOM`)**:
  - Varridura automática do DOM procurando atributos:
    - `data-tour-step="1"`
    - `data-tour-title="Meu Título"`
    - `data-tour-content="Explicação deste recurso..."`
    - `data-tour-position="bottom"`
  - Constrói o fluxo do tour automaticamente sem necessidade de configuração prévia em JSON.

---

## 4. Estratégia de Isolamento na Extensão Chrome

* **Shadow DOM**: O Selecto cria uma tag customizada `<div id="selector-extension-root">` na página e anexa um Shadow Root no modo `open`. O CSS da barra lateral flutuante é injetado diretamente dentro do Shadow DOM, garantindo:
  - O estilo do site que está sendo inspecionado **não afeta** os botões e cores da extensão.
  - O estilo do Selecto **não quebra** a formatação da página hospedeira.
* **Comunicação Multi-Frame (IFrames)**:
  - O script de conteúdo escuta cliques em qualquer subquadro da página (`allFrames: true`).
  - O estado de itens capturados e visibilidade é sincronizado através do `chrome.storage.local`.
  - Apenas o quadro superior (`window.self === window.top`) exibe o painel visual.
