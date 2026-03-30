import { Suspense } from 'react'
import InvoicesView from './InvoicesView'

export default function InvoicesPage() {
  return (
    <Suspense>
      <InvoicesView />
    </Suspense>
  )
}
