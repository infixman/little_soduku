const sizeButtons = document.querySelectorAll("[data-size]");
const difficultyButtons = document.querySelectorAll("[data-level]");
const boardEl = document.querySelector("#board");
const messageEl = document.querySelector("#message");
const newGameButton = document.querySelector("#new-game");
const undoButton = document.querySelector("#undo-step");
const redoButton = document.querySelector("#redo-step");
const ruleLabel = document.querySelector("#rule-label");
const mobileChoicePanel = document.querySelector("#mobile-choice-panel");
const mobileChoiceTitle = document.querySelector("#mobile-choice-title");
const mobileChoiceGrid = document.querySelector("#mobile-choice-grid");
const mobileChoiceClose = document.querySelector("#mobile-choice-close");
const mobileQuery = window.matchMedia("(max-width: 520px)");

const levels = {
  starter: 0.24,
  easy: 0.36,
  hard: 0.48,
  challenge: 0.6,
  hell: 0.72,
};

const boxShapes = {
  4: { rows: 2, cols: 2 },
  6: { rows: 2, cols: 3 },
  8: { rows: 2, cols: 4 },
  9: { rows: 3, cols: 3 },
};

let size = 4;
let level = "starter";
let puzzleIndex = 0;
let solution = [];
let board = [];
let fixed = [];
let selected = null;
let history = [];
let historyIndex = 0;

function startGame() {
  solution = buildSolution(size, puzzleIndex);
  board = hideCells(solution, levels[level], puzzleIndex);
  fixed = board.map((row) => row.map((value) => value !== 0));
  selected = null;
  history = [cloneGrid(board)];
  historyIndex = 0;

  boardEl.style.setProperty("--size", size);
  boardEl.style.setProperty("--choice-cols", size <= 4 ? 2 : 3);
  boardEl.setAttribute("aria-label", `${size}x${size} 數獨棋盤`);
  ruleLabel.textContent = `${size}x${size} ${hasBoxRule() ? "Sudoku" : "Number Grid"}`;

  messageEl.textContent = hasBoxRule()
    ? "點空格，選一個同行、同列、同宮都沒出現的數字。"
    : "點空格，選一個同行、同列都沒出現的數字。";
  messageEl.classList.remove("win");
  renderBoard();
}

function buildSolution(gridSize, offset) {
  if (boxShapes[gridSize]) {
    return buildSudokuSolution(gridSize, offset);
  }

  return buildLatinSolution(gridSize, offset);
}

function cloneGrid(grid) {
  return grid.map((row) => [...row]);
}

function buildSudokuSolution(gridSize, offset) {
  const shape = boxShapes[gridSize];
  const shift = offset % gridSize;
  return Array.from({ length: gridSize }, (_, row) =>
    Array.from({ length: gridSize }, (_, col) => {
      const base = (row * shape.cols + Math.floor(row / shape.rows) + col + shift) % gridSize;
      return base + 1;
    })
  );
}

function buildLatinSolution(gridSize, offset) {
  const shift = offset % gridSize;
  return Array.from({ length: gridSize }, (_, row) =>
    Array.from({ length: gridSize }, (_, col) => ((row + col + shift) % gridSize) + 1)
  );
}

function hideCells(fullGrid, ratio, seed) {
  const result = fullGrid.map((row) => [...row]);
  const total = size * size;
  const targetHidden = Math.max(size, Math.round(total * ratio));
  const cells = [];

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      cells.push({ row, col, score: seededScore(row, col, seed) });
    }
  }

  cells.sort((a, b) => a.score - b.score);
  cells.slice(0, targetHidden).forEach(({ row, col }) => {
    result[row][col] = 0;
  });

  return result;
}

function seededScore(row, col, seed) {
  const value = Math.sin((row + 1) * 41.17 + (col + 1) * 73.31 + (seed + 1) * 19.89) * 10000;
  return value - Math.floor(value);
}

