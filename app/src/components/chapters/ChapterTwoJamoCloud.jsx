import { useLayoutEffect, useMemo, useRef } from 'react'
import gsap from 'gsap'
import { CHAPTER_TWO_BG_BASE_JAMO, CHAPTER_TWO_LAYER_DEPTHS } from './shared/chapterConstants'
import { getJamoCloudPosition } from './shared/chapterUtils'

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


export default ChapterTwoJamoCloud
