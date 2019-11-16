let count = 0;
const interval = setInterval(() => {
  console.log(`message-${Date.now()}`);
  count++;

  if (count === 10) {
    clearInterval(interval);
  }
}, 1000);
