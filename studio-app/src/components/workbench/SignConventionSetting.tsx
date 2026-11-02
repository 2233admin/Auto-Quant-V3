import { useState } from 'react'
import { applySignConvention, storedSignConvention, type SignConvention } from '../../design/signConvention'
import { STATE_COPY } from '../stateCopy'
import { SegmentedToggle } from './SegmentedToggle'

export function SignConventionSetting({ readOnly = false }: { readOnly?: boolean }) {
  const [value, setValue] = useState<SignConvention>(storedSignConvention)
  return <section className="set-sec" aria-labelledby="display-settings"><h2 id="display-settings">Display</h2>
    <div className="setting-row"><span id="price-colours">Price colours</span><SegmentedToggle label="Price colours" value={value}
      options={[{ id: 'red-up', label: 'Red up, green down' }, { id: 'green-up', label: 'Green up, red down' }]}
      disabledReason={readOnly ? STATE_COPY.readOnlyReason : undefined}
      onChange={next => { applySignConvention(next); setValue(next) }} /></div>
    <p className="small muted">Changes colours only. Numbers, signs and exports stay the same.</p>
  </section>
}
