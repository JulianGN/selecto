# 🧩 Extensão Chrome: Desenvolvimento, Empacotamento e Publicação

Este guia direto ao ponto descreve como rodar a extensão **Selecto** em modo desenvolvedor, como gerar o pacote `.zip` para atualização na **Chrome Web Store** e quais são os cuidados essenciais.

---

## 1. Como Carregar a Extensão Localmente (Modo Desenvolvedor)

1. Garanta que o SDK da extensão esteja sincronizado:
   ```bash
   npm run copy-sdk --workspace=apps/chrome-extension
   ```
2. Abra o Google Chrome e acesse:
   ```text
   chrome://extensions/
   ```
3. Ative a chave **Modo do desenvolvedor** (Developer mode) no canto superior direito.
4. Clique no botão **Carregar sem compactação** (Load unpacked) no canto superior esquerdo.
5. Selecione a pasta:
   ```text
   projeto/apps/chrome-extension
   ```
6. O ícone do **Selecto** estará ativo na barra de ferramentas do Chrome.
7. Ao alterar código em `content.js`, `background.js` ou `popup.js`, clique no botão **Recarregar (ícone de seta circular)** no card da extensão em `chrome://extensions/`.

---

## 2. Como Gerar o Pack (.zip) para Atualização na Chrome Web Store

Para atualizar a extensão na loja, você deve enviar um arquivo `.zip` limpo, sem arquivos desnecessários (`package.json`, testes ou pastas de build).

### Comando Único (com ou sem bump de versão):

Você pode gerar o pacote mantendo a versão atual ou passando o incremento de versão desejado no próprio comando:

```bash
# 1. Empacotar incrementando versão PATCH (ex: 1.1.0 -> 1.1.1):
npm run pack:extension:patch
# ou via argumento:
npm run pack:extension -- patch     # aceita também: bump-patch, --patch

# 2. Empacotar incrementando versão MINOR (ex: 1.1.0 -> 1.2.0):
npm run pack:extension:minor
# ou via argumento:
npm run pack:extension -- minor     # aceita também: bump-minor, --minor

# 3. Empacotar mantendo a versão atual (sem bump):
npm run pack:extension
```

### O que o script faz automaticamente:
1. Se foi passado `patch`, `minor`, `major` (ou prefixado com `bump-`):
   - Atualiza o `manifest.json` da extensão e todos os `package.json` do monorepo de forma sincronizada.
2. Copia a versão mais recente de `packages/selector-sdk/selector-sdk.js` para `apps/chrome-extension/`.
3. Remove qualquer `selecto.zip` anterior para evitar zips aninhados.
4. Gera o arquivo final:
   ```text
   projeto/apps/chrome-extension/selecto.zip
   ```
5. Inclui **apenas** os arquivos exigidos pela Chrome Web Store:
   - `manifest.json`
   - `background.js` (Service Worker)
   - `content.js` (UI injetada via Shadow DOM e escuta de eventos)
   - `selector-sdk.js` (Módulo gerador de seletores)
   - `popup.html`, `popup.css`, `popup.js` (Menu da barra do navegador)
   - `_locales/` (`en`, `es`, `pt_BR`)
   - `icon-16.png`, `icon-48.png`, `icon-128.png`, `icon-active-*.png`
   - `LICENSE`

---

## 3. Checklist de Publicação na Chrome Web Store

1. Acesse o [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Selecione o item **Selecto - XPath & CSS Selector Organizer**.
3. No menu lateral, acesse **Pacote (Package)** e clique em **Carregar novo pacote (Upload new package)**.
4. Selecione o arquivo recém-gerado: `apps/chrome-extension/selecto.zip`.
5. Se houver novidades na descrição ou imagens promocionais:
   - Os textos em Português, Inglês e Espanhol já revisados estão centralizados em `projeto/STORE_LISTING.md`.
   - As imagens oficiais de divulgação estão no diretório `identidade/`.
6. Clique em **Enviar para análise (Submit for review)**.

---

## 4. Detalhes Técnicos Relevantes da Extensão

* **Suporte a IFrames (`allFrames: true`)**:
  - A extensão injeta `content.js` e `selector-sdk.js` em todos os quadros da página (`allFrames: true`).
  - O painel visual flutuante (Sidebar) é renderizado **apenas no topo** (`window.self === window.top`).
  - As seleções feitas dentro de `<iframe>` são sincronizadas com a barra lateral principal em tempo real usando `chrome.storage.local` e o listener `chrome.storage.onChanged`.
* **Isolamento via Shadow DOM**:
  - Todo o estilo da barra lateral e dos cards do Selecto fica contido em um `ShadowRoot` fechado contra vazamento de CSS da página hospedeira.
* **Internacionalização**:
  - Todos os textos da interface e notificações utilizam `chrome.i18n.getMessage(...)`, alimentados pelos arquivos em `_locales/`.
