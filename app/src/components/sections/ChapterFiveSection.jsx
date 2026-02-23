import ChapterSectionShell from './ChapterSectionShell'

function ChapterFiveSection({ section, children }) {
  return (
    <ChapterSectionShell
      section={section}
      sectionClassName="chapter-five-section"
      labelBgClass="bg-neo-secondary"
    >
      {children}
    </ChapterSectionShell>
  )
}

export default ChapterFiveSection
