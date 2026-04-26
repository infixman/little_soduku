const appButtons = document.querySelectorAll("[data-app]");
const sizeButtons = document.querySelectorAll("[data-size]");
const difficultyButtons = document.querySelectorAll("[data-level]");
const singleHintToggle = document.querySelector("#single-hint-toggle");
const gradeButtons = document.querySelectorAll("[data-grade]");
const operatorButtons = document.querySelectorAll("[data-operator]");
const mazeSizeButtons = document.querySelectorAll("[data-maze-size]");
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
const sudokuSizes = Object.keys(boxShapes).map(Number);

const mazeDirections = [
  { key: "up", label: "⬆️", name: "上", row: -1, col: 0 },
  { key: "right", label: "➡️", name: "右", row: 0, col: 1 },
  { key: "down", label: "⬇️", name: "下", row: 1, col: 0 },
  { key: "left", label: "⬅️", name: "左", row: 0, col: -1 },
];

const mazeKeyDirections = {
  ArrowUp: "up",
  ArrowRight: "right",
  ArrowDown: "down",
  ArrowLeft: "left",
};

let size = 4;
let mode = "sudoku";
let level = "starter";
let activeApp = "sudoku";
let showSingleHints = false;
let mazeGrade = 1;
let mazeOperators = ["add"];
let mazeSize = 7;
const fogSize = 3;
let mazePosition = { row: 0, col: 0 };
let mazeRoute = [];
let mazePassages = new Set();
let mazeSeenCells = new Set();
let playerPath = [];
let abandonedPaths = [];
let mazeCurrentQuestion = null;
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

  syncModeFromApp();
  solution = buildSolution(size, puzzleIndex);
  board = hideCells(solution, levels[level], puzzleIndex);
  fixed = board.map((row) => row.map((value) => value !== 0));
  selected = null;
  history = [cloneGrid(board)];
  historyIndex = 0;

  boardEl.style.setProperty("--size", size);
  boardEl.style.setProperty("--choice-cols", size <= 4 ? 2 : 3);
  boardEl.setAttribute("aria-label", `${size}x${size} ${getBoardGameName()}棋盤`);
  if (ruleLabel) ruleLabel.textContent = `${size}x${size} ${getBoardGameName()}`;
  if (gameTitle) gameTitle.textContent = getBoardGameTitle();
  updateAppButtons();

  messageEl.textContent = hasBoxRule()
    ? "點空格，選一個同行、同列、同宮都沒出現的數字。"
    : "點空格，選一個同行、同列都沒出現的數字。";
  messageEl.classList.remove("win");
  renderBoard();
}

function switchApp(nextApp) {
  activeApp = nextApp;
  if (activeApp === "sudoku" && !canUseSudoku(size)) {
    size = getDefaultSudokuSize();
  }
  selected = null;
  hideMobileChoices();
  updateAppButtons();
  sudokuGame.classList.toggle("is-hidden", activeApp === "maze");
  mazeGame.classList.toggle("is-hidden", activeApp !== "maze");
  newGameButton.setAttribute("aria-label", activeApp === "maze" ? "重開迷宮" : "換一題");
  newGameButton.setAttribute("title", activeApp === "maze" ? "重開迷宮" : "換一題");
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
  if (gameTitle) gameTitle.textContent = "算術迷宮";
  if (ruleLabel) ruleLabel.textContent = `Lv.${mazeGrade} ${getOperatorSummary()} ${mazeSize}x${mazeSize}`;
  const generatedMaze = generateMazeMap(mazeSize, puzzleIndex);
  mazeRoute = generatedMaze.route;
  mazePassages = generatedMaze.passages;
  mazeSeenCells = new Set();
  mazePosition = { row: mazeRoute[0][0], col: mazeRoute[0][1] };
  playerPath = [{ ...mazePosition }];
  abandonedPaths = [];
  revealAround(mazePosition.row, mazePosition.col);
  mazeCurrentQuestion = makeMazeMoveQuestion();
  mazeMessageEl.textContent = "看地圖，選答案決定要往哪裡走。";
  mazeMessageEl.classList.remove("win");
  renderMaze();
}

