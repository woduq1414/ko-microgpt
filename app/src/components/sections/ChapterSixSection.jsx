function ChapterSixSection({ section, children }) {
  if (!section) {
    return null
  }

  return (
    <section
      id={section.id}
      className={`snap-section edu-panel chapter-six-section relative flex min-h-screen items-center border-b-8 border-black ${section.bgClass}`}
    >
      <div aria-hidden="true" className="absolute inset-0 texture-grid opacity-45" />
      <div aria-hidden="true" className="absolute inset-0 texture-noise opacity-15" />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 py-8 md:px-12 md:py-10">
        <article className="reveal max-w-6xl">
          <p className="inline-block -rotate-2 border-4 border-black bg-neo-secondary px-4 py-2 text-sm font-black tracking-[0.22em]">
            {section.label}
          </p>

          <h2 className="mt-4 max-w-3xl text-4xl font-black uppercase leading-[0.9] tracking-tight sm:text-5xl md:text-6xl">
            <span className="inline-block rotate-1 border-4 border-black bg-neo-accent px-4 py-2">{section.title}</span>
          </h2>

          <p className="mt-5 max-w-[100%] border-4 border-black bg-white p-4 text-base font-bold leading-relaxed shadow-[6px_6px_0px_0px_#000]">
            {section.description}
          </p>
        </article>

        {children}
      </div>
    </section>
  )
}

export default ChapterSixSection
