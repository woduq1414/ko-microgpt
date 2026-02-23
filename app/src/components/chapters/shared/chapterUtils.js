import {
  CHAPTER_SIX_DEFAULT_STEP_OPTIONS,
  CHOSEONG_COMPAT,
  EMBEDDING_NEGATIVE_BASE,
  EMBEDDING_NEGATIVE_STRONG,
  EMBEDDING_POSITIVE_BASE,
  EMBEDDING_POSITIVE_STRONG,
  HANGUL_SYLLABLE_END,
  HANGUL_SYLLABLE_START,
  JONGSEONG_COMPAT,
  JUNGSEONG_COMPAT,
} from './chapterConstants'

export const createRevealVector = (length) => Array.from({ length: Math.max(0, Number(length) || 0) }, () => false)

export const createRevealMatrix = (rows, cols) => {
  return Array.from({ length: Math.max(0, Number(rows) || 0) }, () => createRevealVector(cols))
}

export const createRevealMatrixWithVisibleRows = (rows, cols, visibleRowCount) => {
  const safeRows = Math.max(0, Number(rows) || 0)
  const safeCols = Math.max(0, Number(cols) || 0)
  const safeVisibleRows = Math.max(0, Number(visibleRowCount) || 0)
  return Array.from({ length: safeRows }, (_, rowIndex) => {
    const isVisibleRow = rowIndex < safeVisibleRows
    return Array.from({ length: safeCols }, () => isVisibleRow)
  })
}

export const getInitialMatch = (query) => {
  if (typeof window === 'undefined') {
    return false
  }
  return window.matchMedia(query).matches
}

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export const formatTokenId = (value) => (typeof value === 'number' ? String(value) : 'N/A')

export const getRoleLabel = (roleKey, roleLabels) => {
  if (!roleKey) {
    return ''
  }
  return roleLabels?.[roleKey] ?? roleKey
}

export const buildTokenizerFromRaw = (rawText) => {
  const rawDocs = rawText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)

  const hangulDocs = rawDocs.filter((name) => /^[가-힣]+$/u.test(name))
  if (!hangulDocs.length) {
    throw new Error('No valid Hangul names found in dataset.')
  }

  const docs = hangulDocs.map((name) => name.normalize('NFD'))
  const uchars = [...new Set(docs.join(''))].sort()
  const stoi = Object.fromEntries(uchars.map((char, index) => [char, index]))

  return {
    stoi,
    bos: uchars.length,
  }
}

export const decomposeKoreanNameToNfdTokens = (name) => {
  const syllables = []
  const tokens = []

  for (const syllable of name) {
    const code = syllable.codePointAt(0)
    if (!code || code < HANGUL_SYLLABLE_START || code > HANGUL_SYLLABLE_END) {
      continue
    }

    const syllableOffset = code - HANGUL_SYLLABLE_START
    const choseongIndex = Math.floor(syllableOffset / 588)
    const jungseongIndex = Math.floor((syllableOffset % 588) / 28)
    const jongseongIndex = syllableOffset % 28

    const initial = {
      roleKey: 'initial',
      syllable,
      nfd: String.fromCharCode(0x1100 + choseongIndex),
      display: CHOSEONG_COMPAT[choseongIndex],
    }
    const medial = {
      roleKey: 'medial',
      syllable,
      nfd: String.fromCharCode(0x1161 + jungseongIndex),
      display: JUNGSEONG_COMPAT[jungseongIndex],
    }
    const final =
      jongseongIndex > 0
        ? {
            roleKey: 'final',
            syllable,
            nfd: String.fromCharCode(0x11a7 + jongseongIndex),
            display: JONGSEONG_COMPAT[jongseongIndex],
          }
        : null

    tokens.push(initial, medial)
    if (final) {
      tokens.push(final)
    }

    syllables.push({
      syllable,
      initial,
      medial,
      final,
    })
  }

  return { syllables, tokens }
}

export const getJamoInfoForChapter3 = (nfdChar) => {
  if (!nfdChar) {
    return { display: '', roleKey: '' }
  }
  const code = nfdChar.codePointAt(0)
  if (!code) {
    return { display: nfdChar, roleKey: 'other' }
  }
  if (code >= 0x1100 && code <= 0x1112) {
    return {
      display: CHOSEONG_COMPAT[code - 0x1100] ?? nfdChar,
      roleKey: 'initial',
    }
  }
  if (code >= 0x1161 && code <= 0x1175) {
    return {
      display: JUNGSEONG_COMPAT[code - 0x1161] ?? nfdChar,
      roleKey: 'medial',
    }
  }
  if (code >= 0x11a8 && code <= 0x11c2) {
    return {
      display: JONGSEONG_COMPAT[code - 0x11a7] ?? nfdChar,
      roleKey: 'final',
    }
  }
  return { display: nfdChar, roleKey: 'other' }
}

