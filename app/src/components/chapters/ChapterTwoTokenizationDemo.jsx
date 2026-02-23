import { useLayoutEffect, useMemo, useState } from 'react'
import gsap from 'gsap'
import { CHAPTER_TWO_EXAMPLE_NAMES } from './shared/chapterConstants'
import { decomposeKoreanNameToNfdTokens, formatTokenId, getRoleLabel } from './shared/chapterUtils'

function ChapterTwoTokenizationDemo({ tokenizer, reducedMotion, isMobile, copy }) {
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
        roleKey: token.roleKey,
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
        roleKey: 'sequenceStart',
        syllable: '-',
        tokenId: tokenizer.bos,
        isBos: true,
      },
      ...phonemeTokens,
      {
        id: 'bos-end',
        display: '[BOS]',
        nfd: 'BOS',
        roleKey: 'sequenceEnd',
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

  const roleLabels = copy.roles
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
            aria-label={copy.chapter2.prevExampleNameAria}
          >
            <span className="token-name-arrow-shape token-name-arrow-shape-left" />
          </button>

          <p className="token-name-pill">{currentExampleName}</p>

          <button
            type="button"
            className="token-name-arrow"
            onClick={() => moveExampleName(1)}
            aria-label={copy.chapter2.nextExampleNameAria}
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
              aria-label={copy.chapter2.tokenChipAria(token.display, getRoleLabel(token.roleKey, roleLabels), formatTokenId(token.tokenId))}
            >
              <span className="token-chip-symbol">{token.display}</span>
              <span className="token-chip-meta">{getRoleLabel(token.roleKey, roleLabels)}</span>
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
        <p className="text-xs font-black uppercase tracking-[0.2em]">{copy.chapter2.selectedTokenTitle}</p>
        {selectedToken ? (
          <>
            <p className="mt-3 inline-block border-4 border-white bg-black px-4 py-2 text-2xl font-black">
              {selectedToken.display}
            </p>

            <div className="token-inspector-row">
              <span>{copy.chapter2.roleLabel}</span>
              <strong>{getRoleLabel(selectedToken.roleKey, roleLabels)}</strong>
            </div>
            <div className="token-inspector-row">
              <span>{copy.chapter2.syllableLabel}</span>
              <strong>{selectedToken.syllable}</strong>
            </div>
            <div className="token-inspector-row">
              <span>Token ID</span>
              <strong>{formatTokenId(selectedToken.tokenId)}</strong>
            </div>
          </>
        ) : (
          <p className="mt-3 border-4 border-white bg-black px-4 py-4 text-sm font-bold leading-relaxed">
            {copy.chapter2.noSelectedTokenMessage}
          </p>
        )}
      </aside>
    </div>
  )
}


export default ChapterTwoTokenizationDemo
