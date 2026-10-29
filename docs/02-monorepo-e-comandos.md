# 🛠️ Monorepo: Estrutura e Comandos

O **Selecto** é estruturado como um monorepo npm unificado, contendo a extensão Chrome, os SDKs clientes e as aplicações web de apoio.

---

## 1. Mapa de Módulos (Workspaces)

### Aplicações (`apps/`)
* **`apps/chrome-extension`**: Extensão para Google Chrome (Manifest V3, Shadow DOM, multilíngue).
* **`apps/dashboard`**: Painel administrativo em **Next.js 16 (App Router)** e **Drizzle ORM** para gerenciamento de fluxos e visualização de onboarding.
* **`apps/website`**: Landing page e documentação pública do produto.

### Pacotes (`packages/`)
* **`packages/selector-sdk`**: Biblioteca JavaScript pura (zero dependências) que inspeciona elementos do DOM e calcula seletores únicos (CSS, XPath, Playwright e Cypress).
* **`packages/onboarding-sdk`**: SDK para execução de tours guiados e onboarding interativo (gera bundles CJS, ESM e IIFE com suporte declarativo via `data-tour-*`).
* **`packages/core`**: Tipos compartilhados TypeScript e utilitários de domínio.
* **`packages/ui`**: Componentes de interface compartilhados (Tailwind CSS).

---

## 2. Comandos do Dia a Dia

Executar a partir da pasta raiz `projeto/`:

### Desenvolvimento
```bash
# Executa dashboard, website e onboarding-sdk em modo watch simultaneamente:
npm run dev

# Ou inicie cada aplicação individualmente:
npm run dev:dashboard   # Painel Next.js (http://localhost:3000)
npm run dev:website     # Site público
npm run dev:sdk         # Compilação contínua do Onboarding SDK via tsup
```

### Compilação e Empacotamento
```bash
# Compilar Onboarding SDK (gera dist/ CJS, ESM e IIFE):
npm run build:sdk

# Compilar Landing Page:
npm run build:website

# Empacotar extensão Chrome para envio à Chrome Web Store (gera selecto.zip):
npm run pack:extension

# Sincronizar apenas o arquivo selector-sdk.js com a pasta da extensão:
npm run copy-sdk --workspace=apps/chrome-extension
```

---

## 3. Gestão de Versões (Bump Sincronizado)

Todas as dependências e o `manifest.json` da extensão são mantidos rigorosamente alinhados através do utilitário `scripts/bump-version.mjs`.

```bash
# Incrementa versão de patch (ex: 1.1.0 -> 1.1.1):
npm run bump-version patch

# Incrementa versão minor (ex: 1.1.0 -> 1.2.0):
npm run bump-version minor

# Incrementa versão major (ex: 1.1.0 -> 2.0.0):
npm run bump-version major
```

Após o bump:
1. Revise as alterações com `git diff`.
2. Faça o commit: `git commit -am "chore: bump version to x.y.z"`.
3. Crie a tag: `git tag vx.y.z`.

---

## 4. Publicação dos SDKs no NPM

Quando houver alterações nos pacotes públicos disponibilizados para desenvolvedores:

```bash
# Publicar pacote selector-sdk no NPM:
npm run publish:selector

# Compilar e publicar o pacote selecto-onboarding-sdk no NPM:
npm run publish:onboarding
```
