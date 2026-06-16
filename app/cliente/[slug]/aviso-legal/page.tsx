import LegalPageView from '@/components/cliente/LegalPageView'

export default async function AvisoLegalPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <LegalPageView slug={slug} tipo="aviso_legal" />
}
