function ChapterOneSection({ section, dataCloud }) {
  if (!section) {
    return null
  }

  return (
    <section
      id={section.id}
      className={`snap-section edu-panel chapter-one-section relative flex min-h-screen items-center border-b-8 border-black ${section.bgClass}`}
    >
      <div aria-hidden="true" className="absolute inset-0 texture-grid opacity-50" />
      <div aria-hidden="true" className="absolute inset-0 texture-noise opacity-20" />
      {dataCloud}

      <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-10 px-6 py-16 md:grid-cols-[1.05fr_0.95fr] md:px-12">
        <article className="reveal">
          <p className="inline-block -rotate-2 border-4 border-black bg-white px-4 py-2 text-sm font-black tracking-[0.22em]">
            {section.label}
          </p>

          <h2 className="mt-5 max-w-3xl text-4xl font-black uppercase leading-[0.9] tracking-tight sm:text-5xl md:text-6xl">
            <span className="inline-block rotate-1 border-4 border-black bg-neo-accent px-4 py-2">{section.title}</span>
          </h2>

          <p className="mt-8 max-w-2xl border-4 border-black bg-white p-6 text-lg font-bold leading-relaxed shadow-[8px_8px_0px_0px_#000]">
            {section.description}
          </p>
        </article>

        <aside className="reveal self-center">
          <div className="neo-card rotate-1 bg-white p-6">
            <p className="border-b-4 border-black pb-3 text-xs font-black uppercase tracking-[0.22em]">핵심 포인트</p>
            <ul className="mt-4 space-y-3">
              {section.points.map((point) => (
                <li key={point} className="border-4 border-black bg-neo-cream px-4 py-3 text-base font-bold">
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <div className="-mt-6 ml-auto max-w-sm -rotate-2 border-4 border-black bg-black p-5 text-white shadow-[8px_8px_0px_0px_#000]">
            <p className="text-xs font-black uppercase tracking-[0.2em]">Takeaway</p>
            <p className="mt-2 text-lg font-bold leading-snug">{section.takeaway}</p>
          </div>
        </aside>
      </div>
    </section>
  )
}

export default ChapterOneSection
