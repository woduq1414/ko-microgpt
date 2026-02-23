import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import {
  CHAPTER_SIX_AUTOPLAY_INTERVAL_MS,
  CHAPTER_SIX_DEFAULT_STEP_OPTIONS,
  CHAPTER_SIX_FLOW_DURATION_SCALE,
  CHAPTER_SIX_LOSS_CHART_HEIGHT,
  CHAPTER_SIX_LOSS_CHART_WIDTH,
} from './shared/chapterConstants'
import { clamp, getRoleLabel, hasNumericVector } from './shared/chapterUtils'
import SectionStateCard from '../common/SectionStateCard'

function ChapterSixTrainingDemo({ trace, reducedMotion, isMobile, copy, exampleLanguage = 'ko' }) {
  const stepOptions = useMemo(() => {
    const raw = Array.isArray(trace?.step_options) ? trace.step_options : CHAPTER_SIX_DEFAULT_STEP_OPTIONS
    const normalized = raw
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value >= 0)
      .sort((left, right) => left - right)
    return normalized.length ? normalized : CHAPTER_SIX_DEFAULT_STEP_OPTIONS
  }, [trace])
  const parameterOptions = useMemo(() => {
    return Array.isArray(trace?.parameter_options) ? trace.parameter_options : []
  }, [trace])
  const localizedParameterOptions = useMemo(() => {
    const rolePrefixes = [
      ['초성', 'initial'],
      ['중성', 'medial'],
      ['종성', 'final'],
      ['기타', 'other'],
      ['Initial', 'initial'],
      ['Medial', 'medial'],
      ['Final', 'final'],
      ['Other', 'other'],
    ]

    return parameterOptions.map((option) => {
      const rawLabel = typeof option?.label === 'string' ? option.label : ''
      let localizedLabel = rawLabel

      for (const [prefix, roleKey] of rolePrefixes) {
        if (rawLabel === prefix || rawLabel.startsWith(`${prefix} `)) {
          localizedLabel = `${getRoleLabel(roleKey, copy.roles)}${rawLabel.slice(prefix.length)}`
          break
        }
      }

      return {
        ...option,
        localizedLabel,
      }
    })
  }, [copy.roles, parameterOptions])
  const stepRecords = useMemo(() => {
    return Array.isArray(trace?.steps) ? trace.steps : []
  }, [trace])

  const [targetStepOptionIndex, setTargetStepOptionIndex] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [, setIsStepAnimating] = useState(false)
  const [selectedParameterIndex, setSelectedParameterIndex] = useState(0)
  const [chapter6IsLearningRateHelpOpen, setChapter6IsLearningRateHelpOpen] = useState(false)
  const chapterSixFlowScopeRef = useRef(null)
  const chapterSixFlowLayerRef = useRef(null)
  const chapterSixEquationScrollRef = useRef(null)
  const lossCardRef = useRef(null)
  const learningRateValueRef = useRef(null)
  const gradientScrollRef = useRef(null)
  const parameterScrollRef = useRef(null)
  const gradientRowRefs = useRef([])
  const parameterRowRefs = useRef([])
  const chapterSixLineTimelineRef = useRef(null)
  const chapterSixAdvanceTimerRef = useRef(null)
  const chapterSixAnimationRunIdRef = useRef(0)
  const hasStepRenderedRef = useRef(false)
  const previousAnimatedStepRef = useRef(0)

  const maxTraceStep = Math.max(0, stepRecords.length - 1)
  const safeTargetStepOptionIndex = clamp(targetStepOptionIndex, 0, Math.max(0, stepOptions.length - 1))
  const safeSelectedParameterIndex = clamp(selectedParameterIndex, 0, Math.max(0, localizedParameterOptions.length - 1))
  const targetStepRaw = Number(stepOptions[safeTargetStepOptionIndex] ?? CHAPTER_SIX_DEFAULT_STEP_OPTIONS[0])
  const targetStep = clamp(targetStepRaw, 0, maxTraceStep)
  const safeCurrentStep = clamp(currentStep, 0, targetStep)

  useEffect(() => {
    if (!hasStarted || !isPlaying) {
      return undefined
    }

    if (safeCurrentStep >= targetStep) {
      return undefined
    }

    const delayMs = CHAPTER_SIX_AUTOPLAY_INTERVAL_MS
    chapterSixAdvanceTimerRef.current = window.setTimeout(() => {
      chapterSixAdvanceTimerRef.current = null
      if (!reducedMotion) {
        setIsStepAnimating(true)
      }
      setCurrentStep((previousStep) => {
        const nextStep = Math.min(previousStep + 1, targetStep)
        if (nextStep >= targetStep) {
          setIsPlaying(false)
        }
        return nextStep
      })
    }, delayMs)

    return () => {
      if (chapterSixAdvanceTimerRef.current != null) {
        window.clearTimeout(chapterSixAdvanceTimerRef.current)
        chapterSixAdvanceTimerRef.current = null
      }
    }
  }, [hasStarted, isPlaying, reducedMotion, safeCurrentStep, targetStep])

  const selectedParameter = localizedParameterOptions[safeSelectedParameterIndex]
  const currentRecord = stepRecords[safeCurrentStep] ?? stepRecords[0]
  const selectedParameterRecord =
    selectedParameter && currentRecord?.params && typeof currentRecord.params === 'object'
      ? currentRecord.params[selectedParameter.id]
      : null
  const fallbackVector = Array.from({ length: 16 }, () => 0)
  const gradientVector = hasNumericVector(selectedParameterRecord?.grad, 16) ? selectedParameterRecord.grad : fallbackVector
  const afterVector = hasNumericVector(selectedParameterRecord?.after, 16) ? selectedParameterRecord.after : fallbackVector

  const formatValue = (value, fractionDigits = 4) => {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) {
      return '0.0000'
    }
    const normalized = Object.is(numeric, -0) ? 0 : numeric
    return normalized.toFixed(fractionDigits)
  }

  const moveTargetStepPreset = (direction) => {
    if (!stepOptions.length) {
      return
    }
    setTargetStepOptionIndex((previous) => {
      const safePrevious = clamp(previous, 0, Math.max(0, stepOptions.length - 1))
      return (safePrevious + direction + stepOptions.length) % stepOptions.length
    })
    setCurrentStep(0)
    setIsPlaying(false)
    setHasStarted(false)
  }

  const moveParameter = (direction) => {
    if (!localizedParameterOptions.length) {
      return
    }
    setSelectedParameterIndex((previous) => {
      const safePrevious = clamp(previous, 0, Math.max(0, localizedParameterOptions.length - 1))
      return (safePrevious + direction + localizedParameterOptions.length) % localizedParameterOptions.length
    })
  }

  const resetChapterSixFlowAnimationState = () => {
    chapterSixLineTimelineRef.current?.kill()
    chapterSixLineTimelineRef.current = null
    if (chapterSixFlowLayerRef.current) {
      chapterSixFlowLayerRef.current.innerHTML = ''
    }
    previousAnimatedStepRef.current = 0
    setIsStepAnimating(false)
  }

  const onStart = () => {
    resetChapterSixFlowAnimationState()
    setCurrentStep(0)
    setHasStarted(true)
    setIsPlaying(true)
  }

  const onTogglePlay = () => {
    if (!hasStarted) {
      return
    }
    if (isPlaying) {
      setIsPlaying(false)
      return
    }
    if (safeCurrentStep >= targetStep) {
      resetChapterSixFlowAnimationState()
      setCurrentStep(0)
    }
    setIsPlaying(true)
  }

  const onReset = () => {
    resetChapterSixFlowAnimationState()
    setCurrentStep(0)
    setIsPlaying(false)
    setHasStarted(false)
  }

  const onStepSliderChange = (event) => {
    const nextStep = clamp(Number(event.target.value), 0, targetStep)
    setCurrentStep(nextStep)
    setIsPlaying(false)
    setIsStepAnimating(false)
  }

  const onStepNudge = (direction) => {
    setCurrentStep((previousStep) => clamp(previousStep + direction, 0, targetStep))
    setIsPlaying(false)
    setIsStepAnimating(false)
  }

  const lossText = safeCurrentStep === 0 || currentRecord?.loss == null ? 'PRE' : formatValue(currentRecord.loss, 4)
  const learningRateText = formatValue(currentRecord?.learning_rate ?? 0, 6)
  const wordText = typeof currentRecord?.word === 'string' && currentRecord.word ? currentRecord.word : 'N/A'
  const displayWordText = exampleLanguage === 'en' ? wordText.toUpperCase() : wordText
  const valueTextClass = isMobile ? 'text-[11px]' : 'text-xs'
  const lossTrend = useMemo(() => {
    const chartWidth = CHAPTER_SIX_LOSS_CHART_WIDTH
    const chartHeight = CHAPTER_SIX_LOSS_CHART_HEIGHT
    const paddingX = 12
    const paddingY = 12
    const plotWidth = chartWidth - paddingX * 2
    const plotHeight = chartHeight - paddingY * 2
    const safeMaxStep = Math.max(1, targetStep)
    const visibleMaxStep = clamp(safeCurrentStep, 0, safeMaxStep)

    const samples = []
    let minLoss = Number.POSITIVE_INFINITY
    let maxLoss = Number.NEGATIVE_INFINITY

    for (let step = 1; step <= visibleMaxStep; step += 1) {
      const record = stepRecords[step]
      const lossValue = Number(record?.loss)
      if (!Number.isFinite(lossValue)) {
        continue
      }
      minLoss = Math.min(minLoss, lossValue)
      maxLoss = Math.max(maxLoss, lossValue)
      samples.push({ step, loss: lossValue })
    }

    if (!samples.length) {
      return {
        chartWidth,
        chartHeight,
        pathData: '',
        currentPoint: null,
        minLoss: 0,
        maxLoss: 0,
      }
    }

    const lossRange = Math.max(maxLoss - minLoss, 1e-9)
    const toPoint = (step, loss) => {
      const x = paddingX + (step / safeMaxStep) * plotWidth
      const y = paddingY + ((maxLoss - loss) / lossRange) * plotHeight
      return { x, y }
    }

    const points = samples.map((sample) => toPoint(sample.step, sample.loss))
    const pathData = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ')

    const currentLoss = Number(stepRecords[safeCurrentStep]?.loss)
    const currentPoint =
      visibleMaxStep > 0 && Number.isFinite(currentLoss) ? toPoint(Math.min(safeCurrentStep, safeMaxStep), currentLoss) : null

    return {
      chartWidth,
      chartHeight,
      pathData,
      currentPoint,
      minLoss,
      maxLoss,
    }
  }, [safeCurrentStep, stepRecords, targetStep])

  useLayoutEffect(() => {
    const flowScopeNode = chapterSixFlowScopeRef.current
    const flowLayerNode = chapterSixFlowLayerRef.current
    const equationScrollNode = chapterSixEquationScrollRef.current
    const gradientScrollNode = gradientScrollRef.current
    const parameterScrollNode = parameterScrollRef.current

    if (!flowScopeNode || !flowLayerNode) {
      return undefined
    }

    chapterSixLineTimelineRef.current?.kill()
    chapterSixLineTimelineRef.current = null
    flowLayerNode.innerHTML = ''
    const animationRunId = chapterSixAnimationRunIdRef.current + 1
    chapterSixAnimationRunIdRef.current = animationRunId

    if (!hasStepRenderedRef.current) {
      hasStepRenderedRef.current = true
      previousAnimatedStepRef.current = safeCurrentStep
      return undefined
    }

    if (previousAnimatedStepRef.current === safeCurrentStep || reducedMotion) {
      previousAnimatedStepRef.current = safeCurrentStep
      return undefined
    }
    previousAnimatedStepRef.current = safeCurrentStep

    const gradientNodes = gradientRowRefs.current.slice(0, 16).filter(Boolean)
    const parameterNodes = parameterRowRefs.current.slice(0, 16).filter(Boolean)
    const lossNode = lossCardRef.current
    const learningRateNode = learningRateValueRef.current
    if (!gradientNodes.length || !parameterNodes.length || !lossNode || !learningRateNode) {
      return undefined
    }

    const connections = []

    const resolveAnchorPoint = (rect, anchor) => {
      const x = anchor.x === 'left' ? rect.left : anchor.x === 'right' ? rect.right : rect.left + rect.width * 0.5
      const y = anchor.y === 'top' ? rect.top : anchor.y === 'bottom' ? rect.bottom : rect.top + rect.height * 0.5
      return { x, y }
    }

    const getLossToGradientFromAnchor = () => {
      if (typeof window === 'undefined') {
        return { x: 'right', y: 'center' }
      }
      return window.matchMedia('(max-width: 1023px)').matches ? { x: 'left', y: 'center' } : { x: 'right', y: 'center' }
    }

    const resolveAnchor = (anchor, fallback) => {
      if (typeof anchor === 'function') {
        return anchor()
      }
      return anchor ?? fallback
    }

    const placeConnection = (connection) => {
      const scopeRect = flowScopeNode.getBoundingClientRect()
      const fromRect = connection.fromNode.getBoundingClientRect()
      const toRect = connection.toNode.getBoundingClientRect()
      const fromAnchor = resolveAnchor(connection.fromAnchor, { x: 'right', y: 'center' })
      const toAnchor = resolveAnchor(connection.toAnchor, { x: 'left', y: 'center' })
      const fromPoint = resolveAnchorPoint(fromRect, fromAnchor)
      const toPoint = resolveAnchorPoint(toRect, toAnchor)
      const fromX = fromPoint.x - scopeRect.left
      const fromY = fromPoint.y - scopeRect.top
      const toX = toPoint.x - scopeRect.left
      const toY = toPoint.y - scopeRect.top
      const distance = Math.hypot(toX - fromX, toY - fromY)
      const angle = (Math.atan2(toY - fromY, toX - fromX) * 180) / Math.PI
      connection.distance = distance
      connection.line.style.left = `${fromX}px`
      connection.line.style.top = `${fromY}px`
      connection.line.style.width = `${distance}px`
      connection.line.style.transform = `translateY(-50%) rotate(${angle}deg)`
    }

    const timeline = gsap.timeline({
      onComplete: () => {
        if (chapterSixAnimationRunIdRef.current === animationRunId) {
          setIsStepAnimating(false)
        }
      },
      onInterrupt: () => {
        if (chapterSixAnimationRunIdRef.current === animationRunId) {
          setIsStepAnimating(false)
        }
      },
    })
    chapterSixLineTimelineRef.current = timeline
    const drawDuration = 0.08 * CHAPTER_SIX_FLOW_DURATION_SCALE
    const dotDuration = 0.08 * CHAPTER_SIX_FLOW_DURATION_SCALE
    const fadeDuration = 0.05 * CHAPTER_SIX_FLOW_DURATION_SCALE
    const fadeStart = 0.09 * CHAPTER_SIX_FLOW_DURATION_SCALE

    const createAnimatedConnection = (
      fromNode,
      toNode,
      variant,
      startAt,
      fromAnchor = { x: 'right', y: 'center' },
      toAnchor = { x: 'left', y: 'center' },
    ) => {
      if (!fromNode || !toNode) {
        return
      }
      const line = document.createElement('span')
      line.className = `chapter-six-flow-line chapter-six-flow-line--${variant}`
      const dot = document.createElement('span')
      dot.className = `chapter-six-flow-dot chapter-six-flow-dot--${variant}`
      line.appendChild(dot)
      flowLayerNode.appendChild(line)

      const connection = {
        line,
        dot,
        fromNode,
        toNode,
        fromAnchor,
        toAnchor,
        distance: 0,
      }
      placeConnection(connection)
      connections.push(connection)

      timeline.fromTo(
        line,
        { opacity: 0, scaleX: 0.08 },
        { opacity: 0.65, scaleX: 1, duration: drawDuration, ease: 'power2.out' },
        startAt,
      )
      timeline.fromTo(
        dot,
        { opacity: 0, x: 0 },
        {
          opacity: 0.75,
          x: () => Math.max(0, connection.distance - 2),
          duration: dotDuration,
          ease: 'power1.inOut',
        },
        startAt,
      )
      timeline.to(line, { opacity: 0, duration: fadeDuration, ease: 'power1.in' }, startAt + fadeStart)
      timeline.to(dot, { opacity: 0, duration: fadeDuration, ease: 'power1.in' }, startAt + fadeStart)
    }

    gradientNodes.forEach((gradientNode) => {
      createAnimatedConnection(lossNode, gradientNode, 'loss-to-grad', 0, getLossToGradientFromAnchor)
    })

    gradientNodes.forEach((gradientNode) => {
      createAnimatedConnection(gradientNode, learningRateNode, 'grad-to-lr', 0)
    })

    parameterNodes.forEach((parameterNode, index) => {
      const gradientNode = gradientNodes[index]
      if (!gradientNode) {
        return
      }
      createAnimatedConnection(learningRateNode, parameterNode, 'lr-to-param', 0)
    })

    const refreshGeometry = () => {
      connections.forEach(placeConnection)
    }

    window.addEventListener('resize', refreshGeometry)
    equationScrollNode?.addEventListener('scroll', refreshGeometry, { passive: true })
    gradientScrollNode?.addEventListener('scroll', refreshGeometry, { passive: true })
    parameterScrollNode?.addEventListener('scroll', refreshGeometry, { passive: true })

    return () => {
      window.removeEventListener('resize', refreshGeometry)
      equationScrollNode?.removeEventListener('scroll', refreshGeometry)
      gradientScrollNode?.removeEventListener('scroll', refreshGeometry)
      parameterScrollNode?.removeEventListener('scroll', refreshGeometry)
      chapterSixLineTimelineRef.current?.kill()
      chapterSixLineTimelineRef.current = null
      flowLayerNode.innerHTML = ''
    }
  }, [reducedMotion, safeCurrentStep, safeSelectedParameterIndex])

  useEffect(() => {
    if (!chapter6IsLearningRateHelpOpen) {
      return undefined
    }

    const onPointerDown = (event) => {
      const target = event.target
      if (target instanceof Element && target.closest('.chapter-six-lr-help-wrap')) {
        return
      }
      setChapter6IsLearningRateHelpOpen(false)
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setChapter6IsLearningRateHelpOpen(false)
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [chapter6IsLearningRateHelpOpen])

  if (!localizedParameterOptions.length || !stepRecords.length) {
    return <SectionStateCard title="TRAINING TRACE" message={copy.chapter6.unavailable} />
  }

  const renderVectorCard = (title, values, variant = 'default', refs = {}) => {
    const rowRefs = refs?.rowRefs
    const scrollRef = refs?.scrollRef
    const maxAbs = values.reduce((maximum, value) => {
      const numericValue = Number(value)
      if (!Number.isFinite(numericValue)) {
        return maximum
      }
      return Math.max(maximum, Math.abs(numericValue))
    }, 0)
    return (
      <article className={`chapter-six-vector-card chapter-six-vector-card--${variant}`.trim()}>
        <p className="chapter-six-vector-title">{title}</p>
        <div ref={scrollRef || null} className="chapter-six-vector-scroll">
          <ul className="chapter-six-vector-list">
            {values.map((value, index) => (
              (() => {
                const numericValue = Number(value)
                const normalizedValue =
                  Number.isFinite(numericValue) && !Object.is(numericValue, -0) ? numericValue : 0
                const signVariant =
                  normalizedValue > 0 ? 'positive' : normalizedValue < 0 ? 'negative' : 'zero'
                const magnitudeRatio = maxAbs > 0 ? Math.min(1, Math.abs(normalizedValue) / maxAbs) : 0
                const intensity = signVariant === 'zero' ? '0.1' : (0.14 + magnitudeRatio * 0.18).toFixed(3)

                return (
                  <li
                    key={`${title}-${index}`}
                    ref={(node) => {
                      if (rowRefs) {
                        rowRefs.current[index] = node
                      }
                    }}
                    className="chapter-six-vector-row"
                    style={{ '--chapter-six-row-intensity': intensity }}
                  >
                    <span className={`chapter-six-vector-index ${valueTextClass}`}>{index}</span>
                    <span className="chapter-six-vector-value-shell">
                      <span className={`chapter-six-vector-fill chapter-six-vector-fill--${signVariant}`} aria-hidden="true" />
                      <span className={`chapter-six-vector-value ${valueTextClass}`}>{formatValue(normalizedValue, 4)}</span>
                    </span>
                  </li>
                )
              })()
            ))}
          </ul>
        </div>
      </article>
    )
  }

  return (
    <div className={`chapter-six-demo-wrap reveal ${reducedMotion ? 'chapter-six-demo-wrap--static' : ''}`}>
      <div className="chapter-six-controls">
        <div className="chapter-six-control-row">
          <div className="chapter-six-nav">
            <p className="chapter-six-nav-title">{copy.chapter6.targetStepTitle}</p>
            <div className="chapter-six-nav-inner">
              <button
                type="button"
                className="chapter-six-nav-arrow"
                onClick={() => moveTargetStepPreset(-1)}
                aria-label={copy.chapter6.prevTargetStepAria}
              >
                <span className="chapter-six-nav-arrow-shape chapter-six-nav-arrow-shape-left" />
              </button>
              <p className="chapter-six-nav-pill">
                <span className="chapter-six-nav-pill-char">{targetStep}</span>
                <span className="chapter-six-nav-pill-meta">TARGET STEP</span>
              </p>
              <button
                type="button"
                className="chapter-six-nav-arrow"
                onClick={() => moveTargetStepPreset(1)}
                aria-label={copy.chapter6.nextTargetStepAria}
              >
                <span className="chapter-six-nav-arrow-shape chapter-six-nav-arrow-shape-right" />
              </button>
            </div>
          </div>

          <div className="chapter-six-slider-shell">
            <div className="chapter-six-slider-head">
              <p className="chapter-six-slider-title">{copy.chapter6.progressStepTitle}</p>
              <p className="chapter-six-slider-value">{`${safeCurrentStep} / ${targetStep}`}</p>
            </div>
            <div className="chapter-six-slider-track">
              <button
                type="button"
                className="chapter-six-nav-arrow chapter-six-slider-arrow"
                onClick={() => onStepNudge(-1)}
                aria-label={copy.chapter6.prevStepAria}
              >
                <span className="chapter-six-nav-arrow-shape chapter-six-nav-arrow-shape-left" />
              </button>
              <input
                type="range"
                className="chapter-six-slider"
                min={0}
                max={targetStep}
                step={1}
                value={safeCurrentStep}
                onChange={onStepSliderChange}
                aria-label={copy.chapter6.stepSliderAria(safeCurrentStep, targetStep)}
              />
              <button
                type="button"
                className="chapter-six-nav-arrow chapter-six-slider-arrow"
                onClick={() => onStepNudge(1)}
                aria-label={copy.chapter6.nextStepAria}
              >
                <span className="chapter-six-nav-arrow-shape chapter-six-nav-arrow-shape-right" />
              </button>
            </div>
          </div>

          <div className="chapter-six-action-row">
            {hasStarted ? (
              <button
                type="button"
                className="chapter-six-action-btn"
                onClick={onTogglePlay}
                aria-label={copy.chapter6.togglePlayAria(isPlaying)}
              >
                {isPlaying ? 'PAUSE' : 'RESUME'}
              </button>
            ) : (
              <button type="button" className="chapter-six-action-btn" onClick={onStart} aria-label={copy.chapter6.startAria}>
                START
              </button>
            )}
            <button type="button" className="chapter-six-action-btn" onClick={onReset} aria-label={copy.chapter6.resetAria}>
              RESET
            </button>
          </div>
        </div>
      </div>

      <div ref={chapterSixFlowScopeRef} className="chapter-six-flow-scope">
        <div className="chapter-six-flow">
          <div className="chapter-six-left-stack">
            <article className="chapter-six-word-card" aria-label={copy.chapter6.currentWordAria}>
              <p className="chapter-six-word-title">TRAIN WORD</p>
              <p className="chapter-six-word-value">{displayWordText}</p>
              <p className="chapter-six-word-step">{`STEP ${safeCurrentStep}`}</p>
            </article>

            <article ref={lossCardRef} className="chapter-six-loss-card" aria-label={copy.chapter6.currentLossAria}>
              <p className="chapter-six-loss-title">LOSS</p>
              <p className="chapter-six-loss-value">{lossText}</p>
            </article>

            <article className="chapter-six-loss-trend-card" aria-label={copy.chapter6.lossTrendAria}>
              <div className="chapter-six-loss-trend-head">
                <p className="chapter-six-loss-trend-title">LOSS TREND</p>
                <p className="chapter-six-loss-trend-meta">{`STEP 1-${targetStep}`}</p>
              </div>
              <div className="chapter-six-loss-trend-shell">
                {lossTrend.pathData ? (
                  <svg
                    className="chapter-six-loss-trend-svg"
                    viewBox={`0 0 ${lossTrend.chartWidth} ${lossTrend.chartHeight}`}
                    role="img"
                    aria-label={copy.chapter6.lossTrendGraphAria}
                  >
                    <rect
                      className="chapter-six-loss-trend-bg"
                      x="0"
                      y="0"
                      width={lossTrend.chartWidth}
                      height={lossTrend.chartHeight}
                    />
                    <line
                      className="chapter-six-loss-trend-guide"
                      x1="12"
                      y1={lossTrend.chartHeight * 0.5}
                      x2={lossTrend.chartWidth - 12}
                      y2={lossTrend.chartHeight * 0.5}
                    />
                    <path className="chapter-six-loss-trend-line" d={lossTrend.pathData} />
                    {lossTrend.currentPoint ? (
                      <circle
                        className="chapter-six-loss-trend-dot"
                        cx={lossTrend.currentPoint.x}
                        cy={lossTrend.currentPoint.y}
                        r="4.2"
                      />
                    ) : null}
                  </svg>
                ) : (
                  <p className="chapter-six-loss-trend-empty">{copy.chapter6.lossTrendEmpty}</p>
                )}
              </div>
              <div className="chapter-six-loss-trend-stats">
                <span>{`MIN ${formatValue(lossTrend.minLoss, 4)}`}</span>
                <span>{`MAX ${formatValue(lossTrend.maxLoss, 4)}`}</span>
              </div>
            </article>
          </div>

          <section className="chapter-six-update-shell" aria-label={copy.chapter6.parameterUpdateAria}>
            <div className="chapter-six-update-head">
              <div className="chapter-six-param-nav">
                <p className="chapter-six-param-title">{copy.chapter6.exampleParameterTitle}</p>
                <div className="chapter-six-param-inner">
                  <button
                    type="button"
                    className="chapter-six-nav-arrow"
                    onClick={() => moveParameter(-1)}
                    aria-label={copy.chapter6.prevParameterAria}
                  >
                    <span className="chapter-six-nav-arrow-shape chapter-six-nav-arrow-shape-left" />
                  </button>
                  <p className="chapter-six-param-pill">
                    <span className="chapter-six-param-pill-char">{selectedParameter?.localizedLabel ?? selectedParameter?.label ?? 'N/A'}</span>
                    <span className="chapter-six-param-pill-meta">
                      {selectedParameter ? `${selectedParameter.matrix}[${selectedParameter.row_index}]` : ''}
                    </span>
                  </p>
                  <button
                    type="button"
                    className="chapter-six-nav-arrow"
                    onClick={() => moveParameter(1)}
                    aria-label={copy.chapter6.nextParameterAria}
                  >
                    <span className="chapter-six-nav-arrow-shape chapter-six-nav-arrow-shape-right" />
                  </button>
                </div>
              </div>
            </div>

            <div ref={chapterSixEquationScrollRef} className="chapter-six-equation-scroll">
              <div className="chapter-six-equation-row">
                {renderVectorCard('Gradient', gradientVector, 'gradient', {
                  rowRefs: gradientRowRefs,
                  scrollRef: gradientScrollRef,
                })}

                <article className="chapter-six-scalar-card" aria-label="learning rate">
                  <div className="chapter-six-scalar-head">
                    <p className="chapter-six-scalar-title">Learning Rate</p>
                    <div className="chapter-six-lr-help-wrap">
                      <button
                        type="button"
                        className="chapter-six-lr-help-btn"
                        onClick={() => setChapter6IsLearningRateHelpOpen((previous) => !previous)}
                        aria-label={copy.chapter6.learningRateHelpAria}
                        aria-expanded={chapter6IsLearningRateHelpOpen}
                        aria-controls="chapter-six-lr-help-popover"
                      >
                        ?
                      </button>
                      {chapter6IsLearningRateHelpOpen ? (
                        <div id="chapter-six-lr-help-popover" role="note" className="chapter-six-lr-help-popover">
                          <p className="chapter-six-lr-help-title">LEARNING RATE</p>
                          <p className="chapter-six-lr-help-text">{copy.chapter6.learningRateHelpText}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <p ref={learningRateValueRef} className="chapter-six-scalar-value">
                    {learningRateText}
                  </p>
                </article>

                {renderVectorCard('Parameter', afterVector, 'after', {
                  rowRefs: parameterRowRefs,
                  scrollRef: parameterScrollRef,
                })}
              </div>
            </div>
          </section>
        </div>

        <div ref={chapterSixFlowLayerRef} className="chapter-six-flow-layer" aria-hidden="true" />
      </div>
    </div>
  )
}


export default ChapterSixTrainingDemo
