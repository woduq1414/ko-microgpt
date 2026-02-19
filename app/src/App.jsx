import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

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
const ROTATION_STEPS = [-6, -3, -1, 1, 3, 6]
const SIZE_CLASSES = ['text-base', 'text-lg', 'text-xl']

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
    title: 'TRAINING LOOP',
    description:
      'The model learns next-token prediction with custom autograd and Adam updates. Even minimalist code can teach full LM fundamentals.',
    points: [
      'Cross-entropy from softmax probabilities over target tokens.',
      'Per-step Adam with bias correction and lr decay.',
      'Checkpoint stores config, tokenizer, params, dataset names.',
    ],
    takeaway: 'This is a readable from-scratch LM, ideal for teaching internals.',
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

  return (
    <div ref={pageRef} className="relative overflow-x-clip bg-neo-cream font-space text-black">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed right-4 top-6 z-50 hidden h-[calc(100vh-3rem)] w-4 border-4 border-black bg-white lg:block"
      >
        <div className="scroll-progress-fill h-full w-full origin-top scale-y-0 bg-neo-accent" />
      </div>

      <header className="snap-section relative min-h-screen border-b-8 border-black bg-neo-cream">
        <div aria-hidden="true" className="absolute inset-0 texture-grid opacity-70" />
        <div aria-hidden="true" className="absolute inset-0 texture-halftone opacity-20" />

        <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-6 py-16 md:px-12">
          <p className="hero-sticker inline-block w-fit -rotate-2 border-4 border-black bg-neo-accent px-5 py-2 text-sm font-black tracking-[0.22em]">
            EDUCATION MODE
          </p>

          <h1 className="mt-8 max-w-6xl text-5xl font-black uppercase leading-[0.85] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
            <span className="hero-sticker inline-block -rotate-1 border-4 border-black bg-white px-4 py-2">
              FULL-SCREEN
            </span>{' '}
            <span className="hero-sticker inline-block rotate-1 border-4 border-black bg-neo-secondary px-4 py-2">
              SCROLL
            </span>{' '}
            <span className="hero-sticker display-stroke inline-block">LESSON</span>
          </h1>

          <p className="hero-sticker mt-10 max-w-3xl -rotate-1 border-4 border-black bg-white p-6 text-lg font-bold leading-relaxed shadow-[8px_8px_0px_0px_#000] md:text-xl">
            React + Tailwind + GSAP 기반으로 만든 교육용 페이지입니다. 스크롤하며 모델 구조를 학습할 수 있도록
            각 챕터를 풀스크린 카드처럼 구성했습니다.
          </p>

          <div className="hero-sticker mt-8 flex flex-wrap gap-4">
            <a
              href="#lesson-1"
              className="neo-btn bg-neo-accent px-8 py-4 text-sm font-black uppercase tracking-[0.14em]"
            >
              Start Class
            </a>
            <a
              href="#lesson-3"
              className="neo-btn bg-neo-secondary px-8 py-4 text-sm font-black uppercase tracking-[0.14em]"
            >
              Jump To Training
            </a>
          </div>
        </div>
      </header>

      <main>
        {lessonSections.map((section, index) => {
          if (index === 1) {
            return (
              <section
                id={section.id}
                key={section.id}
                className={`snap-section edu-panel relative flex min-h-screen items-center border-b-8 border-black ${section.bgClass}`}
              >
                <div aria-hidden="true" className="absolute inset-0 texture-grid opacity-50" />
                <div aria-hidden="true" className="absolute inset-0 texture-noise opacity-20" />

                <div className="relative z-10 mx-auto w-full max-w-7xl px-6 py-16 md:px-12">
                  <article className="reveal max-w-6xl">
                    <p className="inline-block -rotate-2 border-4 border-black bg-white px-4 py-2 text-sm font-black tracking-[0.22em]">
                      {section.label}
                    </p>

                    <h2 className="mt-5 max-w-3xl text-4xl font-black uppercase leading-[0.9] tracking-tight sm:text-5xl md:text-6xl">
                      <span className="inline-block rotate-1 border-4 border-black bg-neo-accent px-4 py-2">
                        {section.title}
                      </span>
                    </h2>

                    <p className="mt-8 max-w-[100%] border-4 border-black bg-white p-6 text-lg font-bold leading-relaxed shadow-[8px_8px_0px_0px_#000]">
                      {section.description}
                    </p>
                  </article>

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
                </div>
              </section>
            )
          }

          return (
            <section
              id={section.id}
              key={section.id}
              className={`snap-section edu-panel relative flex min-h-screen items-center border-b-8 border-black ${section.bgClass} ${index === 0 ? 'chapter-one-section' : ''}`}
            >
              <div aria-hidden="true" className="absolute inset-0 texture-grid opacity-50" />
              <div aria-hidden="true" className="absolute inset-0 texture-noise opacity-20" />
              {index === 0 ? (
                <ChapterOneDataCloud names={CHAPTER_ONE_NAMES} reducedMotion={reducedMotion} isMobile={isMobile} />
              ) : null}

              <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-10 px-6 py-16 md:grid-cols-[1.05fr_0.95fr] md:px-12">
                <article className="reveal">
                  <p className="inline-block -rotate-2 border-4 border-black bg-white px-4 py-2 text-sm font-black tracking-[0.22em]">
                    {section.label}
                  </p>

                  <h2 className="mt-5 max-w-3xl text-4xl font-black uppercase leading-[0.9] tracking-tight sm:text-5xl md:text-6xl">
                    <span className="inline-block rotate-1 border-4 border-black bg-neo-accent px-4 py-2">
                      {section.title}
                    </span>
                  </h2>

                  <p className="mt-8 max-w-2xl border-4 border-black bg-white p-6 text-lg font-bold leading-relaxed shadow-[8px_8px_0px_0px_#000]">
                    {section.description}
                  </p>
                </article>

                <aside className="reveal self-center">
                  <div className="neo-card rotate-1 bg-white p-6">
                    <p className="border-b-4 border-black pb-3 text-xs font-black uppercase tracking-[0.22em]">핵심 포인트</p>
                    <ul className="mt-4 space-y-3">
                      {section.points.map((point) => (
                        <li key={point} className="border-4 border-black bg-neo-cream px-4 py-3 text-base font-bold">
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="-mt-6 ml-auto max-w-sm -rotate-2 border-4 border-black bg-black p-5 text-white shadow-[8px_8px_0px_0px_#000]">
                    <p className="text-xs font-black uppercase tracking-[0.2em]">Takeaway {index + 1}</p>
                    <p className="mt-2 text-lg font-bold leading-snug">{section.takeaway}</p>
                  </div>
                </aside>
              </div>
            </section>
          )
        })}
      </main>

      <footer className="snap-section flex min-h-screen items-center border-t-8 border-black bg-black px-6 py-10 text-white md:px-12">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-5 md:flex-row md:items-center">
          <p className="border-4 border-white bg-black px-4 py-3 text-sm font-black uppercase tracking-[0.18em]">
            NEXT: API 연결 후 인터랙티브 퀴즈 섹션 추가
          </p>
          <a
            href="#"
            className="neo-btn border-white bg-neo-secondary px-8 py-4 text-sm font-black uppercase tracking-[0.14em] text-black"
          >
            Build Next Module
          </a>
        </div>
      </footer>
    </div>
  )
}

export default App
