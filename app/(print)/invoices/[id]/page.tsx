import InvoicePrint from './InvoicePrint'

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <InvoicePrint id={id} />
}
