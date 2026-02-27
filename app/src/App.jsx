import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Analytics } from '@vercel/analytics/react'
import AsyncChapterContent from './components/common/AsyncChapterContent'
import ScrollToTopButton from './components/common/ScrollToTopButton'
import ChapterOneDataCloud from './components/chapters/ChapterOneDataCloud'
import ChapterTwoJamoCloud from './components/chapters/ChapterTwoJamoCloud'
import ChapterTwoTokenizationDemo from './components/chapters/ChapterTwoTokenizationDemo'
import ChapterThreeEmbeddingDemo from './components/chapters/ChapterThreeEmbeddingDemo'
import ChapterFourAttentionDemo from './components/chapters/ChapterFourAttentionDemo'
import ChapterFiveTrainingDemo from './components/chapters/ChapterFiveTrainingDemo'
import ChapterSixTrainingDemo from './components/chapters/ChapterSixTrainingDemo'
import ChapterSevenInferenceDemo from './components/chapters/ChapterSevenInferenceDemo'
import ChapterEightSection from './components/sections/ChapterEightSection'
import ChapterFiveSection from './components/sections/ChapterFiveSection'
import ChapterFourSection from './components/sections/ChapterFourSection'
import ChapterOneSection from './components/sections/ChapterOneSection'
import ChapterSevenSection from './components/sections/ChapterSevenSection'
import ChapterSixSection from './components/sections/ChapterSixSection'
import ChapterThreeSection from './components/sections/ChapterThreeSection'
import ChapterTwoSection from './components/sections/ChapterTwoSection'
import HeroSection from './components/sections/HeroSection'
import OutroSection from './components/sections/OutroSection'
import { EXAMPLE_NAMES_BY_LANG } from './components/chapters/shared/chapterConstants'
import {
  buildTokenizerFromRaw,
  getInitialMatch,
  isTrainingTracePayloadValid,
  parseDatasetNamesFromRaw,
} from './components/chapters/shared/chapterUtils'
import { getLessonSectionsForLanguage } from './constants/lessonSections'
import {
  COPY_BY_LANG,
  getExampleLanguageFromPathname,
  getPathnameForExampleLanguage,
  readDescriptionLanguageCookie,
  writeDescriptionLanguageCookie,
} from './constants/localization'

gsap.registerPlugin(ScrollTrigger)

