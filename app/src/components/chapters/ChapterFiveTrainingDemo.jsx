import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import {
  ATTENTION_HIDDEN_PLACEHOLDER,
  CHAPTER_FOUR_EXAMPLE_NAMES,
  EMBEDDING_NEGATIVE_BASE,
  EMBEDDING_NEGATIVE_STRONG,
  EMBEDDING_POSITIVE_BASE,
  EMBEDDING_POSITIVE_STRONG,
} from './shared/chapterConstants'
import {
  clamp,
  createRevealVector,
  decomposeKoreanNameToNfdTokens,
  dotProduct,
  getHeatColor,
  getInferenceTokenDisplay,
  getRoleLabel,
  interpolateHexColor,
  matVec,
  rmsNormVector,
  sliceHead,
  softmaxNumbers,
} from './shared/chapterUtils'
import SectionStateCard from '../common/SectionStateCard'

function ChapterFiveTrainingDemo({ snapshot, reducedMotion, isMobile, copy }) {
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
  const [targetIndex, setTargetIndex] = useState(0)
  const [animationTick, setAnimationTick] = useState(1)
  const [isAnimating, setIsAnimating] = useState(false)
  const [skipAnimations, setSkipAnimations] = useState(false)
  const [revealedPosColumns, setRevealedPosColumns] = useState([])
  const [revealedTargetRows, setRevealedTargetRows] = useState([])
  const [revealedLossCards, setRevealedLossCards] = useState([])
  const [isMeanVisible, setIsMeanVisible] = useState(false)
  const [revealedBackpropLossCards, setRevealedBackpropLossCards] = useState([])
  const [revealedBackpropProbCards, setRevealedBackpropProbCards] = useState([])
  const [isBackpropLogitVisible, setIsBackpropLogitVisible] = useState(false)
  const [isBackpropVectorsVisible, setIsBackpropVectorsVisible] = useState(false)
  const [isBackpropBridgeVisible, setIsBackpropBridgeVisible] = useState(false)
  const [isBackpropSumEmbeddingVisible, setIsBackpropSumEmbeddingVisible] = useState(false)
  const [isBackpropEmbeddingPairVisible, setIsBackpropEmbeddingPairVisible] = useState(false)
  const probColumnRefs = useRef([])
  const targetRowRefs = useRef([])
  const lossCardRefs = useRef([])
  const meanCardRef = useRef(null)
  const backpropLossCardRefs = useRef([])
  const backpropProbCardRefs = useRef([])
  const backpropLogitRef = useRef(null)
  const backpropBlockVectorRef = useRef(null)
  const backpropLmHeadVectorRef = useRef(null)
  const backpropBridgeRef = useRef(null)
  const backpropSumEmbeddingRef = useRef(null)
  const backpropTokenEmbeddingRef = useRef(null)
  const backpropPositionEmbeddingRef = useRef(null)
  const backpropLossScrollRef = useRef(null)
  const backpropProbScrollRef = useRef(null)
  const backpropVectorRowRef = useRef(null)
  const backpropSumEmbeddingScrollRef = useRef(null)
  const backpropTokenEmbeddingScrollRef = useRef(null)
  const backpropPositionEmbeddingScrollRef = useRef(null)
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
          label: `${getRoleLabel(token.roleKey, copy.roles)} ${token.display}`.trim(),
          position: index + 1,
          isBos: false,
        },
      ]
    })

    const sequence = [
      { id: 'bos', tokenId: bos, label: '[BOS]', position: 0, isBos: true },
      ...phonemeTokens,
      { id: 'bos-end', tokenId: bos, label: '[BOS]', position: phonemeTokens.length + 1, isBos: true },
    ]

    return sequence.slice(0, Math.min(blockSize, sequence.length))
  }, [blockSize, bos, copy.roles, currentExampleName, isShapeValid, stoi])

  const sumEmbeddingVectors = useMemo(() => {
    return modelSequence.map((item) => {
      const tokenRow = wte[item.tokenId] ?? []
      const positionRow = wpe[item.position] ?? []
      return Array.from({ length: nEmbd }, (_, index) => Number(tokenRow[index] ?? 0) + Number(positionRow[index] ?? 0))
    })
  }, [modelSequence, nEmbd, wpe, wte])

  const xVectors = useMemo(() => {
    return sumEmbeddingVectors.map((sumVector) => rmsNormVector(sumVector))
  }, [sumEmbeddingVectors])

  const formatChapterFiveTokenLabel = useCallback(
    (tokenId) => {
      const includeRole = !isMobile
      return getInferenceTokenDisplay(tokenId, tokenChars, bos, includeRole, copy.roles)
    },
    [bos, copy.roles, isMobile, tokenChars],
  )

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
      const residualVector = currentXVector.map((value, dimIndex) => Number(value ?? 0) + Number(mhaOutputVector[dimIndex] ?? 0))
      const xNormVector = rmsNormVector(residualVector)
      const mlpHiddenVector = matVec(xNormVector, mlpFc1)
      const mlpReluVector = mlpHiddenVector.map((value) => Math.max(0, Number(value ?? 0)))
      const mlpLinearVector = matVec(mlpReluVector, mlpFc2)
      const blockOutputVector = residualVector.map((value, dimIndex) => Number(value ?? 0) + Number(mlpLinearVector[dimIndex] ?? 0))
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
        targetLabel: formatChapterFiveTokenLabel(targetTokenId),
        targetProb,
        tokenLoss: -Math.log(Math.max(targetProb, 1e-12)),
        probVector,
        blockOutputVector,
        sortedTokenIds,
        windowStart,
        windowEnd,
        candidateRows: windowTokenIds.map((tokenId, offset) => ({
          tokenId,
          label: formatChapterFiveTokenLabel(tokenId),
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
    headDim,
    isShapeValid,
    lmHead,
    mlpFc1,
    mlpFc2,
    modelSequence,
    nEmbd,
    nHead,
    formatChapterFiveTokenLabel,
    xVectors,
  ])
  const safeTargetIndex = trainingRows.length ? clamp(targetIndex, 0, trainingRows.length - 1) : 0

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

  const backpropData = useMemo(() => {
    if (!trainingRows.length) {
      return {
        perPos: [],
        selectedLogitRows: [],
        selectedLogitTopEllipsis: false,
        selectedLogitBottomEllipsis: false,
        selectedBlockOutputGrad: [],
        lmHeadDisplayItems: [],
        embeddingPosIndices: [],
        sumEmbeddingGradMatrix: [],
        tokenEmbeddingGradMatrix: [],
        positionEmbeddingGradMatrix: [],
        absMax: 1e-8,
      }
    }

    const positionCount = trainingRows.length
    const scale = 1 / positionCount
    const perPos = trainingRows.map((row) => {
      const targetProb = Math.max(Number(row.targetProb ?? 0), 1e-12)
      return {
        pos: row.pos,
        dMean_dLoss: scale,
        dMean_dTargetProb: -(scale / targetProb),
      }
    })

    const selectedRow = trainingRows[safeTargetIndex]
    if (!selectedRow) {
      return {
        perPos,
        selectedLogitRows: [],
        selectedLogitTopEllipsis: false,
        selectedLogitBottomEllipsis: false,
        selectedBlockOutputGrad: [],
        lmHeadDisplayItems: [],
        embeddingPosIndices: [],
        sumEmbeddingGradMatrix: [],
        tokenEmbeddingGradMatrix: [],
        positionEmbeddingGradMatrix: [],
        absMax: Math.max(
          1e-8,
          ...perPos.map((row) => Math.abs(Number(row.dMean_dTargetProb ?? 0))),
          ...perPos.map((row) => Math.abs(Number(row.dMean_dLoss ?? 0))),
        ),
      }
    }

    const targetId = Number(selectedRow.targetTokenId ?? -1)
    const probs = Array.isArray(selectedRow.probVector) ? selectedRow.probVector : []
    const dMean_dLogits = probs.map((prob, tokenId) => {
      const y = tokenId === targetId ? 1 : 0
      return scale * (Number(prob ?? 0) - y)
    })

    const selectedLogitRows = selectedRow.candidateRows.map((row) => {
      const grad = Number(dMean_dLogits[row.tokenId] ?? 0)
      return {
        ...row,
        grad,
      }
    })
    const selectedLogitTopEllipsis = Number(selectedRow.windowStart ?? 0) > 0
    const selectedLogitBottomEllipsis = Number(selectedRow.windowEnd ?? 0) < Number(selectedRow.sortedTokenIds?.length ?? 0)

    const selectedBlockOutputGrad = Array.from({ length: nEmbd }, (_, dimIndex) => {
      return dMean_dLogits.reduce((accumulator, grad, tokenId) => {
        return accumulator + Number(lmHead[tokenId]?.[dimIndex] ?? 0) * Number(grad ?? 0)
      }, 0)
    })

    const visibleTokenIds = [...new Set([0, targetId, dMean_dLogits.length - 1].filter((tokenId) => tokenId >= 0 && tokenId < dMean_dLogits.length))].sort(
      (left, right) => left - right,
    )
    const lmHeadDisplayItems = []
    visibleTokenIds.forEach((tokenId, index) => {
      if (index > 0 && tokenId - visibleTokenIds[index - 1] > 1) {
        lmHeadDisplayItems.push({
          type: 'ellipsis',
          key: `lmhead-gap-${visibleTokenIds[index - 1]}-${tokenId}`,
        })
      }
      const logitGrad = Number(dMean_dLogits[tokenId] ?? 0)
      lmHeadDisplayItems.push({
        type: 'column',
        key: `lmhead-col-${tokenId}`,
        tokenId,
        label: formatChapterFiveTokenLabel(tokenId),
        isTarget: tokenId === targetId,
        values: Array.from({ length: nEmbd }, (_, dimIndex) => {
          return logitGrad * Number(selectedRow.blockOutputVector?.[dimIndex] ?? 0)
        }),
      })
    })

    const embeddingPosIndices = Array.from({ length: Math.max(0, safeTargetIndex + 1) }, (_, posIndex) => posIndex)
    const epsilon = 1e-3
    const zeroVector = Array.from({ length: nEmbd }, () => 0)
    const selectedPos = safeTargetIndex
    const selectedTargetTokenId = Number(modelSequence[selectedPos + 1]?.tokenId ?? -1)

    const computeSelectedMeanBranchLoss = (inputSumEmbeddingVectors) => {
      if (selectedPos < 0 || selectedPos >= inputSumEmbeddingVectors.length || selectedTargetTokenId < 0) {
        return 0
      }

      const xVectorsForEval = inputSumEmbeddingVectors.map((sumVector) => rmsNormVector(sumVector))
      const currentXVector = xVectorsForEval[selectedPos] ?? zeroVector
      const queryFullVector = matVec(currentXVector, attnWq)
      const keyFullRows = xVectorsForEval.slice(0, selectedPos + 1).map((vector) => matVec(vector, attnWk))
      const valueFullRows = xVectorsForEval.slice(0, selectedPos + 1).map((vector) => matVec(vector, attnWv))

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
      const probVector = softmaxNumbers(logitsVector)
      const targetProb = Number(probVector[selectedTargetTokenId] ?? 0)
      const tokenLoss = -Math.log(Math.max(targetProb, 1e-12))
      return tokenLoss * scale
    }

    const sumEmbeddingGradMatrix = embeddingPosIndices.map((posIndex) => {
      return Array.from({ length: nEmbd }, (_, dimIndex) => {
        const plusVectors = sumEmbeddingVectors.map((vector, rowIndex) => {
          if (rowIndex !== posIndex) {
            return vector
          }
          const nextVector = [...vector]
          nextVector[dimIndex] = Number(nextVector[dimIndex] ?? 0) + epsilon
          return nextVector
        })
        const minusVectors = sumEmbeddingVectors.map((vector, rowIndex) => {
          if (rowIndex !== posIndex) {
            return vector
          }
          const nextVector = [...vector]
          nextVector[dimIndex] = Number(nextVector[dimIndex] ?? 0) - epsilon
          return nextVector
        })
        const plusLoss = computeSelectedMeanBranchLoss(plusVectors)
        const minusLoss = computeSelectedMeanBranchLoss(minusVectors)
        const grad = (plusLoss - minusLoss) / (2 * epsilon)
        return Number.isFinite(grad) ? grad : 0
      })
    })
    const tokenEmbeddingGradMatrix = sumEmbeddingGradMatrix.map((row) => [...row])
    const positionEmbeddingGradMatrix = sumEmbeddingGradMatrix.map((row) => [...row])

    const absMax = Math.max(
      1e-8,
      ...perPos.map((row) => Math.abs(Number(row.dMean_dTargetProb ?? 0))),
      ...perPos.map((row) => Math.abs(Number(row.dMean_dLoss ?? 0))),
      ...selectedLogitRows.map((row) => Math.abs(Number(row.grad ?? 0))),
      ...selectedBlockOutputGrad.map((value) => Math.abs(Number(value ?? 0))),
      ...lmHeadDisplayItems.flatMap((item) =>
        item.type === 'column' ? item.values.map((value) => Math.abs(Number(value ?? 0))) : [],
      ),
      ...sumEmbeddingGradMatrix.flatMap((row) => row.map((value) => Math.abs(Number(value ?? 0)))),
      ...tokenEmbeddingGradMatrix.flatMap((row) => row.map((value) => Math.abs(Number(value ?? 0)))),
      ...positionEmbeddingGradMatrix.flatMap((row) => row.map((value) => Math.abs(Number(value ?? 0)))),
    )

    return {
      perPos,
      selectedLogitRows,
      selectedLogitTopEllipsis,
      selectedLogitBottomEllipsis,
      selectedBlockOutputGrad,
      lmHeadDisplayItems,
      embeddingPosIndices,
      sumEmbeddingGradMatrix,
      tokenEmbeddingGradMatrix,
      positionEmbeddingGradMatrix,
      absMax,
    }
  }, [
    attnWo,
    attnWk,
    attnWq,
    attnWv,
    headDim,
    lmHead,
    mlpFc1,
    mlpFc2,
    modelSequence,
    nEmbd,
    nHead,
    formatChapterFiveTokenLabel,
    safeTargetIndex,
    sumEmbeddingVectors,
    trainingRows,
  ])

  const sharedGridStyle = useMemo(() => {
    const columnCount = Math.max(1, trainingRows.length)
    const mobileColumnCount = columnCount === 2 ? 2 : Math.min(3, columnCount)
    return {
      '--training-col-count': String(columnCount),
      '--training-mobile-col-count': String(mobileColumnCount),
    }
  }, [trainingRows.length])

  useLayoutEffect(() => {
    const positionCount = trainingRows.length
    const flowLayer = flowLayerRef.current
    const backpropLossScrollNode = backpropLossScrollRef.current
    const backpropProbScrollNode = backpropProbScrollRef.current
    const backpropVectorRowNode = backpropVectorRowRef.current
    const backpropSumEmbeddingScrollNode = backpropSumEmbeddingScrollRef.current
    const backpropTokenEmbeddingScrollNode = backpropTokenEmbeddingScrollRef.current
    const backpropPositionEmbeddingScrollNode = backpropPositionEmbeddingScrollRef.current
    const backpropScrollNodes = [
      backpropLossScrollNode,
      backpropProbScrollNode,
      backpropVectorRowNode,
      backpropSumEmbeddingScrollNode,
      backpropTokenEmbeddingScrollNode,
      backpropPositionEmbeddingScrollNode,
    ].filter(Boolean)
    const createdFlowNodes = []
    const persistentBackpropConnectors = new Map()
    const persistentBackpropDots = new Map()
    let geometryRafId = null
    let resizeObserver = null

    const clearPulseClasses = () => {
      probColumnRefs.current.forEach((node) => node?.classList.remove('training-prob-col--active'))
      targetRowRefs.current.forEach((node) => node?.classList.remove('training-prob-row--pulse'))
      lossCardRefs.current.forEach((node) => node?.classList.remove('training-loss-card--pulse'))
      meanCardRef.current?.classList.remove('training-mean-card--pulse')
      backpropLossCardRefs.current.forEach((node) => node?.classList.remove('training-backprop-card--pulse'))
      backpropProbCardRefs.current.forEach((node) => node?.classList.remove('training-backprop-card--pulse'))
      backpropLogitRef.current?.classList.remove('training-backprop-logit--pulse')
      backpropBlockVectorRef.current?.classList.remove('training-backprop-vector--pulse')
      backpropLmHeadVectorRef.current?.classList.remove('training-backprop-vector--pulse')
      backpropBridgeRef.current?.classList.remove('training-backprop-bridge--pulse')
      backpropSumEmbeddingRef.current?.classList.remove('training-backprop-embed-shell--pulse')
      backpropTokenEmbeddingRef.current?.classList.remove('training-backprop-embed-card--pulse')
      backpropPositionEmbeddingRef.current?.classList.remove('training-backprop-embed-card--pulse')
      flowLayer?.querySelectorAll('.training-flow-line--pulse').forEach((line) => {
        line.classList.remove('training-flow-line--pulse')
        gsap.set(line, { scaleX: 1 })
      })
      persistentBackpropDots.forEach((dot) => {
        dot.classList.remove('training-flow-dot--active')
        gsap.killTweensOf(dot)
        gsap.set(dot, { opacity: 0, x: 0 })
      })
    }

    const clearFlowLayer = () => {
      if (flowLayer) {
        flowLayer.innerHTML = ''
      }
      persistentBackpropConnectors.clear()
      persistentBackpropDots.clear()
    }

    const resolveAnchorPoint = (rect, anchor) => {
      const x = anchor.x === 'left' ? rect.left : anchor.x === 'right' ? rect.right : rect.left + rect.width * 0.5
      const y = anchor.y === 'top' ? rect.top : anchor.y === 'bottom' ? rect.bottom : rect.top + rect.height * 0.5
      return { x, y }
    }

    const getAnchoredConnectorGeometry = (fromNode, toNode, fromAnchor, toAnchor) => {
      if (!flowLayer || !fromNode || !toNode) {
        return null
      }
      const flowRect = flowLayer.getBoundingClientRect()
      const fromRect = fromNode.getBoundingClientRect()
      const toRect = toNode.getBoundingClientRect()
      const fromPoint = resolveAnchorPoint(fromRect, fromAnchor)
      const toPoint = resolveAnchorPoint(toRect, toAnchor)
      const fromX = fromPoint.x - flowRect.left
      const fromY = fromPoint.y - flowRect.top
      const toX = toPoint.x - flowRect.left
      const toY = toPoint.y - flowRect.top
      const distance = Math.hypot(toX - fromX, toY - fromY)
      const angle = (Math.atan2(toY - fromY, toX - fromX) * 180) / Math.PI
      return { fromX, fromY, distance, angle }
    }

    const getForwardConnectorGeometry = (fromNode, toNode) => {
      if (!flowLayer || !fromNode || !toNode) {
        return null
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
      return { fromX, fromY, distance, angle }
    }

    const placeConnector = (line, fromNode, toNode, fromAnchor = { x: 'center', y: 'bottom' }, toAnchor = { x: 'center', y: 'top' }) => {
      const geometry = getAnchoredConnectorGeometry(fromNode, toNode, fromAnchor, toAnchor)
      if (!line || !geometry) {
        return false
      }
      line.style.left = `${geometry.fromX}px`
      line.style.top = `${geometry.fromY}px`
      line.style.width = `${geometry.distance}px`
      line.style.transform = `translateY(-50%) rotate(${geometry.angle}deg)`
      return true
    }

    const backpropDescriptors = [
      ...trainingRows.flatMap((_, rowIndex) => [
        {
          key: `mean-to-loss-${rowIndex}`,
          variant: 'backprop-mean',
          getFrom: () => meanCardRef.current,
          getTo: () => backpropLossCardRefs.current[rowIndex],
          fromAnchor: { x: 'center', y: 'bottom' },
          toAnchor: { x: 'center', y: 'top' },
        },
        {
          key: `loss-to-prob-${rowIndex}`,
          variant: 'backprop-prob',
          getFrom: () => backpropLossCardRefs.current[rowIndex],
          getTo: () => backpropProbCardRefs.current[rowIndex],
          fromAnchor: { x: 'center', y: 'bottom' },
          toAnchor: { x: 'center', y: 'top' },
        },
      ]),
      {
        key: 'prob-to-logit',
        variant: 'backprop-prob',
        getFrom: () => backpropProbCardRefs.current[safeTargetIndex],
        getTo: () => backpropLogitRef.current,
        fromAnchor: { x: 'center', y: 'bottom' },
        toAnchor: { x: 'center', y: 'top' },
      },
      {
        key: 'logit-to-block',
        variant: 'backprop-vector',
        getFrom: () => backpropLogitRef.current,
        getTo: () => backpropBlockVectorRef.current,
        fromAnchor: { x: 'center', y: 'bottom' },
        toAnchor: { x: 'center', y: 'top' },
      },
      {
        key: 'logit-to-lmhead',
        variant: 'backprop-vector',
        getFrom: () => backpropLogitRef.current,
        getTo: () => backpropLmHeadVectorRef.current,
        fromAnchor: { x: 'center', y: 'bottom' },
        toAnchor: { x: 'center', y: 'top' },
      },
      {
        key: 'block-to-bridge',
        variant: 'backprop-vector',
        getFrom: () => backpropBlockVectorRef.current,
        getTo: () => backpropBridgeRef.current,
        fromAnchor: { x: 'center', y: 'bottom' },
        toAnchor: { x: 'center', y: 'top' },
      },
      {
        key: 'bridge-to-sum',
        variant: 'backprop-vector',
        getFrom: () => backpropBridgeRef.current,
        getTo: () => backpropSumEmbeddingRef.current,
        fromAnchor: { x: 'center', y: 'bottom' },
        toAnchor: { x: 'center', y: 'top' },
      },
      {
        key: 'sum-to-token',
        variant: 'backprop-vector',
        getFrom: () => backpropSumEmbeddingRef.current,
        getTo: () => backpropTokenEmbeddingRef.current,
        fromAnchor: { x: 'center', y: 'bottom' },
        toAnchor: { x: 'center', y: 'top' },
      },
      {
        key: 'sum-to-position',
        variant: 'backprop-vector',
        getFrom: () => backpropSumEmbeddingRef.current,
        getTo: () => backpropPositionEmbeddingRef.current,
        fromAnchor: { x: 'center', y: 'bottom' },
        toAnchor: { x: 'center', y: 'top' },
      },
    ]

    const refreshPersistentBackpropConnectors = () => {
      backpropDescriptors.forEach((descriptor) => {
        const fromNode = descriptor.getFrom()
        const toNode = descriptor.getTo()
        if (!flowLayer || !fromNode || !toNode) {
          return
        }
        const existing = persistentBackpropConnectors.get(descriptor.key)
        if (existing) {
          placeConnector(existing, fromNode, toNode, descriptor.fromAnchor, descriptor.toAnchor)
          return
        }
        const line = document.createElement('span')
        line.className = `training-flow-line training-flow-line--${descriptor.variant} training-flow-line--persistent`
        const dot = document.createElement('span')
        dot.className = `training-flow-dot training-flow-dot--${descriptor.variant}`
        line.appendChild(dot)
        flowLayer.appendChild(line)
        createdFlowNodes.push(line)
        persistentBackpropConnectors.set(descriptor.key, line)
        persistentBackpropDots.set(descriptor.key, dot)
        placeConnector(line, fromNode, toNode, descriptor.fromAnchor, descriptor.toAnchor)
      })
    }

    const queuePersistentConnectorRefresh = () => {
      if (geometryRafId !== null) {
        return
      }
      geometryRafId = window.requestAnimationFrame(() => {
        geometryRafId = null
        refreshPersistentBackpropConnectors()
      })
    }

    const cleanupPersistentConnectorListeners = () => {
      if (geometryRafId !== null) {
        window.cancelAnimationFrame(geometryRafId)
        geometryRafId = null
      }
      window.removeEventListener('resize', queuePersistentConnectorRefresh)
      backpropScrollNodes.forEach((node) => {
        node.removeEventListener('scroll', queuePersistentConnectorRefresh)
      })
      resizeObserver?.disconnect()
      resizeObserver = null
    }

    const runSharedCleanup = () => {
      cleanupPersistentConnectorListeners()
      clearPulseClasses()
      clearFlowLayer()
    }

    timelineRef.current?.kill()
    timelineRef.current = null
    clearPulseClasses()
    clearFlowLayer()

    if (!positionCount) {
      return () => {
        setIsAnimating(false)
        runSharedCleanup()
      }
    }

    const revealAt = (setter, index) => {
      setter((prev) => {
        const previous = Array.isArray(prev) ? prev : []
        const resized =
          previous.length === positionCount
            ? [...previous]
            : Array.from({ length: positionCount }, (_, rowIndex) => Boolean(previous[rowIndex]))
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

    refreshPersistentBackpropConnectors()
    window.addEventListener('resize', queuePersistentConnectorRefresh)
    backpropScrollNodes.forEach((node) => {
      node.addEventListener('scroll', queuePersistentConnectorRefresh, { passive: true })
    })
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        queuePersistentConnectorRefresh()
      })
      const observedNodes = [
        flowLayer,
        meanCardRef.current,
        backpropLogitRef.current,
        backpropLossScrollNode,
        backpropProbScrollNode,
        backpropVectorRowNode,
        backpropBlockVectorRef.current,
        backpropLmHeadVectorRef.current,
        backpropBridgeRef.current,
        backpropSumEmbeddingRef.current,
        backpropTokenEmbeddingRef.current,
        backpropPositionEmbeddingRef.current,
      ]
      observedNodes.forEach((node) => {
        if (node) {
          resizeObserver.observe(node)
        }
      })
    }

    if (reducedMotion || skipAnimations) {
      const rafId = window.requestAnimationFrame(() => {
        setIsAnimating(false)
        setRevealedPosColumns(Array.from({ length: positionCount }, () => true))
        setRevealedTargetRows(Array.from({ length: positionCount }, () => true))
        setRevealedLossCards(Array.from({ length: positionCount }, () => true))
        setIsMeanVisible(true)
        setRevealedBackpropLossCards(Array.from({ length: positionCount }, () => true))
        setRevealedBackpropProbCards(Array.from({ length: positionCount }, () => true))
        setIsBackpropLogitVisible(true)
        setIsBackpropVectorsVisible(true)
        setIsBackpropBridgeVisible(true)
        setIsBackpropSumEmbeddingVisible(true)
        setIsBackpropEmbeddingPairVisible(true)
        queuePersistentConnectorRefresh()
      })
      return () => {
        window.cancelAnimationFrame(rafId)
        runSharedCleanup()
      }
    }

    const timeline = gsap.timeline()
    timelineRef.current = timeline
    timeline.call(() => {
      setIsAnimating(true)
    }, null, 0)

    const spawnConnector = (fromNode, toNode, startAt, variant = 'loss') => {
      if (!flowLayer || !fromNode || !toNode) {
        return
      }

      const geometry = getForwardConnectorGeometry(fromNode, toNode)
      if (!geometry) {
        return
      }

      const line = document.createElement('span')
      line.className = `training-flow-line training-flow-line--${variant}`
      line.style.left = `${geometry.fromX}px`
      line.style.top = `${geometry.fromY}px`
      line.style.width = `${geometry.distance}px`
      line.style.transform = `translateY(-50%) rotate(${geometry.angle}deg)`
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

    const pulsePersistentConnector = (lineKey, startAt, duration = 0.22) => {
      const line = persistentBackpropConnectors.get(lineKey)
      const dot = persistentBackpropDots.get(lineKey)
      if (!line) {
        return
      }
      const safeDuration = Math.max(0.12, Number(duration) || 0.22)
      timeline.call(() => {
        line.classList.add('training-flow-line--pulse')
        if (dot) {
          dot.classList.add('training-flow-dot--active')
          gsap.killTweensOf(dot)
          gsap.set(dot, { x: 0, opacity: 1 })
          const travel = Math.max(0, line.getBoundingClientRect().width - 2)
          gsap.to(dot, {
            x: travel,
            duration: safeDuration,
            ease: 'power1.inOut',
            overwrite: 'auto',
          })
        }
        gsap.fromTo(
          line,
          { scaleX: 1 },
          {
            scaleX: 1.08,
            duration: Math.max(0.08, safeDuration * 0.45),
            yoyo: true,
            repeat: 1,
            ease: 'power2.out',
            overwrite: 'auto',
          },
        )
      }, null, startAt)
      timeline.call(() => {
        line.classList.remove('training-flow-line--pulse')
        gsap.set(line, { scaleX: 1 })
        if (dot) {
          dot.classList.remove('training-flow-dot--active')
          gsap.killTweensOf(dot)
          gsap.set(dot, { opacity: 0, x: 0 })
        }
      }, null, startAt + safeDuration)
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
      queuePersistentConnectorRefresh()
    }, null, meanStageStart)

    trainingRows.forEach((_, rowIndex) => {
      const at = meanStageStart + 0.02 + rowIndex * 0.045
      spawnConnector(lossCardRefs.current[rowIndex], meanCardRef.current, at, 'mean')
    })

    const meanPulseStart = meanStageStart + trainingRows.length * 0.045 + 0.04
    if (meanCardRef.current) {
      timeline.call(() => meanCardRef.current?.classList.add('training-mean-card--pulse'), null, meanPulseStart)
      timeline.call(() => meanCardRef.current?.classList.remove('training-mean-card--pulse'), null, meanPulseStart + 0.2)
    }

    const backpropStart = meanPulseStart + 0.24
    trainingRows.forEach((_, rowIndex) => {
      const at = backpropStart + rowIndex * 0.07
      timeline.call(() => {
        revealAt(setRevealedBackpropLossCards, rowIndex)
        queuePersistentConnectorRefresh()
      }, null, at)
      pulsePersistentConnector(`mean-to-loss-${rowIndex}`, at + 0.012)
      timeline.call(() => backpropLossCardRefs.current[rowIndex]?.classList.add('training-backprop-card--pulse'), null, at + 0.012)
      timeline.call(() => backpropLossCardRefs.current[rowIndex]?.classList.remove('training-backprop-card--pulse'), null, at + 0.18)
    })

    const backpropProbStart = backpropStart + trainingRows.length * 0.07 + 0.1
    trainingRows.forEach((_, rowIndex) => {
      const at = backpropProbStart + rowIndex * 0.07
      timeline.call(() => {
        revealAt(setRevealedBackpropProbCards, rowIndex)
        queuePersistentConnectorRefresh()
      }, null, at)
      pulsePersistentConnector(`loss-to-prob-${rowIndex}`, at + 0.012)
      timeline.call(() => backpropProbCardRefs.current[rowIndex]?.classList.add('training-backprop-card--pulse'), null, at + 0.012)
      timeline.call(() => backpropProbCardRefs.current[rowIndex]?.classList.remove('training-backprop-card--pulse'), null, at + 0.18)
    })

    const backpropLogitStart = backpropProbStart + trainingRows.length * 0.07 + 0.12
    const slowBackpropScale = 1.65
    const slowBackprop = (value) => value * slowBackpropScale
    const slowConnectorDuration = slowBackprop(0.22)
    timeline.call(() => {
      setIsBackpropLogitVisible(true)
      queuePersistentConnectorRefresh()
    }, null, backpropLogitStart)
    pulsePersistentConnector('prob-to-logit', backpropLogitStart + slowBackprop(0.01), slowConnectorDuration)
    timeline.call(
      () => probColumnRefs.current[safeTargetIndex]?.classList.add('training-prob-col--active'),
      null,
      backpropLogitStart + slowBackprop(0.01),
    )
    timeline.call(
      () => probColumnRefs.current[safeTargetIndex]?.classList.remove('training-prob-col--active'),
      null,
      backpropLogitStart + slowBackprop(0.18),
    )
    timeline.call(() => backpropLogitRef.current?.classList.add('training-backprop-logit--pulse'), null, backpropLogitStart + slowBackprop(0.02))
    timeline.call(() => backpropLogitRef.current?.classList.remove('training-backprop-logit--pulse'), null, backpropLogitStart + slowBackprop(0.2))

    const backpropVectorStart = backpropLogitStart + slowBackprop(0.22)
    timeline.call(() => {
      setIsBackpropVectorsVisible(true)
      queuePersistentConnectorRefresh()
    }, null, backpropVectorStart)
    pulsePersistentConnector('logit-to-block', backpropVectorStart + slowBackprop(0.01), slowConnectorDuration)
    pulsePersistentConnector('logit-to-lmhead', backpropVectorStart + slowBackprop(0.04), slowConnectorDuration)
    timeline.call(() => backpropBlockVectorRef.current?.classList.add('training-backprop-vector--pulse'), null, backpropVectorStart + slowBackprop(0.04))
    timeline.call(() => backpropLmHeadVectorRef.current?.classList.add('training-backprop-vector--pulse'), null, backpropVectorStart + slowBackprop(0.06))
    timeline.call(() => backpropBlockVectorRef.current?.classList.remove('training-backprop-vector--pulse'), null, backpropVectorStart + slowBackprop(0.22))
    timeline.call(() => backpropLmHeadVectorRef.current?.classList.remove('training-backprop-vector--pulse'), null, backpropVectorStart + slowBackprop(0.22))

    const backpropBridgeStart = backpropVectorStart + slowBackprop(0.24)
    timeline.call(() => {
      setIsBackpropBridgeVisible(true)
      queuePersistentConnectorRefresh()
    }, null, backpropBridgeStart)
    pulsePersistentConnector('block-to-bridge', backpropBridgeStart + slowBackprop(0.01), slowConnectorDuration)
    timeline.call(() => backpropBridgeRef.current?.classList.add('training-backprop-bridge--pulse'), null, backpropBridgeStart + slowBackprop(0.02))
    timeline.call(() => backpropBridgeRef.current?.classList.remove('training-backprop-bridge--pulse'), null, backpropBridgeStart + slowBackprop(0.2))

    const backpropSumEmbeddingStart = backpropBridgeStart + slowBackprop(0.24)
    timeline.call(() => {
      setIsBackpropSumEmbeddingVisible(true)
      queuePersistentConnectorRefresh()
    }, null, backpropSumEmbeddingStart)
    pulsePersistentConnector('bridge-to-sum', backpropSumEmbeddingStart + slowBackprop(0.01), slowConnectorDuration)
    timeline.call(() => backpropSumEmbeddingRef.current?.classList.add('training-backprop-embed-shell--pulse'), null, backpropSumEmbeddingStart + slowBackprop(0.02))
    timeline.call(() => backpropSumEmbeddingRef.current?.classList.remove('training-backprop-embed-shell--pulse'), null, backpropSumEmbeddingStart + slowBackprop(0.2))

    const backpropEmbeddingPairStart = backpropSumEmbeddingStart + slowBackprop(0.24)
    timeline.call(() => {
      setIsBackpropEmbeddingPairVisible(true)
      queuePersistentConnectorRefresh()
    }, null, backpropEmbeddingPairStart)
    pulsePersistentConnector('sum-to-token', backpropEmbeddingPairStart + slowBackprop(0.01), slowConnectorDuration)
    pulsePersistentConnector('sum-to-position', backpropEmbeddingPairStart + slowBackprop(0.04), slowConnectorDuration)
    timeline.call(() => backpropTokenEmbeddingRef.current?.classList.add('training-backprop-embed-card--pulse'), null, backpropEmbeddingPairStart + slowBackprop(0.04))
    timeline.call(() => backpropPositionEmbeddingRef.current?.classList.add('training-backprop-embed-card--pulse'), null, backpropEmbeddingPairStart + slowBackprop(0.06))
    timeline.call(() => backpropTokenEmbeddingRef.current?.classList.remove('training-backprop-embed-card--pulse'), null, backpropEmbeddingPairStart + slowBackprop(0.22))
    timeline.call(() => backpropPositionEmbeddingRef.current?.classList.remove('training-backprop-embed-card--pulse'), null, backpropEmbeddingPairStart + slowBackprop(0.22))
    timeline.call(() => {
      setIsAnimating(false)
    }, null, backpropEmbeddingPairStart + slowBackprop(0.24))

    return () => {
      timeline.kill()
      timelineRef.current = null
      setIsAnimating(false)
      runSharedCleanup()
    }
  }, [animationTick, reducedMotion, safeTargetIndex, skipAnimations, trainingRows])

  if (!isShapeValid) {
    return null
  }

  if (!trainingRows.length) {
    return <SectionStateCard title="TRAINING DEMO" message={copy.chapter5.unavailable} />
  }

  const resetRevealStates = () => {
    const hiddenMask = createRevealVector(trainingRows.length)
    setRevealedPosColumns(hiddenMask)
    setRevealedTargetRows(hiddenMask)
    setRevealedLossCards(hiddenMask)
    setIsMeanVisible(false)
    setRevealedBackpropLossCards(hiddenMask)
    setRevealedBackpropProbCards(hiddenMask)
    setIsBackpropLogitVisible(false)
    setIsBackpropVectorsVisible(false)
    setIsBackpropBridgeVisible(false)
    setIsBackpropSumEmbeddingVisible(false)
    setIsBackpropEmbeddingPairVisible(false)
    setIsAnimating(false)
  }

  const moveExampleName = (direction) => {
    resetRevealStates()
    setExampleNameIndex((prevIndex) => {
      return (prevIndex + direction + CHAPTER_FOUR_EXAMPLE_NAMES.length) % CHAPTER_FOUR_EXAMPLE_NAMES.length
    })
    setTargetIndex(0)
    setAnimationTick((prevTick) => prevTick + 1)
  }

  const moveTargetIndex = (direction) => {
    const maxIndex = Math.max(0, trainingRows.length - 1)
    const nextIndex = clamp(targetIndex + direction, 0, maxIndex)
    if (nextIndex === targetIndex) {
      return
    }
    resetRevealStates()
    setTargetIndex(nextIndex)
    setAnimationTick((prevTick) => prevTick + 1)
  }

  const replayAnimation = () => {
    if (skipAnimations) {
      return
    }
    resetRevealStates()
    setAnimationTick((prevTick) => prevTick + 1)
  }

  const toggleSkipAnimations = () => {
    resetRevealStates()
    setSkipAnimations((prev) => !prev)
    setAnimationTick((prevTick) => prevTick + 1)
  }

  const lmHeadVisibleColumnCount = Math.max(1, backpropData.lmHeadDisplayItems.length)
  const lmHeadGridStyle = { '--training-lmhead-visible-cols': String(lmHeadVisibleColumnCount) }
  const embedColumnCount = Math.max(1, backpropData.embeddingPosIndices.length)
  const embedTableStyle = {
    '--training-embed-col-count': String(embedColumnCount),
    ...(isMobile ? { minWidth: `${56 + embedColumnCount * 92 + Math.max(0, embedColumnCount - 1) * 6}px` } : {}),
  }
  const selectedInputToken = modelSequence[safeTargetIndex] ?? null
  const renderEmbeddingGradientTable = (matrix, isVisible, tableKeyPrefix, scrollRef, headHighlightLine = null) => {
    return (
      <div ref={scrollRef} className="training-backprop-embed-scroll">
        <div className="training-backprop-embed-table" style={embedTableStyle}>
          <div className="training-backprop-embed-row training-backprop-embed-row--head">
            <span className={`training-backprop-embed-dim training-backprop-embed-head training-backprop-head-spacer ${valueTextClass}`} aria-hidden="true" />
            {backpropData.embeddingPosIndices.map((posIndex) => {
              const headTokenLabel = modelSequence[posIndex]?.label ?? 'N/A'
              return (
                <span key={`${tableKeyPrefix}-head-pos-${posIndex}`} className={`training-backprop-embed-head ${valueTextClass}`}>
                  <span className="training-backprop-embed-head-stack">
                    <span
                      className={`training-backprop-embed-head-pos ${
                        headHighlightLine === 'pos' ? 'training-backprop-embed-head-pos--highlight' : ''
                      }`.trim()}
                    >
                      {`POS ${posIndex}`}
                    </span>
                    <span
                      className={`training-backprop-embed-head-token ${
                        headHighlightLine === 'token' ? 'training-backprop-embed-head-token--highlight' : ''
                      }`.trim()}
                    >
                      {headTokenLabel}
                    </span>
                  </span>
                </span>
              )
            })}
          </div>

          {Array.from({ length: nEmbd }, (_, dimIndex) => {
            return (
              <div key={`${tableKeyPrefix}-dim-${dimIndex}`} className="training-backprop-embed-row">
                <span className={`training-backprop-embed-dim ${valueTextClass}`}>{dimIndex}</span>
                {backpropData.embeddingPosIndices.map((posIndex) => {
                  const value = Number(matrix?.[posIndex]?.[dimIndex] ?? 0)
                  const ratio = clamp(Math.abs(value) / Math.max(backpropData.absMax, 1e-8), 0, 1)
                  return (
                    <span
                      key={`${tableKeyPrefix}-cell-${posIndex}-${dimIndex}`}
                      className={`training-backprop-embed-value ${valueTextClass}`}
                      style={
                        isVisible
                          ? {
                              backgroundColor: getHeatColor(value, Math.max(backpropData.absMax, 1e-8)),
                              color: ratio >= 0.78 ? '#fff' : '#000',
                            }
                          : undefined
                      }
                    >
                      {isVisible ? value.toFixed(3) : ATTENTION_HIDDEN_PLACEHOLDER}
                    </span>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className={`training-demo-wrap reveal ${reducedMotion ? 'training-demo-wrap--static' : ''}`}>
      <div className="attention-controls">
        <div className="attention-nav">
          <p className="attention-nav-title">{copy.chapter5.exampleNameTitle}</p>
          <div className="attention-nav-inner">
            <button type="button" className="attention-nav-arrow" onClick={() => moveExampleName(-1)} aria-label={copy.chapter5.prevExampleNameAria}>
              <span className="attention-nav-arrow-shape attention-nav-arrow-shape-left" />
            </button>
            <p className="attention-nav-pill">
              <span className="attention-nav-pill-char">{currentExampleName}</span>
              <span className="attention-nav-pill-meta">{`POS 0 ~ ${Math.max(0, trainingRows.length - 1)}`}</span>
            </p>
            <button type="button" className="attention-nav-arrow" onClick={() => moveExampleName(1)} aria-label={copy.chapter5.nextExampleNameAria}>
              <span className="attention-nav-arrow-shape attention-nav-arrow-shape-right" />
            </button>
          </div>
        </div>

        <div className="attention-nav">
          <p className="attention-nav-title">{copy.chapter5.targetIndexTitle}</p>
          <div className="attention-nav-inner">
            <button type="button" className="attention-nav-arrow" onClick={() => moveTargetIndex(-1)} aria-label={copy.chapter5.prevTargetIndexAria}>
              <span className="attention-nav-arrow-shape attention-nav-arrow-shape-left" />
            </button>
            <p className="attention-nav-pill">
              <span className="attention-nav-pill-char">{`POS ${safeTargetIndex}`}</span>
              <span className="attention-nav-pill-meta">
                {selectedInputToken ? `${selectedInputToken.label} · ID ${selectedInputToken.tokenId}` : 'N/A'}
              </span>
            </p>
            <button type="button" className="attention-nav-arrow" onClick={() => moveTargetIndex(1)} aria-label={copy.chapter5.nextTargetIndexAria}>
              <span className="attention-nav-arrow-shape attention-nav-arrow-shape-right" />
            </button>
          </div>
        </div>

        <button
          type="button"
          className={`attention-replay-btn ${isAnimating ? 'attention-replay-btn--active' : ''}`}
          onClick={replayAnimation}
          aria-label={copy.chapter5.replayAria}
          aria-disabled={skipAnimations}
          disabled={skipAnimations}
        >
          {isAnimating ? 'PLAYING...' : 'REPLAY'}
        </button>

        <button
          type="button"
          className={`attention-skip-btn ${skipAnimations ? 'attention-skip-btn--active' : ''}`}
          onClick={toggleSkipAnimations}
          aria-label={copy.chapter5.skipAria}
          aria-pressed={skipAnimations}
        >
          {`ANIMATION SKIP: ${skipAnimations ? 'ON' : 'OFF'}`}
        </button>
      </div>

      <div className="training-flow-scope">
        <section className="training-prob-shell" aria-label={copy.chapter5.nextTokenProbAria}>
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
                      {isColumnVisible ? copy.chapter5.correctLabel(row.targetLabel) : ATTENTION_HIDDEN_PLACEHOLDER}
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

        <section className="training-loss-shell" aria-label={copy.chapter5.tokenLossAria}>
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
                              backgroundColor: interpolateHexColor(EMBEDDING_NEGATIVE_BASE, EMBEDDING_NEGATIVE_STRONG, lossRatio),
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

        <article
          ref={meanCardRef}
          className={`training-mean-card ${isMeanVisible ? '' : 'training-mean-card--hidden'}`.trim()}
          aria-label={copy.chapter5.meanLossAria}
        >
          <p className="training-mean-title">FINAL LOSS</p>
          <p className="training-mean-value">{isMeanVisible ? meanLoss.toFixed(3) : ATTENTION_HIDDEN_PLACEHOLDER}</p>
        </article>

        <section className="training-backprop-stage training-backprop-stage--loss training-backprop-node" aria-label="Token Loss Gradient">
          <p className="training-backprop-label">Token Loss Gradient</p>
          <div ref={backpropLossScrollRef} className="training-backprop-scroll training-backprop-scroll--loss">
            <div className="training-backprop-grid" style={sharedGridStyle}>
              {backpropData.perPos.map((row, rowIndex) => {
                const isVisible = Boolean(revealedBackpropLossCards[rowIndex])
                return (
                  <article
                    key={`backprop-loss-${row.pos}`}
                    ref={(node) => {
                      backpropLossCardRefs.current[rowIndex] = node
                    }}
                    className={`training-backprop-card ${isVisible ? '' : 'training-backprop-card--hidden'}`.trim()}
                  >
                    <p className={`training-backprop-card-title ${valueTextClass}`}>{`POS ${row.pos}`}</p>
                    <div className="training-backprop-card-kv">
                      <span
                        className={`training-backprop-v ${valueTextClass}`}
                        style={
                          isVisible
                            ? {
                                backgroundColor: interpolateHexColor(
                                  EMBEDDING_POSITIVE_BASE,
                                  EMBEDDING_POSITIVE_STRONG,
                                  clamp(Number(row.dMean_dLoss ?? 0) * trainingRows.length, 0, 1),
                                ),
                                color: '#000',
                              }
                            : undefined
                        }
                      >
                        {isVisible ? Number(row.dMean_dLoss ?? 0).toFixed(3) : ATTENTION_HIDDEN_PLACEHOLDER}
                      </span>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section className="training-backprop-stage training-backprop-stage--prob training-backprop-node" aria-label="Target Probability Gradient">
          <p className="training-backprop-label">Target Probability Gradient</p>
          <div ref={backpropProbScrollRef} className="training-backprop-scroll training-backprop-scroll--prob">
            <div className="training-backprop-grid" style={sharedGridStyle}>
              {backpropData.perPos.map((row, rowIndex) => {
                const isVisible = Boolean(revealedBackpropProbCards[rowIndex])
                const value = Number(row.dMean_dTargetProb ?? 0)
                const ratio = clamp(Math.abs(value) / Math.max(backpropData.absMax, 1e-8), 0, 1)
                return (
                  <article
                    key={`backprop-prob-${row.pos}`}
                    ref={(node) => {
                      backpropProbCardRefs.current[rowIndex] = node
                    }}
                    className={`training-backprop-card ${isVisible ? '' : 'training-backprop-card--hidden'}`.trim()}
                  >
                    <p className={`training-backprop-card-title ${valueTextClass}`}>{`POS ${row.pos}`}</p>
                    <div className="training-backprop-card-kv">
                      <span
                        className={`training-backprop-v ${valueTextClass}`}
                        style={
                          isVisible
                            ? {
                                backgroundColor: getHeatColor(value, Math.max(backpropData.absMax, 1e-8)),
                                color: ratio >= 0.78 ? '#fff' : '#000',
                              }
                            : undefined
                        }
                      >
                        {isVisible ? value.toFixed(3) : ATTENTION_HIDDEN_PLACEHOLDER}
                      </span>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <div
          ref={backpropLogitRef}
          className={`training-backprop-logit training-backprop-node ${isBackpropLogitVisible ? '' : 'training-backprop-logit--hidden'}`.trim()}
          aria-label={`Logit Gradient (POS ${safeTargetIndex})`}
        >
          <p className="training-backprop-label">{`Logit Gradient (POS ${safeTargetIndex})`}</p>
          <div className="training-backprop-logit-list">
            {backpropData.selectedLogitTopEllipsis ? <p className={`training-backprop-ellipsis ${valueTextClass}`}>...</p> : null}
            {backpropData.selectedLogitRows.map((row) => {
              const ratio = clamp(Math.abs(Number(row.grad ?? 0)) / Math.max(backpropData.absMax, 1e-8), 0, 1)
              return (
                <article
                  key={`backprop-logit-${row.tokenId}`}
                  className={`training-backprop-logit-row ${row.isTarget ? 'training-backprop-logit-row--target' : ''}`.trim()}
                >
                  <span className={`training-backprop-logit-rank ${valueTextClass}`}>{`#${Number(row.rank ?? 0) + 1}`}</span>
                  <span className={`training-backprop-logit-token ${valueTextClass}`}>{`${row.label} · ID ${row.tokenId}`}</span>
                  <span
                    className={`training-backprop-logit-value ${valueTextClass}`}
                    style={{
                      backgroundColor: getHeatColor(Number(row.grad ?? 0), Math.max(backpropData.absMax, 1e-8)),
                      color: ratio >= 0.78 ? '#fff' : '#000',
                    }}
                  >
                    {isBackpropLogitVisible ? Number(row.grad ?? 0).toFixed(3) : ATTENTION_HIDDEN_PLACEHOLDER}
                  </span>
                </article>
              )
            })}
            {backpropData.selectedLogitBottomEllipsis ? <p className={`training-backprop-ellipsis ${valueTextClass}`}>...</p> : null}
          </div>
        </div>

        <div ref={backpropVectorRowRef} className="training-backprop-vector-row training-backprop-node" aria-label="Backpropagation Vector Gradients">
          <article
            ref={backpropBlockVectorRef}
            className={`training-backprop-vector-card ${isBackpropVectorsVisible ? '' : 'training-backprop-vector-card--hidden'}`.trim()}
          >
            <p className="training-backprop-label">{`Transformer Block Output Gradient (POS ${safeTargetIndex})`}</p>
            <div className="training-backprop-vector-lines">
              {backpropData.selectedBlockOutputGrad.map((value, dimIndex) => {
                const ratio = clamp(Math.abs(Number(value ?? 0)) / Math.max(backpropData.absMax, 1e-8), 0, 1)
                return (
                  <div key={`backprop-block-${dimIndex}`} className="training-backprop-vector-line">
                    <span className={`training-backprop-dim ${valueTextClass}`}>{dimIndex}</span>
                    <span
                      className={`training-backprop-vector-value ${valueTextClass}`}
                      style={{
                        backgroundColor: getHeatColor(Number(value ?? 0), Math.max(backpropData.absMax, 1e-8)),
                        color: ratio >= 0.78 ? '#fff' : '#000',
                      }}
                    >
                      {isBackpropVectorsVisible ? Number(value ?? 0).toFixed(3) : ATTENTION_HIDDEN_PLACEHOLDER}
                    </span>
                  </div>
                )
              })}
            </div>
          </article>

          <article
            ref={backpropLmHeadVectorRef}
            className={`training-backprop-vector-card training-backprop-vector-card--learnable ${
              isBackpropVectorsVisible ? '' : 'training-backprop-vector-card--hidden'
            }`.trim()}
          >
            <p className="training-backprop-label">{`LM Head Parameter Gradient (Matrix Slice, POS ${safeTargetIndex})`}</p>
            <div className="training-backprop-lmhead-header" style={lmHeadGridStyle}>
              <span className={`training-backprop-lmhead-corner training-backprop-head-spacer ${valueTextClass}`} aria-hidden="true" />
              {backpropData.lmHeadDisplayItems.map((item) => {
                if (item.type === 'ellipsis') {
                  return (
                    <span key={item.key} className={`training-backprop-lmhead-head training-backprop-lmhead-head--ellipsis ${valueTextClass}`}>
                      ...
                    </span>
                  )
                }
                return (
                  <span
                    key={item.key}
                    className={`training-backprop-lmhead-head ${item.isTarget ? 'training-backprop-lmhead-head--target' : ''} ${valueTextClass}`.trim()}
                    title={`token #${item.tokenId} · ${item.label}`}
                  >
                    {isMobile ? item.label : item.isTarget ? `${item.label} · ID ${item.tokenId}` : `ID ${item.tokenId}`}
                  </span>
                )
              })}
            </div>

            <div className="training-backprop-lmhead-rows">
              {Array.from({ length: nEmbd }, (_, dimIndex) => {
                return (
                  <div key={`backprop-lmhead-row-${dimIndex}`} className="training-backprop-lmhead-row" style={lmHeadGridStyle}>
                    <span className={`training-backprop-dim ${valueTextClass}`}>{dimIndex}</span>
                    {backpropData.lmHeadDisplayItems.map((item) => {
                      if (item.type === 'ellipsis') {
                        return (
                          <span key={`${item.key}-${dimIndex}`} className={`training-backprop-lmhead-gap ${valueTextClass}`}>
                            ...
                          </span>
                        )
                      }
                      const value = Number(item.values?.[dimIndex] ?? 0)
                      const ratio = clamp(Math.abs(value) / Math.max(backpropData.absMax, 1e-8), 0, 1)
                      return (
                        <span
                          key={`${item.key}-${dimIndex}`}
                          className={`training-backprop-vector-value ${
                            item.isTarget ? 'training-backprop-vector-value--target-col' : ''
                          } ${valueTextClass}`.trim()}
                          style={{
                            backgroundColor: getHeatColor(value, Math.max(backpropData.absMax, 1e-8)),
                            color: ratio >= 0.78 ? '#fff' : '#000',
                          }}
                        >
                          {isBackpropVectorsVisible ? value.toFixed(3) : ATTENTION_HIDDEN_PLACEHOLDER}
                        </span>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </article>
        </div>

        <section
          ref={backpropBridgeRef}
          className={`training-backprop-bridge training-backprop-node ${isBackpropBridgeVisible ? '' : 'training-backprop-bridge--hidden'}`.trim()}
          aria-label="Backpropagation Bridge Description"
        >
          <p className="training-backprop-label">{copy.chapter5.backpropSummaryLabel}</p>
          <p className={`training-backprop-bridge-text ${valueTextClass}`}>
            {copy.chapter5.backpropSummaryText}
          </p>
        </section>

        <section
          ref={backpropSumEmbeddingRef}
          className={`training-backprop-embed-shell training-backprop-embed-shell--single training-backprop-node ${
            isBackpropSumEmbeddingVisible ? '' : 'training-backprop-embed-shell--hidden'
          }`.trim()}
          aria-label="Sum Embedding Gradient"
        >
          <p className="training-backprop-label">
            {safeTargetIndex === 0 ? 'Sum Embedding Gradient (POS 0)' : `Sum Embedding Gradient (POS 0 ~ ${safeTargetIndex})`}
          </p>
          {renderEmbeddingGradientTable(
            backpropData.sumEmbeddingGradMatrix,
            isBackpropSumEmbeddingVisible,
            'sum-embedding',
            backpropSumEmbeddingScrollRef,
          )}
        </section>

        <div className={`training-backprop-embed-split training-backprop-node ${isBackpropEmbeddingPairVisible ? '' : 'training-backprop-embed-split--hidden'}`.trim()}>
          <section
            ref={backpropTokenEmbeddingRef}
            className={`training-backprop-embed-shell training-backprop-embed-card ${isBackpropEmbeddingPairVisible ? '' : 'training-backprop-embed-shell--hidden'}`.trim()}
            aria-label="Token Embedding Gradient"
          >
            <p className="training-backprop-label">
              {safeTargetIndex === 0 ? 'Token Embedding Gradient (POS 0)' : `Token Embedding Gradient (POS 0 ~ ${safeTargetIndex})`}
            </p>
            {renderEmbeddingGradientTable(
              backpropData.tokenEmbeddingGradMatrix,
              isBackpropEmbeddingPairVisible,
              'token-embedding',
              backpropTokenEmbeddingScrollRef,
              'token',
            )}
          </section>

          <section
            ref={backpropPositionEmbeddingRef}
            className={`training-backprop-embed-shell training-backprop-embed-card ${isBackpropEmbeddingPairVisible ? '' : 'training-backprop-embed-shell--hidden'}`.trim()}
            aria-label="Position Embedding Gradient"
          >
            <p className="training-backprop-label">
              {safeTargetIndex === 0 ? 'Position Embedding Gradient (POS 0)' : `Position Embedding Gradient (POS 0 ~ ${safeTargetIndex})`}
            </p>
            {renderEmbeddingGradientTable(
              backpropData.positionEmbeddingGradMatrix,
              isBackpropEmbeddingPairVisible,
              'position-embedding',
              backpropPositionEmbeddingScrollRef,
              'pos',
            )}
          </section>
        </div>

        <div ref={flowLayerRef} className="training-flow-layer" aria-hidden="true" />
      </div>
    </div>
  )
}


export default ChapterFiveTrainingDemo
