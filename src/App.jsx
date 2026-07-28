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
  const [game, setGame] = useState(() => new Chess());
  const [history, setHistory] = useState([new Chess().fen()]);
  const [selected, setSelected] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  const [playerColor, setPlayerColor] = useState("white");
  const [level, setLevel] = useState(1);
  const [thinking, setThinking] = useState(false);
  const [analysis, setAnalysis] = useState([]);
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
        controller.current.signal,
      );
      const next = new Chess(position.fen());
      next.move(result.move.uci);
      setLastMove(result.move.uci);
      replaceGame(next);
      setAnalysis([result.analysis]);
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
      const result = await chessApi.analyze(game.fen(), levels[level].time, 3);
      setAnalysis(result.lines);
      setMessage(`Analysis complete · ${result.elapsed_ms} ms`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setThinking(false);
    }
  }

  function newGame(color = playerColor) {
    controller.current?.abort();
    const next = new Chess();
    setGame(next);
    setHistory([next.fen()]);
    setLastMove(null);
    setSelected(null);
    setAnalysis([]);
    setMessage(color === "white" ? "Your move" : "Server opens");
    if (color === "black") askEngine(next);
  }

  function changeColor(color) {
    setPlayerColor(color);
    newGame(color);
  }

  function undo() {
    if (history.length < 3 || thinking) return;
    const remaining = history.slice(0, -2);
    const next = new Chess(remaining.at(-1));
    setHistory(remaining);
    setGame(next);
    setLastMove(null);
    setAnalysis([]);
    setMessage("Position restored");
  }

  return (
    <main className="app-shell">
      <header>
        <div>
          <p className="kicker">SELF-HOSTED ENGINE</p>
          <h1>Chess Lab<span>.</span></h1>
        </div>
        <a href="https://github.com/DanielLFS" target="_blank" rel="noreferrer">View source ↗</a>
      </header>

      <section className="workspace">
        <div className="board-column">
          <div className="player"><span className="avatar dark-avatar">SF</span><div><strong>Stockfish</strong><small>Home server · {levels[level].label}</small></div></div>
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
              <h2>Game controls</h2>
              <label>Play as</label>
              <div className="segmented">
                {["white", "black"].map((color) => <button className={playerColor === color ? "active" : ""} onClick={() => changeColor(color)} key={color}>{color}</button>)}
              </div>
              <label>Engine time</label>
              <div className="segmented">
                {levels.map((item, index) => <button className={level === index ? "active" : ""} onClick={() => setLevel(index)} key={item.label}>{item.label}</button>)}
              </div>
              <div className="actions">
                <button className="primary" onClick={() => newGame()}>New game</button>
                <button onClick={undo} disabled={history.length < 3 || thinking}>Undo turn</button>
                <button onClick={analyze} disabled={thinking}>Analyse</button>
              </div>
            </section>

            <section>
              <h2>Engine lines</h2>
              {analysis.length ? analysis.map((line, index) => (
                <div className="line" key={`${line.depth}-${index}`}>
                  <b>{scoreText(line)}</b>
                  <p>{line.moves.map((move) => move.san).join(" ")}</p>
                  <small>Depth {line.depth}</small>
                </div>
              )) : <p className="empty">Run analysis to compare Stockfish’s top three continuations.</p>}
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
      <footer><span>React · FastAPI · Stockfish · Prometheus</span><span>Built by DanielLFS</span></footer>
    </main>
  );
}

function gameResult(game) {
  if (game.isCheckmate()) return `Checkmate · ${game.turn() === "w" ? "Black" : "White"} wins`;
  if (game.isDraw()) return "Draw";
  return "Game over";
}
