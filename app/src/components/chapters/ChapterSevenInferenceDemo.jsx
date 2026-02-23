import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ATTENTION_HIDDEN_PLACEHOLDER,
  CHAPTER_SEVEN_DEFAULT_TEMPERATURE,
  CHAPTER_SEVEN_EMPTY_RETRY_LIMIT,
  CHAPTER_SEVEN_MAX_TEMPERATURE,
  CHAPTER_SEVEN_MIN_TEMPERATURE,
  CHAPTER_SEVEN_PHASE_HOLD_MS,
  CHAPTER_SEVEN_PHASE_INPUT_MS,
  CHAPTER_SEVEN_PHASE_PROB_MS,
  CHAPTER_SEVEN_PHASE_SAMPLE_MS,
  CHAPTER_SEVEN_QUEUE_ENTER_ANIM_MS,
  CHAPTER_SEVEN_QUEUE_LIMIT,
  CHAPTER_SEVEN_QUEUE_STAGGER_MS,
  CHAPTER_SEVEN_TEMPERATURE_STEP,
} from './shared/chapterConstants'
import {
  clamp,
  dotProduct,
  getChapterSevenProbValueHeatmapStyle,
  getInferenceTokenDisplay,
  matVec,
  rmsNormVector,
  sliceHead,
  softmaxNumbers,
} from './shared/chapterUtils'
import SectionStateCard from '../common/SectionStateCard'

