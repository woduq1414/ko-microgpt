import SectionStateCard from './SectionStateCard'

function AsyncChapterContent({ status, title, loadingMessage, errorMessage, children }) {
  if (status === 'loading') {
    return <SectionStateCard title={title} message={loadingMessage} />
  }

  if (status === 'error') {
    return <SectionStateCard title={title} message={errorMessage} />
  }

  if (status === 'ready') {
    return children ?? null
  }

  return null
}

export default AsyncChapterContent