function generateMazeMap(mapSize, seed) {
  const attemptCount = Math.max(48, mapSize * mapSize);
  let bestMaze = null;
  let bestScore = -Infinity;

  for (let attempt = 0; attempt < attemptCount; attempt += 1) {
    const candidate = generateMazeCandidate(mapSize, seed * 97 + attempt * 31);
    const score = scoreMazeCandidate(candidate, mapSize);

    if (score > bestScore) {
      bestMaze = candidate;
      bestScore = score;
    }
  }

  return bestMaze;
}

function generateMazeCandidate(mapSize, seed) {
  const passages = new Set();
  const visited = new Set([cellKey(0, 0)]);
  const stack = [{ row: 0, col: 0 }];

  while (stack.length) {
    const current = stack[stack.length - 1];
    const nextDirections = mazeDirections
      .map((direction) => ({
        ...direction,
        nextRow: current.row + direction.row,
        nextCol: current.col + direction.col,
      }))
      .filter(({ nextRow, nextCol }) => isInMaze(nextRow, nextCol, mapSize) && !visited.has(cellKey(nextRow, nextCol)))
      .sort((a, b) =>
        seededScore(current.row * mapSize + current.col, directionScore(a), seed) -
        seededScore(current.row * mapSize + current.col, directionScore(b), seed)
      );

    if (!nextDirections.length) {
      stack.pop();
    } else {
      const next = nextDirections[0];
      addPassage(passages, current.row, current.col, next.nextRow, next.nextCol);
      visited.add(cellKey(next.nextRow, next.nextCol));
      stack.push({ row: next.nextRow, col: next.nextCol });
    }
  }

  const route = findPathBetween({ row: 0, col: 0 }, { row: mapSize - 1, col: mapSize - 1 }, passages, mapSize);
  return { route: route.map(({ row, col }) => [row, col]), passages };
}

function scoreMazeCandidate(candidate, mapSize) {
  const routeCells = new Set(candidate.route.map(([row, col]) => cellKey(row, col)));
  const offRouteGroups = findOffRouteGroups(candidate.passages, routeCells, mapSize);
  const largestUnusedGroup = offRouteGroups.reduce((largest, groupSize) => Math.max(largest, groupSize), 0);
  const unusedGroupPenalty = offRouteGroups.reduce((total, groupSize) => total + groupSize * groupSize, 0);

  return candidate.route.length * 18 - largestUnusedGroup * 9 - unusedGroupPenalty;
}

function findOffRouteGroups(passages, routeCells, mapSize) {
  const groups = [];
  const visited = new Set(routeCells);

  for (let row = 0; row < mapSize; row += 1) {
    for (let col = 0; col < mapSize; col += 1) {
      const key = cellKey(row, col);
      if (visited.has(key)) continue;

      let size = 0;
      const stack = [{ row, col }];
      visited.add(key);

      while (stack.length) {
        const current = stack.pop();
        size += 1;

        mazeDirections.forEach((direction) => {
          const nextRow = current.row + direction.row;
          const nextCol = current.col + direction.col;
          const nextKey = cellKey(nextRow, nextCol);
          if (
            !isInMaze(nextRow, nextCol, mapSize) ||
            visited.has(nextKey) ||
            !hasPassageIn(passages, mapSize, current.row, current.col, direction)
          ) {
            return;
          }

          visited.add(nextKey);
          stack.push({ row: nextRow, col: nextCol });
        });
      }

      groups.push(size);
    }
  }

  return groups;
}

