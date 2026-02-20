import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import HeroSection from './components/sections/HeroSection'
import ChapterOneSection from './components/sections/ChapterOneSection'
import ChapterTwoSection from './components/sections/ChapterTwoSection'
import ChapterThreeSection from './components/sections/ChapterThreeSection'
import ChapterFourSection from './components/sections/ChapterFourSection'
import ChapterFiveSection from './components/sections/ChapterFiveSection'
import FooterSection from './components/sections/FooterSection'

gsap.registerPlugin(ScrollTrigger)

const CHAPTER_ONE_NAMES = [
  '민준',
  '나영',
  '아희',
  '지혜',
  '시연',
  '규민',
  '승민',
  '희태',
  '준식',
  '서준',
  '도윤',
  '예준',
  '시우',
  '주원',
  '하준',
  '지호',
  '지후',
  '준우',
  '현우',
  '준서',
  '도현',
  '지훈',
  '건우',
  '우진',
  '선우',
  '민재',
  '현준',
  '유준',
  '서진',
  '연우',
  '은우',
  '정우',
  '시윤',
  '준혁',
  '승현',
  '이준',
  '승우',
  '지환',
  '민성',
  '윤우',
]

const CHAPTER_TWO_EXAMPLE_NAMES = ['시연', '민준', '나영', '지혜', '승민', '하율', '아희', '유성']
const CHAPTER_FOUR_EXAMPLE_NAMES = ['시연', '민준', '나영', '지혜', '승민', '하율', '아희', '유성']
const CHOSEONG_COMPAT = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
const JUNGSEONG_COMPAT = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ']
const JONGSEONG_COMPAT = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
const HANGUL_SYLLABLE_START = 0xac00
const HANGUL_SYLLABLE_END = 0xd7a3

const LAYER_DEPTHS = [1, 1.6, 2.2]
const CHAPTER_TWO_LAYER_DEPTHS = [0.65, 1.0, 1.35]
const ROTATION_STEPS = [-6, -3, -1, 1, 3, 6]
const SIZE_CLASSES = ['text-base', 'text-lg', 'text-xl']
const CHAPTER_TWO_BG_BASE_JAMO = [...CHOSEONG_COMPAT, ...JUNGSEONG_COMPAT]
const EMBEDDING_POSITIVE_BASE = '#e9fce9'
const EMBEDDING_POSITIVE_STRONG = '#22c55e'
const EMBEDDING_NEGATIVE_BASE = '#feeaea'
const EMBEDDING_NEGATIVE_STRONG = '#ef4444'
const ATTENTION_HIDDEN_PLACEHOLDER = '····'
const LOGIT_PARTIAL_COMMIT_STEP = 2

const createRevealVector = (length) => Array.from({ length: Math.max(0, Number(length) || 0) }, () => false)

const createRevealMatrix = (rows, cols) => {
  return Array.from({ length: Math.max(0, Number(rows) || 0) }, () => createRevealVector(cols))
}

const createRevealMatrixWithVisibleRows = (rows, cols, visibleRowCount) => {
  const safeRows = Math.max(0, Number(rows) || 0)
  const safeCols = Math.max(0, Number(cols) || 0)
  const safeVisibleRows = Math.max(0, Number(visibleRowCount) || 0)
  return Array.from({ length: safeRows }, (_, rowIndex) => {
    const isVisibleRow = rowIndex < safeVisibleRows
    return Array.from({ length: safeCols }, () => isVisibleRow)
  })
}

