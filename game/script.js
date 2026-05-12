// ===== 常量 =====
const ROWS = 8;
const COLS = 8;
const ANIMALS = ['🐱', '🐶', '🐰', '🐻', '🦊', '🐼'];
const TOTAL_MOVES = 30;
const POINTS_PER_CELL = 10;

// ===== 游戏状态 =====
let board = [];
let score = 0;
let movesLeft = TOTAL_MOVES;
let combo = 1;
let selectedCell = null; // { row, col } | null
let isProcessing = false; // 动画期间禁止操作

// ===== DOM 引用 =====
const boardEl = document.getElementById('board');
const scoreEl = document.getElementById('score');
const movesEl = document.getElementById('moves');
const comboEl = document.getElementById('combo');
const comboBox = document.getElementById('comboBox');
const overlay = document.getElementById('overlay');
const modalTitle = document.getElementById('modalTitle');
const modalScore = document.getElementById('modalScore');

// ===== 棋盘逻辑 =====

function randomAnimal() {
  return ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
}

function createBoard() {
  board = [];
  for (let r = 0; r < ROWS; r++) {
    board[r] = [];
    for (let c = 0; c < COLS; c++) {
      let animal;
      do {
        animal = randomAnimal();
      } while (wouldMatch(r, c, animal));
      board[r][c] = animal;
    }
  }
}

// 检查在 (r,c) 放置 animal 是否会形成 3+ 连
function wouldMatch(r, c, animal) {
  // 水平向左检查
  if (c >= 2 && board[r][c - 1] === animal && board[r][c - 2] === animal) return true;
  // 垂直向上检查
  if (r >= 2 && board[r - 1] && board[r - 1][c] === animal && board[r - 2] && board[r - 2][c] === animal) return true;
  return false;
}

// ===== 渲染 =====

function renderBoard(animationHints = {}) {
  boardEl.innerHTML = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      if (board[r][c]) {
        cell.textContent = board[r][c];
      }
      cell.dataset.row = r;
      cell.dataset.col = c;

      // 选中状态
      if (selectedCell && selectedCell.row === r && selectedCell.col === c) {
        cell.classList.add('selected');
      }

      // 提示动画
      const key = `${r},${c}`;
      if (animationHints[key]) cell.classList.add('hint');

      // 下落动画
      if (animationHints.fallCells && animationHints.fallCells.has(key)) {
        cell.classList.add('fall');
      }

      // 消除动画
      if (animationHints.matchCells && animationHints.matchCells.has(key)) {
        cell.classList.add('matched');
      }

      // 交换动画
      if (animationHints.swapClass && animationHints.swapClass[key]) {
        cell.classList.add(animationHints.swapClass[key]);
      }

      cell.addEventListener('click', () => handleClick(r, c));
      boardEl.appendChild(cell);
    }
  }
}

function updateInfo() {
  scoreEl.textContent = score;
  movesEl.textContent = movesLeft;
  comboEl.textContent = `x${combo}`;
}

// ===== 匹配检测 =====

function findMatches() {
  const matched = new Set();

  // 水平检测
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 2; c++) {
      if (!board[r][c]) continue;
      const val = board[r][c];
      let len = 1;
      while (c + len < COLS && board[r][c + len] === val) len++;
      if (len >= 3) {
        for (let i = 0; i < len; i++) matched.add(`${r},${c + i}`);
      }
      c += len - 1;
    }
  }

  // 垂直检测
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS - 2; r++) {
      if (!board[r][c]) continue;
      const val = board[r][c];
      let len = 1;
      while (r + len < ROWS && board[r + len] && board[r + len][c] === val) len++;
      if (len >= 3) {
        for (let i = 0; i < len; i++) matched.add(`${r + i},${c}`);
      }
      r += len - 1;
    }
  }

  return matched;
}

// ===== 核心流程 =====

