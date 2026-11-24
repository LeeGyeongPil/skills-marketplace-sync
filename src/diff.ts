/** Dependency-free line diff (LCS) printed in unified style with 3 lines of context. */
export function unifiedDiff(oldText: string, newText: string, oldName: string, newName: string): string {
  const a = oldText === "" ? [] : oldText.replace(/\n$/, "").split("\n");
  const b = newText === "" ? [] : newText.replace(/\n$/, "").split("\n");
  const n = a.length;
  const m = b.length;
  // lcs[i][j] = length of the longest common subsequence of a[i..] and b[j..]
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  type Op = { kind: " " | "+" | "-"; text: string };
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ kind: " ", text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ kind: "-", text: a[i++] });
    } else {
      ops.push({ kind: "+", text: b[j++] });
    }
  }
  while (i < n) ops.push({ kind: "-", text: a[i++] });
  while (j < m) ops.push({ kind: "+", text: b[j++] });

  const CONTEXT = 3;
  const out: string[] = [`--- ${oldName}`, `+++ ${newName}`];
  let k = 0;
  while (k < ops.length) {
    if (ops[k].kind === " ") {
      k++;
      continue;
    }
    const start = Math.max(0, k - CONTEXT);
    // extend the hunk while the next change is within 2*CONTEXT unchanged lines
    let last = k;
    for (let p = k; p < ops.length && p - last <= CONTEXT * 2; p++) {
      if (ops[p].kind !== " ") last = p;
    }
    const stop = Math.min(ops.length - 1, last + CONTEXT);
    let oldLine = 1;
    let newLine = 1;
    for (let p = 0; p < start; p++) {
      if (ops[p].kind !== "+") oldLine++;
      if (ops[p].kind !== "-") newLine++;
    }
    const hunk = ops.slice(start, stop + 1);
    const oldCount = hunk.filter((o) => o.kind !== "+").length;
    const newCount = hunk.filter((o) => o.kind !== "-").length;
    out.push(`@@ -${oldLine},${oldCount} +${newLine},${newCount} @@`);
    for (const op of hunk) out.push(`${op.kind}${op.text}`);
    k = stop + 1;
  }
  return out.join("\n");
}
