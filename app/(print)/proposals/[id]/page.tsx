import ProposalPrint from './ProposalPrint';

export default async function ProposalPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProposalPrint id={id} />;
}