function removeMatches(matched) {
  for (const key of matched) {
    const [r, c] = key.split(',').map(Number);
    board[r][c] = null;
  }
  return matched.size;
}

function applyGravity() {
  const fallCells = new Set();

  for (let c = 0; c < COLS; c++) {
    // 从底向上，将非空单元格下移
    let writeRow = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r][c] !== null) {
        if (r !== writeRow) {
          board[writeRow][c] = board[r][c];
          board[r][c] = null;
          fallCells.add(`${writeRow},${c}`);
        }
        writeRow--;
      }
    }
    // 顶部空位填新动物
    for (let r = writeRow; r >= 0; r--) {
      board[r][c] = randomAnimal();
      fallCells.add(`${r},${c}`);
    }
  }

  return fallCells;
}

async function processMatches(initialSwapAnim = null) {
  let totalRemoved = 0;
  let currentCombo = 0;

  while (true) {
    const matched = findMatches();
    if (matched.size === 0) break;

    currentCombo++;
    combo = currentCombo;

    // 渲染消除动画
    const hints = { matchCells: matched };
    renderBoard(hints);
    updateInfo();
    await sleep(300);

    // 移除
    const removed = removeMatches(matched);
    totalRemoved += removed;

    // 重力 + 填充
    const fallCells = applyGravity();
    const fallHints = { fallCells };
    renderBoard(fallHints);
    await sleep(280);
  }

  // 结算分数
  if (totalRemoved > 0) {
    score += totalRemoved * POINTS_PER_CELL * currentCombo;
    if (currentCombo > 1) {
      comboBox.classList.remove('pulse');
      void comboBox.offsetWidth;
      comboBox.classList.add('pulse');
    }
  }

  combo = 1;
  renderBoard();
  updateInfo();
  isProcessing = false;

  // 检查是否还有可行解
  if (!hasValidMove()) {
    shuffleBoard();
  }

  // 检查游戏结束
  if (movesLeft <= 0) {
    setTimeout(showGameOver, 500);
  }
}

// ===== 用户交互 =====

function handleClick(row, col) {
  if (isProcessing) return;
  if (!board[row][col]) return;

  if (!selectedCell) {
    // 第一次选择
    selectedCell = { row, col };
    renderBoard();
    return;
  }

  if (selectedCell.row === row && selectedCell.col === col) {
    // 取消选择
    selectedCell = null;
    renderBoard();
    return;
  }

  if (!isAdjacent(selectedCell.row, selectedCell.col, row, col)) {
    // 不邻接：切换选中
    selectedCell = { row, col };
    renderBoard();
    return;
  }

  // 执行交换
  const sr = selectedCell.row;
  const sc = selectedCell.col;
  selectedCell = null;

  doSwap(sr, sc, row, col);
}

function isAdjacent(r1, c1, r2, c2) {
  const dr = Math.abs(r1 - r2);
  const dc = Math.abs(c1 - c2);
  return (dr + dc) === 1;
}

async function doSwap(r1, c1, r2, c2) {
  if (isProcessing) return;
  isProcessing = true;

  // 数据交换
  swap(r1, c1, r2, c2);

  // 确定动画方向
  const swapClass = {};
  if (r1 === r2) {
    swapClass[`${r1},${c2}`] = c2 > c1 ? 'swap-left' : 'swap-right';
    swapClass[`${r2},${c1}`] = c1 > c2 ? 'swap-left' : 'swap-right';
  } else {
    swapClass[`${r2},${c1}`] = r2 > r1 ? 'swap-up' : 'swap-down';
    swapClass[`${r1},${c2}`] = r1 > r2 ? 'swap-up' : 'swap-down';
  }

  renderBoard({ swapClass });
  await sleep(200);

  // 检查匹配
  const matched = findMatches();
  if (matched.size > 0) {
    movesLeft--;
    updateInfo();
    await processMatches();
  } else {
    // 无效交换：换回
    swap(r1, c1, r2, c2);
    const reverseSwap = {};
    if (r1 === r2) {
      reverseSwap[`${r1},${c1}`] = c2 > c1 ? 'swap-left' : 'swap-right';
      reverseSwap[`${r2},${c2}`] = c1 > c2 ? 'swap-left' : 'swap-right';
    } else {
      reverseSwap[`${r1},${c1}`] = r2 > r1 ? 'swap-up' : 'swap-down';
      reverseSwap[`${r2},${c2}`] = r1 > r2 ? 'swap-up' : 'swap-down';
    }
    renderBoard({ swapClass: reverseSwap });
    await sleep(200);
    renderBoard();
    isProcessing = false;
  }
}

