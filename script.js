const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const confettiColors = ['#ffeb3b', '#ffc107', '#ff9800', '#ff5722', '#795548', '#9e9e9e', '#607d8b'];
let confettis = Array.from({ length: 150 }, () => createConfetti());

const balloonImages = ['accessories/images/balloons.png', 'accessories/images/balloons.png', 'accessories/images/balloons.png']; // Array of balloon image paths
const balloons = [];

balloonImages.forEach(src => {
  const img = new Image();
  img.src = src;
  img.onload = () => {
    for (let i = 0; i < 4; i++) { // Create multiple balloons for each type
      balloons.push({
        img: img,
        x: Math.random() * canvas.width,
        y: canvas.height + Math.random() * 100,
        sizeMultiplier: Math.random() * 0.1 + 0.1,
        dY: Math.random() * -3 - 1
      });
    }
  };
});

function createConfetti() {
    return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 3 + 2,
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
        dX: Math.random() * 6 - 3,
        dY: Math.random() * 6 - 3
    };
}

function drawConfetti(confetti) {
    ctx.beginPath();
    ctx.arc(confetti.x, confetti.y, confetti.radius, 0, 2 * Math.PI);
    ctx.fillStyle = confetti.color;
    ctx.fill();
}

function drawBalloon(balloon) {
    const scaledWidth = balloon.img.width * balloon.sizeMultiplier;
    const scaledHeight = balloon.img.height * balloon.sizeMultiplier;
    ctx.drawImage(balloon.img, balloon.x, balloon.y, scaledWidth, scaledHeight);
}

function update() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Update and draw confetti
  confettis.forEach(confetti => {
    confetti.x += confetti.dX;
    confetti.y += confetti.dY;
    if (confetti.x < 0) confetti.x = canvas.width;
    else if (confetti.x > canvas.width) confetti.x = 0;
    if (confetti.y < 0) confetti.y = canvas.height;
    else if (confetti.y > canvas.height) confetti.y = 0;
    drawConfetti(confetti);
  });

  // Update and draw balloons
  balloons.forEach(balloon => {
    balloon.y += balloon.dY;
    if (balloon.y < -balloon.img.height) {
      balloon.y = canvas.height + balloon.img.height;
      balloon.x = Math.random() * canvas.width;
    }
    drawBalloon(balloon);
  });

  requestAnimationFrame(update);
}

update();

const countdown1 = document.getElementById('countdown-timer-1');
const targetDate1 = new Date('2025-01-14T00:00:00').getTime(); // Set your target date and time

function updateCountdown1() {
  const now = new Date().getTime();
  const distance = targetDate1 - now;

  if (distance < 0) {
    clearInterval(interval1);
    countdown1.innerHTML = "00:00:00";
    alert('Countdown Finished!');
    return;
  }

  // Time calculations for days, hours, minutes and seconds
  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);

  // Display the result
  countdown1.innerHTML = days + " days " + hours + " hrs " + minutes + " mins " + seconds + " sec ";
}

// Update the count down every 1 second
const interval1 = setInterval(updateCountdown1, 1000);

// Select the birthday message element
const birthdayMessage = document.getElementById('birthday-message');

// Create an audio object for the sound effect
const boomSound = new Audio('accessories/sounds/boom-hbd.mp3');

// Play the sound when the animation starts
birthdayMessage.addEventListener('animationstart', () => {
    boomSound.play();
});
