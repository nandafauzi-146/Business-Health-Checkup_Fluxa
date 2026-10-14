export default function AdminDashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" role="status" aria-busy="true" aria-label="Memuat dashboard admin">
      <div>
        <div className="dashboard-skeleton-shimmer dashboard-skeleton-heading" />
        <div className="dashboard-skeleton-shimmer dashboard-skeleton-subtitle" />
      </div>
      <div className="dashboard-skeleton-stats">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="dashboard-skeleton-block dashboard-skeleton-stat" key={index}>
            <div className="dashboard-skeleton-shimmer" style={{ width: '46%', height: 14, marginBottom: 20 }} />
            <div className="dashboard-skeleton-shimmer" style={{ width: '68%', height: 28, marginBottom: 12 }} />
            <div className="dashboard-skeleton-shimmer" style={{ width: '54%', height: 11 }} />
          </div>
        ))}
      </div>
      <div className="dashboard-skeleton-main">
        <div>
          <div className="dashboard-skeleton-block dashboard-skeleton-chart" />
          <div className="dashboard-skeleton-block dashboard-skeleton-table" />
        </div>
        <div className="dashboard-skeleton-block dashboard-skeleton-side" />
      </div>
    </div>
  )
}
