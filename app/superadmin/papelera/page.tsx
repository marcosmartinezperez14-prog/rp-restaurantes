import { getPapeleraFase1 } from '@/app/actions/papelera'
import SuperadminPapeleraView from './SuperadminPapeleraView'

export default async function SuperadminPapeleraPage() {
  const datos = await getPapeleraFase1()
  return <SuperadminPapeleraView datos={datos} />
}
