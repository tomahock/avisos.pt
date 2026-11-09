# Contribuir para o Avisos.pt

Obrigado por quereres ajudar! 🌦️

O Avisos.pt é código aberto e mantido por voluntários. Toda a ajuda conta: código, design, textos, testes em telemóvel, ou simplesmente avisar quando algo está errado.

## Sem programar

- **Encontraste um erro** (um aviso que não aparece, uma estação no distrito errado, um texto confuso)? Abre um [issue](https://github.com/tomahock/avisos.pt/issues/new) com o link da página e, se possível, uma captura de ecrã.
- **Tens uma ideia**? Abre um issue a descrever o problema que resolve.

## Com código

1. Escolhe um [issue aberto](https://github.com/tomahock/avisos.pt/issues) (ou abre um) e comenta que vais pegar nele, para não haver trabalho duplicado.
2. Faz fork do repositório e cria um branch a partir de `main` (ex.: `feat/rankings-vento`, `fix/estacao-sem-leitura`).
3. Prepara o ambiente:

   ```bash
   npm install
   cp .dev.vars.example .dev.vars   # põe aqui a tua FOGOS_API_KEY (pede em https://fogos.pt/pt/api)
   npm run dev:cf                   # site + funções em http://localhost:8788
   ```

   Sem chave, podes apontar as funções para um servidor falso com `FOGOS_API_BASE` (ver `.dev.vars.example`).

4. Antes de abrir o PR:

   ```bash
   npm run lint
   npm run build
   ```

   e confirma no browser que as páginas que mexeste funcionam (incluindo em largura de telemóvel).

5. Abre um Pull Request para `main` com:
   - o que muda e porquê;
   - `Closes #<número do issue>`;
   - como testaste.

O Cloudflare Pages cria automaticamente um preview do PR.

### Convenções

- **Tabs** e **sem ponto e vírgula** (`.editorconfig` + `.prettierrc`).
- Commits no formato `tipo(âmbito): descrição (#issue)`, ex.: `fix(mapa): ícone da Costa Sul fora do mapa (#11)`.
- Classes do Tailwind sempre como strings completas (nunca concatenadas) — ver `src/data/levels.js`.
- Código partilhado entre browser e funções (`src/utils/share.js`, `src/utils/stations.js`) não pode usar DOM nem React.
- Os slugs dos distritos e das estações são URLs públicos: não os mudes.
- Textos do site em português de Portugal.

A arquitetura está descrita em [`CLAUDE.md`](CLAUDE.md).

## Licença das contribuições

Ao contribuíres, aceitas que a tua contribuição é publicada nos termos da [GNU AGPL-3.0-or-later](LICENSE), com o termo de atribuição descrito em [`NOTICE`](NOTICE) — a mesma licença do resto do projeto.
