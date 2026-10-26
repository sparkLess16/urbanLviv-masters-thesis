// Agreement between predicted clusters and ground-truth groups. Both inputs are
// arrays of labels of the same length (index i is the same report).

const choose2 = (n) => (n * (n - 1)) / 2;

// Contingency table: counts[predicted][truth], plus the row and column totals.
const contingency = (predicted, truth) => {
  const table = new Map();
  const rows = new Map();
  const cols = new Map();
  predicted.forEach((p, i) => {
    const t = truth[i];
    const row = table.get(p) ?? new Map();
    row.set(t, (row.get(t) ?? 0) + 1);
    table.set(p, row);
    rows.set(p, (rows.get(p) ?? 0) + 1);
    cols.set(t, (cols.get(t) ?? 0) + 1);
  });
  return { table, rows, cols, n: predicted.length };
};

// Share of reports that belong to the majority truth group of their cluster.
export const purity = (predicted, truth) => {
  const { table, n } = contingency(predicted, truth);
  let sum = 0;
  for (const row of table.values()) sum += Math.max(...row.values());
  return sum / n;
};

// Adjusted Rand Index: 1 = identical partitions, about 0 = random.
export const adjustedRandIndex = (predicted, truth) => {
  const { table, rows, cols, n } = contingency(predicted, truth);
  let sumCells = 0;
  for (const row of table.values()) {
    for (const count of row.values()) sumCells += choose2(count);
  }
  const sumRows = [...rows.values()].reduce((s, c) => s + choose2(c), 0);
  const sumCols = [...cols.values()].reduce((s, c) => s + choose2(c), 0);
  const expected = (sumRows * sumCols) / choose2(n);
  const maximum = (sumRows + sumCols) / 2;
  if (maximum === expected) return 1;
  return (sumCells - expected) / (maximum - expected);
};

// Normalized Mutual Information (arithmetic mean normalization).
export const normalizedMutualInformation = (predicted, truth) => {
  const { table, rows, cols, n } = contingency(predicted, truth);
  const entropy = (totals) =>
    -[...totals.values()].reduce((s, c) => s + (c / n) * Math.log(c / n), 0);

  let mutual = 0;
  for (const [p, row] of table) {
    for (const [t, count] of row) {
      mutual +=
        (count / n) * Math.log((count * n) / (rows.get(p) * cols.get(t)));
    }
  }
  const denominator = (entropy(rows) + entropy(cols)) / 2;
  return denominator === 0 ? 1 : mutual / denominator;
};
