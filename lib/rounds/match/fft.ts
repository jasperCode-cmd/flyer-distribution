// A plain radix-2 FFT, in place, in one and two dimensions. Pure.

export const pow2 = (n: number) => 2 ** Math.ceil(Math.log2(Math.max(1, n)));

function fft1(re: Float64Array, im: Float64Array, n: number, off: number, stride: number, inverse: boolean) {
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const a = off + i * stride;
      const b = off + j * stride;
      let t = re[a];
      re[a] = re[b];
      re[b] = t;
      t = im[a];
      im[a] = im[b];
      im[b] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k++) {
        const a = off + (i + k) * stride;
        const b = off + (i + k + half) * stride;
        const xr = re[b] * cr - im[b] * ci;
        const xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

// W and H must be powers of two.
export function fft2(re: Float64Array, im: Float64Array, W: number, H: number, inverse = false): void {
  for (let y = 0; y < H; y++) fft1(re, im, W, y * W, 1, inverse);
  for (let x = 0; x < W; x++) fft1(re, im, H, x, W, inverse);
  if (inverse) {
    const n = W * H;
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}