const getInitialMatch = (query) => {
  if (typeof window === 'undefined') {
    return false
  }
  return window.matchMedia(query).matches
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const formatTokenId = (value) => (typeof value === 'number' ? String(value) : 'N/A')

const buildTokenizerFromRaw = (rawText) => {
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

const decomposeKoreanNameToNfdTokens = (name) => {
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
      role: '초성',
      syllable,
      nfd: String.fromCharCode(0x1100 + choseongIndex),
      display: CHOSEONG_COMPAT[choseongIndex],
    }
    const medial = {
      role: '중성',
      syllable,
      nfd: String.fromCharCode(0x1161 + jungseongIndex),
      display: JUNGSEONG_COMPAT[jungseongIndex],
    }
    const final =
      jongseongIndex > 0
        ? {
            role: '종성',
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

const getJamoInfoForChapter3 = (nfdChar) => {
  if (!nfdChar) {
    return { display: '', role: '' }
  }
  const code = nfdChar.codePointAt(0)
  if (!code) {
    return { display: nfdChar, role: '기타' }
  }
  if (code >= 0x1100 && code <= 0x1112) {
    return {
      display: CHOSEONG_COMPAT[code - 0x1100] ?? nfdChar,
      role: '초성',
    }
  }
  if (code >= 0x1161 && code <= 0x1175) {
    return {
      display: JUNGSEONG_COMPAT[code - 0x1161] ?? nfdChar,
      role: '중성',
    }
  }
  if (code >= 0x11a8 && code <= 0x11c2) {
    return {
      display: JONGSEONG_COMPAT[code - 0x11a7] ?? nfdChar,
      role: '종성',
    }
  }
  return { display: nfdChar, role: '기타' }
}

const getVocabularyTokenLabel = (tokenId, tokenChars, bos) => {
  if (tokenId === bos) {
    return '[BOS]'
  }
  const tokenChar = tokenChars[tokenId] ?? ''
  if (!tokenChar) {
    return `ID ${tokenId}`
  }

  const jamoInfo = getJamoInfoForChapter3(tokenChar)
  if (jamoInfo.role && jamoInfo.role !== '기타') {
    return `${jamoInfo.role} ${jamoInfo.display || tokenChar}`
  }
  return jamoInfo.display || tokenChar
}

const softmaxNumbers = (values) => {
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

const dotProduct = (left, right) => {
  const count = Math.min(left.length, right.length)
  let total = 0
  for (let index = 0; index < count; index += 1) {
    total += Number(left[index] ?? 0) * Number(right[index] ?? 0)
  }
  return total
}

const matVec = (vector, matrix) =>
  matrix.map((row) => {
    return dotProduct(row, vector)
  })

const sliceHead = (vector, headIndex, headDim) => {
  const start = Math.max(0, headIndex * headDim)
  return vector.slice(start, start + headDim)
}

const mixChannel = (from, to, ratio) => Math.round(from + (to - from) * ratio)

const hexToRgb = (hexColor) => {
  const normalized = hexColor.replace('#', '')
  const expanded = normalized.length === 3 ? normalized.split('').map((char) => `${char}${char}`).join('') : normalized
  const value = Number.parseInt(expanded, 16)
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

const interpolateHexColor = (fromColor, toColor, ratio) => {
  const clamped = clamp(ratio, 0, 1)
  const from = hexToRgb(fromColor)
  const to = hexToRgb(toColor)
  return `rgb(${mixChannel(from.r, to.r, clamped)} ${mixChannel(from.g, to.g, clamped)} ${mixChannel(from.b, to.b, clamped)})`
}

const getHeatColor = (value, maxAbs) => {
  const ratio = clamp(Math.abs(value) / Math.max(maxAbs, 1e-8), 0, 1)
  if (ratio < 0.02) {
    return '#f7f7f7'
  }
  if (value >= 0) {
    return interpolateHexColor(EMBEDDING_POSITIVE_BASE, EMBEDDING_POSITIVE_STRONG, ratio)
  }
  return interpolateHexColor(EMBEDDING_NEGATIVE_BASE, EMBEDDING_NEGATIVE_STRONG, ratio)
}

const rmsNormVector = (vector, epsilon = 1e-5) => {
  if (!vector.length) {
    return []
  }
  const ms = vector.reduce((accumulator, value) => accumulator + value * value, 0) / vector.length
  const scale = 1 / Math.sqrt(ms + epsilon)
  return vector.map((value) => value * scale)
}

const getCloudPosition = (index, isMobile) => {
  if (isMobile) {
    const x = 14 + (index % 4) * 24 + (((index * 11) % 5) - 2) * 1.4
    const y = 18 + Math.floor(index / 4) * 20 + (((index * 7) % 5) - 2) * 1.2
    return { x: clamp(x, 7, 93), y: clamp(y, 10, 92) }
  }

  const x = 6 + (index % 8) * 12 + (((index * 17) % 5) - 2) * 1.8
  const y = 10 + Math.floor(index / 8) * 18 + (((index * 13) % 5) - 2) * 1.6
  return { x: clamp(x, 4, 95), y: clamp(y, 8, 92) }
}

const getJamoCloudPosition = (index, totalCount, isMobile) => {
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

function ChapterOneDataCloud({ names, reducedMotion, isMobile }) {
  const cloudRef = useRef(null)
  const layerRefs = useRef([])
  const visibleNames = useMemo(() => (isMobile ? names.slice(0, 14) : names), [isMobile, names])

  useLayoutEffect(() => {
    if (!cloudRef.current || reducedMotion) {
      return undefined
    }

    const ctx = gsap.context(() => {
      gsap.utils.toArray('.name-chip', cloudRef.current).forEach((chip, index) => {
        const yDrift = isMobile ? gsap.utils.random(-5, 5) : gsap.utils.random(-8, 8)
        const duration = isMobile ? gsap.utils.random(5.2, 7.4) : gsap.utils.random(2.6, 4.8)
        gsap.to(chip, {
          y: yDrift,
          repeat: -1,
          yoyo: true,
          duration,
          delay: index * 0.04,
          ease: 'sine.inOut',
        })
      })
    }, cloudRef)

    return () => ctx.revert()
  }, [isMobile, reducedMotion, visibleNames.length])

  useEffect(() => {
    const sectionEl = cloudRef.current?.closest('.chapter-one-section')
    if (!sectionEl || reducedMotion || isMobile) {
      layerRefs.current.forEach((layer) => {
        if (layer) {
          gsap.set(layer, { x: 0, y: 0 })
        }
      })
      return undefined
    }

    const onPointerMove = (event) => {
      const rect = sectionEl.getBoundingClientRect()
      const nx = (event.clientX - rect.left) / rect.width - 0.5
      const ny = (event.clientY - rect.top) / rect.height - 0.5

      layerRefs.current.forEach((layer, index) => {
        if (!layer) {
          return
        }
        const depth = LAYER_DEPTHS[index]
        gsap.to(layer, {
          x: nx * 12 * depth,
          y: ny * 10 * depth,
          duration: 0.28,
          ease: 'power2.out',
          overwrite: 'auto',
        })
      })
    }

    const onPointerLeave = () => {
      layerRefs.current.forEach((layer) => {
        if (!layer) {
          return
        }
        gsap.to(layer, {
          x: 0,
          y: 0,
          duration: 0.28,
          ease: 'power2.out',
          overwrite: 'auto',
        })
      })
    }

    sectionEl.addEventListener('pointermove', onPointerMove)
    sectionEl.addEventListener('pointerleave', onPointerLeave)

    return () => {
      sectionEl.removeEventListener('pointermove', onPointerMove)
      sectionEl.removeEventListener('pointerleave', onPointerLeave)
      onPointerLeave()
    }
  }, [isMobile, reducedMotion])

  return (
    <div ref={cloudRef} aria-hidden="true" className="name-cloud absolute inset-0 overflow-hidden">
      {[0, 1, 2].map((layerIndex) => (
        <div
          key={`name-layer-${layerIndex}`}
          ref={(node) => {
            layerRefs.current[layerIndex] = node
          }}
          className={`name-cloud-layer name-cloud-layer-${layerIndex + 1}`}
        >
          {visibleNames.map((name, index) => {
            if (index % 3 !== layerIndex) {
              return null
            }

            const { x, y } = getCloudPosition(index, isMobile)
            return (
              <div
                key={`${name}-${index}`}
                className="name-node"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  '--node-rotate': `${ROTATION_STEPS[index % 6]}deg`,
                }}
              >
                <span className={`name-chip name-chip--layer${layerIndex + 1} ${SIZE_CLASSES[index % 3]}`}>
                  {name}
                </span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function ChapterTwoJamoCloud({ reducedMotion, isMobile }) {
  const cloudRef = useRef(null)
  const layerRefs = useRef([])
  const cloudItems = useMemo(() => {
    const itemCount = isMobile ? 30 : 45
    return Array.from({ length: itemCount }, (_, index) => {
      const char = CHAPTER_TWO_BG_BASE_JAMO[index % CHAPTER_TWO_BG_BASE_JAMO.length]
      const rotate = (((index * 37) % 19) - 9) * 1.25
      return {
        id: `jamo-${index}-${char}`,
        char,
        rotate,
      }
    })
  }, [isMobile])

  useLayoutEffect(() => {
    if (!cloudRef.current || reducedMotion) {
      return undefined
    }

    const ctx = gsap.context(() => {
      gsap.utils.toArray('.jamo-float', cloudRef.current).forEach((chip, index) => {
        const yDrift = isMobile ? gsap.utils.random(-4, 4) : gsap.utils.random(-6, 6)
        const duration = isMobile ? gsap.utils.random(5.6, 7.8) : gsap.utils.random(4.0, 6.4)
        gsap.to(chip, {
          y: yDrift,
          repeat: -1,
          yoyo: true,
          duration,
          delay: index * 0.06,
          ease: 'sine.inOut',
        })
      })
    }, cloudRef)

    return () => ctx.revert()
  }, [isMobile, reducedMotion, cloudItems.length])

  useLayoutEffect(() => {
    const sectionEl = cloudRef.current?.closest('.chapter-two-section')
    if (!sectionEl || reducedMotion || isMobile) {
      layerRefs.current.forEach((layer) => {
        if (layer) {
          gsap.set(layer, { x: 0, y: 0 })
        }
      })
      return undefined
    }

    const onPointerMove = (event) => {
      const rect = sectionEl.getBoundingClientRect()
      const nx = (event.clientX - rect.left) / rect.width - 0.5
      const ny = (event.clientY - rect.top) / rect.height - 0.5

      layerRefs.current.forEach((layer, index) => {
        if (!layer) {
          return
        }
        const depth = CHAPTER_TWO_LAYER_DEPTHS[index]
        gsap.to(layer, {
          x: nx * 10 * depth,
          y: ny * 8 * depth,
          duration: 0.24,
          ease: 'power2.out',
          overwrite: 'auto',
        })
      })
    }

    const onPointerLeave = () => {
      layerRefs.current.forEach((layer) => {
        if (!layer) {
          return
        }
        gsap.to(layer, {
          x: 0,
          y: 0,
          duration: 0.24,
          ease: 'power2.out',
          overwrite: 'auto',
        })
      })
    }

    sectionEl.addEventListener('pointermove', onPointerMove)
    sectionEl.addEventListener('pointerleave', onPointerLeave)

    return () => {
      sectionEl.removeEventListener('pointermove', onPointerMove)
      sectionEl.removeEventListener('pointerleave', onPointerLeave)
      onPointerLeave()
    }
  }, [isMobile, reducedMotion])

  return (
    <div ref={cloudRef} aria-hidden="true" className="jamo-cloud absolute inset-0 overflow-hidden">
      {[0, 1, 2].map((layerIndex) => (
        <div
          key={`jamo-layer-${layerIndex}`}
          ref={(node) => {
            layerRefs.current[layerIndex] = node
          }}
          className={`jamo-cloud-layer jamo-cloud-layer-${layerIndex + 1}`}
        >
          {cloudItems.map((item, index) => {
            if (index % 3 !== layerIndex) {
              return null
            }
            const { x, y } = getJamoCloudPosition(index, cloudItems.length, isMobile)
            return (
              <div
                key={item.id}
                className="jamo-node"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  '--jamo-rotate': `${item.rotate}deg`,
                }}
              >
                <span className="jamo-float">{item.char}</span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function ChapterTwoTokenizationDemo({ tokenizer, reducedMotion, isMobile }) {
  const [exampleNameIndex, setExampleNameIndex] = useState(0)
  const [selectedTokenId, setSelectedTokenId] = useState(null)
  const [hoveredTokenId, setHoveredTokenId] = useState(null)

  const currentExampleName = CHAPTER_TWO_EXAMPLE_NAMES[exampleNameIndex]
  const decomposition = useMemo(() => decomposeKoreanNameToNfdTokens(currentExampleName), [currentExampleName])

  const tokenSequence = useMemo(() => {
    const phonemeTokens = decomposition.tokens.map((token, index) => {
      return {
        id: `phoneme-${index}`,
        display: token.display,
        nfd: token.nfd,
        role: token.role,
        syllable: token.syllable,
        tokenId: tokenizer.stoi[token.nfd],
        isBos: false,
      }
    })

    return [
      {
        id: 'bos',
        display: '[BOS]',
        nfd: 'BOS',
        role: '시퀀스 시작',
        syllable: '-',
        tokenId: tokenizer.bos,
        isBos: true,
      },
      ...phonemeTokens,
      {
        id: 'bos-end',
        display: '[BOS]',
        nfd: 'BOS',
        role: '시퀀스 끝',
        syllable: '-',
        tokenId: tokenizer.bos,
        isBos: true,
      },
    ]
  }, [decomposition.tokens, tokenizer])

  useLayoutEffect(() => {
    if (reducedMotion) {
      return undefined
    }

    const ctx = gsap.context(() => {
      gsap.from('.token-chip', {
        y: 0,
        opacity: 0,
        duration: 0.35,
        stagger: 0.05,
        ease: 'power2.out',
      })
    })

    return () => ctx.revert()
  }, [reducedMotion, tokenSequence.length, currentExampleName])

  const selectedToken = tokenSequence.find((token) => token.id === selectedTokenId) ?? null

  const handleTokenHoverStart = (tokenId) => setHoveredTokenId(tokenId)
  const handleTokenHoverEnd = () => setHoveredTokenId(null)
  const handleTokenSelect = (tokenId) => setSelectedTokenId(tokenId)
  const moveExampleName = (direction) => {
    setExampleNameIndex((prevIndex) => {
      const nextIndex = (prevIndex + direction + CHAPTER_TWO_EXAMPLE_NAMES.length) % CHAPTER_TWO_EXAMPLE_NAMES.length
      return nextIndex
    })
    setSelectedTokenId(null)
    setHoveredTokenId(null)
  }

  return (
    <div className="token-demo-wrap reveal">
      <div className="token-syllable-card -rotate-1 py-1">
        <p className="inline-block border-4 border-black bg-neo-secondary px-3 py-2 text-xs font-black uppercase tracking-[0.2em]">
          EXAMPLE NAME
        </p>
        <div className="token-name-switcher mt-4">
          <button
            type="button"
            className="token-name-arrow"
            onClick={() => moveExampleName(-1)}
            aria-label="이전 예시 이름 보기"
          >
            <span className="token-name-arrow-shape token-name-arrow-shape-left" />
          </button>

          <p className="token-name-pill">{currentExampleName}</p>

          <button
            type="button"
            className="token-name-arrow"
            onClick={() => moveExampleName(1)}
            aria-label="다음 예시 이름 보기"
          >
            <span className="token-name-arrow-shape token-name-arrow-shape-right" />
          </button>
        </div>

       
        <p className="mt-5 inline-block border-4 border-black bg-neo-accent px-3 py-2 text-xs font-black uppercase tracking-[0.2em]">
          TOKEN SEQUENCE
        </p>
        <div className="token-chip-list">
          {tokenSequence.map((token) => (
            <button
              key={token.id}
              type="button"
              className={`token-chip ${token.isBos ? 'token-chip--bos' : ''} ${selectedTokenId === token.id ? 'token-chip--selected' : ''}`}
              onMouseEnter={() => handleTokenHoverStart(token.id)}
              onMouseLeave={handleTokenHoverEnd}
              onFocus={() => handleTokenHoverStart(token.id)}
              onBlur={handleTokenHoverEnd}
              onClick={() => handleTokenSelect(token.id)}
              aria-label={`${token.display} ${token.role} token id ${formatTokenId(token.tokenId)}`}
            >
              <span className="token-chip-symbol">{token.display}</span>
              <span className="token-chip-meta">{token.role}</span>
              {hoveredTokenId === token.id ? (
                <span className={`token-tooltip ${isMobile ? 'token-tooltip-mobile' : ''}`}>
                  ID {formatTokenId(token.tokenId)}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <aside className="token-inspector reveal">
        <p className="text-xs font-black uppercase tracking-[0.2em]">현재 선택 토큰</p>
        {selectedToken ? (
          <>
            <p className="mt-3 inline-block border-4 border-white bg-black px-4 py-2 text-2xl font-black">
              {selectedToken.display}
            </p>

            <div className="token-inspector-row">
              <span>역할</span>
              <strong>{selectedToken.role}</strong>
            </div>
            <div className="token-inspector-row">
              <span>음절</span>
              <strong>{selectedToken.syllable}</strong>
            </div>
            <div className="token-inspector-row">
              <span>Token ID</span>
              <strong>{formatTokenId(selectedToken.tokenId)}</strong>
            </div>
          </>
        ) : (
          <p className="mt-3 border-4 border-white bg-black px-4 py-4 text-sm font-bold leading-relaxed">
            아직 선택된 토큰이 없어요. 토큰을 클릭하면 여기에 선택 정보가 표시됩니다.
          </p>
        )}
      </aside>
    </div>
  )
}

function ChapterThreeEmbeddingDemo({ snapshot, reducedMotion, isMobile }) {
  const tokenChars = snapshot?.tokenizer?.uchars ?? []
  const tokenCount = tokenChars.length
  const nEmbd = Number(snapshot?.n_embd ?? 16)
  const finalDelayMs = 450
  const positionCount = Math.min(Number(snapshot?.block_size ?? 16), snapshot?.wpe?.length ?? 0)
  const [tokenIndex, setTokenIndex] = useState(0)
  const [positionIndex, setPositionIndex] = useState(0)
  const [openInfoKey, setOpenInfoKey] = useState(null)
  const [isFinalPending, setIsFinalPending] = useState(false)
  const [displayedFinalVector, setDisplayedFinalVector] = useState(() => {
    const initialToken = snapshot?.wte?.[0] ?? []
    const initialPosition = snapshot?.wpe?.[0] ?? []
    const initialSum = Array.from(
      { length: nEmbd },
      (_, index) => Number(initialToken[index] ?? 0) + Number(initialPosition[index] ?? 0),
    )
    return rmsNormVector(initialSum)
  })
  const tokenRowRefs = useRef([])
  const positionRowRefs = useRef([])
  const sumRowRefs = useRef([])
  const finalRowRefs = useRef([])
  const positionColumnRef = useRef(null)
  const sumColumnRef = useRef(null)
  const finalColumnRef = useRef(null)
  const flowLayerRef = useRef(null)
  const sumToFinalTimelineRef = useRef(null)
  const finalDelayTimeoutRef = useRef(null)
  const animationCycleRef = useRef(0)
  const safeTokenIndex = tokenCount ? ((tokenIndex % tokenCount) + tokenCount) % tokenCount : 0
  const safePositionIndex = positionCount ? ((positionIndex % positionCount) + positionCount) % positionCount : 0

  const tokenVector = useMemo(() => {
    const row = snapshot?.wte?.[safeTokenIndex] ?? []
    return Array.from({ length: nEmbd }, (_, index) => Number(row[index] ?? 0))
  }, [nEmbd, safeTokenIndex, snapshot])

  const positionVector = useMemo(() => {
    const row = snapshot?.wpe?.[safePositionIndex] ?? []
    return Array.from({ length: nEmbd }, (_, index) => Number(row[index] ?? 0))
  }, [nEmbd, safePositionIndex, snapshot])

  const sumVector = useMemo(
    () => tokenVector.map((tokenValue, index) => tokenValue + positionVector[index]),
    [positionVector, tokenVector],
  )

  const computedFinalVector = useMemo(() => rmsNormVector(sumVector), [sumVector])

  const maxAbs = useMemo(() => {
    return Math.max(
      1e-8,
      ...tokenVector.map((value) => Math.abs(value)),
      ...positionVector.map((value) => Math.abs(value)),
      ...sumVector.map((value) => Math.abs(value)),
      ...computedFinalVector.map((value) => Math.abs(value)),
      ...displayedFinalVector.map((value) => Math.abs(value)),
    )
  }, [computedFinalVector, displayedFinalVector, positionVector, sumVector, tokenVector])

  useEffect(
    () => () => {
      if (finalDelayTimeoutRef.current) {
        window.clearTimeout(finalDelayTimeoutRef.current)
        finalDelayTimeoutRef.current = null
      }
      if (sumToFinalTimelineRef.current) {
        sumToFinalTimelineRef.current.kill()
        sumToFinalTimelineRef.current = null
      }
    },
    [],
  )

  useEffect(() => {
    if (openInfoKey === null) {
      return undefined
    }

    const onPointerDown = (event) => {
      const target = event.target
      if (target instanceof Element && target.closest('.embedding-help-wrap')) {
        return
      }
      setOpenInfoKey(null)
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpenInfoKey(null)
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [openInfoKey])

  useLayoutEffect(() => {
    const sumRows = sumRowRefs.current.slice(0, nEmbd).filter(Boolean)
    const finalRows = finalRowRefs.current.slice(0, nEmbd).filter(Boolean)
    const flowLayer = flowLayerRef.current
    const positionColumnEl = positionColumnRef.current
    const sumColumnEl = sumColumnRef.current
    const finalColumnEl = finalColumnRef.current

    if (!sumRows.length || !finalRows.length || !flowLayer) {
      return undefined
    }

    if (finalDelayTimeoutRef.current) {
      window.clearTimeout(finalDelayTimeoutRef.current)
      finalDelayTimeoutRef.current = null
    }
    if (sumToFinalTimelineRef.current) {
      sumToFinalTimelineRef.current.kill()
      sumToFinalTimelineRef.current = null
    }

    flowLayer.innerHTML = ''
    const flowLayerRect = flowLayer.getBoundingClientRect()
    const createdNodes = []
    const cycle = animationCycleRef.current + 1
    animationCycleRef.current = cycle

    const appendOperationStickerTimeline = ({
      timeline,
      label,
      fromColumnEl,
      toColumnEl,
      startAt = 0,
      variant = 'rms',
    }) => {
      const fromRect = fromColumnEl?.getBoundingClientRect()
      const toRect = toColumnEl?.getBoundingClientRect()
      if (!fromRect || !toRect) {
        return
      }

      const centerX = (fromRect.right + toRect.left) * 0.5 - flowLayerRect.left
      const centerY =
        (fromRect.top + fromRect.bottom + toRect.top + toRect.bottom) * 0.25 -
        flowLayerRect.top
      const sticker = document.createElement('span')
      sticker.className = `embedding-op-sticker embedding-op-sticker--${variant}`
      sticker.textContent = label
      sticker.style.left = `${centerX}px`
      sticker.style.top = `${centerY}px`
      flowLayer.appendChild(sticker)
      createdNodes.push(sticker)

      timeline.fromTo(
        sticker,
        { opacity: 0, scale: 0.86, rotate: -2 },
        { opacity: 1, scale: 1.02, rotate: 1, duration: 0.12, ease: 'power2.out' },
        startAt,
      )
      timeline.to(
        sticker,
        {
          opacity: 0,
          scale: 1.04,
          rotate: 2,
          duration: 0.22,
          ease: 'power2.in',
          onComplete: () => {
            sticker.remove()
          },
        },
        startAt + 0.22,
      )
    }

    if (reducedMotion) {
      const sumStageTimeline = gsap.timeline()
      appendOperationStickerTimeline({
        timeline: sumStageTimeline,
        label: 'SUM',
        fromColumnEl: positionColumnEl,
        toColumnEl: sumColumnEl,
        startAt: 0,
        variant: 'sum',
      })
      sumStageTimeline.fromTo(
        sumRows,
        { opacity: 0.84 },
        {
          opacity: 1,
          duration: 0.16,
          stagger: 0.01,
          ease: 'power2.out',
          overwrite: 'auto',
        },
        0.08,
      )

      finalDelayTimeoutRef.current = window.setTimeout(() => {
        if (animationCycleRef.current !== cycle) {
          return
        }

        setDisplayedFinalVector(computedFinalVector)

        const finalStageTimeline = gsap.timeline({
          onComplete: () => {
            if (animationCycleRef.current === cycle) {
              setIsFinalPending(false)
            }
          },
        })
        appendOperationStickerTimeline({
          timeline: finalStageTimeline,
          label: 'RMSNORM',
          fromColumnEl: sumColumnEl,
          toColumnEl: finalColumnEl,
          startAt: 0,
          variant: 'rms',
        })
        finalStageTimeline.fromTo(
          finalRows,
          { opacity: 0.84 },
          {
            opacity: 1,
            duration: 0.16,
            stagger: 0.01,
            ease: 'power2.out',
            overwrite: 'auto',
          },
          0.08,
        )
        sumToFinalTimelineRef.current = finalStageTimeline
      }, finalDelayMs)

      return () => {
        sumStageTimeline.kill()
        if (finalDelayTimeoutRef.current) {
          window.clearTimeout(finalDelayTimeoutRef.current)
          finalDelayTimeoutRef.current = null
        }
        if (sumToFinalTimelineRef.current) {
          sumToFinalTimelineRef.current.kill()
          sumToFinalTimelineRef.current = null
        }
        createdNodes.forEach((node) => node.remove())
        flowLayer.innerHTML = ''
      }
    }
    const timeline = gsap.timeline()
    appendOperationStickerTimeline({
      timeline,
      label: 'SUM',
      fromColumnEl: positionColumnEl,
      toColumnEl: sumColumnEl,
      startAt: 0,
      variant: 'sum',
    })

    for (let rowIndex = 0; rowIndex < nEmbd; rowIndex += 1) {
      const tokenRow = tokenRowRefs.current[rowIndex]
      const positionRow = positionRowRefs.current[rowIndex]
      const sumRow = sumRowRefs.current[rowIndex]
      if (!tokenRow || !positionRow || !sumRow) {
        continue
      }

      const tokenRect = tokenRow.getBoundingClientRect()
      const positionRect = positionRow.getBoundingClientRect()
      const sumRect = sumRow.getBoundingClientRect()
      const tokenStartX = tokenRect.left - flowLayerRect.left + tokenRect.width * 0.86
      const tokenStartY = tokenRect.top - flowLayerRect.top + tokenRect.height / 2
      const positionStartX = positionRect.left - flowLayerRect.left + positionRect.width * 0.86
      const positionStartY = positionRect.top - flowLayerRect.top + positionRect.height / 2
      const sumTargetX = sumRect.left - flowLayerRect.left + sumRect.width * 0.5
      const sumTargetY = sumRect.top - flowLayerRect.top + sumRect.height / 2
      const delay = rowIndex * 0.02

      const tokenDot = document.createElement('span')
      tokenDot.className = 'embedding-flow-dot embedding-flow-dot--token'
      flowLayer.appendChild(tokenDot)
      createdNodes.push(tokenDot)

      timeline.fromTo(
        tokenDot,
        { x: tokenStartX, y: tokenStartY, opacity: 0, scale: 0.7 },
        { opacity: 1, duration: 0.08, ease: 'power2.out' },
        delay,
      )
      timeline.to(
        tokenDot,
        {
          x: sumTargetX,
          y: sumTargetY,
          duration: 0.45,
          ease: 'power2.out',
        },
        delay,
      )
      timeline.to(tokenDot, { opacity: 0, duration: 0.12, ease: 'power2.in' }, delay + 0.33)

      const positionDot = document.createElement('span')
      positionDot.className = 'embedding-flow-dot embedding-flow-dot--pos'
      flowLayer.appendChild(positionDot)
      createdNodes.push(positionDot)

      timeline.fromTo(
        positionDot,
        { x: positionStartX, y: positionStartY, opacity: 0, scale: 0.7 },
        { opacity: 1, duration: 0.08, ease: 'power2.out' },
        delay,
      )
      timeline.to(
        positionDot,
        {
          x: sumTargetX,
          y: sumTargetY,
          duration: 0.45,
          ease: 'power2.out',
        },
        delay,
      )
      timeline.to(positionDot, { opacity: 0, duration: 0.12, ease: 'power2.in' }, delay + 0.33)
    }

    timeline.fromTo(
      sumRows,
      { scale: 1, opacity: 0.9 },
      {
        scale: 1.02,
        opacity: 1,
        duration: 0.15,
        repeat: 1,
        yoyo: true,
        stagger: 0.02,
        ease: 'power2.out',
      },
      0.06,
    )

    finalDelayTimeoutRef.current = window.setTimeout(() => {
      if (animationCycleRef.current !== cycle) {
        return
      }

      setDisplayedFinalVector(computedFinalVector)

      const sumToFinalTimeline = gsap.timeline({
        onComplete: () => {
          if (animationCycleRef.current === cycle) {
            setIsFinalPending(false)
          }
        },
      })
      appendOperationStickerTimeline({
        timeline: sumToFinalTimeline,
        label: 'RMSNORM',
        fromColumnEl: sumColumnEl,
        toColumnEl: finalColumnEl,
        startAt: 0,
        variant: 'rms',
      })

      for (let rowIndex = 0; rowIndex < nEmbd; rowIndex += 1) {
        const sumRow = sumRowRefs.current[rowIndex]
        const finalRow = finalRowRefs.current[rowIndex]
        if (!sumRow || !finalRow) {
          continue
        }

        const sumRect = sumRow.getBoundingClientRect()
        const finalRect = finalRow.getBoundingClientRect()
        const sumStartX = sumRect.left - flowLayerRect.left + sumRect.width * 0.85
        const sumStartY = sumRect.top - flowLayerRect.top + sumRect.height / 2
        const finalTargetX = finalRect.left - flowLayerRect.left + finalRect.width * 0.5
        const finalTargetY = finalRect.top - flowLayerRect.top + finalRect.height / 2
        const delay = 0.08 + rowIndex * 0.02

        const sumDot = document.createElement('span')
        sumDot.className = 'embedding-flow-dot embedding-flow-dot--sum'
        flowLayer.appendChild(sumDot)
        createdNodes.push(sumDot)

        sumToFinalTimeline.fromTo(
          sumDot,
          { x: sumStartX, y: sumStartY, opacity: 0, scale: 0.74 },
          { opacity: 1, duration: 0.08, ease: 'power2.out' },
          delay,
        )
        sumToFinalTimeline.to(
          sumDot,
          {
            x: finalTargetX,
            y: finalTargetY,
            duration: 0.45,
            ease: 'power2.out',
          },
          delay,
        )
        sumToFinalTimeline.to(sumDot, { opacity: 0, duration: 0.12, ease: 'power2.in' }, delay + 0.33)
      }

      sumToFinalTimeline.fromTo(
        finalRows,
        { scale: 1, opacity: 0.9 },
        {
          scale: 1.02,
          opacity: 1,
          duration: 0.15,
          repeat: 1,
          yoyo: true,
          stagger: 0.02,
          ease: 'power2.out',
        },
        0.06,
      )

      sumToFinalTimelineRef.current = sumToFinalTimeline
    }, finalDelayMs)

    return () => {
      timeline.kill()
      if (finalDelayTimeoutRef.current) {
        window.clearTimeout(finalDelayTimeoutRef.current)
        finalDelayTimeoutRef.current = null
      }
      if (sumToFinalTimelineRef.current) {
        sumToFinalTimelineRef.current.kill()
        sumToFinalTimelineRef.current = null
      }
      createdNodes.forEach((dot) => dot.remove())
      flowLayer.innerHTML = ''
    }
  }, [computedFinalVector, finalDelayMs, nEmbd, reducedMotion, safePositionIndex, safeTokenIndex])

  if (!tokenCount || !positionCount) {
    return null
  }

  const moveToken = (direction) => {
    setIsFinalPending(true)
    setTokenIndex((prevIndex) => (prevIndex + direction + tokenCount) % tokenCount)
    setOpenInfoKey(null)
  }
  const movePosition = (direction) => {
    setIsFinalPending(true)
    setPositionIndex((prevIndex) => (prevIndex + direction + positionCount) % positionCount)
    setOpenInfoKey(null)
  }
  const jamoInfo = getJamoInfoForChapter3(tokenChars[safeTokenIndex])
  const displayChar = jamoInfo.display
  const displayRole = jamoInfo.role
  const valueTextClass = isMobile ? 'text-[11px]' : 'text-xs'
  const columns = [
    {
      key: 'token',
      title: 'TOKEN EMBEDDING',
      infoTitle: 'Token Embedding',
      infoBody: '음운 자체 의미를 담는 벡터입니다.',
      vector: tokenVector,
      rowRef: tokenRowRefs,
      columnRef: null,
    },
    {
      key: 'position',
      title: 'POSITION EMBEDDING',
      infoTitle: 'Position Embedding',
      infoBody: "토큰이 시퀀스의 몇 번째인지 알려주는 벡터입니다. 왜 토큰의 위치 정보를 임베딩하는 걸까요? 이는 모델이 시퀀스의 순서를 인식하고, 이전 토큰들의 정보를 참고할 수 있게 도와주기 때문입니다.",
      vector: positionVector,
      rowRef: positionRowRefs,
      columnRef: positionColumnRef,
    },
    {
      key: 'sum',
      title: 'SUM EMBEDDING',
      infoTitle: 'Sum Embedding',
      infoBody: "토큰 임베딩과 위치 임베딩을 차원별로 더한 중간 입력입니다. 이 벡터는 토큰과 위치의 정보를 모두 반영한 결과로, 모델이 토큰과 위치를 동시에 고려할 수 있게 해줍니다.",
      vector: sumVector,
      rowRef: sumRowRefs,
      columnRef: sumColumnRef,
    },
    {
      key: 'final',
      title: 'FINAL EMBEDDING',
      infoTitle: 'Final Embedding',
      infoBody: "합 벡터를 RMSNorm으로 스케일링한 최종 입력입니다. 이 과정을 통해 벡터의 크기를 1로 만들고, 모델의 학습 안정성을 높이는 역할을 합니다.",
      vector: displayedFinalVector,
      rowRef: finalRowRefs,
      columnRef: finalColumnRef,
    },
  ]

  return (
    <div className="embedding-demo-wrap reveal">
      <div className="embedding-controls">
        <div className="embedding-nav">
          <p className="embedding-nav-title">예시 음운</p>
          <div className="embedding-nav-inner">
            <button
              type="button"
              className="embedding-nav-arrow"
              onClick={() => moveToken(-1)}
              aria-label="이전 음운"
            >
              <span className="embedding-nav-arrow-shape embedding-nav-arrow-shape-left" />
            </button>
            <p className="embedding-nav-pill">
              <span className="embedding-nav-pill-char">{`${displayRole} ${displayChar}`.trim()}</span>
              <span className="embedding-nav-pill-meta">ID {safeTokenIndex}</span>
            </p>
            <button
              type="button"
              className="embedding-nav-arrow"
              onClick={() => moveToken(1)}
              aria-label="다음 음운"
            >
              <span className="embedding-nav-arrow-shape embedding-nav-arrow-shape-right" />
            </button>
          </div>
        </div>

        <div className="embedding-nav">
          <p className="embedding-nav-title">위치 인덱스</p>
          <div className="embedding-nav-inner">
            <button
              type="button"
              className="embedding-nav-arrow"
              onClick={() => movePosition(-1)}
              aria-label="이전 위치 인덱스"
            >
              <span className="embedding-nav-arrow-shape embedding-nav-arrow-shape-left" />
            </button>
            <p className="embedding-nav-pill">
              <span className="embedding-nav-pill-char">POS {safePositionIndex}</span>
              <span className="embedding-nav-pill-meta">0 ~ {positionCount - 1}</span>
            </p>
            <button
              type="button"
              className="embedding-nav-arrow"
              onClick={() => movePosition(1)}
              aria-label="다음 위치 인덱스"
            >
              <span className="embedding-nav-arrow-shape embedding-nav-arrow-shape-right" />
            </button>
          </div>
        </div>
      </div>

      <div className={`embedding-grid-wrap ${isFinalPending ? 'embedding-grid-wrap--pending' : ''}`}>
        <div className="embedding-grid">
          {columns.map((column) => {
            const isFlashColumn = column.key === 'sum' || column.key === 'final'
            const isInfoOpen = openInfoKey === column.key
            return (
              <section
                key={column.key}
                ref={(node) => {
                  if (column.columnRef) {
                    column.columnRef.current = node
                  }
                }}
                className={`embedding-col reveal ${column.key === 'sum' ? 'embedding-col--sum' : ''} ${column.key === 'final' ? 'embedding-col--final' : ''}`}
              >
                <div className="embedding-col-head">
                  <p className="embedding-col-title">{column.title}</p>
                  <div className="embedding-help-wrap">
                    <button
                      type="button"
                      className="embedding-help-btn"
                      onClick={() => {
                        setOpenInfoKey((prevKey) => (prevKey === column.key ? null : column.key))
                      }}
                      aria-label={`${column.title} 개념 설명`}
                      aria-expanded={isInfoOpen}
                      aria-controls={`embedding-help-${column.key}`}
                    >
                      ?
                    </button>
                    {isInfoOpen ? (
                      <div id={`embedding-help-${column.key}`} role="note" className="embedding-help-popover">
                        <p className="embedding-help-title">{column.infoTitle}</p>
                        <p className="embedding-help-text">{column.infoBody}</p>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="embedding-col-rows">
                  {column.vector.map((value, rowIndex) => {
                    const ratio = clamp(Math.abs(value) / maxAbs, 0, 1)
                    return (
                      <div
                        key={`${column.key}-${rowIndex}`}
                        ref={(node) => {
                          column.rowRef.current[rowIndex] = node
                        }}
                        className={`embedding-row ${isFlashColumn ? 'embedding-sum-row--flash' : ''}`}
                        style={{
                          backgroundColor: getHeatColor(value, maxAbs),
                        }}
                      >
                        <span className={`embedding-row-index ${valueTextClass}`}>{rowIndex}</span>
                        <span className={`embedding-value ${valueTextClass}`} style={{ color: ratio > 0.8 ? '#fff' : '#000' }}>
                          {value.toFixed(2)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>

        <div ref={flowLayerRef} className="embedding-flow-layer" aria-hidden="true" />
      </div>
    </div>
  )
}

function ChapterFourAttentionDemo({ snapshot, attention, reducedMotion, isMobile }) {
  const tokenChars = useMemo(() => snapshot?.tokenizer?.uchars ?? [], [snapshot])
  const bos = Number(snapshot?.tokenizer?.bos ?? -1)
  const nEmbd = Number(snapshot?.n_embd ?? 16)
  const blockSize = Number(snapshot?.block_size ?? 16)
  const nHead = Number(attention?.n_head ?? 1)
  const headIndex = 0
  const headDim = Number(attention?.head_dim ?? 0)
  const attnWq = attention?.attn_wq ?? []
  const attnWk = attention?.attn_wk ?? []
  const attnWv = attention?.attn_wv ?? []
  const attnWo = attention?.attn_wo ?? []
  const mlpFc1 = snapshot?.mlp?.mlp_fc1 ?? []
  const mlpFc2 = snapshot?.mlp?.mlp_fc2 ?? []
  const lmHead = snapshot?.lm_head ?? []
  const wte = snapshot?.wte ?? []
  const wpe = snapshot?.wpe ?? []
  const [exampleNameIndex, setExampleNameIndex] = useState(0)
  const [queryIndex, setQueryIndex] = useState(0)
  const [openInfoKey, setOpenInfoKey] = useState(null)
  const [animationTick, setAnimationTick] = useState(1)
  const [isAnimating, setIsAnimating] = useState(false)
  const [skipAnimations, setSkipAnimations] = useState(false)
  const [outputStep, setOutputStep] = useState(0)
  const [revealedXDims, setRevealedXDims] = useState([])
  const [revealedQDims, setRevealedQDims] = useState([])
  const [revealedKCells, setRevealedKCells] = useState([])
  const [revealedVCells, setRevealedVCells] = useState([])
  const [revealedWeights, setRevealedWeights] = useState([])
  const [revealedContribCells, setRevealedContribCells] = useState([])
  const [revealedOutputDims, setRevealedOutputDims] = useState([])
  const [revealedHeadOutputCells, setRevealedHeadOutputCells] = useState([])
  const [revealedMhaInputDims, setRevealedMhaInputDims] = useState([])
  const [revealedMhaOutputDims, setRevealedMhaOutputDims] = useState([])
  const [revealedResultDims, setRevealedResultDims] = useState([])
  const [revealedBlockOutputDims, setRevealedBlockOutputDims] = useState([])
  const [revealedLogitRows, setRevealedLogitRows] = useState([])
  const [revealedProbRows, setRevealedProbRows] = useState([])
  const [displayedWeights, setDisplayedWeights] = useState([])
  const [displayedOutput, setDisplayedOutput] = useState([])
  const [displayedMhaOutput, setDisplayedMhaOutput] = useState([])
  const [displayedResultVector, setDisplayedResultVector] = useState([])
  const [displayedBlockOutputVector, setDisplayedBlockOutputVector] = useState([])
  const [displayedLogits, setDisplayedLogits] = useState([])
  const [displayedProbs, setDisplayedProbs] = useState([])
  const pipelineContentRef = useRef(null)
  const bridgeLayerRef = useRef(null)
  const bridgeTopPathRef = useRef(null)
  const bridgeResultPathRef = useRef(null)
  const flowLayerRef = useRef(null)
  const xVectorRef = useRef(null)
  const xValueRefs = useRef([])
  const qVectorRef = useRef(null)
  const kRowRefs = useRef([])
  const vRowRefs = useRef([])
  const weightRowRefs = useRef([])
  const qCellRefs = useRef([])
  const kCellRefs = useRef([])
  const vCellRefs = useRef([])
  const weightValueRefs = useRef([])
  const contribCellRefs = useRef([])
  const outputCellRefs = useRef([])
  const contribRowRefs = useRef([])
  const outputVectorRef = useRef(null)
  const headsStageRef = useRef(null)
  const mhaStageRef = useRef(null)
  const headOutputRowRefs = useRef([])
  const headOutputCellRefs = useRef([])
  const headSummaryQRefs = useRef([])
  const headSummaryKRefs = useRef([])
  const headSummaryVRefs = useRef([])
  const mhaInputRowRef = useRef(null)
  const mhaInputCellRefs = useRef([])
  const mhaOutputRowRef = useRef(null)
  const mhaOutputCellRefs = useRef([])
  const resultRowRef = useRef(null)
  const resultCellRefs = useRef([])
  const blockOutputStageRef = useRef(null)
  const blockOutputRowRef = useRef(null)
  const blockOutputCellRefs = useRef([])
  const logitStageRef = useRef(null)
  const logitRowRefs = useRef([])
  const logitValueRefs = useRef([])
  const probStageRef = useRef(null)
  const probRowRefs = useRef([])
  const probValueRefs = useRef([])
  const timelineRef = useRef(null)
  const currentExampleName = CHAPTER_FOUR_EXAMPLE_NAMES[exampleNameIndex]
  const valueTextClass = isMobile ? 'text-[11px]' : 'text-xs'

  const isShapeValid =
    tokenChars.length > 0 &&
    Number.isFinite(bos) &&
    nEmbd > 0 &&
    blockSize > 0 &&
    nHead > 0 &&
    headDim > 0 &&
    Array.isArray(attnWq) &&
    Array.isArray(attnWk) &&
    Array.isArray(attnWv) &&
    Array.isArray(attnWo) &&
    Array.isArray(attnWq[0]) &&
    Array.isArray(attnWk[0]) &&
    Array.isArray(attnWv[0]) &&
    Array.isArray(attnWo[0]) &&
    Array.isArray(mlpFc1) &&
    Array.isArray(mlpFc2) &&
    Array.isArray(lmHead) &&
    Array.isArray(mlpFc1[0]) &&
    Array.isArray(mlpFc2[0]) &&
    Array.isArray(lmHead[0])

  const stoi = useMemo(() => {
    return Object.fromEntries(tokenChars.map((char, index) => [char, index]))
  }, [tokenChars])

  const modelSequence = useMemo(() => {
    if (!isShapeValid) {
      return []
    }
    const decomposition = decomposeKoreanNameToNfdTokens(currentExampleName)
    const sequence = [{ tokenId: bos, label: '[BOS]' }]
    decomposition.tokens.forEach((token) => {
      const tokenId = stoi[token.nfd]
      if (typeof tokenId !== 'number') {
        return
      }
      sequence.push({
        tokenId,
        label: `${token.role} ${token.display}`.trim(),
      })
    })

    return sequence.slice(0, Math.max(1, blockSize)).map((item, position) => {
      return {
        ...item,
        position,
      }
    })
  }, [blockSize, bos, currentExampleName, isShapeValid, stoi])
  const hasAttentionData = isShapeValid && modelSequence.length > 0

  useEffect(() => {
    if (openInfoKey === null) {
      return undefined
    }

    const onPointerDown = (event) => {
      const target = event.target
      if (target instanceof Element && target.closest('.attention-help-wrap')) {
        return
      }
      setOpenInfoKey(null)
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpenInfoKey(null)
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [openInfoKey])

  const safeQueryIndex = modelSequence.length ? clamp(queryIndex, 0, modelSequence.length - 1) : 0
  const causalSequence = hasAttentionData ? modelSequence.slice(0, safeQueryIndex + 1) : []
  const queryToken = modelSequence[safeQueryIndex] ?? null

  const xVectors = modelSequence.map((item) => {
    const tokenRow = wte[item.tokenId] ?? []
    const positionRow = wpe[item.position] ?? []
    const sumVector = Array.from({ length: nEmbd }, (_, index) => {
      return Number(tokenRow[index] ?? 0) + Number(positionRow[index] ?? 0)
    })
    return rmsNormVector(sumVector)
  })

  const currentXVector = xVectors[safeQueryIndex] ?? Array.from({ length: nEmbd }, () => 0)
  const currentXRows = currentXVector.map((value, dim) => ({ dim, value: Number(value ?? 0) }))
  const queryVector = currentXVector
  const queryFullVector = matVec(queryVector, attnWq)
  const queryHeadVector = sliceHead(queryFullVector, headIndex, headDim)

  const keyFullRows = causalSequence.map((item) => {
    const keyVector = matVec(xVectors[item.position] ?? [], attnWk)
    return {
      ...item,
      vector: keyVector,
    }
  })

  const valueFullRows = causalSequence.map((item) => {
    const valueVector = matVec(xVectors[item.position] ?? [], attnWv)
    return {
      ...item,
      vector: valueVector,
    }
  })

  const keyRows = keyFullRows.map((item) => {
    const keyVector = sliceHead(item.vector, headIndex, headDim)
    return {
      ...item,
      vector: keyVector,
    }
  })

  const valueRows = valueFullRows.map((item) => {
    const valueVector = sliceHead(item.vector, headIndex, headDim)
    return {
      ...item,
      vector: valueVector,
    }
  })

  const logitRows = keyRows.map((row) => {
    return {
      ...row,
      value: dotProduct(queryHeadVector, row.vector) / Math.sqrt(headDim),
    }
  })

  const weightValues = softmaxNumbers(logitRows.map((row) => row.value))
  const weightRows = causalSequence.map((row, index) => {
    return {
      ...row,
      value: Number(weightValues[index] ?? 0),
    }
  })

  const partialWeightRows = (() => {
    const rowCount = keyRows.length
    if (rowCount === 0 || headDim <= 0) {
      return []
    }

    const partialLogits = Array.from({ length: rowCount }, () => Array.from({ length: headDim }, () => 0))
    keyRows.forEach((row, rowIndex) => {
      let runningDot = 0
      for (let dimIndex = 0; dimIndex < headDim; dimIndex += 1) {
        runningDot += Number(queryHeadVector[dimIndex] ?? 0) * Number(row.vector[dimIndex] ?? 0)
        partialLogits[rowIndex][dimIndex] = runningDot / Math.sqrt(headDim)
      }
    })

    const partialWeights = Array.from({ length: rowCount }, () => Array.from({ length: headDim }, () => 0))
    for (let dimIndex = 0; dimIndex < headDim; dimIndex += 1) {
      const logitsAtDim = partialLogits.map((row) => Number(row[dimIndex] ?? 0))
      const softmaxAtDim = softmaxNumbers(logitsAtDim)
      for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
        partialWeights[rowIndex][dimIndex] = Number(softmaxAtDim[rowIndex] ?? 0)
      }
    }

    return partialWeights
  })()

  const weightedVRows = valueRows.map((row, index) => {
    const weight = Number(weightRows[index]?.value ?? 0)
    return {
      ...row,
      weight,
      vector: row.vector.map((value) => Number(value) * weight),
    }
  })

  const runningOutputRows = weightedVRows.map((_, rowIndex) => {
    return Array.from({ length: headDim }, (_, dimIndex) => {
      return weightedVRows.slice(0, rowIndex + 1).reduce((accumulator, row) => {
        return accumulator + Number(row.vector[dimIndex] ?? 0)
      }, 0)
    })
  })

  const attentionOutput = Array.from({ length: headDim }, (_, dimIndex) => {
    return valueRows.reduce((accumulator, row, rowIndex) => {
      return accumulator + Number(weightRows[rowIndex]?.value ?? 0) * Number(row.vector[dimIndex] ?? 0)
    }, 0)
  })

  const headOutputs = Array.from({ length: nHead }, (_, headIdx) => {
    const queryHead = sliceHead(queryFullVector, headIdx, headDim)
    const keySlices = keyFullRows.map((row) => sliceHead(row.vector, headIdx, headDim))
    const valueSlices = valueFullRows.map((row) => sliceHead(row.vector, headIdx, headDim))
    const logits = keySlices.map((row) => dotProduct(queryHead, row) / Math.sqrt(headDim))
    const weights = softmaxNumbers(logits)
    return Array.from({ length: headDim }, (_, dimIndex) => {
      return valueSlices.reduce((accumulator, row, rowIndex) => {
        return accumulator + Number(weights[rowIndex] ?? 0) * Number(row[dimIndex] ?? 0)
      }, 0)
    })
  })

  const xAttnVector = headOutputs.flat()
  const mhaOutputVector = attnWo.length ? matVec(xAttnVector, attnWo) : Array.from({ length: nEmbd }, () => 0)
  const attentionBlockResultVector = currentXVector.map((value, dimIndex) => {
    return Number(value ?? 0) + Number(mhaOutputVector[dimIndex] ?? 0)
  })
  const xResidualVector = attentionBlockResultVector
  const xNormVector = rmsNormVector(xResidualVector)
  const mlpHiddenVector = mlpFc1.length ? matVec(xNormVector, mlpFc1) : Array.from({ length: nEmbd * 4 }, () => 0)
  const mlpReluVector = mlpHiddenVector.map((value) => Math.max(0, Number(value ?? 0)))
  const mlpLinearVector = mlpFc2.length ? matVec(mlpReluVector, mlpFc2) : Array.from({ length: nEmbd }, () => 0)
  const transformerBlockOutputVector = xResidualVector.map((value, dimIndex) => {
    return Number(value ?? 0) + Number(mlpLinearVector[dimIndex] ?? 0)
  })
  const logitsVector = lmHead.length ? matVec(transformerBlockOutputVector, lmHead) : []
  const probVector = softmaxNumbers(logitsVector)
  const vocabularyRows = logitsVector.map((value, tokenId) => {
    if (tokenId === bos) {
      return {
        tokenId,
        label: '[BOS]',
        logit: Number(value ?? 0),
        prob: Number(probVector[tokenId] ?? 0),
      }
    }
    const tokenChar = tokenChars[tokenId] ?? ''
    if (!tokenChar) {
      return {
        tokenId,
        label: `ID ${tokenId}`,
        logit: Number(value ?? 0),
        prob: Number(probVector[tokenId] ?? 0),
      }
    }
    const jamoInfo = getJamoInfoForChapter3(tokenChar)
    const tokenLabel =
      jamoInfo.role && jamoInfo.role !== '기타'
        ? `${jamoInfo.role} ${jamoInfo.display || tokenChar}`
        : jamoInfo.display || tokenChar
    return {
      tokenId,
      label: tokenLabel,
      logit: Number(value ?? 0),
      prob: Number(probVector[tokenId] ?? 0),
    }
  })
  const topTokenRows = [...vocabularyRows]
    .sort((left, right) => right.prob - left.prob || left.tokenId - right.tokenId)
    .slice(0, Math.min(10, vocabularyRows.length))
  const topTokenIdSet = new Set(topTokenRows.map((row) => row.tokenId))
  const bottomTokenRows = [...vocabularyRows]
    .filter((row) => !topTokenIdSet.has(row.tokenId))
    .sort((left, right) => left.prob - right.prob || left.tokenId - right.tokenId)
    .slice(0, Math.min(2, Math.max(0, vocabularyRows.length - topTokenRows.length)))
  const selectedTokenRows = [...topTokenRows, ...bottomTokenRows]
  const shouldRenderTokenEllipsis = bottomTokenRows.length > 0 && topTokenRows.length + bottomTokenRows.length < vocabularyRows.length
  const tokenDisplayRows = [
    ...topTokenRows.map((row, selectedIndex) => ({ ...row, selectedIndex, isEllipsis: false })),
    ...(shouldRenderTokenEllipsis ? [{ isEllipsis: true, key: 'ellipsis' }] : []),
    ...bottomTokenRows.map((row, bottomIndex) => ({
      ...row,
      selectedIndex: topTokenRows.length + bottomIndex,
      isEllipsis: false,
    })),
  ]
  const partialLogitsForSelectedRows = selectedTokenRows.map((row) => {
    const lmHeadRow = lmHead[row.tokenId] ?? []
    let runningDot = 0
    return Array.from({ length: nEmbd }, (_, dimIndex) => {
      runningDot += Number(transformerBlockOutputVector[dimIndex] ?? 0) * Number(lmHeadRow[dimIndex] ?? 0)
      return runningDot
    })
  })

  const totalSteps = weightedVRows.length
  const safeOutputStep = clamp(outputStep, 0, totalSteps)
  const displayedOutputVector = displayedOutput.length === headDim ? displayedOutput : Array.from({ length: headDim }, () => 0)
  const displayedMhaOutputVector = displayedMhaOutput.length === nEmbd ? displayedMhaOutput : Array.from({ length: nEmbd }, () => 0)
  const displayedResult = displayedResultVector.length === nEmbd ? displayedResultVector : Array.from({ length: nEmbd }, () => 0)
  const displayedBlockOutput =
    displayedBlockOutputVector.length === nEmbd ? displayedBlockOutputVector : Array.from({ length: nEmbd }, () => 0)
  const displayedLogitValues =
    displayedLogits.length === selectedTokenRows.length
      ? displayedLogits
      : Array.from({ length: selectedTokenRows.length }, () => 0)
  const displayedProbValues =
    displayedProbs.length === selectedTokenRows.length ? displayedProbs : Array.from({ length: selectedTokenRows.length }, () => 0)
  const logitAbsMax = Math.max(
    1e-8,
    ...selectedTokenRows.map((row) => Math.abs(Number(row.logit ?? 0))),
    ...displayedLogitValues.map((value) => Math.abs(Number(value ?? 0))),
  )

  const maxAbs = Math.max(
    1e-8,
    ...currentXVector.map((value) => Math.abs(Number(value ?? 0))),
    ...queryHeadVector.map((value) => Math.abs(Number(value ?? 0))),
    ...keyRows.flatMap((row) => row.vector.map((value) => Math.abs(value))),
    ...valueRows.flatMap((row) => row.vector.map((value) => Math.abs(value))),
    ...weightRows.map((row) => Math.abs(row.value)),
    ...weightedVRows.flatMap((row) => row.vector.map((value) => Math.abs(value))),
    ...attentionOutput.map((value) => Math.abs(value)),
    ...headOutputs.flatMap((row) => row.map((value) => Math.abs(value))),
    ...xAttnVector.map((value) => Math.abs(value)),
    ...mhaOutputVector.map((value) => Math.abs(value)),
    ...attentionBlockResultVector.map((value) => Math.abs(value)),
    ...transformerBlockOutputVector.map((value) => Math.abs(value)),
    ...logitsVector.map((value) => Math.abs(value)),
    ...probVector.map((value) => Math.abs(value)),
  )

  const animationSignature = `${currentExampleName}-${safeQueryIndex}-${totalSteps}-${selectedTokenRows.length}`

  useEffect(() => {
    const flowLayer = flowLayerRef.current
    if (!flowLayer) {
      return undefined
    }
    const currentKeyIndex = Math.max(0, keyRows.length - 1)

    const resetRevealState = () => {
      setOutputStep(0)
      setDisplayedWeights(Array.from({ length: weightRows.length }, () => 0))
      setDisplayedOutput(Array.from({ length: headDim }, () => 0))
      setDisplayedMhaOutput(Array.from({ length: nEmbd }, () => 0))
      setDisplayedResultVector(Array.from({ length: nEmbd }, () => 0))
      setDisplayedBlockOutputVector(Array.from({ length: nEmbd }, () => 0))
      setDisplayedLogits(Array.from({ length: selectedTokenRows.length }, () => 0))
      setDisplayedProbs(Array.from({ length: selectedTokenRows.length }, () => 0))
      setRevealedXDims(createRevealVector(currentXRows.length))
      setRevealedQDims(createRevealVector(headDim))
      setRevealedKCells(createRevealMatrixWithVisibleRows(keyRows.length, headDim, currentKeyIndex))
      setRevealedVCells(createRevealMatrixWithVisibleRows(valueRows.length, headDim, currentKeyIndex))
      setRevealedWeights(createRevealVector(weightRows.length))
      setRevealedContribCells(createRevealMatrix(weightedVRows.length, headDim))
      setRevealedOutputDims(createRevealVector(headDim))
      setRevealedHeadOutputCells(createRevealMatrix(nHead, headDim))
      setRevealedMhaInputDims(createRevealVector(nEmbd))
      setRevealedMhaOutputDims(createRevealVector(nEmbd))
      setRevealedResultDims(createRevealVector(nEmbd))
      setRevealedBlockOutputDims(createRevealVector(nEmbd))
      setRevealedLogitRows(createRevealVector(selectedTokenRows.length))
      setRevealedProbRows(createRevealVector(selectedTokenRows.length))
    }

    const showFinalStateImmediately = () => {
      setOutputStep(totalSteps)
      setDisplayedWeights(weightRows.map((row) => Number(row.value ?? 0)))
      setDisplayedOutput(attentionOutput)
      setDisplayedMhaOutput(mhaOutputVector)
      setDisplayedResultVector(attentionBlockResultVector)
      setDisplayedBlockOutputVector(transformerBlockOutputVector)
      setDisplayedLogits(selectedTokenRows.map((row) => Number(row.logit ?? 0)))
      setDisplayedProbs(selectedTokenRows.map((row) => Number(row.prob ?? 0)))
      setRevealedXDims(Array.from({ length: currentXRows.length }, () => true))
      setRevealedQDims(Array.from({ length: headDim }, () => true))
      setRevealedKCells(Array.from({ length: keyRows.length }, () => Array.from({ length: headDim }, () => true)))
      setRevealedVCells(Array.from({ length: valueRows.length }, () => Array.from({ length: headDim }, () => true)))
      setRevealedWeights(Array.from({ length: weightRows.length }, () => true))
      setRevealedContribCells(
        Array.from({ length: weightedVRows.length }, () => Array.from({ length: headDim }, () => true)),
      )
      setRevealedOutputDims(Array.from({ length: headDim }, () => true))
      setRevealedHeadOutputCells(Array.from({ length: nHead }, () => Array.from({ length: headDim }, () => true)))
      setRevealedMhaInputDims(Array.from({ length: nEmbd }, () => true))
      setRevealedMhaOutputDims(Array.from({ length: nEmbd }, () => true))
      setRevealedResultDims(Array.from({ length: nEmbd }, () => true))
      setRevealedBlockOutputDims(Array.from({ length: nEmbd }, () => true))
      setRevealedLogitRows(Array.from({ length: selectedTokenRows.length }, () => true))
      setRevealedProbRows(Array.from({ length: selectedTokenRows.length }, () => true))
    }

    const revealVectorIndex = (setter, index) => {
      setter((prev) => {
        if (!Array.isArray(prev) || index < 0 || index >= prev.length || prev[index]) {
          return prev
        }
        const next = [...prev]
        next[index] = true
        return next
      })
    }

    const revealMatrixIndex = (setter, rowIndex, dimIndex) => {
      setter((prev) => {
        if (!Array.isArray(prev) || rowIndex < 0 || rowIndex >= prev.length) {
          return prev
        }
        const row = prev[rowIndex]
        if (!Array.isArray(row) || dimIndex < 0 || dimIndex >= row.length || row[dimIndex]) {
          return prev
        }
        const next = prev.map((item, index) => (index === rowIndex && Array.isArray(item) ? [...item] : item))
        next[rowIndex][dimIndex] = true
        return next
      })
    }

    const updateDisplayedOutputDim = (dimIndex, value) => {
      setDisplayedOutput((prev) => {
        const base = Array.isArray(prev) && prev.length === headDim ? [...prev] : Array.from({ length: headDim }, () => 0)
        if (dimIndex < 0 || dimIndex >= base.length) {
          return base
        }
        base[dimIndex] = Number(value ?? 0)
        return base
      })
    }

    const updateDisplayedMhaOutputDim = (dimIndex, value) => {
      setDisplayedMhaOutput((prev) => {
        const base = Array.isArray(prev) && prev.length === nEmbd ? [...prev] : Array.from({ length: nEmbd }, () => 0)
        if (dimIndex < 0 || dimIndex >= base.length) {
          return base
        }
        base[dimIndex] = Number(value ?? 0)
        return base
      })
    }

    const updateDisplayedResultDim = (dimIndex, value) => {
      setDisplayedResultVector((prev) => {
        const base = Array.isArray(prev) && prev.length === nEmbd ? [...prev] : Array.from({ length: nEmbd }, () => 0)
        if (dimIndex < 0 || dimIndex >= base.length) {
          return base
        }
        base[dimIndex] = Number(value ?? 0)
        return base
      })
    }

    const updateDisplayedBlockOutputDim = (dimIndex, value) => {
      setDisplayedBlockOutputVector((prev) => {
        const base = Array.isArray(prev) && prev.length === nEmbd ? [...prev] : Array.from({ length: nEmbd }, () => 0)
        if (dimIndex < 0 || dimIndex >= base.length) {
          return base
        }
        base[dimIndex] = Number(value ?? 0)
        return base
      })
    }

    const updateDisplayedLogitAt = (rowIndex, value) => {
      setDisplayedLogits((prev) => {
        const base =
          Array.isArray(prev) && prev.length === selectedTokenRows.length
            ? [...prev]
            : Array.from({ length: selectedTokenRows.length }, () => 0)
        if (rowIndex < 0 || rowIndex >= base.length) {
          return base
        }
        base[rowIndex] = Number(value ?? 0)
        return base
      })
    }

    const updateDisplayedProbAt = (rowIndex, value) => {
      setDisplayedProbs((prev) => {
        const base =
          Array.isArray(prev) && prev.length === selectedTokenRows.length
            ? [...prev]
            : Array.from({ length: selectedTokenRows.length }, () => 0)
        if (rowIndex < 0 || rowIndex >= base.length) {
          return base
        }
        base[rowIndex] = Number(value ?? 0)
        return base
      })
    }

    const updateDisplayedWeightAt = (rowIndex, value) => {
      setDisplayedWeights((prev) => {
        const base =
          Array.isArray(prev) && prev.length === weightRows.length
            ? [...prev]
            : Array.from({ length: weightRows.length }, () => 0)
        if (rowIndex < 0 || rowIndex >= base.length) {
          return base
        }
        base[rowIndex] = Number(value ?? 0)
        return base
      })
    }

    const clearTempClasses = () => {
      const classNames = [
        'attention-row--pulse',
        'attention-row--active',
        'attention-weight-row--active',
        'attention-cell--pulse',
        'attention-cell--active',
        'attention-weight-value--pulse',
      ]
      const cellGridNodes = (grid) => {
        return grid.flatMap((row) => (Array.isArray(row) ? row : [row])).filter(Boolean)
      }
      ;[
        xVectorRef.current,
        ...kRowRefs.current,
        ...vRowRefs.current,
        ...weightRowRefs.current,
        ...contribRowRefs.current,
        ...headOutputRowRefs.current,
        qVectorRef.current,
        outputVectorRef.current,
        mhaInputRowRef.current,
        mhaOutputRowRef.current,
        resultRowRef.current,
        blockOutputRowRef.current,
        ...logitRowRefs.current,
        ...probRowRefs.current,
        ...xValueRefs.current,
        ...qCellRefs.current,
        ...cellGridNodes(kCellRefs.current),
        ...cellGridNodes(vCellRefs.current),
        ...weightValueRefs.current,
        ...cellGridNodes(contribCellRefs.current),
        ...outputCellRefs.current,
        ...cellGridNodes(headOutputCellRefs.current),
        ...headSummaryQRefs.current,
        ...headSummaryKRefs.current,
        ...headSummaryVRefs.current,
        ...mhaInputCellRefs.current,
        ...mhaOutputCellRefs.current,
        ...resultCellRefs.current,
        ...blockOutputCellRefs.current,
        ...logitValueRefs.current,
        ...probValueRefs.current,
      ]
        .filter(Boolean)
        .forEach((node) => {
          classNames.forEach((className) => node.classList.remove(className))
        })
    }

    flowLayer.innerHTML = ''
    clearTempClasses()
    timelineRef.current?.kill()

    if (!hasAttentionData) {
      timelineRef.current = null
      return () => {
        setIsAnimating(false)
        flowLayer.innerHTML = ''
        clearTempClasses()
      }
    }

    if (skipAnimations) {
      timelineRef.current = null
      showFinalStateImmediately()
      return () => {
        setIsAnimating(false)
        flowLayer.innerHTML = ''
        clearTempClasses()
      }
    }

    resetRevealState()

    const currentKNode = kRowRefs.current[keyRows.length - 1]
    const currentVNode = vRowRefs.current[valueRows.length - 1]
    const flowLayerRect = flowLayer.getBoundingClientRect()
    const centerPointCache = new Map()
    const createdNodes = []
    const timeline = gsap.timeline({
      onStart: () => {
        setIsAnimating(true)
      },
      onComplete: () => {
        showFinalStateImmediately()
        setIsAnimating(false)
      },
    })
    timelineRef.current = timeline

    const addClassPulse = (node, className, startAt, duration = 0.18) => {
      if (!node) {
        return
      }
      timeline.call(() => node.classList.add(className), null, startAt)
      timeline.call(() => node.classList.remove(className), null, startAt + duration)
    }

    const getCenterPoint = (node) => {
      const cached = centerPointCache.get(node)
      if (cached) {
        return cached
      }
      const rect = node.getBoundingClientRect()
      const point = {
        x: rect.left + rect.width * 0.5 - flowLayerRect.left,
        y: rect.top + rect.height * 0.5 - flowLayerRect.top,
      }
      centerPointCache.set(node, point)
      return point
    }

    const spawnTransfer = (fromNode, toNode, startAt, variant = 'default', options = {}) => {
      if (!fromNode || !toNode) {
        return
      }
      const safeBeamOpacity = Math.max(0.08, Math.min(1, Number(options?.beamOpacity ?? 0.9)))
      const safeDotOpacity = Math.max(0.08, Math.min(1, Number(options?.dotOpacity ?? 1)))
      const isLightweight = Boolean(options?.lightweight)
      const from = getCenterPoint(fromNode)
      const to = getCenterPoint(toNode)
      const distance = Math.hypot(to.x - from.x, to.y - from.y)
      const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI

      if (isLightweight) {
        const beam = document.createElement('span')
        beam.className = `attention-flow-beam attention-flow-beam--${variant}`
        beam.style.left = `${from.x}px`
        beam.style.top = `${from.y}px`
        beam.style.width = `${distance}px`
        beam.style.transform = `translateY(-50%) rotate(${angle}deg)`
        flowLayer.appendChild(beam)
        createdNodes.push(beam)

        timeline.fromTo(beam, { opacity: 0 }, { opacity: safeBeamOpacity, duration: 0.1, ease: 'none' }, startAt)
        timeline.to(beam, { opacity: 0, duration: 0.12, ease: 'none' }, startAt + 0.1)
        return
      }

      const beam = document.createElement('span')
      beam.className = `attention-flow-beam attention-flow-beam--${variant}`
      beam.style.left = `${from.x}px`
      beam.style.top = `${from.y}px`
      beam.style.width = `${distance}px`
      beam.style.transform = `translateY(-50%) rotate(${angle}deg)`
      flowLayer.appendChild(beam)
      createdNodes.push(beam)

      const dot = document.createElement('span')
      dot.className = `attention-flow-dot attention-flow-dot--${variant}`
      flowLayer.appendChild(dot)
      createdNodes.push(dot)

      timeline.fromTo(
        beam,
        { opacity: 0, scaleX: 0.15 },
        { opacity: safeBeamOpacity, scaleX: 1, duration: 0.12, ease: 'power2.out' },
        startAt,
      )
      timeline.to(beam, { opacity: 0, duration: 0.2, ease: 'power2.in' }, startAt + 0.12)

      timeline.fromTo(
        dot,
        { x: from.x, y: from.y, opacity: 0, scale: 0.72 },
        { opacity: safeDotOpacity, duration: 0.08, ease: 'power2.out' },
        startAt,
      )
      timeline.to(
        dot,
        {
          x: to.x,
          y: to.y,
          duration: 0.34,
          ease: 'power2.out',
        },
        startAt + 0.02,
      )
      timeline.to(dot, { opacity: 0, duration: 0.1, ease: 'power2.in' }, startAt + 0.3)
    }

    const appendAttentionStickerTimeline = ({
      label,
      startAt = 0,
      duration = 0.4,
      variant = 'concat',
      anchor = 'between',
      fromNode = null,
      toNode = null,
      targetNode = null,
    }) => {
      let centerX = null
      let centerY = null

      if (anchor === 'between') {
        const fromRect = fromNode?.getBoundingClientRect()
        const toRect = toNode?.getBoundingClientRect()
        if (!fromRect || !toRect) {
          return
        }
        centerX = (fromRect.right + toRect.left) * 0.5 - flowLayerRect.left
        centerY = (fromRect.top + fromRect.bottom + toRect.top + toRect.bottom) * 0.25 - flowLayerRect.top
      } else if (anchor === 'top-center') {
        const targetRect = targetNode?.getBoundingClientRect()
        if (!targetRect) {
          return
        }
        centerX = targetRect.left + targetRect.width * 0.5 - flowLayerRect.left
        centerY = targetRect.top - flowLayerRect.top + 8
      } else {
        return
      }

      const sticker = document.createElement('span')
      sticker.className = `attention-op-sticker attention-op-sticker--${variant}`
      sticker.textContent = label
      sticker.style.left = `${centerX}px`
      sticker.style.top = `${centerY}px`
      flowLayer.appendChild(sticker)
      createdNodes.push(sticker)

      const safeDuration = Math.max(0.24, Number(duration) || 0.4)
      const fadeInDuration = 0.12
      const fadeOutDuration = 0.18
      const visibleHold = Math.max(0.04, safeDuration - fadeInDuration - fadeOutDuration)

      timeline.fromTo(
        sticker,
        { opacity: 0, scale: 0.86, rotate: -2 },
        { opacity: 1, scale: 1.02, rotate: 1, duration: fadeInDuration, ease: 'power2.out' },
        startAt,
      )
      timeline.to(sticker, { opacity: 1, duration: visibleHold, ease: 'none' }, startAt + fadeInDuration)
      timeline.to(
        sticker,
        { opacity: 0, scale: 1.04, rotate: 2, duration: fadeOutDuration, ease: 'power2.in' },
        startAt + fadeInDuration + visibleHold,
      )
    }

    timeline.call(() => {
      setOutputStep(0)
      setDisplayedWeights(Array.from({ length: weightRows.length }, () => 0))
      setDisplayedOutput(Array.from({ length: headDim }, () => 0))
      setDisplayedMhaOutput(Array.from({ length: nEmbd }, () => 0))
      setDisplayedResultVector(Array.from({ length: nEmbd }, () => 0))
      setDisplayedBlockOutputVector(Array.from({ length: nEmbd }, () => 0))
      setDisplayedLogits(Array.from({ length: selectedTokenRows.length }, () => 0))
      setDisplayedProbs(Array.from({ length: selectedTokenRows.length }, () => 0))
    }, null, 0)

    const revealXDimAt = (dimIndex, startAt) => {
      timeline.call(() => {
        revealVectorIndex(setRevealedXDims, dimIndex)
      }, null, startAt)
    }

    const revealQDimAt = (dimIndex, startAt) => {
      timeline.call(() => {
        revealVectorIndex(setRevealedQDims, dimIndex)
      }, null, startAt)
    }

    const revealWeightStepAt = (rowIndex, dimIndex, startAt) => {
      timeline.call(() => {
        revealVectorIndex(setRevealedWeights, rowIndex)
        updateDisplayedWeightAt(
          rowIndex,
          partialWeightRows[rowIndex]?.[dimIndex] ?? Number(weightRows[rowIndex]?.value ?? 0),
        )
      }, null, startAt)
    }

    const revealKCellAt = (rowIndex, dimIndex, startAt) => {
      timeline.call(() => {
        revealMatrixIndex(setRevealedKCells, rowIndex, dimIndex)
      }, null, startAt)
    }

    const revealVCellAt = (rowIndex, dimIndex, startAt) => {
      timeline.call(() => {
        revealMatrixIndex(setRevealedVCells, rowIndex, dimIndex)
      }, null, startAt)
    }

    const revealContribCellAt = (rowIndex, dimIndex, startAt) => {
      timeline.call(() => {
        revealMatrixIndex(setRevealedContribCells, rowIndex, dimIndex)
      }, null, startAt)
    }

    const revealOutputDimAt = (dimIndex, value, startAt) => {
      timeline.call(() => {
        revealVectorIndex(setRevealedOutputDims, dimIndex)
        updateDisplayedOutputDim(dimIndex, value)
      }, null, startAt)
    }

    const revealHeadOutputCellAt = (headIdx, dimIndex, startAt) => {
      timeline.call(() => {
        revealMatrixIndex(setRevealedHeadOutputCells, headIdx, dimIndex)
      }, null, startAt)
    }

    const revealMhaInputDimAt = (dimIndex, startAt) => {
      timeline.call(() => {
        revealVectorIndex(setRevealedMhaInputDims, dimIndex)
      }, null, startAt)
    }

    const revealMhaOutputDimAt = (dimIndex, value, startAt) => {
      timeline.call(() => {
        revealVectorIndex(setRevealedMhaOutputDims, dimIndex)
        updateDisplayedMhaOutputDim(dimIndex, value)
      }, null, startAt)
    }

    const revealResultDimAt = (dimIndex, value, startAt) => {
      timeline.call(() => {
        revealVectorIndex(setRevealedResultDims, dimIndex)
        updateDisplayedResultDim(dimIndex, value)
      }, null, startAt)
    }

    const revealBlockOutputDimAt = (dimIndex, value, startAt) => {
      timeline.call(() => {
        revealVectorIndex(setRevealedBlockOutputDims, dimIndex)
        updateDisplayedBlockOutputDim(dimIndex, value)
      }, null, startAt)
    }

    const revealLogitStepAt = (rowIndex, dimIndex, startAt) => {
      timeline.call(() => {
        revealVectorIndex(setRevealedLogitRows, rowIndex)
        const shouldCommitStep =
          dimIndex === nEmbd - 1 ||
          (LOGIT_PARTIAL_COMMIT_STEP > 0 && (dimIndex + 1) % LOGIT_PARTIAL_COMMIT_STEP === 0)
        if (!shouldCommitStep) {
          return
        }
        updateDisplayedLogitAt(
          rowIndex,
          partialLogitsForSelectedRows[rowIndex]?.[dimIndex] ?? Number(selectedTokenRows[rowIndex]?.logit ?? 0),
        )
      }, null, startAt)
    }

    const revealProbRowAt = (rowIndex, value, startAt) => {
      timeline.call(() => {
        revealVectorIndex(setRevealedProbRows, rowIndex)
        updateDisplayedProbAt(rowIndex, value)
      }, null, startAt)
    }

    if (reducedMotion) {
      const reducedStart = 0.04
      addClassPulse(xVectorRef.current, 'attention-row--active', reducedStart, 0.16)
      addClassPulse(qVectorRef.current, 'attention-row--active', reducedStart + 0.08, 0.16)
      addClassPulse(currentKNode, 'attention-row--pulse', reducedStart + 0.1, 0.16)
      addClassPulse(currentVNode, 'attention-row--pulse', reducedStart + 0.12, 0.16)

      currentXRows.forEach((_, dimIndex) => {
        revealXDimAt(dimIndex, reducedStart + dimIndex * 0.01)
      })
      for (let dimIndex = 0; dimIndex < headDim; dimIndex += 1) {
        revealQDimAt(dimIndex, reducedStart + 0.09 + dimIndex * 0.02)
        revealKCellAt(currentKeyIndex, dimIndex, reducedStart + 0.11 + dimIndex * 0.02)
        revealVCellAt(currentKeyIndex, dimIndex, reducedStart + 0.13 + dimIndex * 0.02)
      }

      const weightStageStart = reducedStart + 0.3
      const reducedRowSpacing = 0.11
      const reducedDimSpacing = 0.03
      weightRows.forEach((_, rowIndex) => {
        const rowBase = weightStageStart + rowIndex * reducedRowSpacing
        const targetWeightNode = weightValueRefs.current[rowIndex]
        for (let dimIndex = 0; dimIndex < headDim; dimIndex += 1) {
          const at = rowBase + dimIndex * reducedDimSpacing
          addClassPulse(qCellRefs.current[dimIndex], 'attention-cell--pulse', at, 0.12)
          addClassPulse(kCellRefs.current[rowIndex]?.[dimIndex], 'attention-cell--pulse', at + 0.01, 0.12)
          addClassPulse(targetWeightNode, 'attention-weight-value--pulse', at + 0.015, 0.12)
          revealWeightStepAt(rowIndex, dimIndex, at + 0.018)
        }
        addClassPulse(weightRowRefs.current[rowIndex], 'attention-weight-row--active', rowBase + headDim * reducedDimSpacing, 0.13)
      })

      const outputStageStart = weightStageStart + weightRows.length * reducedRowSpacing + 0.08
      weightedVRows.forEach((_, rowIndex) => {
        const rowBase = outputStageStart + rowIndex * 0.1
        for (let dimIndex = 0; dimIndex < headDim; dimIndex += 1) {
          const at = rowBase + dimIndex * 0.02
          addClassPulse(vCellRefs.current[rowIndex]?.[dimIndex], 'attention-cell--pulse', at, 0.1)
          addClassPulse(weightValueRefs.current[rowIndex], 'attention-weight-value--pulse', at + 0.005, 0.1)
          addClassPulse(contribCellRefs.current[rowIndex]?.[dimIndex], 'attention-cell--active', at + 0.01, 0.1)
          addClassPulse(outputCellRefs.current[dimIndex], 'attention-cell--active', at + 0.02, 0.11)
          revealContribCellAt(rowIndex, dimIndex, at + 0.012)
          revealOutputDimAt(dimIndex, runningOutputRows[rowIndex]?.[dimIndex] ?? 0, at + 0.022)
        }
        timeline.call(() => {
          setOutputStep(rowIndex + 1)
        }, null, rowBase + headDim * 0.02 + 0.03)
      })
      addClassPulse(outputVectorRef.current, 'attention-row--active', outputStageStart + weightedVRows.length * 0.1, 0.16)

      const headStageStart = outputStageStart + weightedVRows.length * 0.1 + 0.08
      for (let dimIndex = 0; dimIndex < headDim; dimIndex += 1) {
        const at = headStageStart + dimIndex * 0.03
        addClassPulse(outputCellRefs.current[dimIndex], 'attention-cell--pulse', at, 0.12)
        addClassPulse(headOutputCellRefs.current[0]?.[dimIndex], 'attention-cell--active', at + 0.01, 0.12)
        revealHeadOutputCellAt(0, dimIndex, at + 0.013)
      }
      addClassPulse(headOutputRowRefs.current[0], 'attention-row--active', headStageStart + headDim * 0.03, 0.13)

      const summaryStageStart = headStageStart + headDim * 0.03 + 0.06
      for (let headIdx = 1; headIdx < nHead; headIdx += 1) {
        const rowBase = summaryStageStart + (headIdx - 1) * 0.09
        for (let dimIndex = 0; dimIndex < headDim; dimIndex += 1) {
          const at = rowBase + dimIndex * 0.02
          addClassPulse(headSummaryQRefs.current[headIdx], 'attention-cell--pulse', at, 0.1)
          addClassPulse(headSummaryKRefs.current[headIdx], 'attention-cell--pulse', at + 0.006, 0.1)
          addClassPulse(headSummaryVRefs.current[headIdx], 'attention-cell--pulse', at + 0.012, 0.1)
          addClassPulse(headOutputCellRefs.current[headIdx]?.[dimIndex], 'attention-cell--active', at + 0.018, 0.1)
          revealHeadOutputCellAt(headIdx, dimIndex, at + 0.02)
        }
        addClassPulse(headOutputRowRefs.current[headIdx], 'attention-row--active', rowBase + headDim * 0.02, 0.11)
      }

      const concatStageStart = summaryStageStart + Math.max(0, nHead - 1) * 0.09 + 0.04
      appendAttentionStickerTimeline({
        label: 'CONCAT',
        startAt: concatStageStart,
        duration: nEmbd * 0.008 + 0.12,
        variant: 'concat',
        anchor: 'between',
        fromNode: headsStageRef.current,
        toNode: mhaStageRef.current,
      })
      for (let flatIndex = 0; flatIndex < nEmbd; flatIndex += 1) {
        const at = concatStageStart + flatIndex * 0.008
        addClassPulse(mhaInputCellRefs.current[flatIndex], 'attention-cell--active', at + 0.01, 0.08)
        revealMhaInputDimAt(flatIndex, at + 0.012)
      }
      addClassPulse(mhaInputRowRef.current, 'attention-row--active', concatStageStart + nEmbd * 0.008, 0.12)

      const mhaStageStart = concatStageStart + nEmbd * 0.008 + 0.05
      const reducedLinearTargetSpacing = 0.018
      const reducedLinearInputSpacing = 0.004
      const reducedLinearSpan =
        Math.max(0, nEmbd - 1) * reducedLinearTargetSpacing + Math.max(0, nEmbd - 1) * reducedLinearInputSpacing
      appendAttentionStickerTimeline({
        label: 'LINEAR',
        startAt: mhaStageStart,
        duration: reducedLinearSpan + 0.14,
        variant: 'linear',
        anchor: 'between',
        fromNode: mhaInputRowRef.current,
        toNode: mhaOutputRowRef.current,
      })
      for (let targetDimIndex = 0; targetDimIndex < nEmbd; targetDimIndex += 1) {
        const targetBase = mhaStageStart + targetDimIndex * reducedLinearTargetSpacing
        for (let sourceDimIndex = 0; sourceDimIndex < nEmbd; sourceDimIndex += 1) {
          const at = targetBase + sourceDimIndex * reducedLinearInputSpacing
          addClassPulse(mhaInputCellRefs.current[sourceDimIndex], 'attention-cell--pulse', at, 0.07)
          addClassPulse(mhaOutputCellRefs.current[targetDimIndex], 'attention-cell--active', at + 0.004, 0.08)
        }
        revealMhaOutputDimAt(
          targetDimIndex,
          mhaOutputVector[targetDimIndex] ?? 0,
          targetBase + Math.max(0, nEmbd - 1) * reducedLinearInputSpacing + 0.01,
        )
      }
      addClassPulse(mhaOutputRowRef.current, 'attention-row--active', mhaStageStart + reducedLinearSpan, 0.12)

      const resultStageStart = mhaStageStart + reducedLinearSpan + 0.05
      appendAttentionStickerTimeline({
        label: 'RESIDUAL',
        startAt: resultStageStart,
        duration: nEmbd * 0.011 + 0.14,
        variant: 'residual',
        anchor: 'top-center',
        targetNode: resultRowRef.current,
      })
      for (let dimIndex = 0; dimIndex < nEmbd; dimIndex += 1) {
        const at = resultStageStart + dimIndex * 0.011
        addClassPulse(xValueRefs.current[dimIndex], 'attention-cell--pulse', at, 0.08)
        addClassPulse(mhaOutputCellRefs.current[dimIndex], 'attention-cell--pulse', at + 0.004, 0.08)
        addClassPulse(resultCellRefs.current[dimIndex], 'attention-cell--active', at + 0.012, 0.1)
        revealResultDimAt(dimIndex, attentionBlockResultVector[dimIndex] ?? 0, at + 0.014)
      }
      addClassPulse(resultRowRef.current, 'attention-row--active', resultStageStart + nEmbd * 0.011, 0.14)

      const mlpStageStart = resultStageStart + nEmbd * 0.011 + 0.06
      const reducedMlpTargetSpacing = 0.018
      const reducedMlpInputSpacing = 0.004
      const reducedMlpSpan =
        Math.max(0, nEmbd - 1) * reducedMlpTargetSpacing + Math.max(0, nEmbd - 1) * reducedMlpInputSpacing
      appendAttentionStickerTimeline({
        label: 'MLP',
        startAt: mlpStageStart,
        duration: reducedMlpSpan + 0.14,
        variant: 'mlp',
        anchor: 'between',
        fromNode: resultRowRef.current,
        toNode: blockOutputRowRef.current,
      })
      for (let targetDimIndex = 0; targetDimIndex < nEmbd; targetDimIndex += 1) {
        const targetBase = mlpStageStart + targetDimIndex * reducedMlpTargetSpacing
        for (let sourceDimIndex = 0; sourceDimIndex < nEmbd; sourceDimIndex += 1) {
          const at = targetBase + sourceDimIndex * reducedMlpInputSpacing
          addClassPulse(resultCellRefs.current[sourceDimIndex], 'attention-cell--pulse', at, 0.07)
          addClassPulse(blockOutputCellRefs.current[targetDimIndex], 'attention-cell--active', at + 0.004, 0.08)
        }
        revealBlockOutputDimAt(
          targetDimIndex,
          transformerBlockOutputVector[targetDimIndex] ?? 0,
          targetBase + Math.max(0, nEmbd - 1) * reducedMlpInputSpacing + 0.01,
        )
      }
      addClassPulse(blockOutputRowRef.current, 'attention-row--active', mlpStageStart + reducedMlpSpan, 0.13)

      const logitStageStart = mlpStageStart + reducedMlpSpan + 0.05
      appendAttentionStickerTimeline({
        label: 'LINEAR',
        startAt: logitStageStart,
        duration: selectedTokenRows.length * 0.05 + 0.18,
        variant: 'logit',
        anchor: 'between',
        fromNode: blockOutputStageRef.current,
        toNode: logitStageRef.current,
      })
      const reducedLogitRowSpacing = 0.05
      const reducedLogitDimSpacing = 0.008
      selectedTokenRows.forEach((_, rowIndex) => {
        const rowBase = logitStageStart + rowIndex * reducedLogitRowSpacing
        for (let dimIndex = 0; dimIndex < nEmbd; dimIndex += 1) {
          const at = rowBase + dimIndex * reducedLogitDimSpacing
          addClassPulse(blockOutputCellRefs.current[dimIndex], 'attention-cell--pulse', at, 0.07)
          addClassPulse(logitValueRefs.current[rowIndex], 'attention-weight-value--pulse', at + 0.004, 0.08)
          revealLogitStepAt(rowIndex, dimIndex, at + 0.006)
        }
        addClassPulse(logitRowRefs.current[rowIndex], 'attention-row--active', rowBase + nEmbd * reducedLogitDimSpacing, 0.1)
      })

      const softmaxStageStart =
        logitStageStart + selectedTokenRows.length * reducedLogitRowSpacing + nEmbd * reducedLogitDimSpacing + 0.04
      appendAttentionStickerTimeline({
        label: 'SOFTMAX',
        startAt: softmaxStageStart,
        duration: selectedTokenRows.length * 0.04 + 0.14,
        variant: 'softmax',
        anchor: 'between',
        fromNode: logitStageRef.current,
        toNode: probStageRef.current,
      })
      selectedTokenRows.forEach((row, rowIndex) => {
        const at = softmaxStageStart + rowIndex * 0.04
        addClassPulse(logitValueRefs.current[rowIndex], 'attention-weight-value--pulse', at, 0.09)
        addClassPulse(probValueRefs.current[rowIndex], 'attention-weight-value--pulse', at + 0.005, 0.1)
        revealProbRowAt(rowIndex, row.prob, at + 0.009)
        addClassPulse(probRowRefs.current[rowIndex], 'attention-row--active', at + 0.01, 0.1)
      })

      return () => {
        timeline.kill()
        timelineRef.current = null
        createdNodes.forEach((node) => node.remove())
        flowLayer.innerHTML = ''
        clearTempClasses()
      }
    }

    const stageAStart = 0
    addClassPulse(xVectorRef.current, 'attention-row--active', stageAStart, 0.22)
    currentXRows.forEach((_, dimIndex) => {
      revealXDimAt(dimIndex, stageAStart + dimIndex * 0.012)
    })

    const stageBStart = stageAStart + 0.18
    spawnTransfer(xVectorRef.current, qVectorRef.current, stageBStart, 'q')
    spawnTransfer(xVectorRef.current, currentKNode, stageBStart + 0.06, 'k')
    spawnTransfer(xVectorRef.current, currentVNode, stageBStart + 0.12, 'v')
    addClassPulse(qVectorRef.current, 'attention-row--active', stageBStart + 0.04, 0.16)
    addClassPulse(currentKNode, 'attention-row--pulse', stageBStart + 0.1, 0.14)
    addClassPulse(currentVNode, 'attention-row--pulse', stageBStart + 0.14, 0.14)
    for (let dimIndex = 0; dimIndex < headDim; dimIndex += 1) {
      revealQDimAt(dimIndex, stageBStart + 0.07 + dimIndex * 0.02)
      revealKCellAt(currentKeyIndex, dimIndex, stageBStart + 0.13 + dimIndex * 0.02)
      revealVCellAt(currentKeyIndex, dimIndex, stageBStart + 0.17 + dimIndex * 0.02)
    }

    const stageCStart = stageBStart + 0.4
    const stageCRowSpacing = 0.34
    const stageCDimSpacing = 0.07
    weightRows.forEach((_, rowIndex) => {
      const rowBase = stageCStart + rowIndex * stageCRowSpacing
      const targetWeightNode = weightValueRefs.current[rowIndex]
      for (let dimIndex = 0; dimIndex < headDim; dimIndex += 1) {
        const at = rowBase + dimIndex * stageCDimSpacing
        spawnTransfer(qCellRefs.current[dimIndex], targetWeightNode, at, 'q')
        spawnTransfer(kCellRefs.current[rowIndex]?.[dimIndex], targetWeightNode, at + 0.02, 'k')
        addClassPulse(qCellRefs.current[dimIndex], 'attention-cell--pulse', at + 0.005, 0.12)
        addClassPulse(kCellRefs.current[rowIndex]?.[dimIndex], 'attention-cell--pulse', at + 0.02, 0.12)
        addClassPulse(targetWeightNode, 'attention-weight-value--pulse', at + 0.03, 0.14)
        revealWeightStepAt(rowIndex, dimIndex, at + 0.034)
      }
      addClassPulse(weightRowRefs.current[rowIndex], 'attention-weight-row--active', rowBase + headDim * stageCDimSpacing, 0.16)
    })

    const stageDStart = stageCStart + weightRows.length * stageCRowSpacing + 0.14
    weightedVRows.forEach((_, rowIndex) => {
      const rowBase = stageDStart + rowIndex * 0.2
      for (let dimIndex = 0; dimIndex < headDim; dimIndex += 1) {
        const at = rowBase + dimIndex * 0.03
        spawnTransfer(vCellRefs.current[rowIndex]?.[dimIndex], contribCellRefs.current[rowIndex]?.[dimIndex], at, 'v')
        spawnTransfer(weightValueRefs.current[rowIndex], contribCellRefs.current[rowIndex]?.[dimIndex], at + 0.015, 'w')
        addClassPulse(vCellRefs.current[rowIndex]?.[dimIndex], 'attention-cell--pulse', at + 0.01, 0.11)
        addClassPulse(contribCellRefs.current[rowIndex]?.[dimIndex], 'attention-cell--active', at + 0.035, 0.12)
        revealContribCellAt(rowIndex, dimIndex, at + 0.038)
        spawnTransfer(contribCellRefs.current[rowIndex]?.[dimIndex], outputCellRefs.current[dimIndex], at + 0.05, 'o')
        addClassPulse(outputCellRefs.current[dimIndex], 'attention-cell--active', at + 0.08, 0.12)
        revealOutputDimAt(dimIndex, runningOutputRows[rowIndex]?.[dimIndex] ?? 0, at + 0.083)
      }
      addClassPulse(contribRowRefs.current[rowIndex], 'attention-row--active', rowBase + 0.02, 0.16)
      timeline.call(() => {
        setOutputStep(rowIndex + 1)
      }, null, rowBase + headDim * 0.03 + 0.06)
    })
    addClassPulse(outputVectorRef.current, 'attention-row--active', stageDStart + weightedVRows.length * 0.2, 0.16)

    const stageEStart = stageDStart + weightedVRows.length * 0.2 + 0.16
    for (let dimIndex = 0; dimIndex < headDim; dimIndex += 1) {
      const at = stageEStart + dimIndex * 0.05
      spawnTransfer(outputCellRefs.current[dimIndex], headOutputCellRefs.current[0]?.[dimIndex], at, 'o')
      addClassPulse(outputCellRefs.current[dimIndex], 'attention-cell--pulse', at + 0.01, 0.12)
      addClassPulse(headOutputCellRefs.current[0]?.[dimIndex], 'attention-cell--active', at + 0.06, 0.14)
      revealHeadOutputCellAt(0, dimIndex, at + 0.064)
    }
    addClassPulse(headOutputRowRefs.current[0], 'attention-row--active', stageEStart + headDim * 0.05, 0.16)

    const stageFStart = stageEStart + headDim * 0.05 + 0.16
    for (let headIdx = 1; headIdx < nHead; headIdx += 1) {
      const rowBase = stageFStart + (headIdx - 1) * 0.23
      for (let dimIndex = 0; dimIndex < headDim; dimIndex += 1) {
        const at = rowBase + dimIndex * 0.04
        spawnTransfer(headSummaryQRefs.current[headIdx], headOutputCellRefs.current[headIdx]?.[dimIndex], at, 'q')
        spawnTransfer(headSummaryKRefs.current[headIdx], headOutputCellRefs.current[headIdx]?.[dimIndex], at + 0.01, 'k')
        spawnTransfer(headSummaryVRefs.current[headIdx], headOutputCellRefs.current[headIdx]?.[dimIndex], at + 0.02, 'v')
        addClassPulse(headOutputCellRefs.current[headIdx]?.[dimIndex], 'attention-cell--active', at + 0.06, 0.12)
        revealHeadOutputCellAt(headIdx, dimIndex, at + 0.064)
      }
      addClassPulse(headOutputRowRefs.current[headIdx], 'attention-row--active', rowBase + headDim * 0.04, 0.14)
    }

    const stageGStart = stageFStart + Math.max(0, nHead - 1) * 0.23 + 0.16
    appendAttentionStickerTimeline({
      label: 'CONCAT',
      startAt: stageGStart,
      duration: nEmbd * 0.024 + 0.14,
      variant: 'concat',
      anchor: 'between',
      fromNode: headsStageRef.current,
      toNode: mhaStageRef.current,
    })
    for (let headIdx = 0; headIdx < nHead; headIdx += 1) {
      for (let dimIndex = 0; dimIndex < headDim; dimIndex += 1) {
        const flatIndex = headIdx * headDim + dimIndex
        const at = stageGStart + flatIndex * 0.024
        spawnTransfer(headOutputCellRefs.current[headIdx]?.[dimIndex], mhaInputCellRefs.current[flatIndex], at, 'o')
        addClassPulse(mhaInputCellRefs.current[flatIndex], 'attention-cell--active', at + 0.06, 0.12)
        revealMhaInputDimAt(flatIndex, at + 0.064)
      }
    }
    addClassPulse(mhaInputRowRef.current, 'attention-row--active', stageGStart + nEmbd * 0.024, 0.14)

    const stageG2Start = stageGStart + nEmbd * 0.024 + 0.12
    const stageG2TargetSpacing = 0.026
    const stageG2InputSpacing = 0.006
    const stageG2Span = Math.max(0, nEmbd - 1) * stageG2TargetSpacing + Math.max(0, nEmbd - 1) * stageG2InputSpacing
    appendAttentionStickerTimeline({
      label: 'LINEAR',
      startAt: stageG2Start,
      duration: stageG2Span + 0.16,
      variant: 'linear',
      anchor: 'between',
      fromNode: mhaInputRowRef.current,
      toNode: mhaOutputRowRef.current,
    })
    for (let targetDimIndex = 0; targetDimIndex < nEmbd; targetDimIndex += 1) {
      const targetBase = stageG2Start + targetDimIndex * stageG2TargetSpacing
      addClassPulse(mhaOutputCellRefs.current[targetDimIndex], 'attention-cell--active', targetBase + 0.03, 0.12)
      for (let sourceDimIndex = 0; sourceDimIndex < nEmbd; sourceDimIndex += 1) {
        const at = targetBase + sourceDimIndex * stageG2InputSpacing
        spawnTransfer(mhaInputCellRefs.current[sourceDimIndex], mhaOutputCellRefs.current[targetDimIndex], at, 'w', {
          beamOpacity: 0.28,
          dotOpacity: 0.42,
          lightweight: true,
        })
      }
      revealMhaOutputDimAt(
        targetDimIndex,
        mhaOutputVector[targetDimIndex] ?? 0,
        targetBase + Math.max(0, nEmbd - 1) * stageG2InputSpacing + 0.064,
      )
    }
    addClassPulse(mhaOutputRowRef.current, 'attention-row--active', stageG2Start + stageG2Span + 0.04, 0.14)

    const stageHStart = stageG2Start + stageG2Span + 0.18
    appendAttentionStickerTimeline({
      label: 'RESIDUAL',
      startAt: stageHStart,
      duration: nEmbd * 0.03 + 0.16,
      variant: 'residual',
      anchor: 'top-center',
      targetNode: resultRowRef.current,
    })
    for (let dimIndex = 0; dimIndex < nEmbd; dimIndex += 1) {
      const at = stageHStart + dimIndex * 0.03
      spawnTransfer(xValueRefs.current[dimIndex], resultCellRefs.current[dimIndex], at, 'q')
      spawnTransfer(mhaOutputCellRefs.current[dimIndex], resultCellRefs.current[dimIndex], at + 0.015, 'v')
      addClassPulse(resultCellRefs.current[dimIndex], 'attention-cell--active', at + 0.07, 0.13)
      revealResultDimAt(dimIndex, attentionBlockResultVector[dimIndex] ?? 0, at + 0.075)
    }
    addClassPulse(resultRowRef.current, 'attention-row--active', stageHStart + nEmbd * 0.03, 0.16)

    const stageIStart = stageHStart + nEmbd * 0.03 + 0.16
    const stageITargetSpacing = 0.026
    const stageIInputSpacing = 0.006
    const stageISpan = Math.max(0, nEmbd - 1) * stageITargetSpacing + Math.max(0, nEmbd - 1) * stageIInputSpacing
    appendAttentionStickerTimeline({
      label: 'MLP',
      startAt: stageIStart,
      duration: stageISpan + 0.16,
      variant: 'mlp',
      anchor: 'between',
      fromNode: resultRowRef.current,
      toNode: blockOutputRowRef.current,
    })
    for (let targetDimIndex = 0; targetDimIndex < nEmbd; targetDimIndex += 1) {
      const targetBase = stageIStart + targetDimIndex * stageITargetSpacing
      addClassPulse(blockOutputCellRefs.current[targetDimIndex], 'attention-cell--active', targetBase + 0.03, 0.12)
      for (let sourceDimIndex = 0; sourceDimIndex < nEmbd; sourceDimIndex += 1) {
        const at = targetBase + sourceDimIndex * stageIInputSpacing
        spawnTransfer(resultCellRefs.current[sourceDimIndex], blockOutputCellRefs.current[targetDimIndex], at, 'v', {
          beamOpacity: 0.26,
          dotOpacity: 0.4,
          lightweight: true,
        })
      }
      revealBlockOutputDimAt(
        targetDimIndex,
        transformerBlockOutputVector[targetDimIndex] ?? 0,
        targetBase + Math.max(0, nEmbd - 1) * stageIInputSpacing + 0.064,
      )
    }
    addClassPulse(blockOutputRowRef.current, 'attention-row--active', stageIStart + stageISpan + 0.04, 0.14)

    const stageJStart = stageIStart + stageISpan + 0.18
    const stageJRowSpacing = 0.2
    const stageJInputSpacing = 0.006
    const stageJSpan =
      Math.max(0, selectedTokenRows.length - 1) * stageJRowSpacing + Math.max(0, nEmbd - 1) * stageJInputSpacing
    appendAttentionStickerTimeline({
      label: 'LINEAR',
      startAt: stageJStart,
      duration: stageJSpan + 0.2,
      variant: 'logit',
      anchor: 'between',
      fromNode: blockOutputStageRef.current,
      toNode: logitStageRef.current,
    })
    selectedTokenRows.forEach((_, rowIndex) => {
      const rowBase = stageJStart + rowIndex * stageJRowSpacing
      addClassPulse(logitValueRefs.current[rowIndex], 'attention-weight-value--pulse', rowBase + 0.04, 0.12)
      for (let dimIndex = 0; dimIndex < nEmbd; dimIndex += 1) {
        const at = rowBase + dimIndex * stageJInputSpacing
        spawnTransfer(blockOutputCellRefs.current[dimIndex], logitValueRefs.current[rowIndex], at, 'w', {
          beamOpacity: 0.24,
          dotOpacity: 0.36,
          lightweight: true,
        })
        revealLogitStepAt(rowIndex, dimIndex, at + 0.034)
      }
      addClassPulse(
        logitRowRefs.current[rowIndex],
        'attention-row--active',
        rowBase + Math.max(0, nEmbd - 1) * stageJInputSpacing + 0.03,
        0.14,
      )
    })

    const stageKStart = stageJStart + stageJSpan + 0.18
    appendAttentionStickerTimeline({
      label: 'SOFTMAX',
      startAt: stageKStart,
      duration: selectedTokenRows.length * 0.08 + 0.2,
      variant: 'softmax',
      anchor: 'between',
      fromNode: logitStageRef.current,
      toNode: probStageRef.current,
    })
    selectedTokenRows.forEach((row, rowIndex) => {
      const at = stageKStart + rowIndex * 0.08
      spawnTransfer(logitValueRefs.current[rowIndex], probValueRefs.current[rowIndex], at, 'o')
      addClassPulse(logitValueRefs.current[rowIndex], 'attention-weight-value--pulse', at + 0.01, 0.11)
      addClassPulse(probValueRefs.current[rowIndex], 'attention-weight-value--pulse', at + 0.06, 0.12)
      revealProbRowAt(rowIndex, row.prob, at + 0.064)
      addClassPulse(probRowRefs.current[rowIndex], 'attention-row--active', at + 0.065, 0.13)
    })

    return () => {
      timeline.kill()
      timelineRef.current = null
      createdNodes.forEach((node) => node.remove())
      flowLayer.innerHTML = ''
      clearTempClasses()
    }
  }, [animationTick, animationSignature, currentXRows.length, hasAttentionData, headDim, nEmbd, nHead, reducedMotion, skipAnimations]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const containerNode = pipelineContentRef.current
    const bridgeLayerNode = bridgeLayerRef.current
    const topPathNode = bridgeTopPathRef.current
    const resultPathNode = bridgeResultPathRef.current
    const resetPaths = () => {
      topPathNode?.setAttribute('d', '')
      resultPathNode?.setAttribute('d', '')
    }
    if (!containerNode) {
      resetPaths()
      return undefined
    }

    const updatePaths = () => {
      const rootRect = containerNode.getBoundingClientRect()
      const topOutputNode = outputVectorRef.current
      const topXNode = xVectorRef.current
      const head0Node = headOutputRowRefs.current[0]
      const resultNode = resultRowRef.current
      if (!topOutputNode || !topXNode || !head0Node || !resultNode || !bridgeLayerNode) {
        resetPaths()
        return
      }

      const getPoint = (node, xAnchor, yAnchor) => {
        const rect = node.getBoundingClientRect()
        const x =
          xAnchor === 'left'
            ? rect.left
            : xAnchor === 'right'
              ? rect.right
              : rect.left + rect.width * 0.5
        const y =
          yAnchor === 'top'
            ? rect.top
            : yAnchor === 'bottom'
              ? rect.bottom
              : rect.top + rect.height * 0.5
        return {
          x: x - rootRect.left,
          y: y - rootRect.top,
        }
      }

      const topOutPoint = getPoint(topOutputNode, 'center', 'bottom')
      const headPoint = getPoint(head0Node, 'center', 'top')
      const xPoint = getPoint(topXNode, 'center', 'bottom')
      const resultPoint = getPoint(resultNode, 'center', 'top')

      const topToHead = `M ${topOutPoint.x} ${topOutPoint.y} C ${topOutPoint.x} ${topOutPoint.y + 42}, ${headPoint.x} ${
        headPoint.y - 42
      }, ${headPoint.x} ${headPoint.y}`
      const xToResult = `M ${xPoint.x} ${xPoint.y} C ${xPoint.x - 110} ${xPoint.y + 92}, ${resultPoint.x - 40} ${
        resultPoint.y - 92
      }, ${resultPoint.x} ${resultPoint.y}`

      bridgeLayerNode.setAttribute('viewBox', `0 0 ${Math.max(1, rootRect.width)} ${Math.max(1, rootRect.height)}`)
      topPathNode?.setAttribute('d', topToHead)
      resultPathNode?.setAttribute('d', xToResult)
    }

    updatePaths()
    window.addEventListener('resize', updatePaths)
    return () => {
      window.removeEventListener('resize', updatePaths)
      resetPaths()
    }
  }, [animationTick, safeQueryIndex])

  const moveExampleName = (direction) => {
    setExampleNameIndex((prevIndex) => {
      const nextIndex = (prevIndex + direction + CHAPTER_FOUR_EXAMPLE_NAMES.length) % CHAPTER_FOUR_EXAMPLE_NAMES.length
      return nextIndex
    })
    setQueryIndex(0)
    setOpenInfoKey(null)
    setAnimationTick((prevTick) => prevTick + 1)
  }

  const moveQueryIndex = (direction) => {
    setQueryIndex((prevIndex) => {
      return clamp(prevIndex + direction, 0, Math.max(0, modelSequence.length - 1))
    })
    setOpenInfoKey(null)
    setAnimationTick((prevTick) => prevTick + 1)
  }

  const replayAnimation = () => {
    if (skipAnimations) {
      return
    }
    setOpenInfoKey(null)
    setAnimationTick((prevTick) => prevTick + 1)
  }

  const toggleSkipAnimations = () => {
    setOpenInfoKey(null)
    setSkipAnimations((prev) => !prev)
    setAnimationTick((prevTick) => prevTick + 1)
  }

  const renderVectorCells = (
    vector,
    keyPrefix,
    {
      dense = false,
      cellRefFactory = null,
      cellClassName = '',
      visibleMask = null,
      hiddenClassName = '',
    } = {},
  ) => {
    return (
      <div className={`attention-vector-grid ${dense ? 'attention-vector-grid--16' : 'attention-vector-grid--4'}`}>
        {vector.map((value, dimIndex) => {
          const numericValue = Number(value ?? 0)
          const ratio = clamp(Math.abs(numericValue) / maxAbs, 0, 1)
          const isVisible = !Array.isArray(visibleMask) || Boolean(visibleMask[dimIndex])
          return (
            <span
              key={`${keyPrefix}-${dimIndex}`}
              ref={cellRefFactory ? cellRefFactory(dimIndex) : undefined}
              className={`attention-cell ${dense ? 'attention-cell--dense' : ''} ${cellClassName} ${
                isVisible ? '' : `attention-cell--hidden ${hiddenClassName}`
              } ${valueTextClass}`.trim()}
              style={{
                backgroundColor: getHeatColor(numericValue, maxAbs),
                color: ratio > 0.8 ? '#fff' : '#000',
              }}
            >
              {isVisible ? numericValue.toFixed(2) : ATTENTION_HIDDEN_PLACEHOLDER}
            </span>
          )
        })}
      </div>
    )
  }

  const renderVectorColumn = (
    vector,
    keyPrefix,
    {
      dense = false,
      cellRefFactory = null,
      visibleMask = null,
      hiddenClassName = '',
    } = {},
  ) => {
    return (
      <div className={`attention-vector-column ${dense ? 'attention-vector-column--dense16' : ''}`.trim()}>
        {vector.map((value, dimIndex) => {
          const numericValue = Number(value ?? 0)
          const ratio = clamp(Math.abs(numericValue) / maxAbs, 0, 1)
          const isVisible = !Array.isArray(visibleMask) || Boolean(visibleMask[dimIndex])
          return (
            <div
              key={`${keyPrefix}-${dimIndex}`}
              className={`attention-vector-line ${dense ? 'attention-vector-line--dense16' : ''}`.trim()}
            >
              <span className={`attention-vector-line-dim ${dense ? 'attention-vector-line-dim--dense16' : ''} ${valueTextClass}`.trim()}>
                {dimIndex}
              </span>
              <span
                ref={cellRefFactory ? cellRefFactory(dimIndex) : undefined}
                className={`attention-vector-line-value attention-cell ${dense ? 'attention-vector-line-value--dense16' : ''} ${
                  isVisible ? '' : `attention-value--hidden ${hiddenClassName}`
                } ${valueTextClass}`.trim()}
                style={{
                  backgroundColor: getHeatColor(numericValue, maxAbs),
                  color: ratio > 0.8 ? '#fff' : '#000',
                }}
              >
                {isVisible ? numericValue.toFixed(2) : ATTENTION_HIDDEN_PLACEHOLDER}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  const renderStageHead = ({ key, title, infoTitle, infoBody, badge = '' }) => {
    const isInfoOpen = openInfoKey === key
    return (
      <div className="attention-stage-head">
        <p className="attention-stage-title">{title}</p>
        <div className="attention-stage-head-right">
          {badge ? <span className="attention-stage-badge">{badge}</span> : null}
          <div className="attention-help-wrap">
            <button
              type="button"
              className="attention-help-btn"
              onClick={() => {
                setOpenInfoKey((prevKey) => (prevKey === key ? null : key))
              }}
              aria-label={`${title} 개념 설명`}
              aria-expanded={isInfoOpen}
              aria-controls={`attention-help-${key}`}
            >
              ?
            </button>
            {isInfoOpen ? (
              <div id={`attention-help-${key}`} role="note" className="attention-help-popover">
                <p className="attention-help-title">{infoTitle}</p>
                <p className="attention-help-text">{infoBody}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  const headOutputRows = headOutputs.map((vector, headIdx) => ({
    head: headIdx,
    vector,
  }))

  if (!hasAttentionData) {
    return null
  }

  return (
    <div className={`attention-demo-wrap reveal ${reducedMotion ? 'attention-demo-wrap--static' : ''}`}>
      <div className="attention-controls">
        <div className="attention-nav">
          <p className="attention-nav-title">예시 이름</p>
          <div className="attention-nav-inner">
            <button
              type="button"
              className="attention-nav-arrow"
              onClick={() => moveExampleName(-1)}
              aria-label="이전 예시 이름"
            >
              <span className="attention-nav-arrow-shape attention-nav-arrow-shape-left" />
            </button>
            <p className="attention-nav-pill">
              <span className="attention-nav-pill-char">{currentExampleName}</span>
              <span className="attention-nav-pill-meta">HEAD 0</span>
            </p>
            <button
              type="button"
              className="attention-nav-arrow"
              onClick={() => moveExampleName(1)}
              aria-label="다음 예시 이름"
            >
              <span className="attention-nav-arrow-shape attention-nav-arrow-shape-right" />
            </button>
          </div>
        </div>

        <div className="attention-nav">
          <p className="attention-nav-title">타겟 인덱스</p>
          <div className="attention-nav-inner">
            <button
              type="button"
              className="attention-nav-arrow"
              onClick={() => moveQueryIndex(-1)}
              aria-label="이전 예시 인덱스"
            >
              <span className="attention-nav-arrow-shape attention-nav-arrow-shape-left" />
            </button>
            <p className="attention-nav-pill">
              <span className="attention-nav-pill-char">{`POS ${safeQueryIndex}`}</span>
              <span className="attention-nav-pill-meta">{queryToken ? `${queryToken.label} · ID ${queryToken.tokenId}` : ''}</span>
            </p>
            <button
              type="button"
              className="attention-nav-arrow"
              onClick={() => moveQueryIndex(1)}
              aria-label="다음 예시 인덱스"
            >
              <span className="attention-nav-arrow-shape attention-nav-arrow-shape-right" />
            </button>
          </div>
        </div>

        <button
          type="button"
          className={`attention-replay-btn ${isAnimating ? 'attention-replay-btn--active' : ''}`}
          onClick={replayAnimation}
          aria-label="Attention 계산 애니메이션 다시 재생"
          aria-disabled={skipAnimations}
          disabled={skipAnimations}
        >
          {isAnimating ? 'PLAYING...' : 'REPLAY'}
        </button>

        <button
          type="button"
          className={`attention-skip-btn ${skipAnimations ? 'attention-skip-btn--active' : ''}`}
          onClick={toggleSkipAnimations}
          aria-label="Chapter 4 애니메이션 생략 모드 토글"
          aria-pressed={skipAnimations}
        >
          {`ANIMATION SKIP: ${skipAnimations ? 'ON' : 'OFF'}`}
        </button>
      </div>

      <div className="attention-pipeline-shell">
        <div ref={pipelineContentRef} className="attention-pipeline-content">
          <div className="attention-pipeline-track">
            <section className="attention-stage attention-stage--x reveal">
              {renderStageHead({
                key: 'stage-x',
                title: 'FINAL EMBEDDING (x)',
                badge: `POS ${safeQueryIndex}`,
                infoTitle: 'Final Embedding (x)',
                infoBody: '현재 Query 위치의 Final Embedding 벡터입니다. Q, K, V를 만드는 재료가 됩니다.',
              })}

              <div className="attention-stage-body">
                <article ref={xVectorRef} className="attention-row attention-row--query">
                  <p className={`attention-row-label ${valueTextClass}`}>{`POS ${safeQueryIndex} · ${queryToken?.label ?? ''}`}</p>
                  <div className="attention-vector-column">
                    {currentXRows.map((row) => {
                      const ratio = clamp(Math.abs(row.value) / maxAbs, 0, 1)
                      const isVisible = Boolean(revealedXDims[row.dim])
                      return (
                        <div key={`x-line-${row.dim}`} className="attention-vector-line">
                          <span className={`attention-vector-line-dim ${valueTextClass}`}>{row.dim}</span>
                          <span
                            ref={(node) => {
                              xValueRefs.current[row.dim] = node
                            }}
                            className={`attention-vector-line-value ${!isVisible ? 'attention-value--hidden' : ''} ${valueTextClass}`.trim()}
                            style={{
                              backgroundColor: getHeatColor(row.value, maxAbs),
                              color: ratio > 0.8 ? '#fff' : '#000',
                            }}
                          >
                            {isVisible ? row.value.toFixed(2) : ATTENTION_HIDDEN_PLACEHOLDER}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </article>
              </div>
            </section>

            <section className="attention-stage attention-stage--qkv reveal">
              {renderStageHead({
                key: 'stage-qkv',
                title: 'Q / K / V',
                badge: 'HEAD 0',
                infoTitle: 'Q / K / V',
                infoBody:
                  'Q는 Query, K는 Key, V는 Value를 나타냅니다. 비유하자면, Q는 궁금증(질문), K는 정보가 저장된 책장(주소), V는 책장의 실제 내용(정보)과 같습니다. 즉, Q를 들고서 여러 책장(K)을 둘러보고, 필요한 내용을(V) 꺼내오는 과정입니다.',
              })}

              <div className="attention-stage-body">
                <div className="attention-qkv-grid">
                  <div className="attention-qkv-block">
                    <p className={`attention-qkv-title ${valueTextClass}`}>{`Q (from POS ${queryToken?.position ?? 0})`}</p>
                    <article ref={qVectorRef} className="attention-row attention-row--query">
                      {renderVectorCells(queryHeadVector, 'q-vector', {
                        cellRefFactory: (dimIndex) => (node) => {
                          qCellRefs.current[dimIndex] = node
                        },
                        visibleMask: revealedQDims,
                      })}
                    </article>
                  </div>

                  <div className="attention-qkv-block">
                    <p className={`attention-qkv-title ${valueTextClass}`}>K (0..query)</p>
                    <div className="attention-matrix-list">
                      {keyRows.map((row, rowIndex) => (
                        <article
                          key={`k-row-${row.position}`}
                          ref={(node) => {
                            kRowRefs.current[rowIndex] = node
                          }}
                          className="attention-row"
                        >
                          <p className={`attention-row-label ${valueTextClass}`}>{`POS ${row.position} · ${row.label}`}</p>
                          {renderVectorCells(row.vector, `k-${row.position}`, {
                            cellRefFactory: (dimIndex) => (node) => {
                              if (!kCellRefs.current[rowIndex]) {
                                kCellRefs.current[rowIndex] = []
                              }
                              kCellRefs.current[rowIndex][dimIndex] = node
                            },
                            visibleMask: revealedKCells[rowIndex] ?? [],
                          })}
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="attention-qkv-block">
                    <p className={`attention-qkv-title ${valueTextClass}`}>V (0..query)</p>
                    <div className="attention-matrix-list">
                      {valueRows.map((row, rowIndex) => (
                        <article
                          key={`v-row-${row.position}`}
                          ref={(node) => {
                            vRowRefs.current[rowIndex] = node
                          }}
                          className="attention-row"
                        >
                          <p className={`attention-row-label ${valueTextClass}`}>{`POS ${row.position} · ${row.label}`}</p>
                          {renderVectorCells(row.vector, `v-${row.position}`, {
                            cellRefFactory: (dimIndex) => (node) => {
                              if (!vCellRefs.current[rowIndex]) {
                                vCellRefs.current[rowIndex] = []
                              }
                              vCellRefs.current[rowIndex][dimIndex] = node
                            },
                            visibleMask: revealedVCells[rowIndex] ?? [],
                          })}
                        </article>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="attention-stage attention-stage--weights reveal">
              {renderStageHead({
                key: 'stage-weights',
                title: 'ATTN WEIGHTS',
                infoTitle: 'Attention Weights',
                infoBody: 'Q·K 점수를 softmax한 확률 분포 벡터입니다. 이 벡터는 각 POS의 K가 Q와 얼마나 연관성이 있는지를 나타냅니다.',
              })}

              <div className="attention-stage-body">
                <div className="attention-weights-list">
                  {weightRows.map((row, rowIndex) => {
                    const displayedWeight = Number(displayedWeights[rowIndex] ?? 0)
                    const color = getHeatColor(displayedWeight, 1)
                    const useLightText = displayedWeight >= 0.7
                    const isVisible = Boolean(revealedWeights[rowIndex])
                    return (
                      <article
                        key={`weight-row-${row.position}`}
                        ref={(node) => {
                          weightRowRefs.current[rowIndex] = node
                        }}
                        className="attention-weight-row"
                        style={{
                          backgroundColor: color,
                          color: useLightText ? '#fff' : '#000',
                        }}
                      >
                        <span className={`attention-weight-meta ${valueTextClass}`}>{`POS ${row.position}`}</span>
                        <span
                          ref={(node) => {
                            weightValueRefs.current[rowIndex] = node
                          }}
                          className={`attention-weight-values ${!isVisible ? 'attention-weight-value--hidden' : ''} ${valueTextClass}`.trim()}
                        >
                          {isVisible ? displayedWeight.toFixed(4) : ATTENTION_HIDDEN_PLACEHOLDER}
                        </span>
                      </article>
                    )
                  })}
                </div>
              </div>
            </section>

            <section className="attention-stage attention-stage--output reveal">
              {renderStageHead({
                key: 'stage-output',
                title: 'ATTENTION OUTPUT',
                badge: `step ${safeOutputStep}/${totalSteps}`,
                infoTitle: 'Attention Output',
                infoBody: '각 POS의 V에 Attention Weight를 곱해 누적한 결과입니다. 이 벡터는 현재 위치에서 과거 위치들의 정보를 종합적으로 반영한 결과입니다.',
              })}

              <div className="attention-stage-body">
                <div className="attention-contrib-list">
                  {weightedVRows.map((row, rowIndex) => (
                    <article
                      key={`contrib-row-${row.position}`}
                      ref={(node) => {
                        contribRowRefs.current[rowIndex] = node
                      }}
                      className={`attention-row ${rowIndex < safeOutputStep ? 'attention-row--done' : ''}`}
                    >
                      <p className={`attention-row-label ${valueTextClass}`}>
                        {`POS ${row.position}`}
                      </p>
                      {renderVectorCells(row.vector, `contrib-${row.position}`, {
                        cellRefFactory: (dimIndex) => (node) => {
                          if (!contribCellRefs.current[rowIndex]) {
                            contribCellRefs.current[rowIndex] = []
                          }
                          contribCellRefs.current[rowIndex][dimIndex] = node
                        },
                        visibleMask: revealedContribCells[rowIndex] ?? [],
                      })}
                    </article>
                  ))}
                </div>

                <article ref={outputVectorRef} className="attention-row attention-row--output">
                  <p className={`attention-row-label ${valueTextClass}`}>Σ(weight_t * V_t)</p>
                  {renderVectorCells(displayedOutputVector, 'output-final', {
                    cellRefFactory: (dimIndex) => (node) => {
                      outputCellRefs.current[dimIndex] = node
                    },
                    visibleMask: revealedOutputDims,
                  })}
                </article>
              </div>
            </section>
          </div>

          <div className="attention-extended-shell">
            <div className="attention-extended-grid">
              <section ref={headsStageRef} className="attention-extended-stage attention-extended-stage--heads">
                {renderStageHead({
                  key: 'stage-heads',
                  title: 'HEAD 0~3 OUTPUTS',
                  infoTitle: 'Head Outputs',
                  infoBody: '상단에서 head0에 대한 Attention Output을 구했습니다. 사실, GPT에서는 여러 개의 head를 사용해 보다 다양한 관점에서 정보(Attention Output)를 추출하고자 합니다. 본 예제에서는 4개 head output을 결합(concat)해 Multi-Head Attention 입력(x_attn)을 만듭니다.',
                })}
                <div className="attention-stage-body">
                  {headOutputRows.map((row, headIdx) => (
                    <article
                      key={`head-output-row-${headIdx}`}
                      ref={(node) => {
                        headOutputRowRefs.current[headIdx] = node
                      }}
                      className={`attention-row ${headIdx === 0 ? 'attention-row--query' : ''}`}
                    >
                      <p className={`attention-row-label ${valueTextClass}`}>{`HEAD ${headIdx} OUTPUT`}</p>
                      {headIdx > 0 ? (
                        <div className="attention-head-summary">
                          <span
                            ref={(node) => {
                              headSummaryQRefs.current[headIdx] = node
                            }}
                            className={`attention-head-summary-node ${valueTextClass}`}
                          >
                            Q{headIdx}
                          </span>
                          <span
                            ref={(node) => {
                              headSummaryKRefs.current[headIdx] = node
                            }}
                            className={`attention-head-summary-node ${valueTextClass}`}
                          >
                            K{headIdx}
                          </span>
                          <span
                            ref={(node) => {
                              headSummaryVRefs.current[headIdx] = node
                            }}
                            className={`attention-head-summary-node ${valueTextClass}`}
                          >
                            V{headIdx}
                          </span>
                        </div>
                      ) : null}
                      {renderVectorCells(row.vector, `head-output-${headIdx}`, {
                        cellRefFactory: (dimIndex) => (node) => {
                          if (!headOutputCellRefs.current[headIdx]) {
                            headOutputCellRefs.current[headIdx] = []
                          }
                          headOutputCellRefs.current[headIdx][dimIndex] = node
                        },
                        visibleMask: revealedHeadOutputCells[headIdx] ?? [],
                      })}
                    </article>
                  ))}
                </div>
              </section>

              <section ref={mhaStageRef} className="attention-extended-stage">
                {renderStageHead({
                  key: 'stage-mha',
                  title: 'Multi-Head Attention Output',
                  infoTitle: 'Multi-Head Attention Output',
                  infoBody: 'x_attn(16차원)에 W_O를 곱해 Multi-Head Attention Output을 만듭니다.',
                })}
                <div className="attention-stage-body">
                  <div className="attention-mha-split">
                    <article ref={mhaInputRowRef} className="attention-row attention-mha-pane">
                      <p className={`attention-row-label ${valueTextClass}`}>x_attn = concat(head0..3)</p>
                      {renderVectorColumn(xAttnVector, 'mha-input-col', {
                        dense: true,
                        cellRefFactory: (dimIndex) => (node) => {
                          mhaInputCellRefs.current[dimIndex] = node
                        },
                        visibleMask: revealedMhaInputDims,
                      })}
                    </article>
                    <article ref={mhaOutputRowRef} className="attention-row attention-row--output attention-mha-pane">
                      <p className={`attention-row-label ${valueTextClass}`}>linear(x_attn, W_O)</p>
                      {renderVectorColumn(displayedMhaOutputVector, 'mha-output-col', {
                        dense: true,
                        cellRefFactory: (dimIndex) => (node) => {
                          mhaOutputCellRefs.current[dimIndex] = node
                        },
                        visibleMask: revealedMhaOutputDims,
                      })}
                    </article>
                  </div>
                </div>
              </section>

              <section className="attention-extended-stage">
                {renderStageHead({
                  key: 'stage-result',
                  title: 'ATTENTION BLOCK RESULT',
                  infoTitle: 'Attention Block Result',
                  infoBody: 'Final Embedding(x)와 Multi-Head Attention Output을 더한 결과 벡터입니다. 이와 같이 이전 데이터를 잔차 연결(residual connection)을 통해 더해주면 모델의 학습 안정성을 높일 수 있어요.',
                })}
                <div className="attention-stage-body">
                  <article ref={resultRowRef} className="attention-row attention-row--output">
                    <p className={`attention-row-label ${valueTextClass}`}>x + linear(x_attn, W_O)</p>
                    {renderVectorColumn(displayedResult, 'attention-block-result-col', {
                      dense: true,
                      cellRefFactory: (dimIndex) => (node) => {
                        resultCellRefs.current[dimIndex] = node
                      },
                      visibleMask: revealedResultDims,
                    })}
                  </article>
                </div>
              </section>
            </div>
          </div>

          <div className="attention-decoder-shell">
            <div className="attention-decoder-grid">
              <section ref={blockOutputStageRef} className="attention-decoder-stage attention-decoder-stage--block-output">
                {renderStageHead({
                  key: 'stage-block-output',
                  title: 'TRANSFORMER BLOCK OUTPUT',
                  infoTitle: 'Transformer Block Output',
                  infoBody: 'Attention Block Result를 입력으로 MLP(Multi Layer Perceptron : rmsnorm → fc1 → relu → fc2 → residual)를 적용한 트랜스포머 블럭의 최종 출력 벡터입니다.',
                })}
                <div className="attention-stage-body">
                  <article ref={blockOutputRowRef} className="attention-row attention-row--output">
                    {renderVectorColumn(displayedBlockOutput, 'transformer-block-output-col', {
                      dense: true,
                      cellRefFactory: (dimIndex) => (node) => {
                        blockOutputCellRefs.current[dimIndex] = node
                      },
                      visibleMask: revealedBlockOutputDims,
                    })}
                  </article>
                </div>
              </section>

              <section ref={logitStageRef} className="attention-decoder-stage">
                {renderStageHead({
                  key: 'stage-logit',
                  title: 'LOGIT',
                  badge: 'TOP10 + BOTTOM2',
                  infoTitle: 'Logit',
                  infoBody: 'Transformer Block Output에 선형 변환을 적용해 토큰 별 점수(높을수록 다음 토큰이 될 확률이 높음)를 계산합니다. 전체 vocab에 대해 계산하고, 여기에는 상위 10개와 하위 2개만 표시합니다.',
                })}
                <div className="attention-stage-body">
                  <div className="attention-token-list">
                    {tokenDisplayRows.map((row) => {
                      if (row.isEllipsis) {
                        return (
                          <p key={row.key} className={`attention-token-ellipsis ${valueTextClass}`}>
                            ...
                          </p>
                        )
                      }
                      const rowIndex = row.selectedIndex
                      const shownValue = Number(displayedLogitValues[rowIndex] ?? 0)
                      const isVisible = Boolean(revealedLogitRows[rowIndex])
                      const tokenLabel = `${row.label} · ID ${row.tokenId}`
                      const ratio = clamp(Math.abs(shownValue) / logitAbsMax, 0, 1)
                      return (
                        <article
                          key={`logit-row-${row.tokenId}`}
                          ref={(node) => {
                            logitRowRefs.current[rowIndex] = node
                          }}
                          className="attention-token-row attention-row"
                        >
                          <span
                            className={`attention-token-meta ${
                              !isVisible ? 'attention-token-meta--hidden' : ''
                            } ${valueTextClass}`.trim()}
                          >
                            {isVisible ? tokenLabel : ATTENTION_HIDDEN_PLACEHOLDER}
                          </span>
                          <span
                            ref={(node) => {
                              logitValueRefs.current[rowIndex] = node
                            }}
                            className={`attention-token-value ${
                              !isVisible ? 'attention-weight-value--hidden' : ''
                            } ${valueTextClass}`.trim()}
                            style={{
                              backgroundColor: getHeatColor(shownValue, logitAbsMax),
                              color: ratio > 0.8 ? '#fff' : '#000',
                            }}
                          >
                            {isVisible ? shownValue.toFixed(4) : ATTENTION_HIDDEN_PLACEHOLDER}
                          </span>
                        </article>
                      )
                    })}
                  </div>
                </div>
              </section>

              <section ref={probStageRef} className="attention-decoder-stage">
                {renderStageHead({
                  key: 'stage-prob',
                  title: 'NEXT TOKEN PROB',
                  badge: 'SOFTMAX(LOGIT)',
                  infoTitle: 'Next Token Probability',
                  infoBody: 'logit 전체에 softmax를 적용해 다음 토큰이 나올 확률 분포를 만든 결과입니다.',
                })}
                <div className="attention-stage-body">
                  <div className="attention-token-list">
                    {tokenDisplayRows.map((row) => {
                      if (row.isEllipsis) {
                        return (
                          <p key={`${row.key}-prob`} className={`attention-token-ellipsis ${valueTextClass}`}>
                            ...
                          </p>
                        )
                      }
                      const rowIndex = row.selectedIndex
                      const shownValue = Number(displayedProbValues[rowIndex] ?? 0)
                      const isVisible = Boolean(revealedProbRows[rowIndex])
                      const tokenLabel = `${row.label} · ID ${row.tokenId}`
                      const useLightText = shownValue >= 0.7
                      return (
                        <article
                          key={`prob-row-${row.tokenId}`}
                          ref={(node) => {
                            probRowRefs.current[rowIndex] = node
                          }}
                          className="attention-token-row attention-row"
                        >
                          <span
                            className={`attention-token-meta ${
                              !isVisible ? 'attention-token-meta--hidden' : ''
                            } ${valueTextClass}`.trim()}
                          >
                            {isVisible ? tokenLabel : ATTENTION_HIDDEN_PLACEHOLDER}
                          </span>
                          <span
                            ref={(node) => {
                              probValueRefs.current[rowIndex] = node
                            }}
                            className={`attention-token-value ${
                              !isVisible ? 'attention-weight-value--hidden' : ''
                            } ${valueTextClass}`.trim()}
                            style={{
                              backgroundColor: getHeatColor(shownValue, 1),
                              color: useLightText ? '#fff' : '#000',
                            }}
                          >
                            {isVisible ? shownValue.toFixed(6) : ATTENTION_HIDDEN_PLACEHOLDER}
                          </span>
                        </article>
                      )
                    })}
                  </div>
                </div>
              </section>
            </div>
          </div>

          <svg
            ref={bridgeLayerRef}
            className="attention-bridge-layer"
            aria-hidden="true"
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
          >
            <path ref={bridgeTopPathRef} className="attention-bridge-path" d="" />
            <path ref={bridgeResultPathRef} className="attention-bridge-path" d="" />
          </svg>

          <div ref={flowLayerRef} className="attention-flow-layer" aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}

function ChapterFiveTrainingDemo({ snapshot, reducedMotion, isMobile }) {
  const tokenChars = useMemo(() => snapshot?.tokenizer?.uchars ?? [], [snapshot])
  const bos = Number(snapshot?.tokenizer?.bos ?? -1)
  const nEmbd = Number(snapshot?.n_embd ?? 0)
  const blockSize = Number(snapshot?.block_size ?? 0)
  const attention = snapshot?.attention
  const nHead = Number(attention?.n_head ?? 0)
  const headDim = Number(attention?.head_dim ?? 0)
  const attnWq = attention?.attn_wq
  const attnWk = attention?.attn_wk
  const attnWv = attention?.attn_wv
  const attnWo = attention?.attn_wo
  const wte = snapshot?.wte
  const wpe = snapshot?.wpe
  const mlpFc1 = snapshot?.mlp?.mlp_fc1
  const mlpFc2 = snapshot?.mlp?.mlp_fc2
  const lmHead = snapshot?.lm_head
  const [exampleNameIndex, setExampleNameIndex] = useState(0)
  const [animationTick, setAnimationTick] = useState(1)
  const [skipAnimations, setSkipAnimations] = useState(false)
  const [revealedPosColumns, setRevealedPosColumns] = useState([])
  const [revealedTargetRows, setRevealedTargetRows] = useState([])
  const [revealedLossCards, setRevealedLossCards] = useState([])
  const [isMeanVisible, setIsMeanVisible] = useState(false)
  const probColumnRefs = useRef([])
  const targetRowRefs = useRef([])
  const lossCardRefs = useRef([])
  const meanCardRef = useRef(null)
  const timelineRef = useRef(null)
  const flowLayerRef = useRef(null)
  const valueTextClass = isMobile ? 'text-[11px]' : 'text-xs'
  const currentExampleName = CHAPTER_FOUR_EXAMPLE_NAMES[exampleNameIndex]

  const hasMatrixShape = (matrix, rows, cols) =>
    Array.isArray(matrix) &&
    matrix.length === rows &&
    matrix.every((row) => Array.isArray(row) && row.length === cols)

  const vocabSize = Array.isArray(wte) ? wte.length : 0
  const isShapeValid =
    tokenChars.length > 0 &&
    Number.isFinite(bos) &&
    bos >= 0 &&
    nEmbd > 0 &&
    blockSize > 0 &&
    nHead > 0 &&
    headDim > 0 &&
    nEmbd % nHead === 0 &&
    hasMatrixShape(wte, vocabSize, nEmbd) &&
    hasMatrixShape(wpe, blockSize, nEmbd) &&
    hasMatrixShape(attnWq, nEmbd, nEmbd) &&
    hasMatrixShape(attnWk, nEmbd, nEmbd) &&
    hasMatrixShape(attnWv, nEmbd, nEmbd) &&
    hasMatrixShape(attnWo, nEmbd, nEmbd) &&
    hasMatrixShape(mlpFc1, nEmbd * 4, nEmbd) &&
    hasMatrixShape(mlpFc2, nEmbd, nEmbd * 4) &&
    hasMatrixShape(lmHead, vocabSize, nEmbd)

  const stoi = useMemo(() => {
    return Object.fromEntries(tokenChars.map((char, index) => [char, index]))
  }, [tokenChars])

  const modelSequence = useMemo(() => {
    if (!isShapeValid) {
      return []
    }

    const decomposition = decomposeKoreanNameToNfdTokens(currentExampleName)
    const phonemeTokens = decomposition.tokens.flatMap((token, index) => {
      const tokenId = stoi[token.nfd]
      if (typeof tokenId !== 'number') {
        return []
      }
      return [
        {
          id: `phoneme-${index}`,
          tokenId,
          label: `${token.role} ${token.display}`.trim(),
          position: index + 1,
          isBos: false,
        },
      ]
    })

    const sequence = [
      {
        id: 'bos',
        tokenId: bos,
        label: '[BOS]',
        position: 0,
        isBos: true,
      },
      ...phonemeTokens,
      {
        id: 'bos-end',
        tokenId: bos,
        label: '[BOS]',
        position: phonemeTokens.length + 1,
        isBos: true,
      },
    ]

    return sequence.slice(0, Math.min(blockSize, sequence.length))
  }, [blockSize, bos, currentExampleName, isShapeValid, stoi])

  const xVectors = useMemo(() => {
    return modelSequence.map((item) => {
      const tokenRow = wte[item.tokenId] ?? []
      const positionRow = wpe[item.position] ?? []
      const sumVector = Array.from({ length: nEmbd }, (_, index) => {
        return Number(tokenRow[index] ?? 0) + Number(positionRow[index] ?? 0)
      })
      return rmsNormVector(sumVector)
    })
  }, [modelSequence, nEmbd, wpe, wte])

  const trainingRows = useMemo(() => {
    if (!isShapeValid || modelSequence.length < 2) {
      return []
    }

    const rows = []
    const zeroVector = Array.from({ length: nEmbd }, () => 0)
    for (let queryIndex = 0; queryIndex < modelSequence.length - 1; queryIndex += 1) {
      const currentXVector = xVectors[queryIndex] ?? zeroVector
      const queryFullVector = matVec(currentXVector, attnWq)
      const keyFullRows = xVectors.slice(0, queryIndex + 1).map((vector) => matVec(vector, attnWk))
      const valueFullRows = xVectors.slice(0, queryIndex + 1).map((vector) => matVec(vector, attnWv))

      const headOutputs = Array.from({ length: nHead }, (_, headIdx) => {
        const queryHead = sliceHead(queryFullVector, headIdx, headDim)
        const keySlices = keyFullRows.map((row) => sliceHead(row, headIdx, headDim))
        const valueSlices = valueFullRows.map((row) => sliceHead(row, headIdx, headDim))
        const logits = keySlices.map((row) => dotProduct(queryHead, row) / Math.sqrt(headDim))
        const weights = softmaxNumbers(logits)
        return Array.from({ length: headDim }, (_, dimIndex) => {
          return valueSlices.reduce((accumulator, row, rowIndex) => {
            return accumulator + Number(weights[rowIndex] ?? 0) * Number(row[dimIndex] ?? 0)
          }, 0)
        })
      })

      const xAttnVector = headOutputs.flat()
      const mhaOutputVector = matVec(xAttnVector, attnWo)
      const residualVector = currentXVector.map((value, dimIndex) => {
        return Number(value ?? 0) + Number(mhaOutputVector[dimIndex] ?? 0)
      })
      const xNormVector = rmsNormVector(residualVector)
      const mlpHiddenVector = matVec(xNormVector, mlpFc1)
      const mlpReluVector = mlpHiddenVector.map((value) => Math.max(0, Number(value ?? 0)))
      const mlpLinearVector = matVec(mlpReluVector, mlpFc2)
      const blockOutputVector = residualVector.map((value, dimIndex) => {
        return Number(value ?? 0) + Number(mlpLinearVector[dimIndex] ?? 0)
      })
      const logitsVector = matVec(blockOutputVector, lmHead)
      const probVector = softmaxNumbers(logitsVector)

      const targetToken = modelSequence[queryIndex + 1]
      const targetTokenId = Number(targetToken?.tokenId ?? -1)
      if (targetTokenId < 0 || targetTokenId >= probVector.length) {
        continue
      }

      const sortedTokenIds = Array.from({ length: probVector.length }, (_, tokenId) => tokenId).sort((left, right) => {
        const diff = Number(probVector[right] ?? 0) - Number(probVector[left] ?? 0)
        if (diff !== 0) {
          return diff
        }
        return left - right
      })
      const targetRankRaw = sortedTokenIds.indexOf(targetTokenId)
      const targetRank = targetRankRaw >= 0 ? targetRankRaw : 0
      const windowSize = Math.min(5, sortedTokenIds.length)
      const windowStart = Math.max(0, Math.min(targetRank - 2, sortedTokenIds.length - windowSize))
      const windowEnd = Math.min(sortedTokenIds.length, windowStart + windowSize)
      const windowTokenIds = sortedTokenIds.slice(windowStart, windowEnd)
      const targetProb = Number(probVector[targetTokenId] ?? 0)

      rows.push({
        pos: queryIndex,
        targetTokenId,
        targetLabel: getVocabularyTokenLabel(targetTokenId, tokenChars, bos),
        targetProb,
        tokenLoss: -Math.log(Math.max(targetProb, 1e-12)),
        candidateRows: windowTokenIds.map((tokenId, offset) => ({
          tokenId,
          label: getVocabularyTokenLabel(tokenId, tokenChars, bos),
          prob: Number(probVector[tokenId] ?? 0),
          rank: windowStart + offset,
          isTarget: tokenId === targetTokenId,
        })),
      })
    }

    return rows
  }, [
    attnWo,
    attnWk,
    attnWq,
    attnWv,
    bos,
    headDim,
    isShapeValid,
    lmHead,
    mlpFc1,
    mlpFc2,
    modelSequence,
    nEmbd,
    nHead,
    tokenChars,
    xVectors,
  ])

  const meanLoss = useMemo(() => {
    if (!trainingRows.length) {
      return 0
    }
    const total = trainingRows.reduce((accumulator, row) => accumulator + Number(row.tokenLoss ?? 0), 0)
    return total / trainingRows.length
  }, [trainingRows])

  const lossRange = useMemo(() => {
    if (!trainingRows.length) {
      return { min: 0, max: 0, span: 0 }
    }
    const values = trainingRows.map((row) => Number(row.tokenLoss ?? 0))
    const min = Math.min(...values)
    const max = Math.max(...values)
    return { min, max, span: max - min }
  }, [trainingRows])

  const sharedGridStyle = useMemo(() => {
    const columnCount = Math.max(1, trainingRows.length)
    const style = { '--training-col-count': String(columnCount) }
    if (!isMobile) {
      return style
    }
    const gapPx = 7
    const minWidth = columnCount * 160 + Math.max(0, columnCount - 1) * gapPx
    return {
      ...style,
      minWidth: `${minWidth}px`,
    }
  }, [isMobile, trainingRows.length])

  useLayoutEffect(() => {
    const positionCount = trainingRows.length
    const flowLayer = flowLayerRef.current
    const createdFlowNodes = []

    const clearPulseClasses = () => {
      probColumnRefs.current.forEach((node) => node?.classList.remove('training-prob-col--active'))
      targetRowRefs.current.forEach((node) => node?.classList.remove('training-prob-row--pulse'))
      lossCardRefs.current.forEach((node) => node?.classList.remove('training-loss-card--pulse'))
      meanCardRef.current?.classList.remove('training-mean-card--pulse')
    }
    const clearFlowLayer = () => {
      if (flowLayer) {
        flowLayer.innerHTML = ''
      }
    }

    timelineRef.current?.kill()
    timelineRef.current = null
    clearPulseClasses()
    clearFlowLayer()

    if (!positionCount) {
      return () => {
        clearPulseClasses()
        clearFlowLayer()
      }
    }

    const revealAt = (setter, index) => {
      setter((prev) => {
        const previous = Array.isArray(prev) ? prev : []
        const resized =
          previous.length === positionCount ? [...previous] : Array.from({ length: positionCount }, (_, idx) => Boolean(previous[idx]))
        if (index < 0 || index >= positionCount) {
          return previous.length === positionCount ? prev : resized
        }
        if (resized[index]) {
          return previous.length === positionCount ? prev : resized
        }
        resized[index] = true
        return resized
      })
    }

    if (reducedMotion || skipAnimations) {
      const rafId = window.requestAnimationFrame(() => {
        setRevealedPosColumns(Array.from({ length: positionCount }, () => true))
        setRevealedTargetRows(Array.from({ length: positionCount }, () => true))
        setRevealedLossCards(Array.from({ length: positionCount }, () => true))
        setIsMeanVisible(true)
      })
      return () => {
        window.cancelAnimationFrame(rafId)
        clearPulseClasses()
        clearFlowLayer()
      }
    }

    const timeline = gsap.timeline()
    timelineRef.current = timeline

    const spawnConnector = (fromNode, toNode, startAt, variant = 'loss') => {
      if (!flowLayer || !fromNode || !toNode) {
        return
      }

      const flowRect = flowLayer.getBoundingClientRect()
      const fromRect = fromNode.getBoundingClientRect()
      const toRect = toNode.getBoundingClientRect()
      const fromX = fromRect.left + fromRect.width * 0.86 - flowRect.left
      const fromY = fromRect.top + fromRect.height * 0.5 - flowRect.top
      const toX = toRect.left + toRect.width * 0.5 - flowRect.left
      const toY = toRect.top + toRect.height * 0.5 - flowRect.top
      const distance = Math.hypot(toX - fromX, toY - fromY)
      const angle = (Math.atan2(toY - fromY, toX - fromX) * 180) / Math.PI

      const line = document.createElement('span')
      line.className = `training-flow-line training-flow-line--${variant}`
      line.style.left = `${fromX}px`
      line.style.top = `${fromY}px`
      line.style.width = `${distance}px`
      line.style.transform = `translateY(-50%) rotate(${angle}deg)`
      flowLayer.appendChild(line)
      createdFlowNodes.push(line)

      timeline.fromTo(
        line,
        { opacity: 0, scaleX: 0.12 },
        { opacity: 1, scaleX: 1, duration: 0.12, ease: 'power2.out' },
        startAt,
      )
      timeline.to(line, { opacity: 0, duration: 0.16, ease: 'power2.in' }, startAt + 0.12)
    }

    trainingRows.forEach((_, rowIndex) => {
      const at = rowIndex * 0.12
      timeline.call(() => {
        revealAt(setRevealedPosColumns, rowIndex)
        revealAt(setRevealedTargetRows, rowIndex)
      }, null, at)

      const probColumnNode = probColumnRefs.current[rowIndex]
      if (probColumnNode) {
        timeline.call(() => probColumnNode.classList.add('training-prob-col--active'), null, at + 0.01)
        timeline.call(() => probColumnNode.classList.remove('training-prob-col--active'), null, at + 0.2)
      }

      const targetRowNode = targetRowRefs.current[rowIndex]
      if (targetRowNode) {
        timeline.call(() => targetRowNode.classList.add('training-prob-row--pulse'), null, at + 0.03)
        timeline.call(() => targetRowNode.classList.remove('training-prob-row--pulse'), null, at + 0.22)
      }
    })

    const lossStageStart = trainingRows.length * 0.12 + 0.08
    trainingRows.forEach((_, rowIndex) => {
      const at = lossStageStart + rowIndex * 0.08
      timeline.call(() => {
        revealAt(setRevealedLossCards, rowIndex)
      }, null, at)

      const lossCardNode = lossCardRefs.current[rowIndex]
      if (lossCardNode) {
        spawnConnector(targetRowRefs.current[rowIndex], lossCardNode, at + 0.005, 'loss')
        timeline.call(() => lossCardNode.classList.add('training-loss-card--pulse'), null, at + 0.01)
        timeline.call(() => lossCardNode.classList.remove('training-loss-card--pulse'), null, at + 0.18)
      }
    })

    const meanStageStart = lossStageStart + trainingRows.length * 0.08 + 0.08
    timeline.call(() => {
      setIsMeanVisible(true)
    }, null, meanStageStart)

    trainingRows.forEach((_, rowIndex) => {
      const at = meanStageStart + 0.02 + rowIndex * 0.045
      spawnConnector(lossCardRefs.current[rowIndex], meanCardRef.current, at, 'mean')
    })

    if (meanCardRef.current) {
      const pulseStart = meanStageStart + trainingRows.length * 0.045 + 0.04
      timeline.call(() => meanCardRef.current?.classList.add('training-mean-card--pulse'), null, pulseStart)
      timeline.call(() => meanCardRef.current?.classList.remove('training-mean-card--pulse'), null, pulseStart + 0.2)
    }

    return () => {
      timeline.kill()
      timelineRef.current = null
      createdFlowNodes.forEach((node) => node.remove())
      clearPulseClasses()
      clearFlowLayer()
    }
  }, [animationTick, reducedMotion, skipAnimations, trainingRows])

  if (!isShapeValid) {
    return null
  }

  if (!trainingRows.length) {
    return (
      <div className="token-state-card reveal">
        <p className="text-sm font-black uppercase tracking-[0.2em]">TRAINING DEMO</p>
        <p className="mt-3 text-lg font-bold">학습 시퀀스를 만들 수 없어 표시할 데이터가 없습니다.</p>
      </div>
    )
  }

  const moveExampleName = (direction) => {
    setRevealedPosColumns(createRevealVector(trainingRows.length))
    setRevealedTargetRows(createRevealVector(trainingRows.length))
    setRevealedLossCards(createRevealVector(trainingRows.length))
    setIsMeanVisible(false)
    setExampleNameIndex((prevIndex) => {
      return (prevIndex + direction + CHAPTER_FOUR_EXAMPLE_NAMES.length) % CHAPTER_FOUR_EXAMPLE_NAMES.length
    })
    setAnimationTick((prevTick) => prevTick + 1)
  }

  const toggleSkipAnimations = () => {
    setRevealedPosColumns(createRevealVector(trainingRows.length))
    setRevealedTargetRows(createRevealVector(trainingRows.length))
    setRevealedLossCards(createRevealVector(trainingRows.length))
    setIsMeanVisible(false)
    setSkipAnimations((prev) => !prev)
    setAnimationTick((prevTick) => prevTick + 1)
  }

  return (
    <div className={`training-demo-wrap reveal ${reducedMotion ? 'training-demo-wrap--static' : ''}`}>
      <div className="training-controls">
        <div className="training-nav">
          <p className="training-nav-title">예시 이름</p>
          <div className="training-nav-inner">
            <button type="button" className="training-nav-arrow" onClick={() => moveExampleName(-1)} aria-label="이전 예시 이름 보기">
              <span className="training-nav-arrow-shape training-nav-arrow-shape-left" />
            </button>
            <p className="training-nav-pill">
              <span className="training-nav-pill-char">{currentExampleName}</span>
              <span className="training-nav-pill-meta">{`POS 0 ~ ${Math.max(0, trainingRows.length - 1)}`}</span>
            </p>
            <button type="button" className="training-nav-arrow" onClick={() => moveExampleName(1)} aria-label="다음 예시 이름 보기">
              <span className="training-nav-arrow-shape training-nav-arrow-shape-right" />
            </button>
          </div>
        </div>

        <button
          type="button"
          className={`training-skip-btn ${skipAnimations ? 'training-skip-btn--active' : ''}`}
          onClick={toggleSkipAnimations}
          aria-label="Chapter 5 애니메이션 생략 모드 토글"
          aria-pressed={skipAnimations}
        >
          {`ANIMATION SKIP: ${skipAnimations ? 'ON' : 'OFF'}`}
        </button>
      </div>

      <div className="training-flow-scope">
        <section className="training-prob-shell" aria-label="POS별 next token probability">
          <div className="training-prob-strip" style={sharedGridStyle}>
            {trainingRows.map((row, rowIndex) => {
              const isColumnVisible = Boolean(revealedPosColumns[rowIndex])
              const isTargetVisible = Boolean(revealedTargetRows[rowIndex])
              return (
                <article
                  key={`training-prob-col-${row.pos}`}
                  ref={(node) => {
                    probColumnRefs.current[rowIndex] = node
                  }}
                  className={`training-prob-col ${isColumnVisible ? '' : 'training-prob-col--hidden'}`.trim()}
                >
                  <div className="training-prob-col-head">
                    <p className={`training-prob-col-pos ${valueTextClass}`}>{`POS ${row.pos}`}</p>
                    <p className={`training-prob-col-target ${valueTextClass}`}>
                      {isColumnVisible ? `정답: ${row.targetLabel}` : ATTENTION_HIDDEN_PLACEHOLDER}
                    </p>
                  </div>
                  <div className="training-prob-row-list">
                    {row.candidateRows.map((candidate) => {
                      const isTargetRow = candidate.isTarget && isTargetVisible
                    return (
                      <div
                        key={`training-candidate-${row.pos}-${candidate.tokenId}`}
                          ref={(node) => {
                            if (candidate.isTarget) {
                              targetRowRefs.current[rowIndex] = node
                            }
                          }}
                          className={`training-prob-row ${isTargetRow ? 'training-prob-row--target' : ''}`.trim()}
                        >
                          <span className={`training-prob-rank ${valueTextClass}`}>
                            {isColumnVisible ? `#${candidate.rank + 1}` : '#?'}
                          </span>
                          <span className={`training-prob-token ${valueTextClass}`}>
                            {isColumnVisible ? candidate.label : ATTENTION_HIDDEN_PLACEHOLDER}
                          </span>
                          <span
                            className={`training-prob-value ${valueTextClass}`}
                            style={
                              isColumnVisible
                                ? {
                                    backgroundColor: interpolateHexColor(
                                      EMBEDDING_POSITIVE_BASE,
                                      EMBEDDING_POSITIVE_STRONG,
                                      clamp(candidate.prob, 0, 1),
                                    ),
                                    color: candidate.prob >= 0.78 ? '#fff' : '#000',
                                  }
                                : undefined
                            }
                          >
                            {isColumnVisible ? candidate.prob.toFixed(3) : ATTENTION_HIDDEN_PLACEHOLDER}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="training-loss-shell" aria-label="POS별 token loss">
          <p className="training-loss-title">TOKEN LOSS = -log(prob)</p>
          <div className="training-loss-grid" style={sharedGridStyle}>
            {trainingRows.map((row, rowIndex) => {
              const isLossVisible = Boolean(revealedLossCards[rowIndex])
            return (
              <article
                  key={`training-loss-${row.pos}`}
                  ref={(node) => {
                    lossCardRefs.current[rowIndex] = node
                  }}
                  className={`training-loss-card ${isLossVisible ? '' : 'training-loss-card--hidden'}`.trim()}
              >
                <span className={`training-loss-pos ${valueTextClass}`}>{`POS ${row.pos}`}</span>
                <span
                  className={`training-loss-value ${valueTextClass}`}
                  style={
                    isLossVisible
                      ? (() => {
                          const lossRatio =
                            lossRange.span < 1e-8 ? 0.5 : clamp((Number(row.tokenLoss ?? 0) - lossRange.min) / lossRange.span, 0, 1)
                          return {
                            backgroundColor: interpolateHexColor(
                              EMBEDDING_NEGATIVE_BASE,
                              EMBEDDING_NEGATIVE_STRONG,
                              lossRatio,
                            ),
                            color: lossRatio >= 0.78 ? '#fff' : '#000',
                          }
                        })()
                      : undefined
                  }
                >
                  {isLossVisible ? row.tokenLoss.toFixed(3) : ATTENTION_HIDDEN_PLACEHOLDER}
                </span>
              </article>
              )
            })}
          </div>
        </section>

        <div ref={flowLayerRef} className="training-flow-layer" aria-hidden="true" />
      </div>

      <article
        ref={meanCardRef}
        className={`training-mean-card ${isMeanVisible ? '' : 'training-mean-card--hidden'}`.trim()}
        aria-label="평균 loss"
      >
        <p className="training-mean-title">MEAN LOSS</p>
        <p className="training-mean-value">{isMeanVisible ? meanLoss.toFixed(3) : ATTENTION_HIDDEN_PLACEHOLDER}</p>
      </article>
    </div>
  )
}

const lessonSections = [
  {
    id: 'lesson-1',
    label: 'CHAPTER 01',
    title: 'DATA',
    description:
      '이름을 만드는 GPT 모델을 학습시키기 위해, 많은 이름들을 모았어요. 이 이름들이 실제론 문서에 해당해요.',
    points: [
      '한국어 이름 샘플을 모아 학습 데이터셋을 만들어요.',
      '각 이름은 모델이 읽는 하나의 문서(document)예요.',
      '문서 수가 많을수록 이름 패턴을 더 안정적으로 배워요.',
    ],
    takeaway: '데이터 품질이 좋아질수록 생성되는 이름 품질도 좋아져요.',
    bgClass: 'bg-neo-secondary',
  },
  {
    id: 'lesson-2',
    label: 'CHAPTER 02',
    title: 'TOKENIZATION',
    description:
      '모델이 이름을 만드는 방법을 배우게 하기 위해, 이름을 음운(초성·중성·종성)으로 나누고, 각 음운에 고유한 번호(토큰 ID)를 부여해 모델이 읽을 수 있는 형태로 바꿨어요. 이름의 시작과 끝에는 [BOS]라는 특수한 토큰을 추가해 어디가 시작과 끝인지 알려줘요.',
    points: [
      '좌우 화살표로 예시 이름을 바꿔가며 토큰화를 확인해요.',
      '각 음운 토큰에는 모델이 참조하는 고유 번호(token id)가 매핑돼요.',
      'BOS 토큰은 이름 시퀀스가 시작된다는 것을 알려주는 특수 토큰이에요.',
    ],
    takeaway: '이름을 음운 + 번호 시퀀스로 바꾸면, 모델이 계산 가능한 입력으로 이해할 수 있어요.',
    bgClass: 'bg-neo-muted',
  },
  {
    id: 'lesson-3',
    label: 'CHAPTER 03',
    title: 'EMBEDDING',
    description:
      '토큰 임베딩과 위치 임베딩을 더해 모델 입력 임베딩을 만듭니다. 어떤 음운이 어느 위치에 놓였는지에 따라 최종 벡터가 달라집니다.',
    points: [
      '각 토큰은 길이 16의 숫자 벡터(토큰 임베딩)로 변환돼요.',
      '현재 위치도 길이 16의 벡터(위치 임베딩)로 표현돼요.',
      '두 벡터를 같은 차원끼리 더한 값이 모델 입력이 돼요.',
    ],
    takeaway: '같은 음운이라도 위치가 바뀌면 입력 임베딩이 달라집니다.',
    bgClass: 'bg-white',
  },
  {
    id: 'lesson-4',
    label: 'CHAPTER 04',
    title: 'ATTENTION',
    description:
      '선택한 예시 이름와 인덱스를 기준으로 Final Embedding(x)에서 Q, K, V를 만들어 Attention Output을 계산하고, 최종적으로 다음 토큰으로 어떤 토큰이 나올 지 확률을 계산합니다.',
    points: [
      'Query 위치를 고르면 해당 위치의 Q를 기준으로 과거 토큰들과의 유사도를 계산해요.',
      'K는 정보의 주소, V는 실제로 가져올 내용을 나타내요.',
      'softmax로 정규화한 가중치로 V를 합치면 최종 Attention Output이 됩니다.',
    ],
    takeaway: 'Attention은 현재 위치가 필요한 과거 정보를 선택적으로 모아오는 연산입니다.',
    bgClass: 'bg-neo-muted',
  },
  {
    id: 'lesson-5',
    label: 'CHAPTER 05',
    title: 'TRAINING',
    description:
      '각 POS에서 정답 토큰이 나올 확률을 통해 최종 손실(loss)을 계산합니다. 이 손실을 줄이는 과정이 모델이 학습하는 과정이고, 내부에서는 손실을 역전파(backpropagation)하여 모델의 파라미터를 업데이트합니다.',
    points: [
      'POS 0부터 마지막 음운 예측 POS까지 next token 확률을 순서대로 확인해요.',
      '각 POS마다 정답 토큰 주변 5개 확률만 세로 리스트로 보여줘요.',
      '아래에서 POS별 token loss와 평균 loss를 함께 확인해요.',
    ],
    takeaway: '학습은 각 POS의 정답 확률을 높이는 방향으로 평균 loss를 줄이는 과정입니다.',
    bgClass: 'bg-white',
  },
]

function App() {
  const pageRef = useRef(null)
  const [reducedMotion, setReducedMotion] = useState(() => getInitialMatch('(prefers-reduced-motion: reduce)'))
  const [isMobile, setIsMobile] = useState(() => getInitialMatch('(max-width: 767px)'))
  const [chapterTwoTokenizer, setChapterTwoTokenizer] = useState(null)
  const [tokenizerStatus, setTokenizerStatus] = useState('loading')
  const [tokenizerError, setTokenizerError] = useState('')
  const [embeddingSnapshot, setEmbeddingSnapshot] = useState(null)
  const [embeddingStatus, setEmbeddingStatus] = useState('loading')
  const [embeddingError, setEmbeddingError] = useState('')
  const [attentionSnapshot, setAttentionSnapshot] = useState(null)
  const [attentionStatus, setAttentionStatus] = useState('loading')
  const [attentionError, setAttentionError] = useState('')

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const mobileQuery = window.matchMedia('(max-width: 767px)')

    const onMotionChange = (event) => setReducedMotion(event.matches)
    const onMobileChange = (event) => setIsMobile(event.matches)

    motionQuery.addEventListener('change', onMotionChange)
    mobileQuery.addEventListener('change', onMobileChange)

    return () => {
      motionQuery.removeEventListener('change', onMotionChange)
      mobileQuery.removeEventListener('change', onMobileChange)
    }
  }, [])

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()

    const loadTokenizer = async () => {
      setTokenizerStatus('loading')
      setTokenizerError('')

      try {
        const response = await fetch('/data/ko_name.txt', { signal: controller.signal })
        if (!response.ok) {
          throw new Error('failed to fetch dataset')
        }
        const rawText = await response.text()
        const tokenizer = buildTokenizerFromRaw(rawText)

        if (!isActive) {
          return
        }

        setChapterTwoTokenizer(tokenizer)
        setTokenizerStatus('ready')
      } catch (error) {
        if (!isActive || error.name === 'AbortError') {
          return
        }

        setChapterTwoTokenizer(null)
        setTokenizerStatus('error')
        setTokenizerError('토큰 맵 로드 실패')
      }
    }

    loadTokenizer()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [])

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()

    const loadEmbeddingSnapshot = async () => {
      setEmbeddingStatus('loading')
      setEmbeddingError('')
      setAttentionStatus('loading')
      setAttentionError('')

      try {
        const response = await fetch('/data/ko_embedding_snapshot.json', { signal: controller.signal })
        if (!response.ok) {
          throw new Error('failed to fetch embedding snapshot')
        }

        const payload = await response.json()
        const isEmbeddingValid =
          Number(payload?.n_embd) > 0 &&
          Number(payload?.block_size) > 0 &&
          Array.isArray(payload?.tokenizer?.uchars) &&
          typeof payload?.tokenizer?.bos === 'number' &&
          Array.isArray(payload?.wte) &&
          Array.isArray(payload?.wpe) &&
          Array.isArray(payload?.wte?.[0]) &&
          Array.isArray(payload?.wpe?.[0])

        if (!isEmbeddingValid) {
          throw new Error('invalid embedding snapshot payload')
        }

        const embd = Number(payload?.n_embd ?? 0)
        const vocabSize = Array.isArray(payload?.wte) ? payload.wte.length : 0
        const hasMatrixShape = (matrix, rows, cols) => {
          return (
            Array.isArray(matrix) &&
            matrix.length === rows &&
            matrix.every((row) => Array.isArray(row) && row.length === cols)
          )
        }
        const attentionHeadDim = Number(payload?.attention?.head_dim ?? 0)
        const attentionHeadCount = Number(payload?.attention?.n_head ?? 0)
        const isAttentionValid =
          Number(payload?.attention?.layer_index) >= 0 &&
          Number(payload?.attention?.head_index) >= 0 &&
          attentionHeadDim > 0 &&
          attentionHeadCount > 0 &&
          hasMatrixShape(payload?.attention?.attn_wq, embd, embd) &&
          hasMatrixShape(payload?.attention?.attn_wk, embd, embd) &&
          hasMatrixShape(payload?.attention?.attn_wv, embd, embd) &&
          hasMatrixShape(payload?.attention?.attn_wo, embd, embd)
        const isMlpValid =
          Number(payload?.mlp?.layer_index) >= 0 &&
          hasMatrixShape(payload?.mlp?.mlp_fc1, embd * 4, embd) &&
          hasMatrixShape(payload?.mlp?.mlp_fc2, embd, embd * 4)
        const isLmHeadValid = hasMatrixShape(payload?.lm_head, vocabSize, embd)
        const isChapterFourSnapshotValid = isAttentionValid && isMlpValid && isLmHeadValid

        if (!isActive) {
          return
        }

        setEmbeddingSnapshot(payload)
        setEmbeddingStatus('ready')
        if (isChapterFourSnapshotValid) {
          setAttentionSnapshot(payload.attention)
          setAttentionStatus('ready')
        } else {
          setAttentionSnapshot(null)
          setAttentionStatus('error')
          setAttentionError('Attention/MLP/lm_head 스냅샷 로드 실패')
        }
      } catch (error) {
        if (!isActive || error.name === 'AbortError') {
          return
        }
        setEmbeddingSnapshot(null)
        setEmbeddingStatus('error')
        setEmbeddingError('임베딩 스냅샷 로드 실패')
        setAttentionSnapshot(null)
        setAttentionStatus('error')
        setAttentionError('Attention/MLP/lm_head 스냅샷 로드 실패')
      }
    }

    loadEmbeddingSnapshot()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [])

  useLayoutEffect(() => {
    let ctx = null
    if (!reducedMotion) {
      ctx = gsap.context(() => {
        gsap.from('.hero-sticker', {
          y: -90,
          opacity: 0,
          rotate: -10,
          duration: 0.9,
          stagger: 0.1,
          ease: 'power2.out',
        })

        gsap.to('.scroll-progress-fill', {
          scaleY: 1,
          transformOrigin: 'top top',
          ease: 'none',
          scrollTrigger: {
            trigger: pageRef.current,
            start: 'top top',
            end: 'bottom bottom',
            scrub: true,
          },
        })

        gsap.utils.toArray('.edu-panel').forEach((panel, index) => {
          gsap.from(panel.querySelectorAll('.reveal'), {
            y: 90,
            opacity: 0,
            rotate: index % 2 ? -2 : 2,
            stagger: 0.12,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: panel,
              start: 'top 72%',
              end: 'top 35%',
              scrub: true,
            },
          })
        })
      }, pageRef)
    }

    return () => {
      ctx?.revert()
    }
  }, [reducedMotion])

  const chapterOneSection = lessonSections[0]
  const chapterTwoSection = lessonSections[1]
  const chapterThreeSection = lessonSections[2]
  const chapterFourSection = lessonSections[3]
  const chapterFiveSection = lessonSections[4]

  return (
    <div ref={pageRef} className="relative overflow-x-clip bg-neo-cream font-space text-black">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed right-4 top-6 z-50 hidden h-[calc(100vh-3rem)] w-4 border-4 border-black bg-white lg:block"
      >
        <div className="scroll-progress-fill h-full w-full origin-top scale-y-0 bg-neo-accent" />
      </div>

      <HeroSection />

      <main>
        <ChapterOneSection
          section={chapterOneSection}
          takeawayNumber={1}
          dataCloud={<ChapterOneDataCloud names={CHAPTER_ONE_NAMES} reducedMotion={reducedMotion} isMobile={isMobile} />}
        />

        <ChapterTwoSection
          section={chapterTwoSection}
          jamoCloud={<ChapterTwoJamoCloud reducedMotion={reducedMotion} isMobile={isMobile} />}
        >
          {tokenizerStatus === 'loading' ? (
            <div className="token-state-card reveal">
              <p className="text-sm font-black uppercase tracking-[0.2em]">TOKEN MAP</p>
              <p className="mt-3 text-lg font-bold">토큰 맵을 불러오는 중...</p>
            </div>
          ) : null}

          {tokenizerStatus === 'error' ? (
            <div className="token-state-card reveal">
              <p className="text-sm font-black uppercase tracking-[0.2em]">TOKEN MAP</p>
              <p className="mt-3 text-lg font-bold">{tokenizerError || '토큰 맵 로드 실패'}</p>
            </div>
          ) : null}

          {tokenizerStatus === 'ready' && chapterTwoTokenizer ? (
            <ChapterTwoTokenizationDemo
              tokenizer={chapterTwoTokenizer}
              reducedMotion={reducedMotion}
              isMobile={isMobile}
            />
          ) : null}
        </ChapterTwoSection>

        <ChapterThreeSection section={chapterThreeSection}>
          {embeddingStatus === 'loading' ? (
            <div className="token-state-card reveal">
              <p className="text-sm font-black uppercase tracking-[0.2em]">EMBEDDING SNAPSHOT</p>
              <p className="mt-3 text-lg font-bold">임베딩 스냅샷을 불러오는 중...</p>
            </div>
          ) : null}

          {embeddingStatus === 'error' ? (
            <div className="token-state-card reveal">
              <p className="text-sm font-black uppercase tracking-[0.2em]">EMBEDDING SNAPSHOT</p>
              <p className="mt-3 text-lg font-bold">{embeddingError || '임베딩 스냅샷 로드 실패'}</p>
            </div>
          ) : null}

          {embeddingStatus === 'ready' && embeddingSnapshot ? (
            <ChapterThreeEmbeddingDemo
              snapshot={embeddingSnapshot}
              reducedMotion={reducedMotion}
              isMobile={isMobile}
            />
          ) : null}
        </ChapterThreeSection>

        <ChapterFourSection section={chapterFourSection}>
          {attentionStatus === 'loading' ? (
            <div className="token-state-card reveal">
              <p className="text-sm font-black uppercase tracking-[0.2em]">ATTENTION SNAPSHOT</p>
              <p className="mt-3 text-lg font-bold">Attention 스냅샷을 불러오는 중...</p>
            </div>
          ) : null}

          {attentionStatus === 'error' ? (
            <div className="token-state-card reveal">
              <p className="text-sm font-black uppercase tracking-[0.2em]">ATTENTION SNAPSHOT</p>
              <p className="mt-3 text-lg font-bold">{attentionError || 'Attention 스냅샷 로드 실패'}</p>
            </div>
          ) : null}

          {attentionStatus === 'ready' && embeddingSnapshot && attentionSnapshot ? (
            <ChapterFourAttentionDemo
              snapshot={embeddingSnapshot}
              attention={attentionSnapshot}
              reducedMotion={reducedMotion}
              isMobile={isMobile}
            />
          ) : null}
        </ChapterFourSection>

        <ChapterFiveSection section={chapterFiveSection}>
          {attentionStatus === 'loading' ? (
            <div className="token-state-card reveal">
              <p className="text-sm font-black uppercase tracking-[0.2em]">TRAINING SNAPSHOT</p>
              <p className="mt-3 text-lg font-bold">Training 스냅샷을 불러오는 중...</p>
            </div>
          ) : null}

          {attentionStatus === 'error' ? (
            <div className="token-state-card reveal">
              <p className="text-sm font-black uppercase tracking-[0.2em]">TRAINING SNAPSHOT</p>
              <p className="mt-3 text-lg font-bold">{attentionError || 'Training 스냅샷 로드 실패'}</p>
            </div>
          ) : null}

          {attentionStatus === 'ready' && embeddingSnapshot ? (
            <ChapterFiveTrainingDemo snapshot={embeddingSnapshot} reducedMotion={reducedMotion} isMobile={isMobile} />
          ) : null}
        </ChapterFiveSection>
      </main>

      <FooterSection />
    </div>
  )
}

export default App
