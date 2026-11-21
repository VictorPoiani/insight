# Instruções para o Claude neste repositório

## Autoria dos commits (regra do dono do projeto)

- **Tudo que envolver o Insight Nitro** (catálogo, molduras, aberturas, tags, títulos,
  temas, estilos de nome, provador, página de planos, selo, cobrança/assinatura do Nitro
  e arquivos em `src/components/nitro`, `src/lib/nitro`, `src/app/nitro`, `public/nitro`,
  `scripts/nitro-render`) é commitado **como Claude**:
  `git -c user.name=Claude -c user.email=noreply@anthropic.com commit ...` (assinado pelo ambiente).
- **Todo o resto** é commitado em nome do dono:
  `Victor Poiani <153679715+VictorPoiani@users.noreply.github.com>`, sem assinatura
  (`--no-gpg-sign`), para aparecer como contribuição dele no GitHub.
- No início de cada sessão, configure o autor padrão do repositório para o Victor:
  `git config user.name "Victor Poiani" && git config user.email "153679715+VictorPoiani@users.noreply.github.com"`.
- **Nunca** inclua a linha `Co-Authored-By` nas mensagens de commit.
- Se uma mudança misturar Nitro e outra coisa, separe em commits distintos.
- Avisos automáticos de "commit Unverified" para os commits do Victor são esperados
  e não devem ser "corrigidos" trocando o autor para Claude.