function swap(r1, c1, r2, c2) {
  const tmp = board[r1][c1];
  board[r1][c1] = board[r2][c2];
  board[r2][c2] = tmp;
}

// ===== 辅助函数 =====

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 检查是否存在可行解
function hasValidMove() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      // 尝试向右交换
      if (c + 1 < COLS) {
        swap(r, c, r, c + 1);
        if (findMatches().size > 0) {
          swap(r, c, r, c + 1);
          return true;
        }
        swap(r, c, r, c + 1);
      }
      // 尝试向下交换
      if (r + 1 < ROWS) {
        swap(r, c, r + 1, c);
        if (findMatches().size > 0) {
          swap(r, c, r + 1, c);
          return true;
        }
        swap(r, c, r + 1, c);
      }
    }
  }
  return false;
}

// 无解时洗牌
function shuffleBoard() {
  // 收集所有动物
  const animals = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      animals.push(board[r][c]);
    }
  }
  // Fisher-Yates 洗牌
  for (let i = animals.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [animals[i], animals[j]] = [animals[j], animals[i]];
  }
  // 放回
  let idx = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      board[r][c] = animals[idx++];
    }
  }
  // 如果洗牌后仍有预设匹配，重新创建
  if (findMatches().size > 0 || !hasValidMove()) {
    createBoard();
  }
  renderBoard();
}

// ===== 提示 =====

function findHint() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c + 1 < COLS) {
        swap(r, c, r, c + 1);
        if (findMatches().size > 0) {
          swap(r, c, r, c + 1);
          return [{ row: r, col: c }, { row: r, col: c + 1 }];
        }
        swap(r, c, r, c + 1);
      }
      if (r + 1 < ROWS) {
        swap(r, c, r + 1, c);
        if (findMatches().size > 0) {
          swap(r, c, r + 1, c);
          return [{ row: r, col: c }, { row: r + 1, col: c }];
        }
        swap(r, c, r + 1, c);
      }
    }
  }
  return null;
}

function showHint() {
  if (isProcessing) return;
  const hint = findHint();
  if (hint) {
    const hints = {};
    hints[`${hint[0].row},${hint[0].col}`] = true;
    hints[`${hint[1].row},${hint[1].col}`] = true;
    renderBoard(hints);
    setTimeout(() => renderBoard(), 2000);
  }
}

// ===== 游戏结束 =====

function showGameOver() {
  modalTitle.textContent = movesLeft <= 0 ? '步数用完' : '游戏结束';
  modalScore.textContent = `最终得分：${score}`;
  overlay.classList.add('show');
}

function hideOverlay() {
  overlay.classList.remove('show');
}

// ===== 重置 =====

function restart() {
  hideOverlay();
  score = 0;
  movesLeft = TOTAL_MOVES;
  combo = 1;
  selectedCell = null;
  isProcessing = false;
  createBoard();
  renderBoard();
  updateInfo();
}

// ===== 事件绑定 =====

document.getElementById('btnHint').addEventListener('click', showHint);
document.getElementById('btnRestart').addEventListener('click', restart);
document.getElementById('btnPlayAgain').addEventListener('click', restart);
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) hideOverlay();
});

// ===== 启动游戏 =====
createBoard();
renderBoard();
updateInfo();
