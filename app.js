const appButtons = document.querySelectorAll("[data-app]");
const sizeButtons = document.querySelectorAll("[data-size]");
const modeButtons = document.querySelectorAll("[data-mode]");
const difficultyButtons = document.querySelectorAll("[data-level]");
const gradeButtons = document.querySelectorAll("[data-grade]");
const operatorButtons = document.querySelectorAll("[data-operator]");
const mazeSizeButtons = document.querySelectorAll("[data-maze-size]");
const fogButtons = document.querySelectorAll("[data-fog-size]");
const boardEl = document.querySelector("#board");
const messageEl = document.querySelector("#message");
const newGameButton = document.querySelector("#new-game");
const undoButton = document.querySelector("#undo-step");
const redoButton = document.querySelector("#redo-step");
const ruleLabel = document.querySelector("#rule-label");
const gameTitle = document.querySelector("#game-title");
const sudokuGame = document.querySelector(".sudoku-game");
const mazeGame = document.querySelector(".maze-game");
const mazePathEl = document.querySelector("#maze-path");
const mazeProgressEl = document.querySelector("#maze-progress");
const mazeQuestionEl = document.querySelector("#maze-question");
const answerGridEl = document.querySelector("#answer-grid");
const mazeMessageEl = document.querySelector("#maze-message");
const mobileChoicePanel = document.querySelector("#mobile-choice-panel");
const mobileChoiceTitle = document.querySelector("#mobile-choice-title");
const mobileChoiceGrid = document.querySelector("#mobile-choice-grid");
const mobileChoiceClose = document.querySelector("#mobile-choice-close");
const celebrationEl = document.querySelector("#celebration");
const appTabs = document.querySelector(".app-tabs");
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

const mazeDirections = [
  { key: "up", label: "上", row: -1, col: 0 },
  { key: "right", label: "右", row: 0, col: 1 },
  { key: "down", label: "下", row: 1, col: 0 },
  { key: "left", label: "左", row: 0, col: -1 },
];

let size = 4;
let mode = "sudoku";
let level = "starter";
let activeApp = "sudoku";
let mazeGrade = 1;
let mazeOperator = "add";
let mazeSize = 5;
let fogSize = 2;
let mazeIndex = 0;
let mazePosition = { row: 0, col: 0 };
let mazeRoute = [];
let mazeOpenCells = new Set();
let mazeSeenCells = new Set();
let mazeCurrentQuestion = null;
let mazeFeedback = null;
let puzzleIndex = 0;
let solution = [];
let board = [];
let fixed = [];
let selected = null;
let history = [];
let historyIndex = 0;
let feedbackCell = null;
let feedbackTimer = null;
let audioContext = null;

function startGame() {
  if (activeApp === "maze") {
    startMaze();
    return;
  }

  normalizeModeForSize();
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
  gameTitle.textContent = "小小數獨";
  updateModeButtons();

  messageEl.textContent = hasBoxRule()
    ? "點空格，選一個同行、同列、同宮都沒出現的數字。"
    : "點空格，選一個同行、同列都沒出現的數字。";
  messageEl.classList.remove("win");
  renderBoard();
}

function switchApp(nextApp) {
  activeApp = nextApp;
  selected = null;
  hideMobileChoices();
  appButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.app === activeApp);
  });
  sudokuGame.classList.toggle("is-hidden", activeApp !== "sudoku");
  mazeGame.classList.toggle("is-hidden", activeApp !== "maze");
  newGameButton.setAttribute("aria-label", activeApp === "sudoku" ? "換一題" : "重開迷宮");
  newGameButton.setAttribute("title", activeApp === "sudoku" ? "換一題" : "重開迷宮");
  startGame();
}

