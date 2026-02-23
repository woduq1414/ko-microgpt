import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import gsap from 'gsap'
import { LAYER_DEPTHS, ROTATION_STEPS, SIZE_CLASSES } from './shared/chapterConstants'
import { getCloudPosition } from './shared/chapterUtils'

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

  useEffect(() => {
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


export default ChapterOneDataCloud