export const getInferenceTokenDisplay = (tokenId, tokenChars, bos, withRole = false, roleLabels) => {
  if (tokenId === bos) {
    return '[BOS]'
  }
  const tokenChar = tokenChars[tokenId] ?? ''
  if (!tokenChar) {
    return `ID ${tokenId}`
  }
  const jamoInfo = getJamoInfoForChapter3(tokenChar)
  if (withRole && jamoInfo.roleKey && jamoInfo.roleKey !== 'other') {
    return `${getRoleLabel(jamoInfo.roleKey, roleLabels)} ${jamoInfo.display || tokenChar}`
  }
  return jamoInfo.display || tokenChar
}

export const getChapterSevenProbValueHeatmapStyle = (probability, minProbability, maxProbability) => {
  const safeProbability = Number(probability)
  const safeMin = Number(minProbability)
  const safeMax = Number(maxProbability)
  if (!Number.isFinite(safeProbability)) {
    return {
      backgroundColor: '#fff',
      color: '#111',
    }
  }

  const denominator = safeMax - safeMin
  const normalized = denominator > 1e-12 ? clamp((safeProbability - safeMin) / denominator, 0, 1) : 0.5
  const eased = Math.pow(normalized, 0.82)
  const alpha = 0.12 + 0.56 * eased

  return {
    backgroundColor: `rgba(34, 197, 94, ${alpha.toFixed(3)})`,
    color: '#111',
  }
}

export const softmaxNumbers = (values) => {
  if (!values.length) {
    return []
  }
  const maxValue = Math.max(...values)
  const exps = values.map((value) => Math.exp(value - maxValue))
  const sum = exps.reduce((accumulator, value) => accumulator + value, 0)
  if (!Number.isFinite(sum) || sum <= 0) {
    return values.map(() => 1 / values.length)
  }
  return exps.map((value) => value / sum)
}

export const dotProduct = (left, right) => {
  const count = Math.min(left.length, right.length)
  let total = 0
  for (let index = 0; index < count; index += 1) {
    total += Number(left[index] ?? 0) * Number(right[index] ?? 0)
  }
  return total
}

export const matVec = (vector, matrix) =>
  matrix.map((row) => {
    return dotProduct(row, vector)
  })

export const sliceHead = (vector, headIndex, headDim) => {
  const start = Math.max(0, headIndex * headDim)
  return vector.slice(start, start + headDim)
}

export const mixChannel = (from, to, ratio) => Math.round(from + (to - from) * ratio)

