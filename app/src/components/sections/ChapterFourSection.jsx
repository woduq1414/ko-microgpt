import ChapterSectionShell from './ChapterSectionShell'

function ChapterFourSection({ section, children }) {
  return (
    <ChapterSectionShell
      section={section}
      sectionClassName="chapter-four-section"
      labelBgClass="bg-neo-secondary"
    >
      {children}
    </ChapterSectionShell>
  )
}

export default ChapterFourSection