function directionScore(direction) {
  return { up: 1, right: 2, down: 3, left: 4 }[direction.key];
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

function passageKey(rowA, colA, rowB, colB) {
  const first = cellKey(rowA, colA);
  const second = cellKey(rowB, colB);
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

function addPassage(passages, rowA, colA, rowB, colB) {
  passages.add(passageKey(rowA, colA, rowB, colB));
}

function hasPassage(row, col, direction) {
  const nextRow = row + direction.row;
  const nextCol = col + direction.col;
  return isInMaze(nextRow, nextCol) && mazePassages.has(passageKey(row, col, nextRow, nextCol));
}

function hasPassageIn(passages, mapSize, row, col, direction) {
  const nextRow = row + direction.row;
  const nextCol = col + direction.col;
  return isInMaze(nextRow, nextCol, mapSize) && passages.has(passageKey(row, col, nextRow, nextCol));
}

function makeMazeMoveQuestion() {
  const index = playerPath.length - 1;
  const operators = mazeOperators.length ? mazeOperators : ["add"];
  const operator = operators[Math.floor(seededScore(index, mazeGrade, puzzleIndex) * operators.length)];
  const question = buildArithmeticQuestion(mazeGrade, operator, index + puzzleIndex * 13);
  const correctDirection = getDirectionAlongRoute();
  const options = makeDirectionalOptions(question.answer, correctDirection, mazeGrade, index);

  return {
    ...question,
    options,
  };
}

function getOperatorsForGrade(grade) {
  if (grade === 1) return ["add", "subtract"];
  if (grade === 2) return ["add", "subtract", "multiply"];
  return ["add", "subtract", "multiply", "divide"];
}

function buildArithmeticQuestion(grade, operator, seed) {
  const [leftRange, rightRange] = getMazeNumberRanges(grade);
  const left = randomInt(leftRange.min, leftRange.max, seed, 1);
  const right = randomInt(rightRange.min, rightRange.max, seed, 2);

  if (operator === "subtract") {
    const a = Math.max(left, right);
    const b = Math.min(left, right);
    return { text: `${a} - ${b} = ?`, answer: a - b };
  }

  if (operator === "multiply") {
    return { text: `${left} × ${right} = ?`, answer: left * right };
  }

  if (operator === "divide") {
    const divisor = Math.max(2, left);
    return { text: `${divisor * right} ÷ ${divisor} = ?`, answer: right };
  }

  return { text: `${left} + ${right} = ?`, answer: left + right };
}

function getMazeNumberRanges(level) {
  return {
    1: [digitRange(1), digitRange(1)],
    2: [digitRange(1), digitRange(2)],
    3: [digitRange(2), digitRange(2)],
    4: [digitRange(2), digitRange(3)],
    5: [digitRange(3), digitRange(3)],
    6: [digitRange(3), digitRange(4)],
  }[level] || [digitRange(1), digitRange(1)];
}

function digitRange(digits) {
  if (digits <= 1) return { min: 1, max: 9 };

  return {
    min: 10 ** (digits - 1),
    max: 10 ** digits - 1,
  };
}

function makeAnswerOptions(answer, grade, seed) {
  const options = new Set([answer]);
  const spread = grade <= 2 ? 5 : grade <= 4 ? 12 : 25;
  const sameTailCandidate = answer + 10;
  let attempt = 0;

  if (sameTailCandidate >= 0) {
    options.add(sameTailCandidate);
  }

  while (options.size < 4 && attempt < 60) {
    const offset = randomInt(-spread, spread, seed, attempt + 9);
    const candidate = answer + (offset === 0 ? attempt + 1 : offset);
    if (candidate >= 0) options.add(candidate);
    attempt += 1;
  }

  while (options.size < 4) {
    options.add(answer + options.size * 10);
  }

  return [...options].sort((a, b) => seededScore(a, b, seed) - 0.5);
}

function makeDirectionalOptions(answer, correctDirection, grade, seed) {
  const availableDirections = getOpenNeighborDirections();
  const answers = makeAnswerOptions(answer, grade, seed).filter((value) => value !== answer);
  while (answers.length < availableDirections.length) {
    const candidate = answer + (answers.length + 1) * 10;
    if (!answers.includes(candidate)) answers.push(candidate);
  }

  if (!correctDirection) {
    return availableDirections.map((direction) => {
      const row = mazePosition.row + direction.row;
      const col = mazePosition.col + direction.col;
      const hasVisited = playerPath.some((cell) => cell.row === row && cell.col === col);

      return {
        direction,
        answer: hasVisited ? "返回" : "探索",
        correct: false,
        backtrack: hasVisited,
        explore: !hasVisited,
      };
    });
  }

  const wrongDirections = availableDirections
    .filter((direction) => direction.key !== correctDirection.key)
    .sort((a, b) => seededScore(seed, a.row + a.col, puzzleIndex) - seededScore(seed, b.row + b.col, puzzleIndex))
    .slice(0, 3);

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
  const currentPathIndex = playerPath.length - 1;

  for (let row = 0; row < mazeSize; row += 1) {
    for (let col = 0; col < mazeSize; col += 1) {
      const step = document.createElement("div");
      step.className = "maze-step";
      const key = cellKey(row, col);
      const pathIndex = playerPath.findIndex((cell) => cell.row === row && cell.col === col);
      const staleIndex = getAbandonedStepIndex(row, col);
      const isCurrent = row === mazePosition.row && col === mazePosition.col;
      const isGoal = row === mazeSize - 1 && col === mazeSize - 1;
      const isSeen = mazeSeenCells.has(key) || isCurrent || pathIndex >= 0 || staleIndex >= 0;

      if (!isSeen) {
        step.classList.add("fog");
        mazePathEl.append(step);
        continue;
      }

      addMazeWallClasses(step, row, col);
      step.classList.add("path");
      step.textContent = "";

      if (staleIndex >= 0 && pathIndex < 0 && !isCurrent) {
        step.classList.add("stale");
        step.textContent = staleIndex;
      }

      if (pathIndex >= 0 && pathIndex < currentPathIndex) {
        step.classList.add("visited");
        step.textContent = pathIndex === 0 ? "起" : pathIndex;
        step.addEventListener("click", () => rewindMazeTo(pathIndex));
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

  mazeProgressEl.textContent = `第 ${playerPath.length} 步`;
  if (hasSolvedMaze()) {
    mazeQuestionEl.textContent = "抵達終點";
    answerGridEl.innerHTML = "";
    return;
  }

  mazeQuestionEl.textContent = mazeCurrentQuestion.text;
  answerGridEl.innerHTML = "";

  if (!mazeCurrentQuestion.options.length) {
    mazeQuestionEl.textContent = "這裡沒有路了";
    mazeMessageEl.textContent = "點走過的格子回到前面重算。";
    return;
  }

  if (mazeCurrentQuestion.options.some((option) => option.backtrack || option.explore)) {
    mazeQuestionEl.textContent = mazeCurrentQuestion.options.some((option) => option.explore)
      ? "探索岔路"
      : "回到走過的路";
    mazeMessageEl.textContent = "沒有算術答案，依牆面選方向。";
  }

  mazeCurrentQuestion.options.forEach((option) => {
    const button = document.createElement("button");
    button.className = "answer-button";
    button.type = "button";
    button.setAttribute(
      "aria-label",
      option.backtrack || option.explore ? `往${option.direction.name}${option.answer}` : `往${option.direction.name}，答案 ${option.answer}`
    );
    button.innerHTML = `<span class="answer-direction" aria-hidden="true">${option.direction.label}</span>${option.answer}`;
    button.addEventListener("click", () => answerMazeQuestion(option));
    answerGridEl.append(button);
  });
}

function addMazeWallClasses(step, row, col) {
  if (row === 0) step.classList.add("wall-up");
  if (col === 0) step.classList.add("wall-left");

  const right = mazeDirections.find((direction) => direction.key === "right");
  const down = mazeDirections.find((direction) => direction.key === "down");

  if (!hasPassage(row, col, right)) step.classList.add("wall-right");
  if (!hasPassage(row, col, down)) step.classList.add("wall-down");
}

function answerMazeQuestion(option) {
  if (!hasPassage(mazePosition.row, mazePosition.col, option.direction)) {
    mazeMessageEl.textContent = `往${option.direction.name}有牆，換個答案試試。`;
    mazeMessageEl.classList.remove("win");
    playFeedbackSound("think");
    vibrate(10);
    return;
  }

  const nextPosition = {
    row: mazePosition.row + option.direction.row,
    col: mazePosition.col + option.direction.col,
  };

  const previousPathIndex = playerPath.findIndex(
    (cell) => cell.row === nextPosition.row && cell.col === nextPosition.col
  );
  if (previousPathIndex >= 0) {
    rewindMazeTo(previousPathIndex);
    playFeedbackSound("move");
    vibrate(12);
    return;
  }

  mazePosition = nextPosition;
  playerPath.push({ ...mazePosition });
  revealAround(mazePosition.row, mazePosition.col);
  playFeedbackSound("move");
  vibrate(12);

  if (hasSolvedMaze()) {
    mazeMessageEl.textContent = "走到終點了！重開迷宮繼續玩。";
    mazeMessageEl.classList.add("win");
    playFeedbackSound("win");
    celebrate();
  } else {
    mazeCurrentQuestion = makeMazeMoveQuestion();
    mazeMessageEl.textContent = `往${option.direction.name}走了一步。`;
    mazeMessageEl.classList.remove("win");
  }

  renderMaze();
}

function handleMazeKeyboard(event) {
  if (activeApp !== "maze" || hasSolvedMaze() || !mazeCurrentQuestion) return;

  const directionKey = mazeKeyDirections[event.key];
  if (!directionKey) return;

  const option = mazeCurrentQuestion.options.find((item) => item.direction.key === directionKey);
  if (!option) return;

  event.preventDefault();
  answerMazeQuestion(option);
}

function rewindMazeTo(pathIndex) {
  if (pathIndex < 0 || pathIndex >= playerPath.length - 1) return;

  const discarded = playerPath.slice(pathIndex + 1);
  if (discarded.length) {
    abandonedPaths.push({ startStep: pathIndex + 2, cells: discarded });
  }

  playerPath = playerPath.slice(0, pathIndex + 1);
  mazePosition = { ...playerPath[playerPath.length - 1] };
  mazeCurrentQuestion = makeMazeMoveQuestion();
  mazeMessageEl.textContent = `回到第 ${pathIndex + 1} 步，灰色是剛剛走過的路。`;
  mazeMessageEl.classList.remove("win");
  renderMaze();
}

function getOpenNeighborDirections() {
  return mazeDirections.filter((direction) => {
    return hasPassage(mazePosition.row, mazePosition.col, direction);
  });
}

function getDirectionTowardGoal() {
  return getDirectionAlongRoute();
}

function getDirectionAlongRoute() {
  const routeIndex = playerPath.length - 1;
  const routeCell = mazeRoute[routeIndex];
  const nextRouteCell = mazeRoute[routeIndex + 1];
  if (!routeCell || !nextRouteCell) {
    return null;
  }

  if (!isOnCorrectRoutePrefix() || mazePosition.row !== routeCell[0] || mazePosition.col !== routeCell[1]) {
    return null;
  }

  const next = { row: nextRouteCell[0], col: nextRouteCell[1] };
  return mazeDirections.find((direction) =>
    mazePosition.row + direction.row === next.row &&
    mazePosition.col + direction.col === next.col
  );
}

function findPathToGoal() {
  return findPathBetween(mazePosition, { row: mazeSize - 1, col: mazeSize - 1 }, mazePassages, mazeSize);
}

function findPathBetween(start, goal, passages, mapSize) {
  const queue = [[start]];
  const visited = new Set([cellKey(start.row, start.col)]);

  while (queue.length) {
    const path = queue.shift();
    const current = path[path.length - 1];
    if (current.row === goal.row && current.col === goal.col) {
      return path;
    }

    mazeDirections.forEach((direction) => {
      const row = current.row + direction.row;
      const col = current.col + direction.col;
      const key = cellKey(row, col);
      if (!isInMaze(row, col, mapSize) || !hasPassageIn(passages, mapSize, current.row, current.col, direction) || visited.has(key)) return;

      visited.add(key);
      queue.push([...path, { row, col }]);
    });
  }

  return [];
}

function getAbandonedStepIndex(row, col) {
  for (const path of abandonedPaths) {
    const index = path.cells.findIndex((cell) => cell.row === row && cell.col === col);
    if (index >= 0) return path.startStep + index;
  }

  return -1;
}

function isAtGoal() {
  return mazePosition.row === mazeSize - 1 && mazePosition.col === mazeSize - 1;
}

function hasSolvedMaze() {
  return isAtGoal() && isOnCorrectRoutePrefix();
}

function isOnCorrectRoutePrefix() {
  return playerPath.every((cell, index) => {
    const routeCell = mazeRoute[index];
    return routeCell && cell.row === routeCell[0] && cell.col === routeCell[1];
  });
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

function getOperatorSummary() {
  return mazeOperators.map(getOperatorLabel).join("、");
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

  if (showSingleHints) {
    markSingleChoiceCells();
  } else {
    updateHistoryButtons();
  }
  renderMobileChoices();
}

function isBoxBoundaryRight(col) {
  if (!hasBoxRule()) return false;
  const shape = boxShapes[size];
  return shape && col < size - 1 && (col + 1) % shape.cols === 0;
}

function isBoxBoundaryBottom(row) {
  if (!hasBoxRule()) return false;
  const shape = boxShapes[size];
  return shape && row < size - 1 && (row + 1) % shape.rows === 0;
}

function hasBoxRule() {
  return mode === "sudoku" && canUseSudoku(size);
}

function canUseSudoku(gridSize) {
  return Boolean(boxShapes[gridSize]);
}

function getDefaultSudokuSize() {
  return sudokuSizes[0];
}

function syncModeFromApp() {
  if (activeApp === "sudoku" && canUseSudoku(size)) {
    mode = "sudoku";
    return;
  }

  if (activeApp === "sudoku") {
    activeApp = "number";
  }

  mode = "number";
}

function updateAppButtons() {
  appButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.app === activeApp);
  });
  updateSizeButtons();
}

function updateSizeButtons() {
  sizeButtons.forEach((button) => {
    const buttonSize = Number(button.dataset.size);
    const isAvailable = activeApp !== "sudoku" || canUseSudoku(buttonSize);
    button.hidden = !isAvailable;
    button.classList.toggle("active", buttonSize === size);
  });
}

function getBoardGameName() {
  return hasBoxRule() ? "數獨" : "數字方格";
}

function getBoardGameTitle() {
  return hasBoxRule() ? "小小數獨" : "數字方格";
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
  if (hasBoxRule() && shape) {
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
  const isAnswer = hasBoxRule() ? number === solution[row][col] : isCellValidByRules(row, col);
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
    move: { frequency: 523.25, duration: 0.045, gain: 0.03 },
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
  if (board.some((row) => row.some((value) => value === 0))) return false;

  for (let index = 0; index < size; index += 1) {
    const rowValues = board[index];
    const colValues = board.map((row) => row[index]);
    if (!hasAllNumbers(rowValues) || !hasAllNumbers(colValues)) return false;
  }

  if (hasBoxRule()) {
    const shape = boxShapes[size];
    for (let boxRow = 0; boxRow < size; boxRow += shape.rows) {
      for (let boxCol = 0; boxCol < size; boxCol += shape.cols) {
        const values = [];
        for (let row = boxRow; row < boxRow + shape.rows; row += 1) {
          for (let col = boxCol; col < boxCol + shape.cols; col += 1) {
            values.push(board[row][col]);
          }
        }
        if (!hasAllNumbers(values)) return false;
      }
    }
  }

  return true;
}

function hasAllNumbers(values) {
  if (values.length !== size) return false;
  const seen = new Set(values);
  return seen.size === size && values.every((value) => value >= 1 && value <= size);
}

function isCellValidByRules(row, col) {
  const value = board[row][col];
  if (!value) return false;

  for (let index = 0; index < size; index += 1) {
    if (index !== col && board[row][index] === value) return false;
    if (index !== row && board[index][col] === value) return false;
  }

  if (hasBoxRule()) {
    const shape = boxShapes[size];
    const boxRow = Math.floor(row / shape.rows) * shape.rows;
    const boxCol = Math.floor(col / shape.cols) * shape.cols;
    for (let r = boxRow; r < boxRow + shape.rows; r += 1) {
      for (let c = boxCol; c < boxCol + shape.cols; c += 1) {
        if ((r !== row || c !== col) && board[r][c] === value) return false;
      }
    }
  }

  return true;
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
    if (button.hidden) return;
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

singleHintToggle.addEventListener("click", () => {
  showSingleHints = !showSingleHints;
  singleHintToggle.classList.toggle("active", showSingleHints);
  singleHintToggle.setAttribute("aria-pressed", String(showSingleHints));
  renderBoard();
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
    const nextOperators = new Set(mazeOperators);
    if (nextOperators.has(button.dataset.operator)) {
      nextOperators.delete(button.dataset.operator);
    } else {
      nextOperators.add(button.dataset.operator);
    }

    if (!nextOperators.size) return;

    mazeOperators = [...nextOperators];
    operatorButtons.forEach((item) => {
      item.classList.toggle("active", mazeOperators.includes(item.dataset.operator));
    });
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

newGameButton.addEventListener("click", () => {
  puzzleIndex += 1;
  startGame();
});

undoButton.addEventListener("click", () => moveHistory(-1));
redoButton.addEventListener("click", () => moveHistory(1));
window.addEventListener("keydown", handleMazeKeyboard);
mobileChoiceClose.addEventListener("click", () => {
  selected = null;
  renderBoard();
});
mobileQuery.addEventListener("change", renderBoard);

startGame();