function App() {
  const pageRef = useRef(null)
  const scrollProgressFillRef = useRef(null)
  const [exampleLanguage, setExampleLanguage] = useState(() => {
    if (typeof window === 'undefined') {
      return 'ko'
    }
    return getExampleLanguageFromPathname(window.location.pathname)
  })
  const [descriptionLanguage, setDescriptionLanguage] = useState(() => {
    const detectedExampleLanguage =
      typeof window === 'undefined' ? 'ko' : getExampleLanguageFromPathname(window.location.pathname)
    return readDescriptionLanguageCookie() ?? detectedExampleLanguage
  })
  const [reducedMotion, setReducedMotion] = useState(() => getInitialMatch('(prefers-reduced-motion: reduce)'))
  const [isMobile, setIsMobile] = useState(() => getInitialMatch('(max-width: 767px)'))
  const [datasetNames, setDatasetNames] = useState([])
  const [chapterTwoTokenizer, setChapterTwoTokenizer] = useState(null)
  const [tokenizerStatus, setTokenizerStatus] = useState('loading')
  const [tokenizerErrorKey, setTokenizerErrorKey] = useState('')
  const [embeddingSnapshot, setEmbeddingSnapshot] = useState(null)
  const [embeddingStatus, setEmbeddingStatus] = useState('loading')
  const [embeddingErrorKey, setEmbeddingErrorKey] = useState('')
  const [attentionSnapshot, setAttentionSnapshot] = useState(null)
  const [attentionStatus, setAttentionStatus] = useState('loading')
  const [attentionErrorKey, setAttentionErrorKey] = useState('')
  const [trainingTrace, setTrainingTrace] = useState(null)
  const [trainingTraceStatus, setTrainingTraceStatus] = useState('loading')
  const [trainingTraceErrorKey, setTrainingTraceErrorKey] = useState('')
  const copy = COPY_BY_LANG[descriptionLanguage] ?? COPY_BY_LANG.en
  const lessonSections = useMemo(
    () => getLessonSectionsForLanguage(descriptionLanguage, exampleLanguage),
    [descriptionLanguage, exampleLanguage],
  )

  useEffect(() => {
    writeDescriptionLanguageCookie(descriptionLanguage)
  }, [descriptionLanguage])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }
    document.title = exampleLanguage === 'en' ? 'MICROGPT LAB' : 'KOREAN MICROGPT LAB'
  }, [exampleLanguage])

  useEffect(() => {
    const onPopState = () => {
      setExampleLanguage(getExampleLanguageFromPathname(window.location.pathname))
    }

    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
    }
  }, [])

  const onLanguageSettingsConfirm = ({ exampleLanguage: nextExampleLanguage, descriptionLanguage: nextDescriptionLanguage }) => {
    if (nextDescriptionLanguage === 'ko' || nextDescriptionLanguage === 'en') {
      setDescriptionLanguage(nextDescriptionLanguage)
    }

    if (nextExampleLanguage !== 'ko' && nextExampleLanguage !== 'en') {
      return
    }
    if (nextExampleLanguage === exampleLanguage) {
      return
    }

    const nextPathname = getPathnameForExampleLanguage(nextExampleLanguage)
    if (window.location.pathname !== nextPathname) {
      window.history.pushState({}, '', `${nextPathname}${window.location.search}${window.location.hash}`)
    }
    setExampleLanguage(nextExampleLanguage)
  }

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
      setTokenizerErrorKey('')
      setDatasetNames([])

      try {
        const response = await fetch(`/data/${exampleLanguage}_name.txt`, { signal: controller.signal })
        if (!response.ok) {
          throw new Error('failed to fetch dataset')
        }
        const rawText = await response.text()
        const tokenizer = buildTokenizerFromRaw(rawText, exampleLanguage)
        const parsedNames = parseDatasetNamesFromRaw(rawText, exampleLanguage)

        if (!isActive) {
          return
        }

        setChapterTwoTokenizer(tokenizer)
        setDatasetNames(parsedNames)
        setTokenizerStatus('ready')
      } catch (error) {
        if (!isActive || error.name === 'AbortError') {
          return
        }

        setChapterTwoTokenizer(null)
        setDatasetNames([])
        setTokenizerStatus('error')
        setTokenizerErrorKey('tokenMapLoadFailed')
      }
    }

    loadTokenizer()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [exampleLanguage])

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()

    const loadEmbeddingSnapshot = async () => {
      setEmbeddingStatus('loading')
      setEmbeddingErrorKey('')
      setAttentionStatus('loading')
      setAttentionErrorKey('')

      try {
        const response = await fetch(`/data/${exampleLanguage}_embedding_snapshot.json`, { signal: controller.signal })
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
          setAttentionErrorKey('attentionSnapshotLoadFailed')
        }
      } catch (error) {
        if (!isActive || error.name === 'AbortError') {
          return
        }
        setEmbeddingSnapshot(null)
        setEmbeddingStatus('error')
        setEmbeddingErrorKey('embeddingSnapshotLoadFailed')
        setAttentionSnapshot(null)
        setAttentionStatus('error')
        setAttentionErrorKey('attentionSnapshotLoadFailed')
      }
    }

    loadEmbeddingSnapshot()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [exampleLanguage])

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()

    const loadTrainingTrace = async () => {
      setTrainingTraceStatus('loading')
      setTrainingTraceErrorKey('')

      try {
        const response = await fetch(`/data/${exampleLanguage}_training_trace.json`, { signal: controller.signal })
        if (!response.ok) {
          throw new Error('failed to fetch training trace')
        }

        const payload = await response.json()
        if (!isTrainingTracePayloadValid(payload)) {
          throw new Error('invalid training trace payload')
        }

        if (!isActive) {
          return
        }

        setTrainingTrace(payload)
        setTrainingTraceStatus('ready')
      } catch (error) {
        if (!isActive || error.name === 'AbortError') {
          return
        }
        setTrainingTrace(null)
        setTrainingTraceStatus('error')
        setTrainingTraceErrorKey('trainingTraceLoadFailed')
      }
    }

    loadTrainingTrace()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [exampleLanguage])

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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const fillNode = scrollProgressFillRef.current
    if (!fillNode) {
      return undefined
    }

    let rafId = 0
    const docElement = document.documentElement
    const body = document.body

    const updateScrollProgress = () => {
      rafId = 0
      const maxScrollTop = Math.max(1, docElement.scrollHeight - window.innerHeight)
      const currentScrollTop = Math.max(0, window.scrollY || docElement.scrollTop || 0)
      const progress = Math.min(1, currentScrollTop / maxScrollTop)
      fillNode.style.height = `${progress * 100}%`
    }

    const queueScrollProgressUpdate = () => {
      if (rafId) {
        return
      }
      rafId = window.requestAnimationFrame(updateScrollProgress)
    }

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(queueScrollProgressUpdate)
    resizeObserver?.observe(docElement)
    if (body) {
      resizeObserver?.observe(body)
    }

    window.addEventListener('scroll', queueScrollProgressUpdate, { passive: true })
    window.addEventListener('resize', queueScrollProgressUpdate)
    queueScrollProgressUpdate()

    return () => {
      window.removeEventListener('scroll', queueScrollProgressUpdate)
      window.removeEventListener('resize', queueScrollProgressUpdate)
      resizeObserver?.disconnect()
      if (rafId) {
        window.cancelAnimationFrame(rafId)
      }
    }
  }, [])

  const chapterOneSection = lessonSections[0]
  const chapterTwoSection = lessonSections[1]
  const chapterThreeSection = lessonSections[2]
  const chapterFourSection = lessonSections[3]
  const chapterFiveSection = lessonSections[4]
  const chapterSixSection = lessonSections[5]
  const chapterSevenSection = lessonSections[6]
  const chapterEightSection = lessonSections[7]
  const exampleNames = EXAMPLE_NAMES_BY_LANG[exampleLanguage] ?? EXAMPLE_NAMES_BY_LANG.ko
  const chapterOneNames = useMemo(() => {
    const displayName = (name) => (exampleLanguage === 'en' ? String(name).toUpperCase() : String(name))
    const normalizedKey = (name) => (exampleLanguage === 'en' ? String(name).toUpperCase() : String(name))
    const merged = []
    const seen = new Set()

    const pushUnique = (name) => {
      const trimmed = typeof name === 'string' ? name.trim() : ''
      if (!trimmed) {
        return
      }
      const key = normalizedKey(trimmed)
      if (seen.has(key)) {
        return
      }
      seen.add(key)
      merged.push(displayName(trimmed))
    }

    exampleNames.forEach(pushUnique)
    datasetNames.forEach(pushUnique)

    if (!merged.length) {
      return []
    }

    const targetCount = 40
    if (merged.length >= targetCount) {
      return merged.slice(0, targetCount)
    }

    const result = [...merged]
    let fillIndex = 0
    while (result.length < targetCount) {
      result.push(merged[fillIndex % merged.length])
      fillIndex += 1
    }
    return result
  }, [datasetNames, exampleLanguage, exampleNames])
  const chapterExampleNames = useMemo(() => {
    return exampleNames.slice(0, 8)
  }, [exampleNames])

  return (
    <div ref={pageRef} className="relative overflow-x-clip bg-neo-cream font-space text-black">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed right-4 top-6 z-50 hidden h-[calc(100vh-3rem)] w-4 border-4 border-black bg-white lg:block"
      >
        <div ref={scrollProgressFillRef} className="scroll-progress-fill absolute inset-x-0 top-0 h-0 bg-neo-accent" />
      </div>
      <ScrollToTopButton reducedMotion={reducedMotion} />

      <HeroSection
        exampleLanguage={exampleLanguage}
        descriptionLanguage={descriptionLanguage}
        onLanguageSettingsConfirm={onLanguageSettingsConfirm}
        copy={copy.hero}
      />

      <main>
        <ChapterOneSection
          section={chapterOneSection}
          dataCloud={<ChapterOneDataCloud names={chapterOneNames} reducedMotion={reducedMotion} isMobile={isMobile} />}
          corePointsLabel={copy.chapterOne.corePointsLabel}
          takeawayLabel={copy.chapterOne.takeawayLabel}
        />

        <ChapterTwoSection
          section={chapterTwoSection}
          jamoCloud={<ChapterTwoJamoCloud reducedMotion={reducedMotion} isMobile={isMobile} exampleLanguage={exampleLanguage} />}
        >
          <AsyncChapterContent
            status={tokenizerStatus}
            title="TOKEN MAP"
            loadingMessage={copy.loaders.tokenMapLoading}
            errorMessage={copy.errors[tokenizerErrorKey] || copy.errors.tokenMapLoadFailed}
          >
            {chapterTwoTokenizer ? (
              <ChapterTwoTokenizationDemo
                key={`chapter2-demo-${exampleLanguage}`}
                tokenizer={chapterTwoTokenizer}
                reducedMotion={reducedMotion}
                isMobile={isMobile}
                copy={copy}
                exampleNames={chapterExampleNames}
                exampleLanguage={exampleLanguage}
              />
            ) : null}
          </AsyncChapterContent>
        </ChapterTwoSection>

        <ChapterThreeSection section={chapterThreeSection}>
          <AsyncChapterContent
            status={embeddingStatus}
            title="EMBEDDING SNAPSHOT"
            loadingMessage={copy.loaders.embeddingSnapshotLoading}
            errorMessage={copy.errors[embeddingErrorKey] || copy.errors.embeddingSnapshotLoadFailed}
          >
            {embeddingSnapshot ? (
              <ChapterThreeEmbeddingDemo
                key={`chapter3-demo-${exampleLanguage}`}
                snapshot={embeddingSnapshot}
                reducedMotion={reducedMotion}
                isMobile={isMobile}
                copy={copy}
                exampleLanguage={exampleLanguage}
              />
            ) : null}
          </AsyncChapterContent>
        </ChapterThreeSection>

        <ChapterFourSection section={chapterFourSection}>
          <AsyncChapterContent
            status={attentionStatus}
            title="ATTENTION SNAPSHOT"
            loadingMessage={copy.loaders.attentionSnapshotLoading}
            errorMessage={copy.errors[attentionErrorKey] || copy.errors.attentionSnapshotLoadFailed}
          >
            {embeddingSnapshot && attentionSnapshot ? (
              <ChapterFourAttentionDemo
                key={`chapter4-demo-${exampleLanguage}`}
                snapshot={embeddingSnapshot}
                attention={attentionSnapshot}
                reducedMotion={reducedMotion}
                isMobile={isMobile}
                copy={copy}
                exampleNames={chapterExampleNames}
                exampleLanguage={exampleLanguage}
              />
            ) : null}
          </AsyncChapterContent>
        </ChapterFourSection>

        <ChapterFiveSection section={chapterFiveSection}>
          <AsyncChapterContent
            status={attentionStatus}
            title="TRAINING SNAPSHOT"
            loadingMessage={copy.loaders.trainingSnapshotLoading}
            errorMessage={copy.errors.trainingSnapshotLoadFailed}
          >
            {embeddingSnapshot ? (
              <ChapterFiveTrainingDemo
                key={`chapter5-demo-${exampleLanguage}`}
                snapshot={embeddingSnapshot}
                reducedMotion={reducedMotion}
                isMobile={isMobile}
                copy={copy}
                exampleNames={chapterExampleNames}
                exampleLanguage={exampleLanguage}
              />
            ) : null}
          </AsyncChapterContent>
        </ChapterFiveSection>

        <ChapterSixSection section={chapterSixSection}>
          <AsyncChapterContent
            status={trainingTraceStatus}
            title="TRAINING TRACE"
            loadingMessage={copy.loaders.trainingTraceLoading}
            errorMessage={copy.errors[trainingTraceErrorKey] || copy.errors.trainingTraceLoadFailed}
          >
            {trainingTrace ? (
              <ChapterSixTrainingDemo
                key={`chapter6-demo-${exampleLanguage}`}
                trace={trainingTrace}
                reducedMotion={reducedMotion}
                isMobile={isMobile}
                copy={copy}
                exampleLanguage={exampleLanguage}
              />
            ) : null}
          </AsyncChapterContent>
        </ChapterSixSection>

        <ChapterSevenSection section={chapterSevenSection}>
          <AsyncChapterContent
            status={embeddingStatus}
            title="INFERENCE SNAPSHOT"
            loadingMessage={copy.loaders.inferenceSnapshotLoading}
            errorMessage={copy.errors.inferenceSnapshotLoadFailed}
          >
            {embeddingSnapshot ? (
              <ChapterSevenInferenceDemo
                key={`chapter7-demo-${exampleLanguage}`}
                snapshot={embeddingSnapshot}
                reducedMotion={reducedMotion}
                isMobile={isMobile}
                copy={copy}
                exampleLanguage={exampleLanguage}
              />
            ) : null}
          </AsyncChapterContent>
        </ChapterSevenSection>

        <ChapterEightSection
          section={chapterEightSection}
          similarityLabel={copy.chapterEight.similarityLabel}
          differenceLabel={copy.chapterEight.differenceLabel}
        />
        <OutroSection copy={copy.outro} exampleLanguage={exampleLanguage} />
      </main>
      <Analytics />
    </div>
  )
}

export default App
