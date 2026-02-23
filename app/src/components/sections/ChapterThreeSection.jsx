import ChapterSectionShell from './ChapterSectionShell'

function ChapterThreeSection({ section, children }) {
  return (
    <ChapterSectionShell
      section={section}
      sectionClassName="chapter-three-section"
      labelBgClass="bg-neo-secondary"
    >
      {children}
    </ChapterSectionShell>
  )
}

export default ChapterThreeSection
