import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import {
  ATTENTION_HIDDEN_PLACEHOLDER,
  LOGIT_PARTIAL_COMMIT_STEP,
} from './shared/chapterConstants'
import {
  clamp,
  createRevealMatrix,
  createRevealMatrixWithVisibleRows,
  createRevealVector,
  decomposeNameToModelTokens,
  dotProduct,
  formatTokenDisplayWithRole,
  getHeatColor,
  getInferenceTokenDisplay,
  matVec,
  rmsNormVector,
  sliceHead,
  softmaxNumbers,
} from './shared/chapterUtils'

const STAGE_REPLAY_KEYS = [
  'stage-qkv',
  'stage-weights',
  'stage-output',
  'stage-heads',
  'stage-mha',
  'stage-result',
  'stage-block-output',
  'stage-logit',
  'stage-prob',
]

function ChapterFourAttentionDemo({
  snapshot,
  attention,
  reducedMotion,
  isMobile,
  copy,
  exampleNames = [],
  exampleLanguage = 'ko',
}) {
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
  const [animationScope, setAnimationScope] = useState('all')
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
  const [activeTraceTarget, setActiveTraceTarget] = useState(null)
  const [isTraceReady, setIsTraceReady] = useState(false)
  const pipelineContentRef = useRef(null)
  const bridgeLayerRef = useRef(null)
  const bridgeTopPathRef = useRef(null)
  const bridgeResultPathRef = useRef(null)
  const traceLayerRef = useRef(null)
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
  const kSourceSummaryRefs = useRef([])
  const vSourceSummaryRefs = useRef([])
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
  const safeExampleNames = useMemo(() => {
    const filtered = Array.isArray(exampleNames)
      ? exampleNames
        .map((name) => (typeof name === 'string' ? name.trim() : ''))
        .filter(Boolean)
      : []
    return filtered.length ? filtered : ['']
  }, [exampleNames])
  const safeExampleNameIndex = safeExampleNames.length
    ? ((exampleNameIndex % safeExampleNames.length) + safeExampleNames.length) % safeExampleNames.length
    : 0
  const currentExampleName = safeExampleNames[safeExampleNameIndex] ?? ''
  const displayExampleName = exampleLanguage === 'en' ? currentExampleName.toUpperCase() : currentExampleName
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
    const decomposition = decomposeNameToModelTokens(currentExampleName, exampleLanguage)
    const sequence = [{ tokenId: bos, label: '[BOS]' }]
    decomposition.tokens.forEach((token) => {
      const tokenId = stoi[token.nfd]
      if (typeof tokenId !== 'number') {
        return
      }
      sequence.push({
        tokenId,
        label: formatTokenDisplayWithRole(token, copy.roles, true),
      })
    })

    return sequence.slice(0, Math.max(1, blockSize)).map((item, position) => {
      return {
        ...item,
        position,
      }
    })
  }, [blockSize, bos, copy.roles, currentExampleName, exampleLanguage, isShapeValid, stoi])
  const hasAttentionData = isShapeValid && modelSequence.length > 0

  useEffect(() => {
    if (openInfoKey === null) {
      return undefined
    }

    const onPointerDown = (event) => {
      const target = event.target
      if (target instanceof Element && target.closest('.attention-help-')) {
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
    return {
      tokenId,
      label: getInferenceTokenDisplay(tokenId, tokenChars, bos, true, copy.roles, exampleLanguage),
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
  const currentKeyRowIndex = Math.max(0, keyRows.length - 1)

  const getTraceTargetKey = (target) => {
    if (!target || typeof target !== 'object') {
      return ''
    }
    const kind = target.kind
    if (typeof kind !== 'string') {
      return ''
    }
    switch (kind) {
      case 'x':
      case 'q':
      case 'output':
      case 'mha-input':
      case 'mha-output':
      case 'result':
      case 'block-output':
        return `${kind}:${Number(target.dimIndex ?? -1)}`
      case 'k':
      case 'v':
      case 'contrib':
        return `${kind}:${Number(target.rowIndex ?? -1)}:${Number(target.dimIndex ?? -1)}`
      case 'weight':
      case 'logit':
      case 'prob':
        return `${kind}:${Number(target.rowIndex ?? -1)}`
      case 'head-output':
        return `head-output:${Number(target.headIndex ?? -1)}:${Number(target.dimIndex ?? -1)}`
      default:
        return ''
    }
  }

  const activeTraceTargetKey = getTraceTargetKey(activeTraceTarget)

  const resolveTraceTargetNode = (target) => {
    if (!target || typeof target !== 'object') {
      return null
    }
    switch (target.kind) {
      case 'x':
        return xValueRefs.current[target.dimIndex] ?? null
      case 'q':
        return qCellRefs.current[target.dimIndex] ?? null
      case 'k':
        return kCellRefs.current[target.rowIndex]?.[target.dimIndex] ?? null
      case 'v':
        return vCellRefs.current[target.rowIndex]?.[target.dimIndex] ?? null
      case 'weight':
        return weightValueRefs.current[target.rowIndex] ?? null
      case 'contrib':
        return contribCellRefs.current[target.rowIndex]?.[target.dimIndex] ?? null
      case 'output':
        return outputCellRefs.current[target.dimIndex] ?? null
      case 'head-output':
        return headOutputCellRefs.current[target.headIndex]?.[target.dimIndex] ?? null
      case 'mha-input':
        return mhaInputCellRefs.current[target.dimIndex] ?? null
      case 'mha-output':
        return mhaOutputCellRefs.current[target.dimIndex] ?? null
      case 'result':
        return resultCellRefs.current[target.dimIndex] ?? null
      case 'block-output':
        return blockOutputCellRefs.current[target.dimIndex] ?? null
      case 'logit':
        return logitValueRefs.current[target.rowIndex] ?? null
      case 'prob':
        return probValueRefs.current[target.rowIndex] ?? null
      default:
        return null
    }
  }

  const dedupeNodes = (nodes) => {
    const seen = new Set()
    return nodes.filter((node) => {
      if (!node || seen.has(node)) {
        return false
      }
      seen.add(node)
      return true
    })
  }

  const resolveTraceSourceNodes = (target) => {
    if (!target || typeof target !== 'object') {
      return []
    }
    switch (target.kind) {
      case 'x':
        return []
      case 'q':
        return dedupeNodes(xValueRefs.current)
      case 'k':
        if (target.rowIndex === currentKeyRowIndex) {
          return dedupeNodes(xValueRefs.current)
        }
        return dedupeNodes([kSourceSummaryRefs.current[target.rowIndex]])
      case 'v':
        if (target.rowIndex === currentKeyRowIndex) {
          return dedupeNodes(xValueRefs.current)
        }
        return dedupeNodes([vSourceSummaryRefs.current[target.rowIndex]])
      case 'weight':
        return dedupeNodes([...(qCellRefs.current ?? []), ...((kCellRefs.current[target.rowIndex] ?? []))])
      case 'contrib':
        return dedupeNodes([vCellRefs.current[target.rowIndex]?.[target.dimIndex], weightValueRefs.current[target.rowIndex]])
      case 'output':
        return dedupeNodes(contribCellRefs.current.map((row) => row?.[target.dimIndex] ?? null))
      case 'head-output':
        if (target.headIndex === 0) {
          return dedupeNodes([outputCellRefs.current[target.dimIndex]])
        }
        return dedupeNodes([
          headSummaryQRefs.current[target.headIndex],
          headSummaryKRefs.current[target.headIndex],
          headSummaryVRefs.current[target.headIndex],
        ])
      case 'mha-input': {
        const sourceHeadIndex = Math.floor(target.dimIndex / Math.max(1, headDim))
        const sourceDimIndex = target.dimIndex % Math.max(1, headDim)
        return dedupeNodes([headOutputCellRefs.current[sourceHeadIndex]?.[sourceDimIndex]])
      }
      case 'mha-output':
        return dedupeNodes(mhaInputCellRefs.current)
      case 'result':
        return dedupeNodes([xValueRefs.current[target.dimIndex], mhaOutputCellRefs.current[target.dimIndex]])
      case 'block-output':
        return dedupeNodes(resultCellRefs.current)
      case 'logit':
        return dedupeNodes(blockOutputCellRefs.current)
      case 'prob':
        return dedupeNodes(logitValueRefs.current)
      default:
        return []
    }
  }

  const buildTraceInteractionProps = (target, isVisible = true) => {
    const targetKey = getTraceTargetKey(target)
    const isSelected = targetKey && targetKey === activeTraceTargetKey
    const isInteractive = Boolean(targetKey) && isTraceReady && !isAnimating && isVisible
    const className = `${isInteractive ? 'attention-trace-target' : ''} ${isSelected ? 'attention-trace-target--selected' : ''}`.trim()

    if (!isInteractive) {
      return {
        className,
        onClick: undefined,
        onKeyDown: undefined,
        tabIndex: undefined,
        role: undefined,
        ariaPressed: undefined,
      }
    }

    const toggleTarget = () => {
      setActiveTraceTarget((previous) => {
        return getTraceTargetKey(previous) === targetKey ? null : target
      })
    }

    const onKeyDown = (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return
      }
      event.preventDefault()
      toggleTarget()
    }

    return {
      className,
      onClick: toggleTarget,
      onKeyDown,
      tabIndex: 0,
      role: 'button',
      ariaPressed: isSelected,
    }
  }

  const animationSignature = `${currentExampleName}-${safeQueryIndex}-${totalSteps}-${selectedTokenRows.length}`

  useEffect(() => {
    const flowLayer = flowLayerRef.current
    if (!flowLayer) {
      return undefined
    }

    const resetRevealState = () => {
      setOutputStep(0)
      setIsTraceReady(false)
      setDisplayedWeights(Array.from({ length: weightRows.length }, () => 0))
      setDisplayedOutput(Array.from({ length: headDim }, () => 0))
      setDisplayedMhaOutput(Array.from({ length: nEmbd }, () => 0))
      setDisplayedResultVector(Array.from({ length: nEmbd }, () => 0))
      setDisplayedBlockOutputVector(Array.from({ length: nEmbd }, () => 0))
      setDisplayedLogits(Array.from({ length: selectedTokenRows.length }, () => 0))
      setDisplayedProbs(Array.from({ length: selectedTokenRows.length }, () => 0))
      setRevealedXDims(createRevealVector(currentXRows.length))
      setRevealedQDims(createRevealVector(headDim))
      setRevealedKCells(createRevealMatrixWithVisibleRows(keyRows.length, headDim, currentKeyRowIndex))
      setRevealedVCells(createRevealMatrixWithVisibleRows(valueRows.length, headDim, currentKeyRowIndex))
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

    const showFinalStateImmediately = ({ markAnimationDone = true, traceReady = true } = {}) => {
      setOutputStep(totalSteps)
      if (markAnimationDone) {
        setIsAnimating(false)
      }
      setIsTraceReady(traceReady)
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

    const resetReplayStageState = (scope) => {
      switch (scope) {
        case 'stage-qkv':
          setRevealedQDims(createRevealVector(headDim))
          setRevealedKCells(createRevealMatrixWithVisibleRows(keyRows.length, headDim, currentKeyRowIndex))
          setRevealedVCells(createRevealMatrixWithVisibleRows(valueRows.length, headDim, currentKeyRowIndex))
          return
        case 'stage-weights':
          setRevealedWeights(createRevealVector(weightRows.length))
          setDisplayedWeights(Array.from({ length: weightRows.length }, () => 0))
          return
        case 'stage-output':
          setOutputStep(0)
          setRevealedContribCells(createRevealMatrix(weightedVRows.length, headDim))
          setRevealedOutputDims(createRevealVector(headDim))
          setDisplayedOutput(Array.from({ length: headDim }, () => 0))
          return
        case 'stage-heads':
          setRevealedHeadOutputCells(createRevealMatrix(nHead, headDim))
          return
        case 'stage-mha':
          setRevealedMhaInputDims(createRevealVector(nEmbd))
          setRevealedMhaOutputDims(createRevealVector(nEmbd))
          setDisplayedMhaOutput(Array.from({ length: nEmbd }, () => 0))
          return
        case 'stage-result':
          setRevealedResultDims(createRevealVector(nEmbd))
          setDisplayedResultVector(Array.from({ length: nEmbd }, () => 0))
          return
        case 'stage-block-output':
          setRevealedBlockOutputDims(createRevealVector(nEmbd))
          setDisplayedBlockOutputVector(Array.from({ length: nEmbd }, () => 0))
          return
        case 'stage-logit':
          setRevealedLogitRows(createRevealVector(selectedTokenRows.length))
          setDisplayedLogits(Array.from({ length: selectedTokenRows.length }, () => 0))
          return
        case 'stage-prob':
          setRevealedProbRows(createRevealVector(selectedTokenRows.length))
          setDisplayedProbs(Array.from({ length: selectedTokenRows.length }, () => 0))
          return
        default:
          return
      }
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

    const currentKNode = kRowRefs.current[keyRows.length - 1]
    const currentVNode = vRowRefs.current[valueRows.length - 1]
    const flowLayerRect = flowLayer.getBoundingClientRect()
    const centerPointCache = new Map()
    const createdNodes = []
    const clearTransientAnimationArtifacts = () => {
      createdNodes.forEach((node) => node.remove())
      createdNodes.length = 0
      flowLayer.innerHTML = ''
      clearTempClasses()
    }
    const timeline = gsap.timeline({
      paused: true,
      onStart: () => {
        setIsAnimating(true)
      },
      onComplete: () => {
        showFinalStateImmediately()
        clearTransientAnimationArtifacts()
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

    const playTimelineForScope = (scopeRanges) => {
      if (animationScope === 'all') {
        resetRevealState()
        timeline.play(0)
        return
      }

      const targetRange = scopeRanges[animationScope]
      if (!targetRange) {
        resetRevealState()
        timeline.play(0)
        return
      }

      showFinalStateImmediately({ markAnimationDone: false, traceReady: false })
      resetReplayStageState(animationScope)
      const safeStart = Math.max(0, Number(targetRange.start) || 0)
      const safeEnd = Number.isFinite(targetRange.end) ? Number(targetRange.end) : timeline.duration()
      timeline.tweenFromTo(safeStart, Math.max(safeStart, safeEnd), {
        onStart: () => {
          setIsAnimating(true)
          setIsTraceReady(false)
        },
        onComplete: () => {
          showFinalStateImmediately()
          clearTransientAnimationArtifacts()
        },
      })
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
        revealKCellAt(currentKeyRowIndex, dimIndex, reducedStart + 0.11 + dimIndex * 0.02)
        revealVCellAt(currentKeyRowIndex, dimIndex, reducedStart + 0.13 + dimIndex * 0.02)
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

      playTimelineForScope({
        'stage-qkv': { start: reducedStart, end: weightStageStart },
        'stage-weights': { start: weightStageStart, end: outputStageStart },
        'stage-output': { start: outputStageStart, end: headStageStart },
        'stage-heads': { start: headStageStart, end: concatStageStart },
        'stage-mha': { start: concatStageStart, end: resultStageStart },
        'stage-result': { start: resultStageStart, end: mlpStageStart },
        'stage-block-output': { start: mlpStageStart, end: logitStageStart },
        'stage-logit': { start: logitStageStart, end: softmaxStageStart },
        'stage-prob': { start: softmaxStageStart, end: timeline.duration() },
      })

      return () => {
        timeline.kill()
        timelineRef.current = null
        clearTransientAnimationArtifacts()
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
      revealKCellAt(currentKeyRowIndex, dimIndex, stageBStart + 0.13 + dimIndex * 0.02)
      revealVCellAt(currentKeyRowIndex, dimIndex, stageBStart + 0.17 + dimIndex * 0.02)
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

    playTimelineForScope({
      'stage-qkv': { start: stageBStart, end: stageCStart },
      'stage-weights': { start: stageCStart, end: stageDStart },
      'stage-output': { start: stageDStart, end: stageEStart },
      'stage-heads': { start: stageEStart, end: stageGStart },
      'stage-mha': { start: stageGStart, end: stageHStart },
      'stage-result': { start: stageHStart, end: stageIStart },
      'stage-block-output': { start: stageIStart, end: stageJStart },
      'stage-logit': { start: stageJStart, end: stageKStart },
      'stage-prob': { start: stageKStart, end: timeline.duration() },
    })

    return () => {
      timeline.kill()
      timelineRef.current = null
      clearTransientAnimationArtifacts()
    }
  }, [animationScope, animationTick, animationSignature, currentXRows.length, hasAttentionData, headDim, nEmbd, nHead, reducedMotion, skipAnimations]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const traceLayerNode = traceLayerRef.current
    const containerNode = pipelineContentRef.current
    if (!traceLayerNode || !containerNode) {
      return undefined
    }

    let highlightedSourceNodes = []

    const clearSourceHighlights = () => {
      highlightedSourceNodes.forEach((node) => {
        node.classList.remove('attention-trace-source--active', 'attention-source-summary-node--active')
      })
      highlightedSourceNodes = []
    }

    const clearTraceLayer = () => {
      traceLayerNode.innerHTML = ''
      clearSourceHighlights()
    }

    const drawTrace = () => {
      clearTraceLayer()

      if (!isTraceReady || isAnimating || !activeTraceTarget) {
        return
      }

      const targetNode = resolveTraceTargetNode(activeTraceTarget)
      if (!targetNode) {
        return
      }

      const targetKey = getTraceTargetKey(activeTraceTarget)
      const sourceNodes = resolveTraceSourceNodes(activeTraceTarget)
        .filter((node) => node && node !== targetNode)
        .filter((node, index, nodes) => nodes.indexOf(node) === index)

      if (!targetKey || !sourceNodes.length) {
        return
      }

      sourceNodes.forEach((sourceNode) => {
        sourceNode.classList.add('attention-trace-source--active')
        if (sourceNode.classList.contains('attention-source-summary-node')) {
          sourceNode.classList.add('attention-source-summary-node--active')
        }
      })
      highlightedSourceNodes = sourceNodes

      const layerRect = traceLayerNode.getBoundingClientRect()
      const getPoint = (node) => {
        const rect = node.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) {
          return null
        }
        return {
          x: rect.left + rect.width * 0.5 - layerRect.left,
          y: rect.top + rect.height * 0.5 - layerRect.top,
        }
      }

      const targetPoint = getPoint(targetNode)
      if (!targetPoint) {
        return
      }

      sourceNodes.forEach((sourceNode, sourceIndex) => {
        const sourcePoint = getPoint(sourceNode)
        if (!sourcePoint) {
          return
        }
        const distance = Math.hypot(targetPoint.x - sourcePoint.x, targetPoint.y - sourcePoint.y)
        const angle = (Math.atan2(targetPoint.y - sourcePoint.y, targetPoint.x - sourcePoint.x) * 180) / Math.PI

        const line = document.createElement('span')
        line.className = 'attention-trace-line'
        line.style.left = `${sourcePoint.x}px`
        line.style.top = `${sourcePoint.y}px`
        line.style.width = `${distance}px`
        line.style.transform = `translateY(-50%) rotate(${angle}deg)`
        line.style.animationDelay = `${Math.min(180, sourceIndex * 22)}ms`
        traceLayerNode.appendChild(line)
      })
    }

    drawTrace()

    const onResize = () => {
      drawTrace()
    }
    window.addEventListener('resize', onResize)

    let resizeObserver = null
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(() => {
        drawTrace()
      })
      resizeObserver.observe(containerNode)
    }

    return () => {
      window.removeEventListener('resize', onResize)
      resizeObserver?.disconnect()
      clearTraceLayer()
    }
  }, [activeTraceTarget, activeTraceTargetKey, animationTick, isAnimating, isTraceReady, safeQueryIndex]) // eslint-disable-line react-hooks/exhaustive-deps

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

      const topToHead = `M ${topOutPoint.x} ${topOutPoint.y} C ${topOutPoint.x} ${topOutPoint.y + 42}, ${headPoint.x} ${headPoint.y - 42
        }, ${headPoint.x} ${headPoint.y}`
      const xToResult = `M ${xPoint.x} ${xPoint.y} C ${xPoint.x - 110} ${xPoint.y + 92}, ${resultPoint.x - 40} ${resultPoint.y - 92
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
      if (safeExampleNames.length <= 1) {
        return 0
      }
      return (prevIndex + direction + safeExampleNames.length) % safeExampleNames.length
    })
    setAnimationScope('all')
    setActiveTraceTarget(null)
    setIsTraceReady(false)
    setQueryIndex(0)
    setOpenInfoKey(null)
    setAnimationTick((prevTick) => prevTick + 1)
  }

  const moveQueryIndex = (direction) => {
    setQueryIndex((prevIndex) => {
      return clamp(prevIndex + direction, 0, Math.max(0, modelSequence.length - 1))
    })
    setAnimationScope('all')
    setActiveTraceTarget(null)
    setIsTraceReady(false)
    setOpenInfoKey(null)
    setAnimationTick((prevTick) => prevTick + 1)
  }

  const triggerReplay = (scope = 'all') => {
    if (skipAnimations) {
      return
    }
    setAnimationScope(scope)
    setActiveTraceTarget(null)
    setIsTraceReady(false)
    setOpenInfoKey(null)
    setAnimationTick((prevTick) => prevTick + 1)
  }

  const replayAnimation = () => {
    triggerReplay('all')
  }

  const toggleSkipAnimations = () => {
    setAnimationScope('all')
    setActiveTraceTarget(null)
    setIsTraceReady(false)
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
      traceTargetFactory = null,
    } = {},
  ) => {
    return (
      <div className={`attention-vector-grid ${dense ? 'attention-vector-grid--16' : 'attention-vector-grid--4'}`}>
        {vector.map((value, dimIndex) => {
          const numericValue = Number(value ?? 0)
          const ratio = clamp(Math.abs(numericValue) / maxAbs, 0, 1)
          const isVisible = !Array.isArray(visibleMask) || Boolean(visibleMask[dimIndex])
          const traceTarget = traceTargetFactory ? traceTargetFactory(dimIndex) : null
          const traceProps = traceTarget ? buildTraceInteractionProps(traceTarget, isVisible) : null
          return (
            <span
              key={`${keyPrefix}-${dimIndex}`}
              ref={cellRefFactory ? cellRefFactory(dimIndex) : undefined}
              className={`attention-cell ${dense ? 'attention-cell--dense' : ''} ${cellClassName} ${isVisible ? '' : `attention-cell--hidden ${hiddenClassName}`
                } ${traceProps?.className ?? ''} ${valueTextClass}`.trim()}
              onClick={traceProps?.onClick}
              onKeyDown={traceProps?.onKeyDown}
              tabIndex={traceProps?.tabIndex}
              role={traceProps?.role}
              aria-pressed={traceProps?.ariaPressed}
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
      traceTargetFactory = null,
    } = {},
  ) => {
    return (
      <div className={`attention-vector-column ${dense ? 'attention-vector-column--dense16' : ''}`.trim()}>
        {vector.map((value, dimIndex) => {
          const numericValue = Number(value ?? 0)
          const ratio = clamp(Math.abs(numericValue) / maxAbs, 0, 1)
          const isVisible = !Array.isArray(visibleMask) || Boolean(visibleMask[dimIndex])
          const traceTarget = traceTargetFactory ? traceTargetFactory(dimIndex) : null
          const traceProps = traceTarget ? buildTraceInteractionProps(traceTarget, isVisible) : null
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
                className={`attention-vector-line-value attention-cell ${dense ? 'attention-vector-line-value--dense16' : ''} ${isVisible ? '' : `attention-value--hidden ${hiddenClassName}`
                  } ${traceProps?.className ?? ''} ${valueTextClass}`.trim()}
                onClick={traceProps?.onClick}
                onKeyDown={traceProps?.onKeyDown}
                tabIndex={traceProps?.tabIndex}
                role={traceProps?.role}
                aria-pressed={traceProps?.ariaPressed}
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
    const canReplayStage = STAGE_REPLAY_KEYS.includes(key)
    const isStageReplayActive = isAnimating && animationScope === key
    return (
      <div className="attention-stage-head">
        <p className="attention-stage-title">{title}</p>
        <div className="attention-stage-head-right">
          {badge ? <span className="attention-stage-badge">{badge}</span> : null}
          {canReplayStage ? (
            <button
              type="button"
              className={`attention-stage-replay-btn ${isStageReplayActive ? 'attention-stage-replay-btn--active' : ''}`}
              onClick={() => triggerReplay(key)}
              aria-label={copy.chapter4.replayStageAria(title)}
              aria-disabled={skipAnimations}
              disabled={skipAnimations}
            >

              <svg viewBox="0 0 24 24" className="attention-stage-replay-icon" aria-hidden="true" focusable="false">
                <g clip-path="url(#clip0_429_11071)">
                  <path d="M12 2.99982C16.9706 2.99982 21 7.02925 21 11.9998C21 16.9704 16.9706 20.9998 12 20.9998C7.02944 20.9998 3 16.9704 3 11.9998C3 9.17255 4.30367 6.64977 6.34267 4.99982" stroke="black" 
                  stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M3 4.49982H7V8.49982" stroke="black" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
                </g>
                <defs>
                  <clipPath id="clip0_429_11071">
                    <rect width="24" height="24" fill="white" />
                  </clipPath>
                </defs>
              </svg>
            </button>
          ) : null}
          <div className="attention-help-wrap">
            <button
              type="button"
              className="attention-help-btn"
              onClick={() => {
                setOpenInfoKey((prevKey) => (prevKey === key ? null : key))
              }}
              aria-label={copy.chapter4.conceptAria(title)}
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
          <p className="attention-nav-title">{copy.chapter4.exampleNameTitle}</p>
          <div className="attention-nav-inner">
            <button
              type="button"
              className="attention-nav-arrow"
              onClick={() => moveExampleName(-1)}
              aria-label={copy.chapter4.prevExampleNameAria}
            >
              <span className="attention-nav-arrow-shape attention-nav-arrow-shape-left" />
            </button>
            <p className="attention-nav-pill">
              <span className="attention-nav-pill-char">{displayExampleName || '-'}</span>
              <span className="attention-nav-pill-meta">{`POS 0 ~ ${Math.max(0, modelSequence.length - 1)}`}</span>
            </p>
            <button
              type="button"
              className="attention-nav-arrow"
              onClick={() => moveExampleName(1)}
              aria-label={copy.chapter4.nextExampleNameAria}
            >
              <span className="attention-nav-arrow-shape attention-nav-arrow-shape-right" />
            </button>
          </div>
        </div>

        <div className="attention-nav">
          <p className="attention-nav-title">{copy.chapter4.targetIndexTitle}</p>
          <div className="attention-nav-inner">
            <button
              type="button"
              className="attention-nav-arrow"
              onClick={() => moveQueryIndex(-1)}
              aria-label={copy.chapter4.prevTargetIndexAria}
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
              aria-label={copy.chapter4.nextTargetIndexAria}
            >
              <span className="attention-nav-arrow-shape attention-nav-arrow-shape-right" />
            </button>
          </div>
        </div>

        <button
          type="button"
          className={`attention-replay-btn ${isAnimating && animationScope === 'all' ? 'attention-replay-btn--active' : ''}`}
          onClick={replayAnimation}
          aria-label={copy.chapter4.replayAria}
          aria-disabled={skipAnimations}
          disabled={skipAnimations}
        >
          {isAnimating && animationScope === 'all' ? 'PLAYING...' : 'REPLAY'}
        </button>

        <button
          type="button"
          className={`attention-skip-btn ${skipAnimations ? 'attention-skip-btn--active' : ''}`}
          onClick={toggleSkipAnimations}
          aria-label={copy.chapter4.skipAria}
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
                infoBody: copy.chapter4.finalEmbeddingInfoBody,
              })}

              <div className="attention-stage-body">
                <article ref={xVectorRef} className="attention-row attention-row--query">
                  <p className={`attention-row-label ${valueTextClass}`}>{`POS ${safeQueryIndex} · ${queryToken?.label ?? ''}`}</p>
                  <div className="attention-vector-column">
                    {currentXRows.map((row) => {
                      const ratio = clamp(Math.abs(row.value) / maxAbs, 0, 1)
                      const isVisible = Boolean(revealedXDims[row.dim])
                      const traceProps = buildTraceInteractionProps({ kind: 'x', dimIndex: row.dim }, isVisible)
                      return (
                        <div key={`x-line-${row.dim}`} className="attention-vector-line">
                          <span className={`attention-vector-line-dim ${valueTextClass}`}>{row.dim}</span>
                          <span
                            ref={(node) => {
                              xValueRefs.current[row.dim] = node
                            }}
                            className={`attention-vector-line-value ${!isVisible ? 'attention-value--hidden' : ''} ${traceProps.className
                              } ${valueTextClass}`.trim()}
                            onClick={traceProps.onClick}
                            onKeyDown={traceProps.onKeyDown}
                            tabIndex={traceProps.tabIndex}
                            role={traceProps.role}
                            aria-pressed={traceProps.ariaPressed}
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
                infoBody: copy.chapter4.qkvInfoBody,
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
                        traceTargetFactory: (dimIndex) => ({ kind: 'q', dimIndex }),
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
                          <div className="attention-row-source-summary">
                            <span
                              ref={(node) => {
                                kSourceSummaryRefs.current[rowIndex] = node
                              }}
                              className={`attention-source-summary-node ${valueTextClass}`}
                            >
                              {`FROM x (POS ${row.position})`}
                            </span>
                          </div>
                          {renderVectorCells(row.vector, `k-${row.position}`, {
                            cellRefFactory: (dimIndex) => (node) => {
                              if (!kCellRefs.current[rowIndex]) {
                                kCellRefs.current[rowIndex] = []
                              }
                              kCellRefs.current[rowIndex][dimIndex] = node
                            },
                            visibleMask: revealedKCells[rowIndex] ?? [],
                            traceTargetFactory: (dimIndex) => ({ kind: 'k', rowIndex, dimIndex }),
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
                          <div className="attention-row-source-summary">
                            <span
                              ref={(node) => {
                                vSourceSummaryRefs.current[rowIndex] = node
                              }}
                              className={`attention-source-summary-node ${valueTextClass}`}
                            >
                              {`FROM x (POS ${row.position})`}
                            </span>
                          </div>
                          {renderVectorCells(row.vector, `v-${row.position}`, {
                            cellRefFactory: (dimIndex) => (node) => {
                              if (!vCellRefs.current[rowIndex]) {
                                vCellRefs.current[rowIndex] = []
                              }
                              vCellRefs.current[rowIndex][dimIndex] = node
                            },
                            visibleMask: revealedVCells[rowIndex] ?? [],
                            traceTargetFactory: (dimIndex) => ({ kind: 'v', rowIndex, dimIndex }),
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
                infoBody: copy.chapter4.attentionWeightsInfoBody,
              })}

              <div className="attention-stage-body">
                <div className="attention-weights-list">
                  {weightRows.map((row, rowIndex) => {
                    const displayedWeight = Number(displayedWeights[rowIndex] ?? 0)
                    const color = getHeatColor(displayedWeight, 1)
                    const useLightText = displayedWeight >= 0.7
                    const isVisible = Boolean(revealedWeights[rowIndex])
                    const traceProps = buildTraceInteractionProps({ kind: 'weight', rowIndex }, isVisible)
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
                          className={`attention-weight-values ${!isVisible ? 'attention-weight-value--hidden' : ''} ${traceProps.className
                            } ${valueTextClass}`.trim()}
                          onClick={traceProps.onClick}
                          onKeyDown={traceProps.onKeyDown}
                          tabIndex={traceProps.tabIndex}
                          role={traceProps.role}
                          aria-pressed={traceProps.ariaPressed}
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
                infoBody: copy.chapter4.attentionOutputInfoBody,
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
                        traceTargetFactory: (dimIndex) => ({ kind: 'contrib', rowIndex, dimIndex }),
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
                    traceTargetFactory: (dimIndex) => ({ kind: 'output', dimIndex }),
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
                  infoBody: copy.chapter4.headOutputsInfoBody,
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
                            className={`attention-head-summary-node attention-source-summary-node ${valueTextClass}`}
                          >
                            Q{headIdx}
                          </span>
                          <span
                            ref={(node) => {
                              headSummaryKRefs.current[headIdx] = node
                            }}
                            className={`attention-head-summary-node attention-source-summary-node ${valueTextClass}`}
                          >
                            K{headIdx}
                          </span>
                          <span
                            ref={(node) => {
                              headSummaryVRefs.current[headIdx] = node
                            }}
                            className={`attention-head-summary-node attention-source-summary-node ${valueTextClass}`}
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
                        traceTargetFactory: (dimIndex) => ({ kind: 'head-output', headIndex: headIdx, dimIndex }),
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
                  infoBody: copy.chapter4.multiHeadOutputInfoBody,
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
                        traceTargetFactory: (dimIndex) => ({ kind: 'mha-input', dimIndex }),
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
                        traceTargetFactory: (dimIndex) => ({ kind: 'mha-output', dimIndex }),
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
                  infoBody: copy.chapter4.attentionBlockResultInfoBody,
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
                      traceTargetFactory: (dimIndex) => ({ kind: 'result', dimIndex }),
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
                  infoBody: copy.chapter4.transformerBlockOutputInfoBody,
                })}
                <div className="attention-stage-body">
                  <article ref={blockOutputRowRef} className="attention-row attention-row--output">
                    {renderVectorColumn(displayedBlockOutput, 'transformer-block-output-col', {
                      dense: true,
                      cellRefFactory: (dimIndex) => (node) => {
                        blockOutputCellRefs.current[dimIndex] = node
                      },
                      visibleMask: revealedBlockOutputDims,
                      traceTargetFactory: (dimIndex) => ({ kind: 'block-output', dimIndex }),
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
                  infoBody: copy.chapter4.logitInfoBody,
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
                      const traceProps = buildTraceInteractionProps({ kind: 'logit', rowIndex }, isVisible)
                      return (
                        <article
                          key={`logit-row-${row.tokenId}`}
                          ref={(node) => {
                            logitRowRefs.current[rowIndex] = node
                          }}
                          className="attention-token-row attention-row"
                        >
                          <span
                            className={`attention-token-meta ${!isVisible ? 'attention-token-meta--hidden' : ''
                              } ${valueTextClass}`.trim()}
                          >
                            {isVisible ? tokenLabel : ATTENTION_HIDDEN_PLACEHOLDER}
                          </span>
                          <span
                            ref={(node) => {
                              logitValueRefs.current[rowIndex] = node
                            }}
                            className={`attention-token-value ${!isVisible ? 'attention-weight-value--hidden' : ''
                              } ${traceProps.className} ${valueTextClass}`.trim()}
                            onClick={traceProps.onClick}
                            onKeyDown={traceProps.onKeyDown}
                            tabIndex={traceProps.tabIndex}
                            role={traceProps.role}
                            aria-pressed={traceProps.ariaPressed}
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
                  infoBody: copy.chapter4.nextTokenProbabilityInfoBody,
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
                      const traceProps = buildTraceInteractionProps({ kind: 'prob', rowIndex }, isVisible)
                      return (
                        <article
                          key={`prob-row-${row.tokenId}`}
                          ref={(node) => {
                            probRowRefs.current[rowIndex] = node
                          }}
                          className="attention-token-row attention-row"
                        >
                          <span
                            className={`attention-token-meta ${!isVisible ? 'attention-token-meta--hidden' : ''
                              } ${valueTextClass}`.trim()}
                          >
                            {isVisible ? tokenLabel : ATTENTION_HIDDEN_PLACEHOLDER}
                          </span>
                          <span
                            ref={(node) => {
                              probValueRefs.current[rowIndex] = node
                            }}
                            className={`attention-token-value ${!isVisible ? 'attention-weight-value--hidden' : ''
                              } ${traceProps.className} ${valueTextClass}`.trim()}
                            onClick={traceProps.onClick}
                            onKeyDown={traceProps.onKeyDown}
                            tabIndex={traceProps.tabIndex}
                            role={traceProps.role}
                            aria-pressed={traceProps.ariaPressed}
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

          <div ref={traceLayerRef} className="attention-trace-layer" aria-hidden="true" />
          <div ref={flowLayerRef} className="attention-flow-layer" aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}


export default ChapterFourAttentionDemo
