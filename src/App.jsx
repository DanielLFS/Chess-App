import { useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { chessApi } from "./api";
import { ChessBoard } from "./ChessBoard";
import "./styles.css";

const levels = [
  { label: "Quick", time: 100 },
  { label: "Balanced", time: 400 },
  { label: "Deep", time: 1200 },
];

function scoreText(line) {
  if (line.mate !== null) return `Mate ${Math.abs(line.mate)}`;
  const score = (line.score_cp || 0) / 100;
  return `${score >= 0 ? "+" : ""}${score.toFixed(2)}`;
}

export default function App() {
  const [phase, setPhase] = useState("setup");
  const [game, setGame] = useState(() => new Chess());
  const [history, setHistory] = useState([new Chess().fen()]);
  const [selected, setSelected] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  const [playerColor, setPlayerColor] = useState("white");
  const [level, setLevel] = useState(1);
  const [engineName, setEngineName] = useState("daniel");
  const [thinking, setThinking] = useState(false);
  const [analysis, setAnalysis] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [message, setMessage] = useState("Your move");
  const controller = useRef(null);

  const targets = useMemo(
    () => (selected ? game.moves({ square: selected, verbose: true }) : []),
    [game, selected],
  );
  const moves = game.history();

  function replaceGame(next, addHistory = true) {
    setGame(next);
    if (addHistory) setHistory((items) => [...items, next.fen()]);
  }

  async function askEngine(position) {
    if (position.isGameOver()) return;
    setThinking(true);
    setMessage("Server is thinking…");
    controller.current = new AbortController();
    try {
      const result = await chessApi.engineMove(
        position.fen(),
        levels[level].time,
        engineName,
        controller.current.signal,
      );
      const next = new Chess(position.fen());
      next.move(result.move.uci);
      setLastMove(result.move.uci);
      replaceGame(next);
      setAnalysis([result.analysis]);
      setMetrics(result.metrics);
      setMessage(next.isGameOver() ? gameResult(next) : "Your move");
    } catch (error) {
      if (error.name !== "AbortError") setMessage(error.message);
    } finally {
      setThinking(false);
    }
  }

  async function makeMove(from, to) {
    const before = game.fen();
    const candidates = game.moves({ square: from, verbose: true }).filter((move) => move.to === to);
    if (!candidates.length) return false;
    const promotion = candidates.some((move) => move.promotion) ? "q" : undefined;
    const preview = new Chess(before);
    const played = preview.move({ from, to, promotion });
    if (!played) return false;
    setThinking(true);
    try {
      await chessApi.validateMove(before, played.lan);
      setLastMove(played.lan);
      replaceGame(preview);
      setSelected(null);
      setAnalysis([]);
      setMetrics(null);
      if (preview.isGameOver()) setMessage(gameResult(preview));
      else if (preview.turn() !== playerColor[0]) await askEngine(preview);
      return true;
    } catch (error) {
      setMessage(error.message);
      return false;
    } finally {
      setThinking(false);
    }
  }

  async function selectSquare(square) {
    if (thinking || game.isGameOver() || game.turn() !== playerColor[0]) return;
    const piece = game.get(square);
    if (selected && await makeMove(selected, square)) return;
    setSelected(piece?.color === playerColor[0] ? square : null);
  }

  async function analyze() {
    setThinking(true);
    setMessage("Analysing position…");
    try {
      const multipv = engineName === "stockfish" ? 3 : 1;
      const result = await chessApi.analyze(
        game.fen(),
        levels[level].time,
        multipv,
        engineName,
      );
      setAnalysis(result.lines);
      setMetrics(result.metrics);
      setMessage(`Analysis complete · ${result.elapsed_ms} ms`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setThinking(false);
    }
  }

  function startMatch() {
    controller.current?.abort();
    const next = new Chess();
    setGame(next);
    setHistory([next.fen()]);
    setLastMove(null);
    setSelected(null);
    setAnalysis([]);
    setMetrics(null);
    setMessage(playerColor === "white" ? "Your move" : "Server opens");
    setPhase("playing");
    if (playerColor === "black") setTimeout(() => askEngine(next), 0);
  }

  function leaveMatch() {
    controller.current?.abort();
    setThinking(false);
    setPhase("setup");
  }

  function undo() {
    if (history.length < 3 || thinking) return;
    const remaining = history.slice(0, -2);
    const next = new Chess(remaining.at(-1));
    setHistory(remaining);
    setGame(next);
    setLastMove(null);
    setAnalysis([]);
    setMetrics(null);
    setMessage("Position restored");
  }

  return (
    <main className="app-shell">
      <header>
        <div>
          <p className="kicker">SELF-HOSTED ENGINE</p>
          <h1>Chess Lab<span>.</span></h1>
        </div>
        <a href="https://github.com/DanielLFS/Chess-App" target="_blank" rel="noreferrer">View source ↗</a>
      </header>

      {phase === "setup" ? (
        <section className="match-setup">
          <div className="setup-intro">
            <p className="setup-number">MATCH / 001</p>
            <h2 aria-label="Build your opening position">Build your<br />opening position.</h2>
            <p>Choose the opponent, your side, and how far the server should search. These settings lock when the match begins.</p>
            <div className="setup-engine-note">
              <span>LIVE SERVER</span>
              <strong>{engineName === "daniel" ? "Custom Numba engine" : "Stockfish 17 reference"}</strong>
              <small>{engineName === "daniel" ? "Bitboards · alpha-beta · visible metrics" : "External benchmark and playing-strength reference"}</small>
            </div>
          </div>

          <div className="setup-card">
            <div className="setup-heading"><span>Configure match</span><b>01—03</b></div>
            <fieldset>
              <legend><span>01</span> Choose opponent</legend>
              <div className="choice-grid engine-choices">
                <button aria-label="Daniel Engine" className={engineName === "daniel" ? "selected-choice" : ""} onClick={() => setEngineName("daniel")}>
                  <b>DE</b><strong>Daniel Engine</strong><small>Custom build · live NPS</small>
                </button>
                <button aria-label="Stockfish" className={engineName === "stockfish" ? "selected-choice" : ""} onClick={() => setEngineName("stockfish")}>
                  <b>SF</b><strong>Stockfish 17</strong><small>Reference engine</small>
                </button>
              </div>
            </fieldset>
            <fieldset>
              <legend><span>02</span> Take a side</legend>
              <div className="choice-grid side-choices">
                {["white", "black"].map((color) => (
                  <button aria-label={`Play as ${color}`} className={playerColor === color ? "selected-choice" : ""} onClick={() => setPlayerColor(color)} key={color}>
                    <b>{color === "white" ? "♙" : "♟"}</b><strong>{color}</strong><small>{color === "white" ? "You open" : "Engine opens"}</small>
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend><span>03</span> Search profile</legend>
              <div className="depth-choices">
                {levels.map((item, index) => (
                  <button aria-label={`${item.label} search`} className={level === index ? "selected-choice" : ""} onClick={() => setLevel(index)} key={item.label}>
                    <strong>{item.label}</strong><small>{item.time} ms profile</small>
                  </button>
                ))}
              </div>
            </fieldset>
            <button aria-label="Start match" className="launch-match" onClick={startMatch}><span>Start match</span><b>→</b></button>
            <p className="lock-note">Configuration is locked during play.</p>
          </div>
        </section>
      ) : (
        <>
      <section className="workspace">
        <div className="board-column">
          <div className="player"><span className="avatar dark-avatar">{engineName === "daniel" ? "DE" : "SF"}</span><div><strong>{engineName === "daniel" ? "Daniel Engine" : "Stockfish 17"}</strong><small>Home server · {levels[level].label}</small></div></div>
          <ChessBoard
            game={game}
            orientation={playerColor}
            selected={selected}
            targets={targets}
            lastMove={lastMove}
            disabled={thinking}
            onSquare={selectSquare}
          />
          <div className="player"><span className="avatar">YOU</span><div><strong>You</strong><small>{playerColor === "white" ? "White" : "Black"}</small></div></div>
        </div>

        <aside>
          <div className="status-row"><span className={thinking ? "pulse" : ""}></span>{message}</div>
          <div className="tabs">
            <section>
              <div className="match-heading">
                <h2>Match card</h2><span>LOCKED</span>
              </div>
              <dl className="match-card">
                <div><dt>Opponent</dt><dd>{engineName === "daniel" ? "Daniel Engine" : "Stockfish 17"}</dd></div>
                <div><dt>Your side</dt><dd>{playerColor}</dd></div>
                <div><dt>Search</dt><dd>{levels[level].label}</dd></div>
              </dl>
              <div className="actions">
                <button className="primary" onClick={leaveMatch}>New match</button>
                <button onClick={undo} disabled={history.length < 3 || thinking}>Undo turn</button>
                <button onClick={analyze} disabled={thinking}>Analyse</button>
              </div>
            </section>

            <section>
              <h2>Live search metrics</h2>
              {metrics ? (
                <div className="metrics-grid">
                  <div><strong>{metrics.engine === "daniel" ? "Daniel" : "Stockfish"}</strong><small>Engine</small></div>
                  <div><strong>{metrics.depth}</strong><small>Depth</small></div>
                  <div><strong>{metrics.nodes?.toLocaleString() || "UCI"}</strong><small>Nodes</small></div>
                  <div><strong>{metrics.nodes_per_second ? `${(metrics.nodes_per_second / 1000).toFixed(1)}k` : "—"}</strong><small>NPS</small></div>
                  <div><strong>{metrics.elapsed_ms} ms</strong><small>Search</small></div>
                  <div><strong>{metrics.beta_cutoffs?.toLocaleString() || "—"}</strong><small>β cutoffs</small></div>
                </div>
              ) : <p className="empty">Metrics appear after the server searches a position.</p>}
            </section>

            <section>
              <h2>Engine lines</h2>
              {analysis.length ? analysis.map((line, index) => (
                <div className="line" key={`${line.depth}-${index}`}>
                  <b>{scoreText(line)}</b>
                  <p>{line.moves.map((move) => move.san).join(" ")}</p>
                  <small>Depth {line.depth}</small>
                </div>
              )) : <p className="empty">Run analysis to inspect the selected engine’s continuation.</p>}
            </section>

            <section>
              <h2>Moves</h2>
              <div className="move-list">
                {moves.length ? moves.map((move, index) => <span key={`${move}-${index}`}><b>{index % 2 === 0 ? `${Math.floor(index / 2) + 1}.` : ""}</b>{move}</span>) : <p className="empty">The game has not started yet.</p>}
              </div>
            </section>
          </div>
        </aside>
      </section>
      <section className="benchmark-strip">
        <div><span>CUSTOM MOVEGEN</span><strong>3.43M NPS</strong><small>Kiwipete · depth 5</small></div>
        <div><span>STOCKFISH MOVEGEN</span><strong>193.21M NPS</strong><small>Same position and limits</small></div>
        <div><span>COMPILED SEARCH</span><strong>~118K NPS</strong><small>Current alpha-beta core</small></div>
        <a href="https://github.com/DanielLFS/Chess-App-Self-Host-Server/blob/main/ENGINE_REPORT.md" target="_blank" rel="noreferrer">Read engineering report ↗</a>
      </section>
        </>
      )}
      <footer><span>React · FastAPI · Numba · Bitboards · Stockfish · Prometheus</span><span>Built by DanielLFS</span></footer>
    </main>
  );
}

function gameResult(game) {
  if (game.isCheckmate()) return `Checkmate · ${game.turn() === "w" ? "Black" : "White"} wins`;
  if (game.isDraw()) return "Draw";
  return "Game over";
}