export const hexToRgb = (hexColor) => {
  const normalized = hexColor.replace('#', '')
  const expanded = normalized.length === 3 ? normalized.split('').map((char) => `${char}${char}`).join('') : normalized
  const value = Number.parseInt(expanded, 16)
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

export const interpolateHexColor = (fromColor, toColor, ratio) => {
  const clamped = clamp(ratio, 0, 1)
  const from = hexToRgb(fromColor)
  const to = hexToRgb(toColor)
  return `rgb(${mixChannel(from.r, to.r, clamped)} ${mixChannel(from.g, to.g, clamped)} ${mixChannel(from.b, to.b, clamped)})`
}

export const getHeatColor = (value, maxAbs) => {
  const ratio = clamp(Math.abs(value) / Math.max(maxAbs, 1e-8), 0, 1)
  if (ratio < 0.02) {
    return '#f7f7f7'
  }
  if (value >= 0) {
    return interpolateHexColor(EMBEDDING_POSITIVE_BASE, EMBEDDING_POSITIVE_STRONG, ratio)
  }
  return interpolateHexColor(EMBEDDING_NEGATIVE_BASE, EMBEDDING_NEGATIVE_STRONG, ratio)
}

export const hasNumericVector = (value, expectedLength = 16) => {
  return (
    Array.isArray(value) &&
    value.length === expectedLength &&
    value.every((item) => Number.isFinite(Number(item)))
  )
}

export const isTrainingTracePayloadValid = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return false
  }
  if (Number(payload?.num_steps) !== 1000) {
    return false
  }
  if (
    !Array.isArray(payload?.step_options) ||
    payload.step_options.length !== 4 ||
    payload.step_options.some((step) => !CHAPTER_SIX_DEFAULT_STEP_OPTIONS.includes(Number(step)))
  ) {
    return false
  }
  if (!payload?.optimizer || typeof payload.optimizer !== 'object') {
    return false
  }
  if (!Array.isArray(payload?.parameter_options) || !payload.parameter_options.length) {
    return false
  }
  const paramIds = payload.parameter_options
    .map((option) => option?.id)
    .filter((id) => typeof id === 'string')
  if (paramIds.length !== payload.parameter_options.length) {
    return false
  }
  const uniqueParamIds = new Set(paramIds)
  if (uniqueParamIds.size !== paramIds.length) {
    return false
  }
  const isParameterOptionValid = payload.parameter_options.every((option) => {
    if (!option || typeof option !== 'object') {
      return false
    }
    if (typeof option.id !== 'string' || !option.id) {
      return false
    }
    if (typeof option.label !== 'string' || !option.label) {
      return false
    }
    if (!['wte', 'wpe', 'lm_head', 'attn_wq'].includes(option.matrix)) {
      return false
    }
    if (!Number.isInteger(Number(option.row_index)) || Number(option.row_index) < 0) {
      return false
    }
    if (option.token_char_nfd != null && typeof option.token_char_nfd !== 'string') {
      return false
    }
    if (option.token_char_display != null && typeof option.token_char_display !== 'string') {
      return false
    }
    return true
  })
  if (!isParameterOptionValid) {
    return false
  }

  if (!Array.isArray(payload?.steps) || payload.steps.length !== Number(payload.num_steps) + 1) {
    return false
  }

  const expectedParamIds = Array.from(uniqueParamIds)
  const isStepRecordValid = payload.steps.every((record, index) => {
    if (!record || typeof record !== 'object') {
      return false
    }
    if (Number(record.step) !== index) {
      return false
    }
    if (typeof record.word !== 'string') {
      return false
    }
    if (index === 0) {
      if (record.loss !== null) {
        return false
      }
    } else if (!Number.isFinite(Number(record.loss))) {
      return false
    }
    if (!Number.isFinite(Number(record.learning_rate))) {
      return false
    }
    if (!record.params || typeof record.params !== 'object') {
      return false
    }
    return expectedParamIds.every((paramId) => {
      const paramRecord = record.params[paramId]
      if (!paramRecord || typeof paramRecord !== 'object') {
        return false
      }
      return hasNumericVector(paramRecord.grad, 16) && hasNumericVector(paramRecord.after, 16)
    })
  })

  return isStepRecordValid
}

export const rmsNormVector = (vector, epsilon = 1e-5) => {
  if (!vector.length) {
    return []
  }
  const ms = vector.reduce((accumulator, value) => accumulator + value * value, 0) / vector.length
  const scale = 1 / Math.sqrt(ms + epsilon)
  return vector.map((value) => value * scale)
}

export const getCloudPosition = (index, isMobile) => {
  if (isMobile) {
    const x = 14 + (index % 4) * 24 + (((index * 11) % 5) - 2) * 1.4
    const y = 18 + Math.floor(index / 4) * 20 + (((index * 7) % 5) - 2) * 1.2
    return { x: clamp(x, 7, 93), y: clamp(y, 10, 92) }
  }

  const x = 6 + (index % 8) * 12 + (((index * 17) % 5) - 2) * 1.8
  const y = 10 + Math.floor(index / 8) * 18 + (((index * 13) % 5) - 2) * 1.6
  return { x: clamp(x, 4, 95), y: clamp(y, 8, 92) }
}

export const getJamoCloudPosition = (index, totalCount, isMobile) => {
  const columns = isMobile ? 5 : 10
  const rows = Math.max(1, Math.ceil(totalCount / columns))
  const colIndex = index % columns
  const rowIndex = Math.floor(index / columns)
  const xStepBase = columns > 1 ? (colIndex / (columns - 1)) * 88 : 44
  const yStepBase = rows > 1 ? (rowIndex / (rows - 1)) * 78 : 39
  const jitterX = (((index * 13) % 7) - 3) * (isMobile ? 1.25 : 1.65)
  const jitterY = (((index * 17) % 7) - 3) * (isMobile ? 1.15 : 1.45)
  const x = 6 + xStepBase + jitterX
  const y = 10 + yStepBase + jitterY
  return { x: clamp(x, 4, 96), y: clamp(y, 8, 92) }
}
