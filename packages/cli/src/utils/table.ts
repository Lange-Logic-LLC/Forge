import chalk from 'chalk';

export function printTable(headers: string[], rows: string[][]) {
  // Calculate column widths
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)),
  );

  // Print header
  const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join('  ');
  console.log(chalk.bold(headerLine));
  console.log(chalk.gray('─'.repeat(headerLine.length)));

  // Print rows
  for (const row of rows) {
    console.log(row.map((cell, i) => (cell ?? '').padEnd(widths[i])).join('  '));
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case 'success': return chalk.green(status);
    case 'failed': return chalk.red(status);
    case 'building':
    case 'submitting': return chalk.yellow(status);
    case 'queued': return chalk.blue(status);
    case 'cancelled': return chalk.gray(status);
    default: return status;
  }
}