function renderBoard() {
  boardEl.innerHTML = "";

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const cell = document.createElement("button");
      cell.className = "cell";
      cell.type = "button";
      cell.dataset.row = row;
      cell.dataset.col = col;

      if (isBoxBoundaryRight(col)) cell.classList.add("box-right");
      if (isBoxBoundaryBottom(row)) cell.classList.add("box-bottom");

      if (fixed[row][col]) {
        cell.classList.add("given");
        cell.textContent = board[row][col];
        cell.setAttribute("aria-label", `固定數字 ${board[row][col]}`);
      } else if (board[row][col]) {
        cell.textContent = board[row][col];
        cell.setAttribute("aria-label", `你填的數字 ${board[row][col]}`);
      } else {
        cell.classList.add("empty");
        cell.setAttribute("aria-label", "空格");
      }

      if (selected?.row === row && selected?.col === col) {
        cell.classList.add("selected");
        showChoices(cell, row, col);
      }

      cell.addEventListener("click", () => selectCell(row, col));
      boardEl.append(cell);
    }
  }

  markSingleChoiceCells();
  renderMobileChoices();
}

function isBoxBoundaryRight(col) {
  const shape = boxShapes[size];
  return shape && col < size - 1 && (col + 1) % shape.cols === 0;
}

function isBoxBoundaryBottom(row) {
  const shape = boxShapes[size];
  return shape && row < size - 1 && (row + 1) % shape.rows === 0;
}

function hasBoxRule() {
  return Boolean(boxShapes[size]);
}

function selectCell(row, col) {
  if (fixed[row][col]) return;

  selected = selected?.row === row && selected?.col === col ? null : { row, col };
  messageEl.textContent = board[row][col] ? "可以重新選一個數字。" : "選一個目前可以放的數字。";
  messageEl.classList.remove("win");
  renderBoard();
}

function showChoices(cell, row, col) {
  if (isMobileChoiceMode()) return;

  const choices = getLegalChoices(row, col);
  const box = document.createElement("div");
  box.className = "choices";

  if (board[row][col]) {
    const clear = document.createElement("button");
    clear.className = "choice";
    clear.type = "button";
    clear.textContent = "清";
    clear.setAttribute("aria-label", "清除這格");
    clear.addEventListener("click", (event) => {
      event.stopPropagation();
      board[row][col] = 0;
      selected = null;
      messageEl.textContent = "清掉了，可以再想一次。";
      saveStep();
    });
    box.append(clear);
  }

  choices.forEach((number) => {
    const choice = document.createElement("button");
    choice.className = "choice";
    choice.type = "button";
    choice.textContent = number;
    choice.setAttribute("aria-label", `填入 ${number}`);
    choice.addEventListener("click", (event) => {
      event.stopPropagation();
      fillCell(row, col, number);
    });
    box.append(choice);
  });

  if (choices.length === 0 && !board[row][col]) {
    messageEl.textContent = "這格暫時沒有可放的數字，先看別格。";
  }

  cell.append(box);
}

function renderMobileChoices() {
  if (!isMobileChoiceMode() || !selected) {
    hideMobileChoices();
    return;
  }

  const { row, col } = selected;
  const choices = getLegalChoices(row, col);
  mobileChoiceGrid.innerHTML = "";
  mobileChoicePanel.hidden = false;
  mobileChoiceTitle.textContent = `第 ${row + 1} 排，第 ${col + 1} 格`;

  if (board[row][col]) {
    mobileChoiceGrid.append(createMobileChoiceButton("清", "清除這格", () => {
      board[row][col] = 0;
      selected = null;
      messageEl.textContent = "清掉了，可以再想一次。";
      saveStep();
    }));
  }

  choices.forEach((number) => {
    mobileChoiceGrid.append(createMobileChoiceButton(number, `填入 ${number}`, () => {
      fillCell(row, col, number);
    }));
  });

  if (choices.length === 0 && !board[row][col]) {
    messageEl.textContent = "這格暫時沒有可放的數字，先看別格。";
  }
}

