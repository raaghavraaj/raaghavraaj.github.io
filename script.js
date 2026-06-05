const OPTION_KEYS = ["A", "B", "C", "D"];
const OPTION_CLASS = { A: "a", B: "b", C: "c", D: "d" };

const screens = {
  welcome: document.getElementById("screen-welcome"),
  game: document.getElementById("screen-game"),
  feedback: document.getElementById("screen-feedback"),
  summary: document.getElementById("screen-summary"),
};

const QUESTION_COUNT_OPTIONS = [20, 50, 100, 200];

/** Reading time before options appear (scaled by EN + HI prompt length). */
const READ_TIME = {
  MIN_SECONDS: 4,
  MAX_SECONDS: 22,
  BASE_SECONDS: 3,
  SECONDS_PER_CHAR: 0.045,
};

const welcomeForm = document.getElementById("welcome-form");
const playerNameInput = document.getElementById("player-name");
const questionCountSelect = document.getElementById("question-count");
const loadError = document.getElementById("load-error");

const playerLabel = document.getElementById("player-label");
const questionCounter = document.getElementById("question-counter");
const questionPrompt = document.getElementById("question-prompt");
const promptCountdown = document.getElementById("prompt-countdown");
const promptCountdownValue = document.getElementById("prompt-countdown-value");
const gameAnswerPanel = document.getElementById("game-answer-panel");
const selectionDisplay = document.getElementById("selection-display");
const optionsGrid = document.getElementById("options-grid");
const timerDisplay = document.getElementById("timer-display");
const btnClear = document.getElementById("btn-clear");
const btnSkip = document.getElementById("btn-skip");
const btnSkipPrompt = document.getElementById("btn-skip-prompt");

const feedbackHeadline = document.getElementById("feedback-headline");
const feedbackTime = document.getElementById("feedback-time");
const feedbackYourLabel = document.getElementById("feedback-your-label");
const feedbackYourOrder = document.getElementById("feedback-your-order");
const feedbackCorrectLabel = document.getElementById("feedback-correct-label");
const feedbackCorrectOrder = document.getElementById("feedback-correct-order");
const btnNext = document.getElementById("btn-next");
const btnEnd = document.getElementById("btn-end");
const btnEndGame = document.getElementById("btn-end-game");

const summaryPlayer = document.getElementById("summary-player");
const summaryStatus = document.getElementById("summary-status");
const summaryStats = document.getElementById("summary-stats");
const summaryTableBody = document.getElementById("summary-table-body");
const btnSummaryHome = document.getElementById("btn-summary-home");

let questionBank = [];
let deck = [];
let playerName = "";
let currentQuestion = null;
let selection = [];
let questionStartMs = 0;
let timerIntervalId = null;
let promptCountdownIntervalId = null;
let promptCountdownEndMs = 0;
let locked = false;
let optionsRevealed = false;
let sessionTarget = 20;
const sessionLog = [];

function getQuestionType(question) {
  if (question.type === "single" || question.correctAnswer) {
    return "single";
  }
  return "order";
}

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

function isLocalizedText(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.en === "string" &&
    value.en.trim() &&
    typeof value.hi === "string" &&
    value.hi.trim()
  );
}

function formatBilingual(text) {
  return `${text.en} / ${text.hi}`;
}

function formatOrder(keys, question) {
  if (!question || keys.length === 0) return "—";
  const map = Object.fromEntries(question.options.map((o) => [o.key, o.text]));
  return keys.map((k) => `${k} (${formatBilingual(map[k])})`).join(" → ");
}

function formatSingleAnswer(key, question) {
  if (!question || !key) return "—";
  const opt = question.options.find((o) => o.key === key);
  return opt ? `${key} (${formatBilingual(opt.text)})` : key;
}

function formatUserResponse(selection, question) {
  const type = getQuestionType(question);
  if (type === "single") {
    return formatSingleAnswer(selection[0], question);
  }
  return formatOrder(selection, question);
}

function formatCorrectResponse(question) {
  const type = getQuestionType(question);
  if (type === "single") {
    return formatSingleAnswer(question.correctAnswer, question);
  }
  return formatOrder(question.correctOrder, question);
}

function renderPromptHtml(prompt) {
  return `
    <p class="prompt-line prompt-line--en">${escapeHtml(prompt.en)}</p>
    <p class="prompt-line prompt-line--hi">${escapeHtml(prompt.hi)}</p>
  `;
}

