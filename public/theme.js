// Applies a saved light or dark choice before first paint, so the page never
// flashes the other theme. Without a saved choice the system setting decides.
try {
  var theme = localStorage.getItem('tp-theme')
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme
} catch (e) {}
