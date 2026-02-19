function FooterSection() {
  return (
    <footer className="snap-section flex min-h-screen items-center border-t-8 border-black bg-black px-6 py-10 text-white md:px-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-5 md:flex-row md:items-center">
        <p className="border-4 border-white bg-black px-4 py-3 text-sm font-black uppercase tracking-[0.18em]">
          NEXT: API 연결 후 인터랙티브 퀴즈 섹션 추가
        </p>
        <a
          href="#"
          className="neo-btn border-white bg-neo-secondary px-8 py-4 text-sm font-black uppercase tracking-[0.14em] text-black"
        >
          Build Next Module
        </a>
      </div>
    </footer>
  )
}

export default FooterSection
