import { useEffect, useRef, useState } from 'react'

function HeroSection({
  exampleLanguage,
  descriptionLanguage,
  onLanguageSettingsConfirm,
  copy,
}) {
  const [isProjectInfoOpen, setIsProjectInfoOpen] = useState(false)
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false)
  const [draftExampleLanguage, setDraftExampleLanguage] = useState(exampleLanguage)
  const [draftDescriptionLanguage, setDraftDescriptionLanguage] = useState(descriptionLanguage)
  const infoStickerRef = useRef(null)
  const languageButtonRef = useRef(null)
  const modalCloseButtonRef = useRef(null)
  const languageModalCloseButtonRef = useRef(null)

  useEffect(() => {
    setDraftExampleLanguage(exampleLanguage)
  }, [exampleLanguage])

  useEffect(() => {
    setDraftDescriptionLanguage(descriptionLanguage)
  }, [descriptionLanguage])

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

  useEffect(() => {
    if (!isLanguageModalOpen) {
      return undefined
    }

    const languageButtonElement = languageButtonRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    languageModalCloseButtonRef.current?.focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsLanguageModalOpen(false)
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      languageButtonElement?.focus()
    }
  }, [isLanguageModalOpen])

  const openLanguageModal = () => {
    setDraftExampleLanguage(exampleLanguage)
    setDraftDescriptionLanguage(descriptionLanguage)
    setIsLanguageModalOpen(true)
  }

  const confirmLanguageSettings = () => {
    if (typeof onLanguageSettingsConfirm === 'function') {
      onLanguageSettingsConfirm({
        exampleLanguage: draftExampleLanguage,
        descriptionLanguage: draftDescriptionLanguage,
      })
    }
    setIsLanguageModalOpen(false)
  }

  const resolvedExampleLanguage = exampleLanguage === 'en' ? 'en' : 'ko'
  const heroLabLabel = resolvedExampleLanguage === 'en' ? 'ENGLISH GPT LAB' : 'KOREAN GPT LAB'
  const heroNameLabel = resolvedExampleLanguage === 'en' ? 'ENGLISH NAME' : 'KOREAN NAME'
  const introText = copy?.introByExampleLanguage?.[resolvedExampleLanguage] ?? copy?.intro ?? ''
  const projectInfoEndText = copy?.projectInfoEndByExampleLanguage?.[resolvedExampleLanguage] ?? copy?.projectInfoEnd ?? ''

  return (
    <header id="hero" className="snap-section relative min-h-screen border-b-8 border-black bg-neo-cream">
      <div aria-hidden="true" className="absolute inset-0 texture-grid opacity-70" />
      <div aria-hidden="true" className="absolute inset-0 texture-halftone opacity-20" />

      <div className="hero-control-cluster">
        <button
          ref={languageButtonRef}
          type="button"
          className="hero-language-button hero-sticker"
          onClick={openLanguageModal}
          aria-label={copy.openLanguageSettingsAria}
          aria-haspopup="dialog"
          aria-expanded={isLanguageModalOpen}
          aria-controls="hero-language-modal"
        >
          {copy.languageButtonText}
        </button>
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
          {heroLabLabel}
        </p>

        <h1 className="mt-8 max-w-6xl text-5xl font-black uppercase leading-[0.85] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
          <span className="hero-sticker inline-block -rotate-1 border-4 border-black bg-white px-4 py-2">{heroNameLabel}</span>{' '}
          <span className="hero-sticker inline-block rotate-1 border-4 border-black bg-neo-secondary px-4 py-2">MICROGPT</span>{' '}
          <span className="hero-sticker display-stroke inline-block">INSIDE</span>
        </h1>

        <p className="hero-sticker mt-10 max-w-3xl -rotate-1 border-4 border-black bg-white p-6 text-lg font-bold leading-relaxed shadow-[8px_8px_0px_0px_#000] md:text-xl">
          {introText}
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

      {isLanguageModalOpen ? (
        <div
          className="hero-language-backdrop"
          onClick={() => setIsLanguageModalOpen(false)}
          role="presentation"
        >
          <div
            id="hero-language-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hero-language-modal-title"
            className="hero-language-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              ref={languageModalCloseButtonRef}
              type="button"
              className="hero-language-modal-close"
              onClick={() => setIsLanguageModalOpen(false)}
              aria-label={copy.closeLanguageSettingsAria}
            >
              X
            </button>

            <p id="hero-language-modal-title" className="hero-language-modal-title">
              {copy.languageModalTitle}
            </p>

            <fieldset className="hero-language-fieldset" aria-label={copy.exampleLanguageLabel}>
              <legend className="hero-language-legend">{copy.exampleLanguageLabel}</legend>
              <div className="hero-language-option-group" role="group" aria-label={copy.exampleLanguageLabel}>
                <button
                  type="button"
                  className={`hero-language-option-btn ${draftExampleLanguage === 'ko' ? 'hero-language-option-btn--active' : ''}`.trim()}
                  onClick={() => setDraftExampleLanguage('ko')}
                  aria-pressed={draftExampleLanguage === 'ko'}
                >
                  {copy.languageOptionKo}
                </button>
                <button
                  type="button"
                  className={`hero-language-option-btn ${draftExampleLanguage === 'en' ? 'hero-language-option-btn--active' : ''}`.trim()}
                  onClick={() => setDraftExampleLanguage('en')}
                  aria-pressed={draftExampleLanguage === 'en'}
                >
                  {copy.languageOptionEn}
                </button>
              </div>
            </fieldset>

            <fieldset className="hero-language-fieldset" aria-label={copy.descriptionLanguageLabel}>
              <legend className="hero-language-legend">{copy.descriptionLanguageLabel}</legend>
              <div className="hero-language-option-group" role="group" aria-label={copy.descriptionLanguageLabel}>
                <button
                  type="button"
                  className={`hero-language-option-btn ${draftDescriptionLanguage === 'ko' ? 'hero-language-option-btn--active' : ''}`.trim()}
                  onClick={() => setDraftDescriptionLanguage('ko')}
                  aria-pressed={draftDescriptionLanguage === 'ko'}
                >
                  {copy.languageOptionKo}
                </button>
                <button
                  type="button"
                  className={`hero-language-option-btn ${draftDescriptionLanguage === 'en' ? 'hero-language-option-btn--active' : ''}`.trim()}
                  onClick={() => setDraftDescriptionLanguage('en')}
                  aria-pressed={draftDescriptionLanguage === 'en'}
                >
                  {copy.languageOptionEn}
                </button>
              </div>
            </fieldset>

            <div className="hero-language-actions">
              <button
                type="button"
                className="hero-language-cancel"
                onClick={() => setIsLanguageModalOpen(false)}
              >
                {copy.cancelLanguageButton}
              </button>
              <button type="button" className="hero-language-confirm" onClick={confirmLanguageSettings}>
                {copy.confirmLanguageButton}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
              {projectInfoEndText}
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
