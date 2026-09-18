import StorageImage from './StorageImage.jsx'

function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function Avatar({ bucket, path, isPublic = false, name = '', size = 36 }) {
  return (
    <div className="avatar-circle" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>
      <StorageImage
        bucket={bucket}
        path={path}
        isPublic={isPublic}
        alt=""
        className="avatar-circle-img"
        fallback={<span className="avatar-circle-initials">{getInitials(name)}</span>}
      />
    </div>
  )
}
