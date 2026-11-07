// Configuración visual compartida por Chart.js. Lee los tokens CSS en tiempo de render para
// respetar el tema elegido en Configuración sin duplicar colores en cada módulo.

const FALLBACKS = {
  primary: '#4F46E5',
  success: '#17A567',
  warning: '#C98A1E',
  danger: '#DC4949',
  muted: '#6b7280',
  info: '#0ea5e9',
  violet: '#a855f7',
  orange: '#f97316',
  text: '#4B4F63',
  textMuted: '#7A7E93',
  border: '#E5E7F0',
};

function cssToken(styles, name, fallback) {
  return styles.getPropertyValue(name).trim() || fallback;
}

export function getChartPalette() {
  const styles = getComputedStyle(document.documentElement);
  return [
    cssToken(styles, '--color-primary', FALLBACKS.primary),
    cssToken(styles, '--color-success', FALLBACKS.success),
    cssToken(styles, '--color-warning', FALLBACKS.warning),
    cssToken(styles, '--color-danger', FALLBACKS.danger),
    cssToken(styles, '--color-text-muted', FALLBACKS.muted),
    cssToken(styles, '--color-info', FALLBACKS.info),
    FALLBACKS.violet,
    FALLBACKS.orange,
  ];
}

export function getChartOptions({ yBeginAtZero = false, yTitle = '', legend = true } = {}) {
  const styles = getComputedStyle(document.documentElement);
  const text = cssToken(styles, '--color-text-secondary', FALLBACKS.text);
  const muted = cssToken(styles, '--color-text-muted', FALLBACKS.textMuted);
  const border = cssToken(styles, '--color-border', FALLBACKS.border);

  return {
    responsive: true,
    maintainAspectRatio: false,
    color: text,
    plugins: {
      legend: {
        display: legend,
        labels: { color: text, usePointStyle: true, padding: 16 },
      },
      tooltip: {
        titleColor: text,
        bodyColor: text,
        borderColor: border,
        borderWidth: 1,
        backgroundColor: cssToken(styles, '--color-surface-elevated', '#ffffff'),
      },
    },
    scales: {
      x: {
        ticks: { color: muted },
        grid: { color: border },
      },
      y: {
        beginAtZero: yBeginAtZero,
        ticks: { color: muted },
        grid: { color: border },
        title: yTitle ? { display: true, text: yTitle, color: muted } : { display: false },
      },
    },
  };
}
