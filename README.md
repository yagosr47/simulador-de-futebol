# Gestor FC Pro — Simulador de Gestão e Simulação de Futebol

Jogo completo de simulação de futebol e gerenciamento de clubes desenvolvido em **React 19 + TypeScript + Tailwind CSS + Three.js**, com sistemas profundos e interligados, 14 páginas funcionais independentes, estádio 3D interativo e persistência automática.

## Arquitetura Modular

- `src/types/game.ts`: Tipagem completa de jogadores, atributos, química, contratos, treinamentos, estádio, finanças, competições, leilões, transferências, calendário, enfermaria e histórico.
- `src/engine/`: Camada de regras de negócio e simulação desacoplada da interface:
  - `overall.ts`: Overall ponderado por posição, modificadores temporários visíveis (ex: `82 (-3)`) e força coletiva da equipe.
  - `chemistry.ts`: Química entre jogadores (tempo juntos, posições, nacionalidade/idioma, estilo, tática, relacionamento) e bônus coletivos.
  - `development.ts`: Evolução por curva de idade, auge individual, declínio físico e valorização dinâmica.
  - `training.ts`: 9 modalidades de treinamento, intensidade, fadiga, risco de lesão e comissão técnica especializada.
  - `contracts.ts`: Papéis contratuais (`Titular fixo`, `Titular rotativo`, `Volátil`, `Reserva`, `Jovem promessa`), insatisfação reversível e renegociação.
  - `matchEngine.ts`: Simulação minuto a minuto ao vivo e instantânea com narração dinâmica não repetitiva, estatísticas, substituições e ajustes táticos.
  - `transfers.ts` & `auctions.ts`: Mercado com abertura/fechamento de janelas, pré-acordos futuros, IA de decisão dos jogadores e sala de leilões competitivos.
  - `stadium.ts`: Expansão modular do estádio, obras com prazo/custo e modelo de bilheteria elástica + fator casa.
  - `infirmary.ts`: Lesões, gravidade, estágios clínicos, equipe médica e retorno gradual.
  - `economy.ts`: Finanças integradas (salários, bilheteria, patrocínios, premiações, empréstimos, manutenção e despesas médicas).
  - `aiClubs.ts`: IA autônoma para 15 clubes rivais (contratações, vendas, renovações, base e demissão de treinadores).
  - `calendar.ts`: Calendário interativo, passagem de tempo, competições (Série A, Copa Nacional e Copa Continental) e virada de temporadas.
  - `storage.ts`: Salvamento automático em `localStorage` + backup/importação JSON.
- `src/components/Stadium3DViewer.tsx`: Arena tridimensional interativa em Three.js reagindo em tempo real às expansões e iluminação.
- `src/pages/`: 14 páginas independentes e interligadas.

## Comandos

```bash
npm install
npm run dev      # Servidor de desenvolvimento (0.0.0.0:5173)
npm test         # Testes automatizados dos motores (Vitest)
npm run build    # Type-check + build de produção
```