function ChapterSevenInferenceDemo({ snapshot, reducedMotion, isMobile, copy }) {
  const tokenChars = useMemo(() => snapshot?.tokenizer?.uchars ?? [], [snapshot])
  const bos = Number(snapshot?.tokenizer?.bos ?? -1)
  const nEmbd = Number(snapshot?.n_embd ?? 0)
  const blockSize = Number(snapshot?.block_size ?? 0)
  const attention = snapshot?.attention ?? null
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
  const valueTextClass = isMobile ? 'text-[11px]' : 'text-xs'
  const [temperature, setTemperature] = useState(CHAPTER_SEVEN_DEFAULT_TEMPERATURE)
  const [samples, setSamples] = useState([])
  const [selectedSampleId, setSelectedSampleId] = useState(null)
  const [currentPosIndex, setCurrentPosIndex] = useState(0)
  const [isSequenceAnimating, setIsSequenceAnimating] = useState(false)
  const [hasSequenceAnimationCompleted, setHasSequenceAnimationCompleted] = useState(false)
  const [chapter7PlaybackPhase, setChapter7PlaybackPhase] = useState('idle')
  const [chapter7PathVisibleCount, setChapter7PathVisibleCount] = useState(0)
  const [chapter7ActiveInputPathIndex, setChapter7ActiveInputPathIndex] = useState(null)
  const [chapter7IsSampleVisible, setChapter7IsSampleVisible] = useState(false)
  const [chapter7IsSampleHighlightVisible, setChapter7IsSampleHighlightVisible] = useState(false)
  const [chapter7IsQueueStaggering, setChapter7IsQueueStaggering] = useState(false)
  const [chapter7RecentQueueIds, setChapter7RecentQueueIds] = useState([])
  const [chapter7IsTemperatureHelpOpen, setChapter7IsTemperatureHelpOpen] = useState(false)
  const playbackTimerRef = useRef(null)
  const queueStaggerTimerRef = useRef(null)
  const queueRecentTimerRefs = useRef([])
  const playbackRunIdRef = useRef(0)
  const queueRunIdRef = useRef(0)
  const sampleCounterRef = useRef(0)

  const hasMatrixShape = (matrix, rows, cols) => {
    return (
      Array.isArray(matrix) &&
      matrix.length === rows &&
      matrix.every((row) => Array.isArray(row) && row.length === cols)
    )
  }

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
  const hasInferenceData = isShapeValid

  const clampTemperature = (value) => {
    const quantized = Math.round(Number(value) / CHAPTER_SEVEN_TEMPERATURE_STEP) * CHAPTER_SEVEN_TEMPERATURE_STEP
    return clamp(quantized, CHAPTER_SEVEN_MIN_TEMPERATURE, CHAPTER_SEVEN_MAX_TEMPERATURE)
  }

  const clearPlaybackTimer = () => {
    if (playbackTimerRef.current != null) {
      window.clearTimeout(playbackTimerRef.current)
      playbackTimerRef.current = null
    }
  }

  const clearQueueTimers = () => {
    if (queueStaggerTimerRef.current != null) {
      window.clearTimeout(queueStaggerTimerRef.current)
      queueStaggerTimerRef.current = null
    }
    if (queueRecentTimerRefs.current.length) {
      queueRecentTimerRefs.current.forEach((timerId) => {
        window.clearTimeout(timerId)
      })
      queueRecentTimerRefs.current = []
    }
  }

  const markRecentQueueId = (id) => {
    setChapter7RecentQueueIds((previous) => {
      if (previous.includes(id)) {
        return previous
      }
      return [...previous, id]
    })
    const timerId = window.setTimeout(() => {
      setChapter7RecentQueueIds((previous) => previous.filter((item) => item !== id))
      queueRecentTimerRefs.current = queueRecentTimerRefs.current.filter((queuedTimerId) => queuedTimerId !== timerId)
    }, CHAPTER_SEVEN_QUEUE_ENTER_ANIM_MS)
    queueRecentTimerRefs.current.push(timerId)
  }

  const computeProbVectorForPrefix = (prefixTokenIds, temperatureValue) => {
    if (!hasInferenceData || !Array.isArray(prefixTokenIds) || !prefixTokenIds.length) {
      return []
    }

    const safePrefix = prefixTokenIds.slice(0, blockSize)
    const queryIndex = safePrefix.length - 1
    if (queryIndex < 0 || queryIndex >= blockSize) {
      return []
    }

    const xVectors = safePrefix.map((tokenId, posIndex) => {
      const tokenRow = wte[tokenId] ?? []
      const positionRow = wpe[posIndex] ?? []
      const sumVector = Array.from({ length: nEmbd }, (_, dimIndex) => {
        return Number(tokenRow[dimIndex] ?? 0) + Number(positionRow[dimIndex] ?? 0)
      })
      return rmsNormVector(sumVector)
    })

    const currentXVector = xVectors[queryIndex] ?? Array.from({ length: nEmbd }, () => 0)
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
    const residualVector = currentXVector.map((value, dimIndex) => Number(value ?? 0) + Number(mhaOutputVector[dimIndex] ?? 0))
    const xNormVector = rmsNormVector(residualVector)
    const mlpHiddenVector = matVec(xNormVector, mlpFc1)
    const mlpReluVector = mlpHiddenVector.map((value) => Math.max(0, Number(value ?? 0)))
    const mlpLinearVector = matVec(mlpReluVector, mlpFc2)
    const blockOutputVector = residualVector.map((value, dimIndex) => Number(value ?? 0) + Number(mlpLinearVector[dimIndex] ?? 0))
    const logitsVector = matVec(blockOutputVector, lmHead)
    const safeTemperature = clampTemperature(temperatureValue)
    const scaledLogits = logitsVector.map((value) => Number(value ?? 0) / safeTemperature)
    return softmaxNumbers(scaledLogits)
  }

  const sampleTokenIdFromProbVector = (probVector) => {
    const total = probVector.reduce((sum, value) => sum + Math.max(0, Number(value ?? 0)), 0)
    if (!Number.isFinite(total) || total <= 0) {
      return bos
    }
    let threshold = Math.random() * total
    for (let tokenId = 0; tokenId < probVector.length; tokenId += 1) {
      threshold -= Math.max(0, Number(probVector[tokenId] ?? 0))
      if (threshold <= 0) {
        return tokenId
      }
    }
    return Math.max(0, probVector.length - 1)
  }

  const buildDisplayRows = (probVector, sampledTokenId, sortedTokenIds) => {
    const rankedTokenIds = Array.isArray(sortedTokenIds)
      ? sortedTokenIds
      : Array.from({ length: probVector.length }, (_, tokenId) => tokenId).sort((left, right) => {
          const diff = Number(probVector[right] ?? 0) - Number(probVector[left] ?? 0)
          if (diff !== 0) {
            return diff
          }
          return left - right
        })
    const sampledRank = rankedTokenIds.indexOf(sampledTokenId)
    const toDisplayRow = (tokenId) => {
      const rank = rankedTokenIds.indexOf(tokenId)
      return {
        kind: 'token',
        tokenId,
        label: getInferenceTokenDisplay(tokenId, tokenChars, bos, true, copy.roles),
        prob: Number(probVector[tokenId] ?? 0),
        rank,
        isSampled: tokenId === sampledTokenId,
      }
    }

    const top10TokenIds = rankedTokenIds.slice(0, Math.min(10, rankedTokenIds.length))
    const isSampledInTop10 = top10TokenIds.includes(sampledTokenId)
    if (isSampledInTop10) {
      return top10TokenIds.map((tokenId) => toDisplayRow(tokenId))
    }

    const top8TokenIds = rankedTokenIds.slice(0, Math.min(8, rankedTokenIds.length))
    const rows = top8TokenIds.map((tokenId) => toDisplayRow(tokenId))
    rows.push({
      kind: 'ellipsis',
      rank: sampledRank,
    })
    rows.push(toDisplayRow(sampledTokenId))
    return rows
  }

  const buildSingleSample = (temperatureValue) => {
    if (!hasInferenceData) {
      return null
    }

    const maxTokens = Math.max(1, blockSize)
    const safeTemperature = clampTemperature(temperatureValue)

    for (let retry = 0; retry < CHAPTER_SEVEN_EMPTY_RETRY_LIMIT; retry += 1) {
      const prefixTokenIds = [bos]
      const sampledChars = []
      const tokenPath = [bos]
      const steps = []

      for (let pos = 0; pos < maxTokens; pos += 1) {
        const inputTokenId = prefixTokenIds[prefixTokenIds.length - 1]
        const probVector = computeProbVectorForPrefix(prefixTokenIds, safeTemperature)
        if (!probVector.length) {
          break
        }

        const sampledTokenId = sampleTokenIdFromProbVector(probVector)
        const sortedTokenIds = Array.from({ length: probVector.length }, (_, tokenId) => tokenId).sort((left, right) => {
          const diff = Number(probVector[right] ?? 0) - Number(probVector[left] ?? 0)
          if (diff !== 0) {
            return diff
          }
          return left - right
        })
        const sampledRank = Math.max(0, sortedTokenIds.indexOf(sampledTokenId))
        const displayRows = buildDisplayRows(probVector, sampledTokenId, sortedTokenIds)

        steps.push({
          pos,
          inputTokenId,
          sampledTokenId,
          sampledProb: Number(probVector[sampledTokenId] ?? 0),
          sampledRank,
          displayRows,
        })

        tokenPath.push(sampledTokenId)
        if (sampledTokenId === bos) {
          break
        }

        prefixTokenIds.push(sampledTokenId)
        sampledChars.push(tokenChars[sampledTokenId] ?? '')
      }

      const jamoText = sampledChars.join('')
      const name = jamoText.normalize('NFC')
      if (!name || !steps.length) {
        continue
      }

      sampleCounterRef.current += 1
      return {
        id: `inference-${Date.now()}-${sampleCounterRef.current}`,
        name,
        jamoText,
        tokenPath,
        steps,
      }
    }

    return null
  }

  const generateSamples = (count) => {
    if (!hasInferenceData || chapter7IsQueueStaggering) {
      return
    }
    const safeCount = Math.max(1, Number(count) || 1)
    const createdSamples = []
    for (let index = 0; index < safeCount; index += 1) {
      const sample = buildSingleSample(temperature)
      if (sample) {
        createdSamples.push(sample)
      }
    }

    if (!createdSamples.length) {
      return
    }

    if (createdSamples.length === 1) {
      const sample = createdSamples[0]
      setSamples((previous) => {
        const merged = [...previous, sample]
        return merged.slice(-CHAPTER_SEVEN_QUEUE_LIMIT)
      })
      markRecentQueueId(sample.id)
      setSelectedSampleId(sample.id)
      return
    }

    clearQueueTimers()
    queueRunIdRef.current += 1
    const queueRunId = queueRunIdRef.current
    const finalSelectedId = createdSamples[createdSamples.length - 1].id
    let insertionIndex = 0
    setChapter7IsQueueStaggering(true)
    setChapter7RecentQueueIds([])

    const enqueueNext = () => {
      if (queueRunIdRef.current !== queueRunId) {
        return
      }
      const sample = createdSamples[insertionIndex]
      if (!sample) {
        setChapter7IsQueueStaggering(false)
        setChapter7RecentQueueIds([])
        setSelectedSampleId(finalSelectedId)
        return
      }

      setSamples((previous) => {
        const merged = [...previous, sample]
        return merged.slice(-CHAPTER_SEVEN_QUEUE_LIMIT)
      })
      markRecentQueueId(sample.id)
      insertionIndex += 1

      if (insertionIndex >= createdSamples.length) {
        queueStaggerTimerRef.current = window.setTimeout(() => {
          if (queueRunIdRef.current !== queueRunId) {
            return
          }
          setChapter7IsQueueStaggering(false)
          setChapter7RecentQueueIds([])
          setSelectedSampleId(finalSelectedId)
          queueStaggerTimerRef.current = null
        }, CHAPTER_SEVEN_QUEUE_STAGGER_MS)
        return
      }

      queueStaggerTimerRef.current = window.setTimeout(enqueueNext, CHAPTER_SEVEN_QUEUE_STAGGER_MS)
    }

    enqueueNext()
  }

  const selectedSample = useMemo(() => {
    return samples.find((sample) => sample.id === selectedSampleId) ?? samples[samples.length - 1] ?? null
  }, [samples, selectedSampleId])
  const activeSampleId = selectedSample?.id ?? null
  const selectedSteps = selectedSample?.steps ?? []
  const safeCurrentPosIndex = selectedSteps.length ? clamp(currentPosIndex, 0, selectedSteps.length - 1) : 0
  const currentStep = selectedSteps[safeCurrentPosIndex] ?? null
  const currentStepTokenRows = currentStep ? currentStep.displayRows.filter((row) => row.kind === 'token') : []
  const currentStepMinProb = currentStepTokenRows.length
    ? currentStepTokenRows.reduce((minimum, row) => Math.min(minimum, Number(row.prob ?? 0)), Number.POSITIVE_INFINITY)
    : 0
  const currentStepMaxProb = currentStepTokenRows.length
    ? currentStepTokenRows.reduce((maximum, row) => Math.max(maximum, Number(row.prob ?? 0)), Number.NEGATIVE_INFINITY)
    : 1
  const safePathVisibleCount = selectedSample
    ? clamp(chapter7PathVisibleCount, 0, selectedSample.tokenPath.length)
    : 0
  const selectedNameTokenLabel = currentStep
    ? getInferenceTokenDisplay(currentStep.sampledTokenId, tokenChars, bos, true, copy.roles)
    : '[BOS]'
  const selectedInputTokenLabel = currentStep
    ? getInferenceTokenDisplay(currentStep.inputTokenId, tokenChars, bos, true, copy.roles)
    : '[BOS]'
  const currentOutputPathIndex = safeCurrentPosIndex + 1
  const isPathNavigationLocked = !hasSequenceAnimationCompleted || isSequenceAnimating || !selectedSteps.length

  const finalizePlaybackState = (finalPosIndex, finalPathVisibleCount) => {
    setCurrentPosIndex(finalPosIndex)
    setChapter7PlaybackPhase('idle')
    setChapter7ActiveInputPathIndex(null)
    setChapter7IsSampleVisible(true)
    setChapter7IsSampleHighlightVisible(true)
    setChapter7PathVisibleCount(finalPathVisibleCount)
    setIsSequenceAnimating(false)
    setHasSequenceAnimationCompleted(true)
  }

  const runPosPhaseSequence = (runId, posIndex, options = {}) => {
    const { revealPathOnSample = false, onDone = null } = options
    if (playbackRunIdRef.current !== runId) {
      return
    }

    setCurrentPosIndex(posIndex)
    setChapter7PlaybackPhase('input')
    setChapter7ActiveInputPathIndex(posIndex)
    setChapter7IsSampleVisible(false)
    setChapter7IsSampleHighlightVisible(false)

    playbackTimerRef.current = window.setTimeout(() => {
      if (playbackRunIdRef.current !== runId) {
        return
      }
      setChapter7PlaybackPhase('prob')

      playbackTimerRef.current = window.setTimeout(() => {
        if (playbackRunIdRef.current !== runId) {
          return
        }
        setChapter7PlaybackPhase('sample')
        setChapter7IsSampleVisible(true)
        setChapter7IsSampleHighlightVisible(true)
        if (revealPathOnSample) {
          setChapter7PathVisibleCount((previous) => Math.max(previous, posIndex + 2))
        }

        playbackTimerRef.current = window.setTimeout(() => {
          if (playbackRunIdRef.current !== runId) {
            return
          }
          playbackTimerRef.current = window.setTimeout(() => {
            if (playbackRunIdRef.current !== runId) {
              return
            }
            if (typeof onDone === 'function') {
              onDone()
            }
          }, CHAPTER_SEVEN_PHASE_HOLD_MS)
        }, CHAPTER_SEVEN_PHASE_SAMPLE_MS)
      }, CHAPTER_SEVEN_PHASE_PROB_MS)
    }, CHAPTER_SEVEN_PHASE_INPUT_MS)
  }

  useEffect(() => {
    clearPlaybackTimer()
    playbackRunIdRef.current += 1
    const runId = playbackRunIdRef.current

    playbackTimerRef.current = window.setTimeout(() => {
      if (playbackRunIdRef.current !== runId) {
        return
      }
      if (!selectedSample || !selectedSteps.length) {
        setCurrentPosIndex(0)
        setChapter7PlaybackPhase('idle')
        setChapter7ActiveInputPathIndex(null)
        setChapter7IsSampleVisible(false)
        setChapter7IsSampleHighlightVisible(false)
        setChapter7PathVisibleCount(0)
        setIsSequenceAnimating(false)
        setHasSequenceAnimationCompleted(false)
        return
      }

      const finalPosIndex = Math.max(0, selectedSteps.length - 1)
      const finalPathVisibleCount = selectedSample.tokenPath.length

      if (reducedMotion) {
        finalizePlaybackState(finalPosIndex, finalPathVisibleCount)
        return
      }

      setIsSequenceAnimating(true)
      setHasSequenceAnimationCompleted(false)
      setChapter7PathVisibleCount(1)

      const playNextPos = (posIndex) => {
        runPosPhaseSequence(runId, posIndex, {
          revealPathOnSample: true,
          onDone: () => {
            if (playbackRunIdRef.current !== runId) {
              return
            }
            if (posIndex < finalPosIndex) {
              playNextPos(posIndex + 1)
              return
            }
            finalizePlaybackState(finalPosIndex, finalPathVisibleCount)
          },
        })
      }

      playNextPos(0)
    }, 0)

    return () => {
      clearPlaybackTimer()
    }
  }, [activeSampleId, reducedMotion, selectedSample, selectedSteps.length])

  useEffect(() => {
    if (!chapter7IsTemperatureHelpOpen) {
      return undefined
    }

    const onPointerDown = (event) => {
      const target = event.target
      if (target instanceof Element && target.closest('.chapter-seven-temp-help-wrap')) {
        return
      }
      setChapter7IsTemperatureHelpOpen(false)
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setChapter7IsTemperatureHelpOpen(false)
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [chapter7IsTemperatureHelpOpen])

  useEffect(() => {
    return () => {
      clearPlaybackTimer()
      clearQueueTimers()
      playbackRunIdRef.current += 1
      queueRunIdRef.current += 1
    }
  }, [])

  const runSinglePosPlayback = (targetPos) => {
    if (!selectedSample || !selectedSteps.length) {
      return
    }
    const finalPathVisibleCount = selectedSample.tokenPath.length
    const safeTargetPos = clamp(targetPos, 0, selectedSteps.length - 1)

    clearPlaybackTimer()
    playbackRunIdRef.current += 1
    const runId = playbackRunIdRef.current

    if (reducedMotion) {
      finalizePlaybackState(safeTargetPos, finalPathVisibleCount)
      return
    }

    setIsSequenceAnimating(true)
    setHasSequenceAnimationCompleted(false)
    setChapter7PathVisibleCount(finalPathVisibleCount)

    runPosPhaseSequence(runId, safeTargetPos, {
      revealPathOnSample: false,
      onDone: () => {
        if (playbackRunIdRef.current !== runId) {
          return
        }
        finalizePlaybackState(safeTargetPos, finalPathVisibleCount)
      },
    })
  }

  const onMovePos = (direction) => {
    if (isPathNavigationLocked) {
      return
    }
    const targetPos = clamp(safeCurrentPosIndex + direction, 0, selectedSteps.length - 1)
    if (targetPos === safeCurrentPosIndex) {
      return
    }
    runSinglePosPlayback(targetPos)
  }

  const onPathTokenClick = (tokenIndex) => {
    if (isPathNavigationLocked || tokenIndex < 0 || tokenIndex >= safePathVisibleCount) {
      return
    }
    const mappedPos = tokenIndex <= 0 ? 0 : clamp(tokenIndex - 1, 0, selectedSteps.length - 1)
    runSinglePosPlayback(mappedPos)
  }

  const onTemperatureChange = (event) => {
    setTemperature(clampTemperature(Number(event.target.value)))
  }

  const onTemperatureNudge = (direction) => {
    const delta = direction * CHAPTER_SEVEN_TEMPERATURE_STEP
    setTemperature((previous) => clampTemperature(previous + delta))
  }

  if (!hasInferenceData) {
    return <SectionStateCard title="INFERENCE SNAPSHOT" message={copy.chapter7.unavailable} />
  }

  return (
    <div className="chapter-seven-demo-wrap reveal">
      <div className="chapter-seven-controls">
        <section className="chapter-seven-queue-shell" aria-label={copy.chapter7.queueAria}>
          <div className="chapter-seven-queue-head">
            <p className="chapter-seven-queue-title">NAME QUEUE</p>
            <p className="chapter-seven-queue-meta">{`${samples.length} / ${CHAPTER_SEVEN_QUEUE_LIMIT}`}</p>
          </div>
          <div className="chapter-seven-queue-row">
            {samples.length ? (
              samples.map((sample) => {
                const isActive = sample.id === activeSampleId
                return (
                  <button
                    key={sample.id}
                    type="button"
                    className={`chapter-seven-queue-chip ${
                      chapter7RecentQueueIds.includes(sample.id) ? 'chapter-seven-queue-chip--entering' : ''
                    } ${isActive ? 'chapter-seven-queue-chip--active' : ''}`.trim()}
                    onClick={() => setSelectedSampleId(sample.id)}
                    aria-pressed={isActive}
                    aria-label={copy.chapter7.queuePathAria(sample.name)}
                  >
                    {sample.name}
                  </button>
                )
              })
            ) : (
              <p className="chapter-seven-queue-empty">{copy.chapter7.queueEmpty}</p>
            )}
          </div>
        </section>

        <div className="chapter-seven-control-row">
          <div className="chapter-seven-action-row">
            <button
              type="button"
              className="chapter-seven-action-btn"
              onClick={() => generateSamples(1)}
              aria-label={copy.chapter7.generateOneAria}
              disabled={chapter7IsQueueStaggering}
            >
              {copy.chapter7.generateOneText}
            </button>
            <button
              type="button"
              className="chapter-seven-action-btn chapter-seven-action-btn--accent"
              onClick={() => generateSamples(10)}
              aria-label={copy.chapter7.generateTenAria}
              disabled={chapter7IsQueueStaggering}
            >
              {copy.chapter7.generateTenText}
            </button>
          </div>

          <div className="chapter-seven-slider-shell">
            <div className="chapter-seven-slider-head">
              <p className="chapter-seven-slider-title">Temperature</p>
              <div className="chapter-seven-slider-head-meta">
                <p className="chapter-seven-slider-value">{temperature.toFixed(1)}</p>
                <div className="chapter-seven-temp-help-wrap">
                  <button
                    type="button"
                    className="chapter-seven-temp-help-btn"
                    onClick={() => setChapter7IsTemperatureHelpOpen((previous) => !previous)}
                    aria-label={copy.chapter7.temperatureHelpAria}
                    aria-expanded={chapter7IsTemperatureHelpOpen}
                    aria-controls="chapter-seven-temp-help-popover"
                  >
                    ?
                  </button>
                  {chapter7IsTemperatureHelpOpen ? (
                    <div id="chapter-seven-temp-help-popover" role="note" className="chapter-seven-temp-help-popover">
                      <p className="chapter-seven-temp-help-title">TEMPERATURE</p>
                      <p className="chapter-seven-temp-help-text">{copy.chapter7.temperatureHelpText}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="chapter-seven-slider-track">
              <button
                type="button"
                className="chapter-seven-nav-arrow chapter-seven-slider-arrow"
                onClick={() => onTemperatureNudge(-1)}
                aria-label={copy.chapter7.temperatureDownAria}
              >
                <span className="chapter-seven-nav-arrow-shape chapter-seven-nav-arrow-shape-left" />
              </button>
              <input
                type="range"
                className="chapter-seven-slider"
                min={CHAPTER_SEVEN_MIN_TEMPERATURE}
                max={CHAPTER_SEVEN_MAX_TEMPERATURE}
                step={CHAPTER_SEVEN_TEMPERATURE_STEP}
                value={temperature}
                onChange={onTemperatureChange}
                aria-label={copy.chapter7.temperatureSliderAria(
                  temperature.toFixed(1),
                  CHAPTER_SEVEN_MIN_TEMPERATURE,
                  CHAPTER_SEVEN_MAX_TEMPERATURE,
                )}
              />
              <button
                type="button"
                className="chapter-seven-nav-arrow chapter-seven-slider-arrow"
                onClick={() => onTemperatureNudge(1)}
                aria-label={copy.chapter7.temperatureUpAria}
              >
                <span className="chapter-seven-nav-arrow-shape chapter-seven-nav-arrow-shape-right" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {selectedSample ? (
        <div className="chapter-seven-inference-shell">
          <div className="chapter-seven-stage-grid">
            <section className="chapter-seven-path-shell">
              <div className="chapter-seven-path-head">
                <p className="chapter-seven-stage-title">TOKEN PATH</p>
                <div className="chapter-seven-path-nav">
                  <button
                    type="button"
                    className="chapter-seven-nav-arrow chapter-seven-path-arrow-btn"
                    onClick={() => onMovePos(-1)}
                    aria-label={copy.chapter7.prevPosAria}
                    disabled={isPathNavigationLocked || safeCurrentPosIndex <= 0}
                  >
                    <span className="chapter-seven-nav-arrow-shape chapter-seven-nav-arrow-shape-left" />
                  </button>
                  <p className="chapter-seven-path-pos-pill">
                    <span className="chapter-seven-path-pos-char">{`POS ${safeCurrentPosIndex}`}</span>
                    <span className="chapter-seven-path-pos-meta">{`0 ~ ${Math.max(0, selectedSteps.length - 1)}`}</span>
                  </p>
                  <button
                    type="button"
                    className="chapter-seven-nav-arrow chapter-seven-path-arrow-btn"
                    onClick={() => onMovePos(1)}
                    aria-label={copy.chapter7.nextPosAria}
                    disabled={isPathNavigationLocked || safeCurrentPosIndex >= selectedSteps.length - 1}
                  >
                    <span className="chapter-seven-nav-arrow-shape chapter-seven-nav-arrow-shape-right" />
                  </button>
                </div>
              </div>

              <div className="chapter-seven-path-track">
                {selectedSample.tokenPath.map((tokenId, tokenIndex) => {
                  const isVisible = tokenIndex < safePathVisibleCount
                  const isCurrentOutput = isVisible && tokenIndex === currentOutputPathIndex
                  const isInputActive =
                    isVisible &&
                    chapter7PlaybackPhase === 'input' &&
                    chapter7ActiveInputPathIndex != null &&
                    tokenIndex === chapter7ActiveInputPathIndex
                  const isNewToken =
                    isVisible &&
                    chapter7PlaybackPhase === 'sample' &&
                    chapter7IsSampleHighlightVisible &&
                    tokenIndex === currentOutputPathIndex
                  const isClickable = isVisible && !isPathNavigationLocked

                  return (
                    <span key={`${selectedSample.id}-path-${tokenIndex}`} className="chapter-seven-path-item">
                      <button
                        type="button"
                        className={`chapter-seven-path-chip ${isVisible ? '' : 'chapter-seven-path-chip--hidden'} ${
                          isCurrentOutput ? 'chapter-seven-path-chip--current' : ''
                        } ${isInputActive ? 'chapter-seven-path-chip--input-active' : ''} ${
                          isNewToken ? 'chapter-seven-path-chip--new' : ''
                        } ${isClickable ? 'chapter-seven-path-chip--clickable' : ''}`.trim()}
                        onClick={() => onPathTokenClick(tokenIndex)}
                        disabled={!isClickable}
                        aria-label={copy.chapter7.tokenViewAria(tokenIndex)}
                      >
                        {isVisible ? getInferenceTokenDisplay(tokenId, tokenChars, bos, true, copy.roles) : ATTENTION_HIDDEN_PLACEHOLDER}
                      </button>
                      {tokenIndex < selectedSample.tokenPath.length - 1 ? <span className="chapter-seven-path-arrow">→</span> : null}
                    </span>
                  )
                })}
              </div>
            </section>

            <section className="chapter-seven-prob-stage">
              <div className="chapter-seven-prob-head">
                <p className="chapter-seven-stage-title">{`POS ${safeCurrentPosIndex} NEXT TOKEN PROB`}</p>
                <p className={`chapter-seven-prob-input ${valueTextClass}`}>{`INPUT: ${selectedInputTokenLabel}`}</p>
              </div>

              {currentStep ? (
                <div className="chapter-seven-prob-shell">
                  <div className="chapter-seven-prob-body">
                    <div className="chapter-seven-prob-list">
                      {currentStep.displayRows.map((row, rowIndex) => {
                        if (row.kind === 'ellipsis') {
                          return (
                            <p key={`ellipsis-${safeCurrentPosIndex}-${rowIndex}`} className={`chapter-seven-prob-ellipsis ${valueTextClass}`}>
                              ...
                            </p>
                          )
                        }
                        const isSampledActive = row.isSampled && chapter7IsSampleHighlightVisible
                        const probValueHeatmapStyle = getChapterSevenProbValueHeatmapStyle(
                          Number(row.prob ?? 0),
                          currentStepMinProb,
                          currentStepMaxProb,
                        )
                        return (
                          <article
                            key={`prob-${safeCurrentPosIndex}-${row.tokenId}`}
                            className={`chapter-seven-prob-row ${
                              isSampledActive ? 'chapter-seven-prob-row--sampled-active' : ''
                            }`.trim()}
                          >
                            <span className={`chapter-seven-prob-rank ${valueTextClass}`}>{`#${Number(row.rank ?? 0) + 1}`}</span>
                            <span className={`chapter-seven-prob-token ${valueTextClass}`}>{`${row.label} · ID ${row.tokenId}`}</span>
                            <span className={`chapter-seven-prob-value ${valueTextClass}`} style={probValueHeatmapStyle}>
                              {Number(row.prob ?? 0).toFixed(3)}
                            </span>
                          </article>
                        )
                      })}
                    </div>

                    <aside className={`chapter-seven-sampled-card ${chapter7IsSampleVisible ? '' : 'chapter-seven-sampled-card--hidden'}`.trim()}>
                      <p className="chapter-seven-sampled-title">SAMPLED NEXT TOKEN</p>
                      <p className="chapter-seven-sampled-token">
                        {chapter7IsSampleVisible ? selectedNameTokenLabel : ATTENTION_HIDDEN_PLACEHOLDER}
                      </p>
                      <p className={`chapter-seven-sampled-meta ${valueTextClass}`}>
                        {chapter7IsSampleVisible
                          ? copy.chapter7.sampledMeta(currentStep.sampledRank + 1, Number(currentStep.sampledProb ?? 0).toFixed(6))
                          : ATTENTION_HIDDEN_PLACEHOLDER}
                      </p>
                    </aside>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      ) : null}
    </div>
  )
}


export default ChapterSevenInferenceDemo
