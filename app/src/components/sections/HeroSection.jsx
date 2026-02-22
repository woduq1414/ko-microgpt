import { useEffect, useRef, useState } from 'react'

function HeroSection({ language, onLanguageChange, copy }) {
  const [isProjectInfoOpen, setIsProjectInfoOpen] = useState(false)
  const infoStickerRef = useRef(null)
  const modalCloseButtonRef = useRef(null)

  useEffect(() => {
    if (!isProjectInfoOpen) {
      return undefined
    }

    const infoStickerElement = infoStickerRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    modalCloseButtonRef.current?.focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsProjectInfoOpen(false)
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      infoStickerElement?.focus()
    }
  }, [isProjectInfoOpen])

  const setLanguage = (nextLanguage) => {
    if (typeof onLanguageChange === 'function') {
      onLanguageChange(nextLanguage)
    }
  }

  return (
    <header id="hero" className="snap-section relative min-h-screen border-b-8 border-black bg-neo-cream">
      <div aria-hidden="true" className="absolute inset-0 texture-grid opacity-70" />
      <div aria-hidden="true" className="absolute inset-0 texture-halftone opacity-20" />

      <div className="hero-control-cluster">
        <div className="hero-language-toggle hero-sticker" role="group" aria-label={copy.languageSwitchAria}>
          <button
            type="button"
            className={`hero-language-option ${language === 'ko' ? 'hero-language-option--active' : ''}`.trim()}
            onClick={() => setLanguage('ko')}
            aria-pressed={language === 'ko'}
          >
            KO
          </button>
          <button
            type="button"
            className={`hero-language-option ${language === 'en' ? 'hero-language-option--active' : ''}`.trim()}
            onClick={() => setLanguage('en')}
            aria-pressed={language === 'en'}
          >
            EN
          </button>
        </div>
      </div>

      <button
        ref={infoStickerRef}
        type="button"
        className="hero-info-sticker hero-info-sticker--bottom-right"
        onClick={() => setIsProjectInfoOpen(true)}
        aria-label={copy.openProjectInfoAria}
        aria-haspopup="dialog"
        aria-expanded={isProjectInfoOpen}
        aria-controls="hero-project-info-modal"
      >
        i
      </button>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-6 py-16 md:px-12">
        <p className="hero-sticker inline-block w-fit -rotate-2 border-4 border-black bg-neo-accent px-5 py-2 text-sm font-black tracking-[0.22em]">
          KOREAN GPT LAB
        </p>

        <h1 className="mt-8 max-w-6xl text-5xl font-black uppercase leading-[0.85] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
          <span className="hero-sticker inline-block -rotate-1 border-4 border-black bg-white px-4 py-2">KOREAN NAME</span>{' '}
          <span className="hero-sticker inline-block rotate-1 border-4 border-black bg-neo-secondary px-4 py-2">MICROGPT</span>{' '}
          <span className="hero-sticker display-stroke inline-block">INSIDE</span>
        </h1>

        <p className="hero-sticker mt-10 max-w-3xl -rotate-1 border-4 border-black bg-white p-6 text-lg font-bold leading-relaxed shadow-[8px_8px_0px_0px_#000] md:text-xl">
          {copy.intro}
        </p>

        <div className="hero-sticker mt-8 flex flex-wrap gap-4">
          <a href="#lesson-1" className="neo-btn bg-neo-accent px-8 py-4 text-sm font-black uppercase tracking-[0.14em]">
            {copy.startFromData}
          </a>
          <a
            href="https://github.com/woduq1414/ko-microgpt"
            target="_blank"
            rel="noopener noreferrer"
            className="neo-btn bg-neo-secondary px-8 py-4 text-sm font-black uppercase tracking-[0.14em]"
          >
            {copy.goToGithub}
          </a>
        </div>
      </div>

      {isProjectInfoOpen ? (
        <div
          className="hero-info-backdrop"
          onClick={() => setIsProjectInfoOpen(false)}
          role="presentation"
        >
          <div
            id="hero-project-info-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hero-project-info-title"
            aria-describedby="hero-project-info-description"
            className="hero-info-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              ref={modalCloseButtonRef}
              type="button"
              className="hero-info-modal-close"
              onClick={() => setIsProjectInfoOpen(false)}
              aria-label={copy.closeProjectInfoAria}
            >
              X
            </button>

            <p id="hero-project-info-title" className="hero-info-modal-title">
              {copy.projectInfoTitle}
            </p>
            <p id="hero-project-info-description" className="hero-info-modal-text">
              {copy.projectInfoStart}
              <a href="https://github.com/karpathy" target="_blank" rel="noopener noreferrer" className="hero-info-inline-link">
                Karpathy
              </a>
              {copy.projectInfoMiddle}
              <a
                href="https://gist.github.com/karpathy/8627fe009c40f57531cb18360106ce95"
                target="_blank"
                rel="noopener noreferrer"
                className="hero-info-inline-link"
              >
                {copy.projectInfoMicrogptLinkText}
              </a>
              {copy.projectInfoEnd}
            </p>

            <a
              href="https://github.com/woduq1414/ko-microgpt/"
              target="_blank"
              rel="noopener noreferrer"
              className="neo-btn hero-info-modal-link bg-neo-secondary px-6 py-3 text-sm font-black uppercase tracking-[0.14em]"
            >
              {copy.projectInfoGithub}
            </a>
          </div>
        </div>
      ) : null}
    </header>
  )
}

export default HeroSection