function buildSolution(gridSize, offset) {
  if (mode === "sudoku" && canUseSudoku(gridSize)) {
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

function startMaze() {
  gameTitle.textContent = "算術迷宮";
  ruleLabel.textContent = `${mazeGrade} 年級 ${getOperatorLabel(mazeOperator)} ${mazeSize}x${mazeSize}`;
  const generatedMaze = generateMazeMap(mazeSize, puzzleIndex);
  mazeRoute = generatedMaze.route;
  mazeOpenCells = generatedMaze.openCells;
  mazeSeenCells = new Set();
  mazeIndex = 0;
  mazePosition = { row: mazeRoute[0][0], col: mazeRoute[0][1] };
  revealAround(mazePosition.row, mazePosition.col);
  mazeCurrentQuestion = makeMazeMoveQuestion();
  mazeFeedback = null;
  mazeMessageEl.textContent = "看地圖，選出正確答案的方向。";
  mazeMessageEl.classList.remove("win");
  renderMaze();
}

function generateMazeMap(mapSize, seed) {
  const route = buildMainRoute(mapSize, seed);
  const openCells = new Set(route.map(([row, col]) => cellKey(row, col)));
  const branchCount = Math.floor(mapSize * 1.6);

  for (let branch = 0; branch < branchCount; branch += 1) {
    const start = route[Math.floor(seededScore(branch, 11, seed) * route.length)];
    let row = start[0];
    let col = start[1];
    const length = 1 + Math.floor(seededScore(branch, 12, seed) * Math.max(2, Math.floor(mapSize / 3)));

    for (let step = 0; step < length; step += 1) {
      const direction = mazeDirections[Math.floor(seededScore(branch, step + 13, seed) * mazeDirections.length)];
      const nextRow = row + direction.row;
      const nextCol = col + direction.col;
      if (!isInMaze(nextRow, nextCol, mapSize)) break;

      row = nextRow;
      col = nextCol;
      openCells.add(cellKey(row, col));
    }
  }

  return { route, openCells };
}

function buildMainRoute(mapSize, seed) {
  const route = [[0, 0]];
  let row = 0;
  let col = 0;

  while (row !== mapSize - 1 || col !== mapSize - 1) {
    const canGoRight = col < mapSize - 1;
    const canGoDown = row < mapSize - 1;
    const preferRight = seededScore(row, col, seed) > 0.46;

    if (canGoRight && (!canGoDown || preferRight)) {
      col += 1;
    } else if (canGoDown) {
      row += 1;
    } else {
      col += 1;
    }

    route.push([row, col]);
  }

  return route;
}

function revealAround(row, col) {
  const before = Math.floor((fogSize - 1) / 2);
  const after = fogSize - 1 - before;

  for (let r = row - before; r <= row + after; r += 1) {
    for (let c = col - before; c <= col + after; c += 1) {
      if (isInMaze(r, c, mazeSize)) {
        mazeSeenCells.add(cellKey(r, c));
      }
    }
  }
}

function isInMaze(row, col, mapSize = mazeSize) {
  return row >= 0 && col >= 0 && row < mapSize && col < mapSize;
}

function cellKey(row, col) {
  return `${row},${col}`;
}

function makeMazeMoveQuestion() {
  const index = mazeIndex;
  const operators = mazeOperator === "mixed"
    ? getOperatorsForGrade(mazeGrade)
    : [mazeOperator];
  const operator = operators[Math.floor(seededScore(index, mazeGrade, puzzleIndex) * operators.length)];
  const question = buildArithmeticQuestion(mazeGrade, operator, index + puzzleIndex * 13);
  const nextCell = mazeRoute[Math.min(mazeIndex + 1, mazeRoute.length - 1)];
  const correctDirection = getDirectionTo(nextCell[0], nextCell[1]);

  return {
    ...question,
    options: makeDirectionalOptions(question.answer, correctDirection, mazeGrade, index),
  };
}

function getOperatorsForGrade(grade) {
  if (grade === 1) return ["add", "subtract"];
  if (grade === 2) return ["add", "subtract", "multiply"];
  return ["add", "subtract", "multiply", "divide"];
}

function buildArithmeticQuestion(grade, operator, seed) {
  if (operator === "subtract") {
    const max = grade <= 1 ? 20 : grade <= 3 ? 100 : 500;
    const a = randomInt(6, max, seed, 1);
    const b = randomInt(1, a, seed, 2);
    return { text: `${a} - ${b} = ?`, answer: a - b };
  }

  if (operator === "multiply") {
    const maxA = grade <= 2 ? 5 : grade <= 3 ? 9 : grade <= 4 ? 12 : 20;
    const maxB = grade <= 2 ? 5 : grade <= 3 ? 9 : grade <= 4 ? 12 : 15;
    const a = randomInt(2, maxA, seed, 3);
    const b = randomInt(2, maxB, seed, 4);
    return { text: `${a} × ${b} = ?`, answer: a * b };
  }

  if (operator === "divide") {
    const divisorMax = grade <= 3 ? 9 : grade <= 4 ? 12 : 15;
    const quotientMax = grade <= 3 ? 9 : grade <= 4 ? 12 : 20;
    const b = randomInt(2, divisorMax, seed, 5);
    const answer = randomInt(2, quotientMax, seed, 6);
    return { text: `${b * answer} ÷ ${b} = ?`, answer };
  }

  const max = grade <= 1 ? 20 : grade <= 2 ? 100 : grade <= 4 ? 500 : 999;
  const a = randomInt(1, max, seed, 7);
  const b = randomInt(1, grade <= 1 ? 10 : max, seed, 8);
  return { text: `${a} + ${b} = ?`, answer: a + b };
}

function makeAnswerOptions(answer, grade, seed) {
  const options = new Set([answer]);
  const spread = grade <= 2 ? 5 : grade <= 4 ? 12 : 25;
  let attempt = 0;

  while (options.size < 4) {
    const offset = randomInt(-spread, spread, seed, attempt + 9);
    const candidate = answer + (offset === 0 ? attempt + 1 : offset);
    if (candidate >= 0) options.add(candidate);
    attempt += 1;
  }

  return [...options].sort((a, b) => seededScore(a, b, seed) - 0.5);
}

function makeDirectionalOptions(answer, correctDirection, grade, seed) {
  const answers = makeAnswerOptions(answer, grade, seed).filter((value) => value !== answer);
  const wrongDirections = mazeDirections
    .filter((direction) => direction.key !== correctDirection.key)
    .sort((a, b) => seededScore(seed, a.row + a.col, puzzleIndex) - seededScore(seed, b.row + b.col, puzzleIndex))
    .slice(0, 2);

  return [
    { direction: correctDirection, answer, correct: true },
    ...wrongDirections.map((direction, index) => ({
      direction,
      answer: answers[index],
      correct: false,
    })),
  ].sort((a, b) => seededScore(seed, a.answer, puzzleIndex) - seededScore(seed, b.answer, puzzleIndex));
}

function randomInt(min, max, seed, salt) {
  return min + Math.floor(seededScore(seed, salt, puzzleIndex) * (max - min + 1));
}

function renderMaze() {
  mazePathEl.innerHTML = "";
  mazePathEl.style.setProperty("--maze-size", mazeSize);

  for (let row = 0; row < mazeSize; row += 1) {
    for (let col = 0; col < mazeSize; col += 1) {
      const step = document.createElement("div");
      step.className = "maze-step";
      const key = cellKey(row, col);
      const routeIndex = mazeRoute.findIndex(([routeRow, routeCol]) => routeRow === row && routeCol === col);
      const isCurrent = row === mazePosition.row && col === mazePosition.col;
      const isGoal = row === mazeSize - 1 && col === mazeSize - 1;
      const isSeen = mazeSeenCells.has(key) || isCurrent;

      if (!isSeen) {
        step.classList.add("fog");
        mazePathEl.append(step);
        continue;
      }

      if (!mazeOpenCells.has(key)) {
        step.classList.add("wall");
        step.textContent = "";
      } else {
        step.classList.add("path");
        step.textContent = "";
      }

      if (routeIndex >= 0 && routeIndex < mazeIndex) {
        step.classList.add("visited");
        step.textContent = routeIndex === 0 ? "起" : routeIndex;
      }

      if (isCurrent) {
        step.classList.add("player");
        step.textContent = "我";
      }

      if (isGoal) {
        step.classList.add("goal");
        if (!isCurrent) {
          step.textContent = "終";
        }
      }

      mazePathEl.append(step);
    }
  }

  mazeProgressEl.textContent = `第 ${Math.min(mazeIndex + 1, mazeRoute.length)} / ${mazeRoute.length} 步`;
  if (mazeIndex >= mazeRoute.length - 1) {
    mazeQuestionEl.textContent = "抵達終點";
    answerGridEl.innerHTML = "";
    return;
  }

  mazeQuestionEl.textContent = mazeCurrentQuestion.text;
  answerGridEl.innerHTML = "";

  mazeCurrentQuestion.options.forEach((option) => {
    const button = document.createElement("button");
    button.className = "answer-button";
    button.type = "button";
    button.innerHTML = `<span class="answer-direction">${option.direction.label}</span>${option.answer}`;
    if (mazeFeedback?.answer === option.answer) {
      button.classList.add(mazeFeedback.type);
    }
    button.addEventListener("click", () => answerMazeQuestion(option));
    answerGridEl.append(button);
  });
}

function answerMazeQuestion(option) {
  const correct = option.correct;
  mazeFeedback = { answer: option.answer, type: correct ? "good" : "think" };
  playFeedbackSound(correct ? "good" : "think");
  vibrate(correct ? 18 : 10);

  if (!correct) {
    mazeMessageEl.textContent = `${option.direction.label} 邊不是這題答案，再看一次。`;
    mazeMessageEl.classList.remove("win");
    renderMaze();
    return;
  }

  mazeIndex += 1;
  const nextCell = mazeRoute[Math.min(mazeIndex, mazeRoute.length - 1)];
  mazePosition = { row: nextCell[0], col: nextCell[1] };
  revealAround(mazePosition.row, mazePosition.col);

  if (mazeIndex >= mazeRoute.length - 1) {
    mazeMessageEl.textContent = "走到終點了！重開迷宮繼續玩。";
    mazeMessageEl.classList.add("win");
    playFeedbackSound("win");
    celebrate();
  } else {
    mazeCurrentQuestion = makeMazeMoveQuestion();
    mazeMessageEl.textContent = `答對了，往${option.direction.label}走。`;
    mazeMessageEl.classList.add("win");
  }

  window.setTimeout(() => {
    mazeFeedback = null;
    renderMaze();
  }, 220);
  renderMaze();
}

function getDirectionTo(nextRow, nextCol) {
  const rowDelta = nextRow - mazePosition.row;
  const colDelta = nextCol - mazePosition.col;
  return mazeDirections.find((direction) => direction.row === rowDelta && direction.col === colDelta);
}

function getOperatorLabel(operator) {
  return {
    add: "加法",
    subtract: "減法",
    multiply: "乘法",
    divide: "除法",
    mixed: "混合",
  }[operator];
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

      if (feedbackCell?.row === row && feedbackCell?.col === col) {
        cell.classList.add(`feedback-${feedbackCell.type}`);
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
  return mode === "sudoku" && canUseSudoku(size);
}

function canUseSudoku(gridSize) {
  return Boolean(boxShapes[gridSize]);
}

function normalizeModeForSize() {
  if (mode === "sudoku" && !canUseSudoku(size)) {
    mode = "number";
  }
}

function updateModeButtons() {
  modeButtons.forEach((button) => {
    const isSudokuButton = button.dataset.mode === "sudoku";
    button.disabled = isSudokuButton && !canUseSudoku(size);
    button.classList.toggle("active", button.dataset.mode === mode);
  });
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
      clearCell(row, col);
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
  document.body.classList.add("choice-panel-open");
  mobileChoiceTitle.textContent = `第 ${row + 1} 排，第 ${col + 1} 格`;

  if (board[row][col]) {
    mobileChoiceGrid.append(createMobileChoiceButton("清", "清除這格", () => {
      clearCell(row, col);
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
  document.body.classList.remove("choice-panel-open");
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
  const isAnswer = number === solution[row][col];
  triggerCellFeedback(row, col, isAnswer ? "good" : "think");
  playFeedbackSound(isAnswer ? "good" : "think");
  vibrate(isAnswer ? 18 : 10);

  if (isComplete()) {
    messageEl.textContent = "完成了！換一題繼續玩。";
    messageEl.classList.add("win");
    playFeedbackSound("win");
    celebrate();
  } else {
    messageEl.textContent = isAnswer
      ? "很好，繼續找下一格。"
      : "這個數字可以放，但再想想答案對不對。";
    messageEl.classList.toggle("win", isAnswer);
  }

  saveStep();
}

function clearCell(row, col) {
  board[row][col] = 0;
  selected = null;
  messageEl.textContent = "清掉了，可以再想一次。";
  triggerCellFeedback(row, col, "clear");
  playFeedbackSound("clear");
  vibrate(8);
  saveStep();
}

function triggerCellFeedback(row, col, type) {
  feedbackCell = { row, col, type };
  window.clearTimeout(feedbackTimer);
  feedbackTimer = window.setTimeout(() => {
    feedbackCell = null;
    renderBoard();
  }, 420);
}

function playFeedbackSound(type) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  if (type === "win") {
    playTone(523.25, 0.08, 0);
    playTone(659.25, 0.08, 0.08);
    playTone(783.99, 0.12, 0.16);
    return;
  }

  const settings = {
    good: { frequency: 659.25, duration: 0.07, gain: 0.045 },
    think: { frequency: 246.94, duration: 0.08, gain: 0.035 },
    clear: { frequency: 392, duration: 0.05, gain: 0.03 },
  }[type];

  if (settings) {
    playTone(settings.frequency, settings.duration, 0, settings.gain);
  }
}

function playTone(frequency, duration, delay = 0, gainValue = 0.045) {
  const start = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function vibrate(duration) {
  if ("vibrate" in navigator) {
    navigator.vibrate(duration);
  }
}

function celebrate() {
  const colors = ["var(--accent)", "var(--mint)", "var(--coral)", "var(--sky)", "var(--accent-strong)"];
  celebrationEl.innerHTML = "";

  for (let index = 0; index < 28; index += 1) {
    const piece = document.createElement("span");
    piece.className = "celebration-piece";
    piece.style.setProperty("--x", `${8 + seededScore(index, 2, historyIndex) * 84}%`);
    piece.style.setProperty("--drift", `${Math.round((seededScore(index, 3, historyIndex) - 0.5) * 140)}px`);
    piece.style.setProperty("--spin", `${Math.round(180 + seededScore(index, 4, historyIndex) * 540)}deg`);
    piece.style.setProperty("--delay", `${seededScore(index, 5, historyIndex) * 120}ms`);
    piece.style.setProperty("--color", colors[index % colors.length]);
    celebrationEl.append(piece);
  }

  window.setTimeout(() => {
    celebrationEl.innerHTML = "";
  }, 1200);
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

appTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-app]");
  if (!button) return;

  switchApp(button.dataset.app);
});

sizeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    sizeButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    size = Number(button.dataset.size);
    puzzleIndex = 0;
    startGame();
  });
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.disabled) return;

    mode = button.dataset.mode;
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

gradeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    gradeButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    mazeGrade = Number(button.dataset.grade);
    puzzleIndex = 0;
    startGame();
  });
});

operatorButtons.forEach((button) => {
  button.addEventListener("click", () => {
    operatorButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    mazeOperator = button.dataset.operator;
    puzzleIndex = 0;
    startGame();
  });
});

mazeSizeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    mazeSizeButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    mazeSize = Number(button.dataset.mazeSize);
    puzzleIndex = 0;
    startGame();
  });
});

fogButtons.forEach((button) => {
  button.addEventListener("click", () => {
    fogButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    fogSize = Number(button.dataset.fogSize);
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
