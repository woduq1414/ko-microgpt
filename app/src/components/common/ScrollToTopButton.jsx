import { useEffect, useState } from 'react'

const HIDDEN_SECTION_IDS = ['hero', 'outro']

const isSectionVisibleInViewport = (section, viewportHeight) => {
  const bounds = section.getBoundingClientRect()
  return bounds.bottom > 0 && bounds.top < viewportHeight
}

const getInitialHiddenSectionVisibility = () => {
  if (typeof window === 'undefined') {
    return false
  }

  const viewportHeight = window.innerHeight
  return HIDDEN_SECTION_IDS.some((id) => {
    const section = document.getElementById(id)
    return section ? isSectionVisibleInViewport(section, viewportHeight) : false
  })
}

function ScrollToTopButton({ reducedMotion = false }) {
  const [isHiddenSectionVisible, setIsHiddenSectionVisible] = useState(getInitialHiddenSectionVisibility)
  const [hasScrollablePage, setHasScrollablePage] = useState(false)
  const [scrollbarOffset, setScrollbarOffset] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const measureViewport = () => {
      const docElement = document.documentElement
      const nextScrollbarWidth = Math.max(0, window.innerWidth - docElement.clientWidth)
      const nextHasScrollablePage = docElement.scrollHeight > window.innerHeight
      const nextScrollbarOffset = nextScrollbarWidth > 0 ? nextScrollbarWidth + 14 : 0
      setScrollbarOffset(nextScrollbarOffset)
      setHasScrollablePage(nextHasScrollablePage)
    }

    measureViewport()

    let resizeObserver = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(measureViewport)
      resizeObserver.observe(document.documentElement)
      if (document.body) {
        resizeObserver.observe(document.body)
      }
    }

    window.addEventListener('resize', measureViewport)
    window.addEventListener('orientationchange', measureViewport)

    return () => {
      window.removeEventListener('resize', measureViewport)
      window.removeEventListener('orientationchange', measureViewport)
      resizeObserver?.disconnect()
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const targets = HIDDEN_SECTION_IDS.map((id) => document.getElementById(id)).filter(Boolean)
    if (!targets.length) {
      return undefined
    }

    if (typeof IntersectionObserver === 'undefined') {
      const handleVisibility = () => {
        const viewportHeight = window.innerHeight
        setIsHiddenSectionVisible(targets.some((section) => isSectionVisibleInViewport(section, viewportHeight)))
      }

      handleVisibility()
      window.addEventListener('scroll', handleVisibility, { passive: true })
      window.addEventListener('resize', handleVisibility)

      return () => {
        window.removeEventListener('scroll', handleVisibility)
        window.removeEventListener('resize', handleVisibility)
      }
    }

    const visibilityMap = new Map(targets.map((section) => [section.id, false]))
    const syncVisibility = () => {
      setIsHiddenSectionVisible(Array.from(visibilityMap.values()).some(Boolean))
    }

    const viewportHeight = window.innerHeight
    targets.forEach((section) => {
      visibilityMap.set(section.id, isSectionVisibleInViewport(section, viewportHeight))
    })
    syncVisibility()

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          visibilityMap.set(entry.target.id, entry.isIntersecting)
        })
        syncVisibility()
      },
      {
        threshold: 0,
      },
    )

    targets.forEach((section) => {
      observer.observe(section)
    })

    return () => {
      observer.disconnect()
    }
  }, [])

  const shouldShow = hasScrollablePage && !isHiddenSectionVisible

  const onClick = () => {
    const heroSection = document.getElementById('hero')
    if (heroSection) {
      heroSection.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'start',
      })
      return
    }

    window.scrollTo({
      top: 0,
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
  }

  return (
    <button
      type="button"
      className={`scroll-top-fab ${shouldShow ? 'scroll-top-fab--visible' : 'scroll-top-fab--hidden'}`}
      style={{ '--scrollbar-offset': `${scrollbarOffset}px` }}
      onClick={onClick}
      aria-label="Scroll to top"
      tabIndex={shouldShow ? 0 : -1}
    >
      <svg className="scroll-top-fab__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M6 14L12 8L18 14" />
      </svg>
    </button>
  )
}

export default ScrollToTopButton
