import { useEffect, useRef, useState } from 'react'

function HeroSection() {
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

  return (
    <header className="snap-section relative min-h-screen border-b-8 border-black bg-neo-cream">
      <div aria-hidden="true" className="absolute inset-0 texture-grid opacity-70" />
      <div aria-hidden="true" className="absolute inset-0 texture-halftone opacity-20" />

      <button
        ref={infoStickerRef}
        type="button"
        className="hero-info-sticker hero-sticker"
        onClick={() => setIsProjectInfoOpen(true)}
        aria-label="프로젝트 정보 열기"
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
          한국어 이름 생성 GPT가 어떻게 데이터를 읽고, 새로운 이름을 생성하는 지 알아볼까요?
        </p>

        <div className="hero-sticker mt-8 flex flex-wrap gap-4">
          <a href="#lesson-1" className="neo-btn bg-neo-accent px-8 py-4 text-sm font-black uppercase tracking-[0.14em]">
            Start From Data
          </a>
          <a
            href="https://github.com/woduq1414/ko-microgpt"
            target="_blank"
            rel="noopener noreferrer"
            className="neo-btn bg-neo-secondary px-8 py-4 text-sm font-black uppercase tracking-[0.14em]"
          >
            Go To Github
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
              aria-label="프로젝트 정보 닫기"
            >
              X
            </button>

            <p id="hero-project-info-title" className="hero-info-modal-title">
              PROJECT INFO
            </p>
            <p id="hero-project-info-description" className="hero-info-modal-text">
              이 프로젝트는 <a href="https://github.com/karpathy" target="_blank" rel="noopener noreferrer" className="hero-info-inline-link">Karpathy</a>의{' '}
              <a
                href="https://gist.github.com/karpathy/8627fe009c40f57531cb18360106ce95"
                target="_blank"
                rel="noopener noreferrer"
                className="hero-info-inline-link"
              >
                microgpt 프로젝트
              </a>
              를 기반으로, 한국어 이름을 생성하는 GPT 모델의 내부 동작 과정을 시각화 한 프로젝트입니다.
            </p>

            <a
              href="https://github.com/woduq1414/ko-microgpt/"
              target="_blank"
              rel="noopener noreferrer"
              className="neo-btn hero-info-modal-link bg-neo-secondary px-6 py-3 text-sm font-black uppercase tracking-[0.14em]"
            >
              Go To this website Github
            </a>
          </div>
        </div>
      ) : null}
    </header>
  )
}

export default HeroSection
