export default function useLUFSNormalizer() {
  // K-weightingフィルタ係数を算出 (ITU-R BS.1770-4)
  const getKWeightingCoefficients = (sampleRate) => {
    // Stage 1: Pre-filter (head acoustics high-shelf)
    const f0_1 = 1681.974450955533
    const G_1 = 3.999843853973347
    const Q_1 = 0.7071752369554196

    const K_1 = Math.tan(Math.PI * f0_1 / sampleRate)
    const Vh = Math.pow(10, G_1 / 20)
    const Vb = Math.pow(Vh, 0.4996667741545416)
    const a0_1 = 1.0 + K_1 / Q_1 + K_1 * K_1

    const stage1 = {
      b0: (Vh + Vb * K_1 / Q_1 + K_1 * K_1) / a0_1,
      b1: 2.0 * (K_1 * K_1 - Vh) / a0_1,
      b2: (Vh - Vb * K_1 / Q_1 + K_1 * K_1) / a0_1,
      a1: 2.0 * (K_1 * K_1 - 1.0) / a0_1,
      a2: (1.0 - K_1 / Q_1 + K_1 * K_1) / a0_1
    }

    // Stage 2: RLB weighting (high-pass)
    const f0_2 = 38.13547087602444
    const Q_2 = 0.5003270373238773

    const K_2 = Math.tan(Math.PI * f0_2 / sampleRate)
    const a0_2 = 1.0 + K_2 / Q_2 + K_2 * K_2

    const stage2 = {
      b0: 1.0 / a0_2,
      b1: -2.0 / a0_2,
      b2: 1.0 / a0_2,
      a1: 2.0 * (K_2 * K_2 - 1.0) / a0_2,
      a2: (1.0 - K_2 / Q_2 + K_2 * K_2) / a0_2
    }

    return { stage1, stage2 }
  }

  // Biquadフィルタ適用
  const applyBiquad = (samples, coeffs) => {
    const { b0, b1, b2, a1, a2 } = coeffs
    const output = new Float64Array(samples.length)
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0

    for (let i = 0; i < samples.length; i++) {
      const x = samples[i]
      const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
      output[i] = y
      x2 = x1; x1 = x
      y2 = y1; y1 = y
    }

    return output
  }

  // Short-term max LUFS を算出 (3秒窓の最大値)
  const calculateLUFS = (audioBuffer) => {
    const sampleRate = audioBuffer.sampleRate
    const numberOfChannels = audioBuffer.numberOfChannels
    const coeffs = getKWeightingCoefficients(sampleRate)

    // ブロックサイズ: 400ms、ステップ: 100ms (75%オーバーラップ)
    const blockSize = Math.round(sampleRate * 0.4)
    const stepSize = Math.round(sampleRate * 0.1)
    const totalSamples = audioBuffer.length
    const numBlocks = Math.floor((totalSamples - blockSize) / stepSize) + 1

    if (numBlocks <= 0) {
      let sum = 0
      for (let ch = 0; ch < numberOfChannels; ch++) {
        const data = audioBuffer.getChannelData(ch)
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
      }
      const ms = sum / (totalSamples * numberOfChannels)
      return ms > 0 ? -0.691 + 10 * Math.log10(ms) : -100
    }

    // ブロックごとの加重平均二乗を蓄積
    const blockLoudness = new Float64Array(numBlocks)

    for (let ch = 0; ch < numberOfChannels; ch++) {
      const rawData = audioBuffer.getChannelData(ch)
      const samples = new Float64Array(rawData.length)
      for (let i = 0; i < rawData.length; i++) samples[i] = rawData[i]

      // K-weightingフィルタ適用
      const afterStage1 = applyBiquad(samples, coeffs.stage1)
      const filtered = applyBiquad(afterStage1, coeffs.stage2)

      // ブロックごとの平均二乗
      for (let block = 0; block < numBlocks; block++) {
        const start = block * stepSize
        let sum = 0
        for (let i = start; i < start + blockSize; i++) {
          sum += filtered[i] * filtered[i]
        }
        blockLoudness[block] += sum / blockSize
      }
    }

    // Short-term窓: 3秒 = 30ブロック (100msステップ × 30)
    const shortTermBlocks = 30
    let maxLUFS = -100

    if (numBlocks < shortTermBlocks) {
      // 3秒未満の音声: 全ブロックの平均を使用
      let sum = 0
      let count = 0
      for (let i = 0; i < numBlocks; i++) {
        if (blockLoudness[i] > 0) {
          sum += blockLoudness[i]
          count++
        }
      }
      if (count > 0) {
        maxLUFS = -0.691 + 10 * Math.log10(sum / count)
      }
    } else {
      // 3秒窓をスライドさせて最大値を取得
      for (let i = 0; i <= numBlocks - shortTermBlocks; i++) {
        let sum = 0
        for (let j = i; j < i + shortTermBlocks; j++) {
          sum += blockLoudness[j]
        }
        const lufs = -0.691 + 10 * Math.log10(sum / shortTermBlocks)
        if (lufs > maxLUFS) {
          maxLUFS = lufs
        }
      }
    }

    return maxLUFS
  }

  // LUFSからゲイン値を算出
  const calculateGain = (loudnessLUFS, targetLUFS = -14) => {
    const gainDb = targetLUFS - loudnessLUFS
    const gain = Math.pow(10, gainDb / 20)
    // クリッピング防止 (最大+9.5dB ≈ 3倍)
    return Math.min(gain, 3.0)
  }

  return { calculateLUFS, calculateGain }
}
