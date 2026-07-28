# Chess Lab

A modern chess interface backed by a Stockfish engine running on a self-hosted
home server. The static React application is deployed through GitHub Pages;
move validation and engine computation use the public API in
[Chess-App-Self-Host-Server](https://github.com/DanielLFS/Chess-App-Self-Host-Server).

## Highlights

- Play either colour against server-side Stockfish.
- Three engine-time profiles.
- Legal-move highlighting, last-move state, undo, and game-over reporting.
- Three-line position analysis with centipawn or mate scores.
- Responsive interface with no chess engine downloaded to the browser.
- Automated lint/build/deployment with GitHub Actions.

## Development

```bash
cp .env.example .env
npm install
npm run dev
```

## Architecture

```text
GitHub Pages (React + chess.js)
           │ HTTPS / JSON
           ▼
Home server (Nginx → FastAPI → Stockfish)
           │
           └── Prometheus metrics → Grafana
```

The frontend keeps interaction responsive, but the API independently validates
every submitted move. Stockfish and server infrastructure remain outside the
browser.

