// A list of postcode districts as a short phrase for the area pages:
// runs of three or more in a row become "SO14 to SO19", the rest are listed,
// and the last two are joined with "and". For example SO21, SO22, SO23,
// SO24 and SO32 read "SO21 to SO24 and SO32". Codes keep the order given.
export function formatPostcodeRanges(codes: readonly string[]): string {
  const parts: string[] = [];
  let run: { prefix: string; from: number; to: number } | null = null;
  const flush = () => {
    if (!run) return;
    const { prefix, from, to } = run;
    if (to - from >= 2) parts.push(`${prefix}${from} to ${prefix}${to}`);
    else for (let n = from; n <= to; n++) parts.push(`${prefix}${n}`);
    run = null;
  };
  for (const code of codes) {
    const m = /^([A-Z]+)(\d+)$/.exec(code);
    if (!m) {
      flush();
      parts.push(code);
      continue;
    }
    const prefix = m[1];
    const n = Number(m[2]);
    if (run && run.prefix === prefix && n === run.to + 1) run.to = n;
    else {
      flush();
      run = { prefix, from: n, to: n };
    }
  }
  flush();
  return parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
