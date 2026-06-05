const OPTION_KEYS = ["A", "B", "C", "D"];
const OPTION_CLASS = { A: "a", B: "b", C: "c", D: "d" };

const screens = {
  welcome: document.getElementById("screen-welcome"),
  game: document.getElementById("screen-game"),
  feedback: document.getElementById("screen-feedback"),
};

const QUESTION_COUNT_OPTIONS = [20, 50, 100, 200];

const welcomeForm = document.getElementById("welcome-form");
const playerNameInput = document.getElementById("player-name");
const questionCountSelect = document.getElementById("question-count");
const loadError = document.getElementById("load-error");

const playerLabel = document.getElementById("player-label");
const questionCounter = document.getElementById("question-counter");
const questionPrompt = document.getElementById("question-prompt");
const selectionDisplay = document.getElementById("selection-display");
const optionsGrid = document.getElementById("options-grid");
const timerDisplay = document.getElementById("timer-display");
const btnClear = document.getElementById("btn-clear");
const btnSkip = document.getElementById("btn-skip");

const feedbackHeadline = document.getElementById("feedback-headline");
const feedbackTime = document.getElementById("feedback-time");
const feedbackYourOrder = document.getElementById("feedback-your-order");
const feedbackCorrectOrder = document.getElementById("feedback-correct-order");
const btnNext = document.getElementById("btn-next");
const btnEnd = document.getElementById("btn-end");

let questionBank = [];
let deck = [];
let playerName = "";
let currentQuestion = null;
let selection = [];
let questionStartMs = 0;
let timerIntervalId = null;
let locked = false;
let sessionTarget = 20;
const sessionLog = [];

function isSessionComplete() {
  return sessionLog.length >= sessionTarget;
}

function updateQuestionCounter() {
  const current = sessionLog.length + (locked ? 0 : 1);
  questionCounter.textContent = `Question ${current} / ${sessionTarget}`;
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    const active = key === name;
    el.classList.toggle("screen--active", active);
    el.hidden = !active;
  });
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatOrder(keys, question) {
  if (!question) return "—";
  const map = Object.fromEntries(question.options.map((o) => [o.key, o.text]));
  return keys.map((k) => `${k} (${map[k]})`).join(" → ");
}

function formatOrderKeys(keys) {
  return keys.join(" → ");
}

function elapsedSeconds() {
  return (performance.now() - questionStartMs) / 1000;
}

function stopTimer() {
  if (timerIntervalId !== null) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
}

function startTimer() {
  stopTimer();
  questionStartMs = performance.now();
  timerDisplay.textContent = "0.0s";
  timerIntervalId = setInterval(() => {
    timerDisplay.textContent = `${elapsedSeconds().toFixed(1)}s`;
  }, 100);
}

function validateQuestion(q, index) {
  if (!q.prompt || !Array.isArray(q.options) || q.options.length !== 4) {
    throw new Error(`Question ${index}: needs prompt and 4 options.`);
  }
  const keys = q.options.map((o) => o.key);
  if (!OPTION_KEYS.every((k) => keys.includes(k))) {
    throw new Error(`Question ${index}: option keys must be A, B, C, D.`);
  }
  if (!Array.isArray(q.correctOrder) || q.correctOrder.length !== 4) {
    throw new Error(`Question ${index}: correctOrder must have 4 keys.`);
  }
  const sortedCorrect = [...q.correctOrder].sort().join(",");
  const sortedKeys = [...OPTION_KEYS].sort().join(",");
  if (sortedCorrect !== sortedKeys) {
    throw new Error(`Question ${index}: correctOrder must be a permutation of A–D.`);
  }
}

async function loadQuestions() {
  const res = await fetch("questions.json");
  if (!res.ok) throw new Error(`Could not load questions (${res.status}).`);
  const data = await res.json();
  if (!Array.isArray(data.questions) || data.questions.length === 0) {
    throw new Error("questions.json has no questions.");
  }
  data.questions.forEach(validateQuestion);
  return data.questions;
}

function drawNextQuestion() {
  if (deck.length === 0) {
    deck = shuffle(questionBank.map((_, i) => i));
  }
  const index = deck.pop();
  return questionBank[index];
}

function updateSelectionUI() {
  if (selection.length === 0) {
    selectionDisplay.textContent = "Tap options in order…";
    selectionDisplay.classList.remove("has-picks");
  } else {
    selectionDisplay.textContent = selection.join(" → ");
    selectionDisplay.classList.add("has-picks");
  }

  optionsGrid.querySelectorAll(".option-btn").forEach((btn) => {
    const key = btn.dataset.key;
    const pickIndex = selection.indexOf(key);
    const picked = pickIndex !== -1;
    btn.classList.toggle("is-picked", picked);
    btn.querySelector(".option-pick").textContent = picked ? String(pickIndex + 1) : "";
    btn.disabled = locked || picked;
  });

  btnClear.disabled = locked || selection.length === 0;
  btnSkip.disabled = locked;
}

