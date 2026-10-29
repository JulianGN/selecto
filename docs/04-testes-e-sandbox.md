# 🧪 Páginas de Teste e Sandboxes Locais

O diretório `projeto/tests/` contém páginas HTML interativas prontas para validar manualmente o comportamento da extensão e dos SDKs sem necessidade de subir servidores complexos.

---

## 1. Páginas Disponíveis

| Arquivo | Finalidade | Como testar |
| :--- | :--- | :--- |
| **`tests/test-discovery.html`** | Testa a descoberta automática de tours declarativos (`data-tour-*`) usando o `onboarding-sdk`. | Abra o arquivo no navegador e clique em **"Iniciar Tour Descoberto"**. |
| **`tests/test-iframe.html`** | Valida a inspeção e captura de seletores dentro de `<iframe>` aninhados com a extensão Chrome ativa. | Abra no navegador com a extensão Selecto carregada e ative a inspeção. |
| **`tests/test-sdk.html`** | Sandbox visual para testar o algoritmo de geração de seletores contra vários tipos de inputs, botões e tabelas. | Abra no navegador e use a área interativa para simular seleções. |
| **`tests/test-all.html`** | Suíte integrada de testes visuais dos componentes. | Carregamento direto no navegador. |

---

## 2. Como Abrir as Páginas no Chrome

Você pode abrir qualquer uma das páginas diretamente arrastando o arquivo `.html` para dentro de uma aba do Google Chrome ou abrindo via terminal:

```bash
# No Windows PowerShell (a partir de projeto/):
Start-Process "chrome.exe" "file://$((Get-Item tests/test-iframe.html).FullName)"
```

Ao inspecionar a página com a extensão Selecto ativa, você verá os destaques em azul e os seletores sendo adicionados na barra flutuante.
