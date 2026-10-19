export default function PageLoading({ label }: { label: string }) {
  return <section className="shell page-loading" role="status" aria-live="polite" aria-busy="true">
    <p className="page-loading-label">{label}</p>
    <div className="page-loading-heading" aria-hidden="true" />
    <div className="page-loading-grid" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map(item => <div className="page-loading-card" key={item}><span /><span /><span /></div>)}
    </div>
  </section>;
}
