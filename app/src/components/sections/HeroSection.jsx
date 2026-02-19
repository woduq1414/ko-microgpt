function HeroSection() {
  return (
    <header className="snap-section relative min-h-screen border-b-8 border-black bg-neo-cream">
      <div aria-hidden="true" className="absolute inset-0 texture-grid opacity-70" />
      <div aria-hidden="true" className="absolute inset-0 texture-halftone opacity-20" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-6 py-16 md:px-12">
        <p className="hero-sticker inline-block w-fit -rotate-2 border-4 border-black bg-neo-accent px-5 py-2 text-sm font-black tracking-[0.22em]">
          EDUCATION MODE
        </p>

        <h1 className="mt-8 max-w-6xl text-5xl font-black uppercase leading-[0.85] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
          <span className="hero-sticker inline-block -rotate-1 border-4 border-black bg-white px-4 py-2">FULL-SCREEN</span>{' '}
          <span className="hero-sticker inline-block rotate-1 border-4 border-black bg-neo-secondary px-4 py-2">SCROLL</span>{' '}
          <span className="hero-sticker display-stroke inline-block">LESSON</span>
        </h1>

        <p className="hero-sticker mt-10 max-w-3xl -rotate-1 border-4 border-black bg-white p-6 text-lg font-bold leading-relaxed shadow-[8px_8px_0px_0px_#000] md:text-xl">
          React + Tailwind + GSAP 기반으로 만든 교육용 페이지입니다. 스크롤하며 모델 구조를 학습할 수 있도록 각 챕터를
          풀스크린 카드처럼 구성했습니다.
        </p>

        <div className="hero-sticker mt-8 flex flex-wrap gap-4">
          <a href="#lesson-1" className="neo-btn bg-neo-accent px-8 py-4 text-sm font-black uppercase tracking-[0.14em]">
            Start Class
          </a>
          <a href="#lesson-3" className="neo-btn bg-neo-secondary px-8 py-4 text-sm font-black uppercase tracking-[0.14em]">
            Jump To Embedding
          </a>
        </div>
      </div>
    </header>
  )
}

export default HeroSection
