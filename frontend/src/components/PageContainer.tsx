import type { ReactNode } from 'react'

type PageContainerProps = {
  children: ReactNode
  className?: string
  narrow?: boolean
  center?: boolean
}

export default function PageContainer({
  children,
  className = '',
  narrow = false,
  center = false,
}: PageContainerProps) {
  return (
    <div
      className={`page-container ${narrow ? 'page-container--narrow' : ''} ${center ? 'page-content-center' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
