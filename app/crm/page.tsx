import { getCrmData } from '@/app/actions/crm'
import CrmClient from './CrmClient'

export default async function CrmPage() {
  const data = await getCrmData()
  return <CrmClient initialData={data} />
}
