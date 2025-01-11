const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

function drawBalloon(x, y, size, color) {
  ctx.beginPath();
  ctx.ellipse(x, y, size, size * 1.5, 0, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.stroke();
}

function drawConfetti() {
  const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722', '#795548', '#9e9e9e', '#607d8b'];
  return {
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    radius: Math.random() * 3 + 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    dX: Math.random() * 6 - 3,
    dY: Math.random() * 6 - 3
  };
}

let confettis = Array.from({ length: 150 }, () => drawConfetti());

function update() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  confettis.forEach(confetti => {
    confetti.x += confetti.dX;
    confetti.y += confetti.dY;
    ctx.beginPath();
    ctx.arc(confetti.x, confetti.y, confetti.radius, 0, 2 * Math.PI);
    ctx.fillStyle = confetti.color;
    ctx.fill();
  });
  requestAnimationFrame(update);
}

update();
