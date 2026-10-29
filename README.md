# Selecto - Element Organizer & Selector Finder

O **Selecto** é uma solução completa para desenvolvedores e engenheiros de QA inspecionarem, organizarem e exportarem seletores HTML (**CSS**, **XPath**, **Playwright** e **Cypress**), além de fornecer SDKs para tours guiados e onboarding interativo.

---

## ⚡ Guia Rápido (Quick Reference)

### Como gerar o pacote (.zip) para atualizar a extensão na Chrome Web Store
```bash
# Opção A: Gerar empacotamento com incremento de versão PATCH:
npm run pack:extension:patch   # Ou: npm run pack:extension -- patch

# Opção B: Gerar empacotamento com incremento de versão MINOR:
npm run pack:extension:minor   # Ou: npm run pack:extension -- minor

# Opção C: Gerar empacotamento com a versão atual:
npm run pack:extension
```
O pacote limpo será criado em `apps/chrome-extension/selecto.zip`. Basta fazer o upload no [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole).

### Como carregar a extensão localmente no Chrome (Modo Desenvolvedor)
1. Execute `npm run copy-sdk --workspace=apps/chrome-extension`.
2. Acesse `chrome://extensions/` no Google Chrome.
3. Ative o **Modo do desenvolvedor** no canto superior direito.
4. Clique em **Carregar sem compactação** e selecione a pasta `projeto/apps/chrome-extension`.

---

## 📚 Documentação Modular

Para detalhes aprofundados sobre cada área, consulte os documentos técnicos dedicados em `docs/`:

* 🧩 **[Extensão Chrome & Publicação](docs/01-extensao-e-publicacao.md)**: Instalação local, processo de empacotamento, envio para a Chrome Web Store, suporte a iframes e Shadow DOM.
* 🛠️ **[Monorepo & Comandos](docs/02-monorepo-e-comandos.md)**: Módulos do workspace (`apps/` e `packages/`), scripts npm do dia a dia e publicação no NPM.
* 🏗️ **[Arquitetura & Pacotes](docs/03-arquitetura-e-pacotes.md)**: Como os SDKs geram os seletores (regras de prioridade semântica) e como o onboarding declarativo funciona.
* 🧪 **[Testes & Sandboxes](docs/04-testes-e-sandbox.md)**: Páginas HTML prontas para validar inspeção, iframes e descoberta de tours.
* 📝 **[Assets da Chrome Store](STORE_LISTING.md)**: Descrições oficiais traduzidas (PT-BR, EN-US, ES) para o cadastro na Chrome Web Store.

---

## 📁 Estrutura do Repositório

```text
Selecto/
├── apps/
│   ├── chrome-extension/      # Extensão Chrome (Manifest V3, Shadow DOM, _locales)
│   ├── dashboard/             # Painel Next.js 16 + Drizzle ORM
│   └── website/               # Landing page e documentação pública
├── packages/
│   ├── selector-sdk/          # SDK puro para extração de seletores (CSS, XPath, Playwright, Cypress)
│   ├── onboarding-sdk/        # SDK de tours interativos e declarativos
│   ├── core/                  # Tipos TypeScript compartilhados
│   └── ui/                    # Componentes UI compartilhados (Tailwind)
├── docs/                      # Guias técnicos modulares
├── scripts/
│   ├── pack-extension.mjs     # Empacotador automatizado do selecto.zip
│   └── bump-version.mjs       # Atualizador sincronizado de versões do monorepo
└── tests/                     # Páginas HTML de sandbox e testes manuais
```

---

## 📄 Licença

Distribuído sob licença MIT. Consulte `LICENSE` para mais detalhes.
