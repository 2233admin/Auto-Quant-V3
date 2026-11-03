import { formattedSignRole, signedNumber } from '../../design/signConvention'
import { AnimatedValue } from '../motion/AnimatedValue'
import { CountUp } from '../../motion/CountUp'

/** Only explicitly designated focal containers may opt in to sign colour. */
export function SignedValue({ value, digits = 2, unit = '', focal = false }: { value: number | null | undefined; digits?: number; unit?: string; focal?: boolean }) {
  const text = signedNumber(value, digits, unit)
  return <span className={focal ? 'signed-value type-value-focal' : 'type-value'} data-sign={focal ? formattedSignRole(text) : undefined}>{focal ? <CountUp value={text} /> : <AnimatedValue value={text} />}</span>
}
