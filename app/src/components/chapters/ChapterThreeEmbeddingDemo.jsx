import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import {
  clamp,
  getHeatColor,
  getJamoInfoForChapter3,
  getRoleLabel,
  rmsNormVector,
  toTokenDisplayChar,
} from './shared/chapterUtils'

function ChapterThreeEmbeddingDemo({ snapshot, reducedMotion, isMobile, copy, exampleLanguage = 'ko' }) {
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
  const displayChar = toTokenDisplayChar(jamoInfo.display || tokenChars[safeTokenIndex] || '', exampleLanguage)
  const shouldShowRolePrefix = exampleLanguage === 'ko' && jamoInfo.roleKey && jamoInfo.roleKey !== 'other'
  const displayRole = shouldShowRolePrefix ? getRoleLabel(jamoInfo.roleKey, copy.roles) : ''
  const valueTextClass = isMobile ? 'text-[11px]' : 'text-xs'
  const columns = [
    {
      key: 'token',
      title: 'TOKEN EMBEDDING',
      infoTitle: 'Token Embedding',
      infoBody: copy.chapter3.tokenEmbeddingInfoBody,
      vector: tokenVector,
      rowRef: tokenRowRefs,
      columnRef: null,
    },
    {
      key: 'position',
      title: 'POSITION EMBEDDING',
      infoTitle: 'Position Embedding',
      infoBody: copy.chapter3.positionEmbeddingInfoBody,
      vector: positionVector,
      rowRef: positionRowRefs,
      columnRef: positionColumnRef,
    },
    {
      key: 'sum',
      title: 'SUM EMBEDDING',
      infoTitle: 'Sum Embedding',
      infoBody: copy.chapter3.sumEmbeddingInfoBody,
      vector: sumVector,
      rowRef: sumRowRefs,
      columnRef: sumColumnRef,
    },
    {
      key: 'final',
      title: 'FINAL EMBEDDING',
      infoTitle: 'Final Embedding',
      infoBody: copy.chapter3.finalEmbeddingInfoBody,
      vector: displayedFinalVector,
      rowRef: finalRowRefs,
      columnRef: finalColumnRef,
    },
  ]

  return (
    <div className="embedding-demo-wrap reveal">
      <div className="embedding-controls">
        <div className="embedding-nav">
          <p className="embedding-nav-title">{copy.chapter3.samplePhonemeTitle}</p>
          <div className="embedding-nav-inner">
            <button
              type="button"
              className="embedding-nav-arrow"
              onClick={() => moveToken(-1)}
              aria-label={copy.chapter3.prevPhonemeAria}
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
              aria-label={copy.chapter3.nextPhonemeAria}
            >
              <span className="embedding-nav-arrow-shape embedding-nav-arrow-shape-right" />
            </button>
          </div>
        </div>

        <div className="embedding-nav">
          <p className="embedding-nav-title">{copy.chapter3.positionIndexTitle}</p>
          <div className="embedding-nav-inner">
            <button
              type="button"
              className="embedding-nav-arrow"
              onClick={() => movePosition(-1)}
              aria-label={copy.chapter3.prevPositionIndexAria}
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
              aria-label={copy.chapter3.nextPositionIndexAria}
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
                      aria-label={copy.chapter3.conceptAria(column.title)}
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


export default ChapterThreeEmbeddingDemo
