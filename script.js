document.addEventListener("DOMContentLoaded", function () {
  console.log("Apology Page Loaded");
});

const noButton = document.getElementById('noButton');

// Add event listener to move the "No" button when hovered
noButton.addEventListener('mouseover', () => {
  const x = Math.random() * window.innerWidth * 0.8; // Random x-position
  const y = Math.random() * window.innerHeight * 0.8; // Random y-position

  noButton.style.position = 'absolute';
  noButton.style.left = `${x}px`;
  noButton.style.top = `${y}px`;
});
