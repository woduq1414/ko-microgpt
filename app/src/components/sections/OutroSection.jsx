function OutroSection({ copy }) {
  return (
    <section id="outro" className="snap-section edu-panel relative flex min-h-screen items-center border-b-8 border-black bg-neo-secondary">
      <div aria-hidden="true" className="absolute inset-0 texture-grid opacity-45" />
      <div aria-hidden="true" className="absolute inset-0 texture-halftone opacity-20" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col items-center justify-center px-6 py-16 text-center md:px-12">
        <p className="reveal max-w-4xl -rotate-1 border-4 border-black bg-neo-cream p-6 text-2xl font-black leading-relaxed shadow-[8px_8px_0px_0px_#000] md:text-3xl">
          {copy.message}
        </p>

        <div className="reveal mt-8 flex flex-wrap justify-center gap-4">
          <a href="#hero" className="neo-btn bg-neo-accent px-8 py-4 text-sm font-black uppercase tracking-[0.14em]">
            {copy.backToTop}
          </a>
          <a
            href="https://github.com/woduq1414/ko-microgpt"
            target="_blank"
            rel="noopener noreferrer"
            className="neo-btn bg-white px-8 py-4 text-sm font-black uppercase tracking-[0.14em]"
          >
            {copy.goToGithub}
          </a>
        </div>
      </div>
    </section>
  )
}

export default OutroSection
