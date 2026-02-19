import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import HeroSection from './components/sections/HeroSection'
import ChapterOneSection from './components/sections/ChapterOneSection'
import ChapterTwoSection from './components/sections/ChapterTwoSection'
import ChapterThreeSection from './components/sections/ChapterThreeSection'
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

const CHAPTER_TWO_EXAMPLE_NAMES = ['시연', '민준', '아영', '지혜', '승민', '하율']
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

const toDisplayJamoForChapter3 = (nfdChar) => {
  if (!nfdChar) {
    return ''
  }
  const code = nfdChar.codePointAt(0)
  if (!code) {
    return nfdChar
  }
  if (code >= 0x1100 && code <= 0x1112) {
    return CHOSEONG_COMPAT[code - 0x1100] ?? nfdChar
  }
  if (code >= 0x1161 && code <= 0x1175) {
    return JUNGSEONG_COMPAT[code - 0x1161] ?? nfdChar
  }
  if (code >= 0x11a8 && code <= 0x11c2) {
    return JONGSEONG_COMPAT[code - 0x11a7] ?? nfdChar
  }
  return nfdChar
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

  useLayoutEffect(() => {
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
  const displayChar = toDisplayJamoForChapter3(tokenChars[safeTokenIndex])
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
      infoBody: '토큰이 시퀀스의 몇 번째인지 알려주는 벡터입니다.',
      vector: positionVector,
      rowRef: positionRowRefs,
      columnRef: positionColumnRef,
    },
    {
      key: 'sum',
      title: 'SUM EMBEDDING',
      infoTitle: 'Sum Embedding',
      infoBody: '토큰 임베딩과 위치 임베딩을 차원별로 더한 중간 입력입니다.',
      vector: sumVector,
      rowRef: sumRowRefs,
      columnRef: sumColumnRef,
    },
    {
      key: 'final',
      title: 'FINAL EMBEDDING',
      infoTitle: 'Final Embedding',
      infoBody: '합 벡터를 RMSNorm으로 스케일링한 최종 입력입니다. x / sqrt(mean(x^2)+1e-5)',
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
              <span className="embedding-nav-pill-char">{displayChar}</span>
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

      try {
        const response = await fetch('/data/ko_embedding_snapshot.json', { signal: controller.signal })
        if (!response.ok) {
          throw new Error('failed to fetch embedding snapshot')
        }

        const payload = await response.json()
        const isValid =
          Number(payload?.n_embd) > 0 &&
          Number(payload?.block_size) > 0 &&
          Array.isArray(payload?.tokenizer?.uchars) &&
          typeof payload?.tokenizer?.bos === 'number' &&
          Array.isArray(payload?.wte) &&
          Array.isArray(payload?.wpe) &&
          Array.isArray(payload?.wte?.[0]) &&
          Array.isArray(payload?.wpe?.[0])

        if (!isValid) {
          throw new Error('invalid embedding snapshot payload')
        }

        if (!isActive) {
          return
        }

        setEmbeddingSnapshot(payload)
        setEmbeddingStatus('ready')
      } catch (error) {
        if (!isActive || error.name === 'AbortError') {
          return
        }
        setEmbeddingSnapshot(null)
        setEmbeddingStatus('error')
        setEmbeddingError('임베딩 스냅샷 로드 실패')
      }
    }

    loadEmbeddingSnapshot()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [])

  useLayoutEffect(() => {
    const sections = Array.from(document.querySelectorAll('.snap-section'))
    let wheelLocked = false
    let unlockTimerId = null

    const syncSectionIndex = () => {
      const pivotY = window.scrollY + window.innerHeight * 0.45
      let nearestIndex = 0
      sections.forEach((section, index) => {
        if (section.offsetTop <= pivotY) {
          nearestIndex = index
        }
      })
      return nearestIndex
    }

    let currentSectionIndex = syncSectionIndex()

    const unlockWheelLater = (delay) => {
      window.clearTimeout(unlockTimerId)
      unlockTimerId = window.setTimeout(() => {
        wheelLocked = false
      }, delay)
    }

    const goToSection = (nextIndex) => {
      if (!sections.length) {
        return
      }

      const boundedIndex = Math.max(0, Math.min(sections.length - 1, nextIndex))
      if (boundedIndex === currentSectionIndex) {
        return
      }

      currentSectionIndex = boundedIndex
      wheelLocked = true

      window.scrollTo({
        top: sections[boundedIndex].offsetTop,
        behavior: reducedMotion ? 'auto' : 'smooth',
      })

      unlockWheelLater(reducedMotion ? 60 : 800)
    }

    const onWheel = (event) => {
      if (Math.abs(event.deltaY) < 12) {
        return
      }

      event.preventDefault()

      if (wheelLocked) {
        return
      }

      const direction = event.deltaY > 0 ? 1 : -1
      goToSection(currentSectionIndex + direction)
    }

    const onKeyDown = (event) => {
      const targetTag = event.target?.tagName ?? ''
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT') {
        return
      }

      if (wheelLocked) {
        if (
          event.key === 'ArrowDown' ||
          event.key === 'PageDown' ||
          event.key === 'ArrowUp' ||
          event.key === 'PageUp' ||
          event.key === ' '
        ) {
          event.preventDefault()
        }
        return
      }

      if (event.key === 'ArrowDown' || event.key === 'PageDown' || (event.key === ' ' && !event.shiftKey)) {
        event.preventDefault()
        goToSection(currentSectionIndex + 1)
        return
      }

      if (event.key === 'ArrowUp' || event.key === 'PageUp' || (event.key === ' ' && event.shiftKey)) {
        event.preventDefault()
        goToSection(currentSectionIndex - 1)
      }
    }

    const onScroll = () => {
      if (wheelLocked) {
        return
      }
      currentSectionIndex = syncSectionIndex()
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, { passive: true })

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
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll)
      window.clearTimeout(unlockTimerId)
      ctx?.revert()
    }
  }, [reducedMotion])

  const chapterOneSection = lessonSections[0]
  const chapterTwoSection = lessonSections[1]
  const chapterThreeSection = lessonSections[2]

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
      </main>

      <FooterSection />
    </div>
  )
}

export default App