function renderOptionTextHtml(text) {
  return `
    <span class="option-line option-line--en">${escapeHtml(text.en)}</span>
    <span class="option-line option-line--hi">${escapeHtml(text.hi)}</span>
  `;
}

function formatPromptSummary(prompt) {
  return `${prompt.en} ${prompt.hi}`;
}

function elapsedSeconds() {
  return (performance.now() - questionStartMs) / 1000;
}

function computeReadSeconds(prompt) {
  const chars = prompt.en.length + prompt.hi.length;
  const raw = READ_TIME.BASE_SECONDS + chars * READ_TIME.SECONDS_PER_CHAR;
  return Math.min(
    READ_TIME.MAX_SECONDS,
    Math.max(READ_TIME.MIN_SECONDS, Math.ceil(raw))
  );
}

function stopTimer() {
  if (timerIntervalId !== null) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
}

function stopPromptCountdown() {
  if (promptCountdownIntervalId !== null) {
    clearInterval(promptCountdownIntervalId);
    promptCountdownIntervalId = null;
  }
}

function stopAllTimers() {
  stopTimer();
  stopPromptCountdown();
}

function startPromptCountdown(durationSeconds) {
  stopPromptCountdown();
  promptCountdown.hidden = false;
  promptCountdownEndMs = performance.now() + durationSeconds * 1000;

  const tick = () => {
    if (locked || optionsRevealed || !currentQuestion) {
      return;
    }
    const remainingMs = promptCountdownEndMs - performance.now();
    if (remainingMs <= 0) {
      stopPromptCountdown();
      revealOptions();
      return;
    }
    promptCountdownValue.textContent = String(Math.ceil(remainingMs / 1000));
  };

  tick();
  promptCountdownIntervalId = setInterval(tick, 100);
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
  if (!isLocalizedText(q.prompt) || !Array.isArray(q.options) || q.options.length !== 4) {
    throw new Error(`Question ${index}: needs bilingual prompt (en, hi) and 4 options.`);
  }
  const keys = q.options.map((o) => o.key);
  if (!OPTION_KEYS.every((k) => keys.includes(k))) {
    throw new Error(`Question ${index}: option keys must be A, B, C, D.`);
  }
  q.options.forEach((opt, optIndex) => {
    if (!isLocalizedText(opt.text)) {
      throw new Error(`Question ${index}, option ${optIndex}: text must have en and hi.`);
    }
  });

  const type = getQuestionType(q);
  const hasOrder = Array.isArray(q.correctOrder) && q.correctOrder.length > 0;
  const hasSingle = typeof q.correctAnswer === "string" && q.correctAnswer.length > 0;

  if (type === "single") {
    if (!hasSingle) {
      throw new Error(`Question ${index}: single type needs correctAnswer (A–D).`);
    }
    if (!OPTION_KEYS.includes(q.correctAnswer)) {
      throw new Error(`Question ${index}: correctAnswer must be A, B, C, or D.`);
    }
    if (hasOrder) {
      throw new Error(`Question ${index}: use either correctAnswer or correctOrder, not both.`);
    }
    q.type = "single";
  } else {
    if (!hasOrder || q.correctOrder.length !== 4) {
      throw new Error(`Question ${index}: order type needs correctOrder (4 keys).`);
    }
    const sortedCorrect = [...q.correctOrder].sort().join(",");
    const sortedKeys = [...OPTION_KEYS].sort().join(",");
    if (sortedCorrect !== sortedKeys) {
      throw new Error(`Question ${index}: correctOrder must be a permutation of A–D.`);
    }
    if (hasSingle) {
      throw new Error(`Question ${index}: use either correctAnswer or correctOrder, not both.`);
    }
    q.type = "order";
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

function setPromptPhaseUI(question) {
  optionsRevealed = false;
  gameAnswerPanel.hidden = true;
  btnSkipPrompt.hidden = false;
  stopTimer();
  timerDisplay.textContent = "—";

  const readSeconds = computeReadSeconds(question.prompt);
  startPromptCountdown(readSeconds);
}

function setOptionsPhaseUI() {
  optionsRevealed = true;
  stopPromptCountdown();
  promptCountdown.hidden = true;
  gameAnswerPanel.hidden = false;
  btnSkipPrompt.hidden = true;
  updateSelectionUI();
  startTimer();
}

function updateSelectionUI() {
  if (!optionsRevealed) return;

  const type = getQuestionType(currentQuestion);

  if (selection.length === 0) {
    selectionDisplay.textContent =
      type === "single" ? "Tap the correct option…" : "Tap options in order…";
    selectionDisplay.classList.remove("has-picks");
  } else if (type === "single") {
    selectionDisplay.textContent = `Selected: ${selection[0]}`;
    selectionDisplay.classList.add("has-picks");
  } else {
    selectionDisplay.textContent = selection.join(" → ");
    selectionDisplay.classList.add("has-picks");
  }

  optionsGrid.querySelectorAll(".option-btn").forEach((btn) => {
    const key = btn.dataset.key;
    const pickIndex = selection.indexOf(key);
    const picked = pickIndex !== -1;
    btn.classList.toggle("is-picked", picked);
    const pickEl = btn.querySelector(".option-pick");
    if (type === "single") {
      pickEl.textContent = picked ? "✓" : "";
    } else {
      pickEl.textContent = picked ? String(pickIndex + 1) : "";
    }
    if (type === "single") {
      btn.disabled = locked;
    } else {
      btn.disabled = locked || picked;
    }
  });

  btnClear.disabled = locked || selection.length === 0;
  btnSkip.disabled = locked;
}

function buildOptionsGrid(question) {
  optionsGrid.innerHTML = "";
  const type = getQuestionType(question);

  question.options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `option-btn option-btn--${OPTION_CLASS[opt.key]}`;
    btn.dataset.key = opt.key;
    btn.innerHTML = `
      <span class="option-key">${opt.key}</span>
      <span class="option-text">${renderOptionTextHtml(opt.text)}</span>
      <span class="option-pick" aria-hidden="true"></span>
    `;
    btn.addEventListener("click", () => onOptionClick(opt.key));
    optionsGrid.appendChild(btn);
  });

  optionsGrid.dataset.questionType = type;
}