function createMobileChoiceButton(label, ariaLabel, onClick) {
  const button = document.createElement("button");
  button.className = "choice";
  button.type = "button";
  button.textContent = label;
  button.setAttribute("aria-label", ariaLabel);
  button.addEventListener("click", onClick);
  return button;
}

function hideMobileChoices() {
  mobileChoicePanel.hidden = true;
  mobileChoiceGrid.innerHTML = "";
}

function isMobileChoiceMode() {
  return mobileQuery.matches;
}

function getLegalChoices(row, col) {
  const used = new Set();

  for (let index = 0; index < size; index += 1) {
    addUsed(used, board[row][index], row, index, row, col);
    addUsed(used, board[index][col], index, col, row, col);
  }

  const shape = boxShapes[size];
  if (shape) {
    const boxRow = Math.floor(row / shape.rows) * shape.rows;
    const boxCol = Math.floor(col / shape.cols) * shape.cols;
    for (let r = boxRow; r < boxRow + shape.rows; r += 1) {
      for (let c = boxCol; c < boxCol + shape.cols; c += 1) {
        addUsed(used, board[r][c], r, c, row, col);
      }
    }
  }

  return Array.from({ length: size }, (_, index) => index + 1).filter((number) => !used.has(number));
}

function addUsed(used, value, valueRow, valueCol, row, col) {
  if (value && (valueRow !== row || valueCol !== col)) {
    used.add(value);
  }
}

function fillCell(row, col, number) {
  if (board[row][col] === number) {
    selected = null;
    renderBoard();
    return;
  }

  board[row][col] = number;
  selected = null;

  if (isComplete()) {
    messageEl.textContent = "完成了！換一題繼續玩。";
    messageEl.classList.add("win");
  } else {
    messageEl.textContent = number === solution[row][col]
      ? "很好，繼續找下一格。"
      : "這個數字可以放，但再想想答案對不對。";
    messageEl.classList.toggle("win", number === solution[row][col]);
  }

  saveStep();
}

function saveStep() {
  history = history.slice(0, historyIndex + 1);
  history.push(cloneGrid(board));
  historyIndex = history.length - 1;
  renderBoard();
}

function moveHistory(direction) {
  const nextIndex = historyIndex + direction;
  if (nextIndex < 0 || nextIndex >= history.length) return;

  historyIndex = nextIndex;
  board = cloneGrid(history[historyIndex]);
  selected = null;
  messageEl.textContent = direction < 0 ? "回到上一步。" : "前進到下一步。";
  messageEl.classList.remove("win");
  renderBoard();
}

function isComplete() {
  return board.every((row, rowIndex) =>
    row.every((value, colIndex) => value === solution[rowIndex][colIndex])
  );
}

function markSingleChoiceCells() {
  document.querySelectorAll(".cell.empty").forEach((cell) => {
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    if (getLegalChoices(row, col).length === 1) {
      cell.classList.add("single-choice");
    }
  });

  updateHistoryButtons();
}

function updateHistoryButtons() {
  undoButton.disabled = historyIndex === 0;
  redoButton.disabled = historyIndex >= history.length - 1;
}

sizeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    sizeButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    size = Number(button.dataset.size);
    puzzleIndex = 0;
    startGame();
  });
});

difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    difficultyButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    level = button.dataset.level;
    puzzleIndex = 0;
    startGame();
  });
});

newGameButton.addEventListener("click", () => {
  puzzleIndex += 1;
  startGame();
});

undoButton.addEventListener("click", () => moveHistory(-1));
redoButton.addEventListener("click", () => moveHistory(1));
mobileChoiceClose.addEventListener("click", () => {
  selected = null;
  renderBoard();
});
mobileQuery.addEventListener("change", renderBoard);

startGame();
