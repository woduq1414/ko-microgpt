import ChapterSectionShell from './ChapterSectionShell'

function ChapterSevenSection({ section, children }) {
  return (
    <ChapterSectionShell
      section={section}
      sectionClassName="chapter-seven-section"
      labelBgClass="bg-white"
    >
      {children}
    </ChapterSectionShell>
  )
}

export default ChapterSevenSection
