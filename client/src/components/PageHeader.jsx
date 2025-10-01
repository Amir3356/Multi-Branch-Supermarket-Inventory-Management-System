// Page title, description and optional action button(s) on the right
export default function PageHeader({ title, description, children }) {
  return (
    <div className="section-header">
      <div>
        <h2 className="page-title">{title}</h2>
        {description && <p className="page-desc">{description}</p>}
      </div>
      {children}
    </div>
  )
}
