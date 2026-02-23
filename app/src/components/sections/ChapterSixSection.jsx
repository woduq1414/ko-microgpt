import ChapterSectionShell from './ChapterSectionShell'

function ChapterSixSection({ section, children }) {
  return (
    <ChapterSectionShell
      section={section}
      sectionClassName="chapter-six-section"
      labelBgClass="bg-neo-secondary"
    >
      {children}
    </ChapterSectionShell>
  )
}

export default ChapterSixSection
