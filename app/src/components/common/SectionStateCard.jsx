function SectionStateCard({ title, message, className = 'reveal' }) {
  return (
    <div className={`token-state-card ${className}`.trim()}>
      <p className="text-sm font-black uppercase tracking-[0.2em]">{title}</p>
      <p className="mt-3 text-lg font-bold">{message}</p>
    </div>
  )
}

export default SectionStateCard
