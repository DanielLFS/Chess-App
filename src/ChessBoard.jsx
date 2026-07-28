const symbols = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};
const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

export function ChessBoard({ game, orientation, selected, targets, lastMove, disabled, onSquare }) {
  const ranks = orientation === "white" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const boardFiles = orientation === "white" ? files : [...files].reverse();

  return (
    <div className={`board ${disabled ? "disabled" : ""}`} aria-label="Chess board">
      {ranks.flatMap((rank, row) =>
        boardFiles.map((file, col) => {
          const square = `${file}${rank}`;
          const piece = game.get(square);
          const isLight = (files.indexOf(file) + rank) % 2 === 1;
          const target = targets.find((move) => move.to === square);
          const wasMoved = lastMove?.includes(square);
          return (
            <button
              className={[
                "square",
                isLight ? "light" : "dark",
                selected === square ? "selected" : "",
                wasMoved ? "last" : "",
                target ? "target" : "",
                target && piece ? "capture" : "",
              ].join(" ")}
              key={square}
              onClick={() => onSquare(square)}
              disabled={disabled}
              aria-label={`${square}${piece ? ` ${piece.color} ${piece.type}` : ""}`}
            >
              {col === 0 && <span className="rank-label">{rank}</span>}
              {row === 7 && <span className="file-label">{file}</span>}
              {piece && <span className={`piece ${piece.color}`}>{symbols[piece.color][piece.type]}</span>}
            </button>
          );
        }),
      )}
    </div>
  );
}