function revealOptions() {
  if (locked || optionsRevealed || !currentQuestion) return;
  setOptionsPhaseUI();
}

function renderQuestion(question) {
  currentQuestion = question;
  selection = [];
  locked = false;

  questionPrompt.innerHTML = renderPromptHtml(question.prompt);
  buildOptionsGrid(question);
  setPromptPhaseUI(question);

  updateQuestionCounter();
}

function isAnswerCorrect() {
  const type = getQuestionType(currentQuestion);
  if (type === "single") {
    return selection[0] === currentQuestion.correctAnswer;
  }
  return ordersMatch(selection, currentQuestion.correctOrder);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function onOptionClick(key) {
  if (locked || !optionsRevealed) return;

  const type = getQuestionType(currentQuestion);

  if (type === "single") {
    selection = [key];
    updateSelectionUI();
    submitAnswer();
    return;
  }

  if (selection.includes(key)) return;
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
  stopAllTimers();
  promptCountdown.hidden = true;
  const type = getQuestionType(currentQuestion);
  const seconds = optionsRevealed ? elapsedSeconds() : 0;

  const entry = {
    questionId: currentQuestion.id ?? null,
    type,
    prompt: currentQuestion.prompt,
    playerName,
    skipped,
    optionsRevealed,
    yourOrder: skipped ? [] : [...selection],
    correctOrder: type === "order" ? [...currentQuestion.correctOrder] : null,
    correctAnswer: type === "single" ? currentQuestion.correctAnswer : null,
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

  const type = getQuestionType(currentQuestion);
  const singleLabels = type === "single";

  feedbackYourLabel.textContent = singleLabels ? "Your answer" : "Your order";
  feedbackCorrectLabel.textContent = singleLabels ? "Correct answer" : "Correct order";

  if (skipped) {
    feedbackYourOrder.innerHTML = "—";
  } else {
    feedbackYourOrder.innerHTML = escapeHtml(
      formatUserResponse(selection, currentQuestion)
    );
  }
  feedbackCorrectOrder.innerHTML = escapeHtml(formatCorrectResponse(currentQuestion));

  if (isSessionComplete()) {
    feedbackTime.textContent += ` · Session complete (${sessionTarget} questions)`;
    btnNext.textContent = "View session summary";
  } else {
    btnNext.textContent = `Next question (${sessionLog.length + 1} / ${sessionTarget})`;
  }
}

function submitAnswer() {
  const correct = isAnswerCorrect();
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
    showSummary();
    return;
  }
  if (deck.length === 0 && questionBank.length > 0) {
    deck = shuffle(questionBank.map((_, i) => i));
  }
  showScreen("game");
  renderQuestion(drawNextQuestion());
}

function computeSessionStats() {
  const attempted = sessionLog.length;
  const correct = sessionLog.filter((e) => e.correct === true).length;
  const incorrect = sessionLog.filter((e) => e.correct === false).length;
  const skipped = sessionLog.filter((e) => e.skipped).length;
  const totalSeconds = sessionLog.reduce((sum, e) => sum + e.seconds, 0);
  const answered = sessionLog.filter((e) => !e.skipped);
  const avgSeconds =
    answered.length > 0
      ? Math.round((totalSeconds / sessionLog.length) * 10) / 10
      : 0;
  const avgAnsweredSeconds =
    answered.length > 0
      ? Math.round((answered.reduce((s, e) => s + e.seconds, 0) / answered.length) * 10) / 10
      : 0;

  return {
    attempted,
    correct,
    incorrect,
    skipped,
    totalSeconds: Math.round(totalSeconds * 10) / 10,
    avgSeconds,
    avgAnsweredSeconds,
    completed: attempted >= sessionTarget,
  };
}

function resultLabel(entry) {
  if (entry.skipped) return "Skipped";
  return entry.correct ? "Correct" : "Incorrect";
}

function resultClass(entry) {
  if (entry.skipped) return "result--skip";
  return entry.correct ? "result--correct" : "result--wrong";
}

function truncate(text, max = 72) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function showSummary() {
  stopAllTimers();
  promptCountdown.hidden = true;
  const stats = computeSessionStats();

  summaryPlayer.textContent = playerName;
  summaryStatus.textContent = stats.completed
    ? `Completed all ${sessionTarget} questions.`
    : `Ended early — ${stats.attempted} of ${sessionTarget} questions attempted.`;

  summaryStats.innerHTML = `
    <div class="summary-stat">
      <dt>Correct</dt>
      <dd class="stat--correct">${stats.correct}</dd>
    </div>
    <div class="summary-stat">
      <dt>Incorrect</dt>
      <dd class="stat--wrong">${stats.incorrect}</dd>
    </div>
    <div class="summary-stat">
      <dt>Skipped</dt>
      <dd class="stat--skip">${stats.skipped}</dd>
    </div>
    <div class="summary-stat">
      <dt>Total time</dt>
      <dd>${stats.totalSeconds}s</dd>
    </div>
    <div class="summary-stat">
      <dt>Avg time / question</dt>
      <dd>${stats.avgSeconds}s</dd>
    </div>
    <div class="summary-stat">
      <dt>Avg time (answered)</dt>
      <dd>${stats.avgAnsweredSeconds}s</dd>
    </div>
  `;

  summaryTableBody.innerHTML = sessionLog
    .map(
      (entry, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><span class="result-badge ${resultClass(entry)}">${resultLabel(entry)}</span></td>
          <td>${entry.seconds.toFixed(1)}s</td>
          <td title="${escapeHtml(formatPromptSummary(entry.prompt))}">${escapeHtml(truncate(entry.prompt.en))}<br><span class="summary-prompt-hi">${escapeHtml(truncate(entry.prompt.hi, 48))}</span></td>
        </tr>
      `
    )
    .join("");

  console.log("FFF session summary:", { playerName, sessionTarget, ...stats, sessionLog });
  showScreen("summary");
}

function endPractice() {
  if (sessionLog.length === 0) {
    stopAllTimers();
    promptCountdown.hidden = true;
    goWelcome();
    return;
  }
  showSummary();
}

function goWelcome() {
  stopAllTimers();
  promptCountdown.hidden = true;
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
btnSkipPrompt.addEventListener("click", skipQuestion);
btnNext.addEventListener("click", nextQuestion);
btnEnd.addEventListener("click", endPractice);
btnEndGame.addEventListener("click", endPractice);
btnSummaryHome.addEventListener("click", goWelcome);

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