function renderQuestion(question) {
  currentQuestion = question;
  selection = [];
  locked = false;

  questionPrompt.textContent = question.prompt;
  optionsGrid.innerHTML = "";

  question.options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `option-btn option-btn--${OPTION_CLASS[opt.key]}`;
    btn.dataset.key = opt.key;
    btn.innerHTML = `
      <span class="option-key">${opt.key}</span>
      <span class="option-text">${escapeHtml(opt.text)}</span>
      <span class="option-pick"></span>
    `;
    btn.addEventListener("click", () => onOptionClick(opt.key));
    optionsGrid.appendChild(btn);
  });

  updateQuestionCounter();

  updateSelectionUI();
  startTimer();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function onOptionClick(key) {
  if (locked || selection.includes(key)) return;
  selection.push(key);
  updateSelectionUI();
  if (selection.length === 4) {
    submitAnswer();
  }
}

function ordersMatch(a, b) {
  return a.length === b.length && a.every((k, i) => k === b[i]);
}

function finishQuestion({ skipped, correct }) {
  locked = true;
  stopTimer();
  const seconds = elapsedSeconds();

  const entry = {
    questionId: currentQuestion.id ?? null,
    prompt: currentQuestion.prompt,
    playerName,
    skipped,
    yourOrder: skipped ? [] : [...selection],
    correctOrder: [...currentQuestion.correctOrder],
    correct: skipped ? null : correct,
    seconds: Math.round(seconds * 10) / 10,
    timestamp: new Date().toISOString(),
  };
  sessionLog.push(entry);
  console.log("FFF attempt:", entry);

  showFeedback({ skipped, correct, seconds });
}

function showFeedback({ skipped, correct, seconds }) {
  showScreen("feedback");

  feedbackHeadline.className = "feedback-headline";
  if (skipped) {
    feedbackHeadline.textContent = "Skipped";
    feedbackHeadline.classList.add("is-skipped");
  } else if (correct) {
    feedbackHeadline.textContent = "Correct!";
    feedbackHeadline.classList.add("is-correct");
  } else {
    feedbackHeadline.textContent = "Incorrect";
    feedbackHeadline.classList.add("is-wrong");
  }

  feedbackTime.textContent = `Time: ${seconds.toFixed(1)} seconds`;

  if (skipped) {
    feedbackYourOrder.textContent = "—";
  } else {
    feedbackYourOrder.textContent = formatOrder(selection, currentQuestion);
  }
  feedbackCorrectOrder.textContent = formatOrder(
    currentQuestion.correctOrder,
    currentQuestion
  );

  if (isSessionComplete()) {
    feedbackTime.textContent += ` · Session complete (${sessionTarget} questions)`;
    btnNext.textContent = "New practice session";
  } else {
    btnNext.textContent = `Next question (${sessionLog.length + 1} / ${sessionTarget})`;
  }
}

function submitAnswer() {
  const correct = ordersMatch(selection, currentQuestion.correctOrder);
  finishQuestion({ skipped: false, correct });
}

function clearSelection() {
  if (locked) return;
  selection = [];
  updateSelectionUI();
}

function skipQuestion() {
  if (locked) return;
  finishQuestion({ skipped: true, correct: null });
}

function startGame(name, questionCount) {
  playerName = name.trim();
  sessionTarget = questionCount;
  playerLabel.textContent = playerName;
  deck = shuffle(questionBank.map((_, i) => i));
  sessionLog.length = 0;
  showScreen("game");
  renderQuestion(drawNextQuestion());
}

function nextQuestion() {
  if (isSessionComplete()) {
    endPractice();
    return;
  }
  if (deck.length === 0 && questionBank.length > 0) {
    deck = shuffle(questionBank.map((_, i) => i));
  }
  showScreen("game");
  renderQuestion(drawNextQuestion());
}

function endPractice() {
  stopTimer();
  playerNameInput.value = playerName;
  showScreen("welcome");
}

welcomeForm.addEventListener("submit", (e) => {
  e.preventDefault();
  loadError.hidden = true;
  const name = playerNameInput.value.trim();
  if (!name) return;
  if (questionBank.length === 0) {
    loadError.textContent = "Questions are still loading. Try again in a moment.";
    loadError.hidden = false;
    return;
  }
  const questionCount = Number(questionCountSelect.value);
  if (!QUESTION_COUNT_OPTIONS.includes(questionCount)) {
    loadError.textContent = "Please choose 20, 50, 100, or 200 questions.";
    loadError.hidden = false;
    return;
  }
  startGame(name, questionCount);
});

btnClear.addEventListener("click", clearSelection);
btnSkip.addEventListener("click", skipQuestion);
btnNext.addEventListener("click", nextQuestion);
btnEnd.addEventListener("click", endPractice);

loadQuestions()
  .then((questions) => {
    questionBank = questions;
    loadError.hidden = true;
  })
  .catch((err) => {
    loadError.textContent = err.message;
    loadError.hidden = false;
    welcomeForm.querySelector('button[type="submit"]').disabled = true;
  });
