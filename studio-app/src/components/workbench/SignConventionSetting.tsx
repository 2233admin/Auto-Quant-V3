import { useState } from 'react'
import { uiText } from '../../i18n'
import { applySignConvention, storedSignConvention, type SignConvention } from '../../design/signConvention'
import { STATE_COPY } from '../stateCopy'
import { MotionSettingRow } from '../../motion/MotionSetting'
import { SegmentedToggle } from './SegmentedToggle'
import { SectionBar } from '../../design/marks'

export function SignConventionSetting({ readOnly = false }: { readOnly?: boolean }) {
  const [value, setValue] = useState<SignConvention>(storedSignConvention)
  return <section className="set-sec" aria-labelledby="display-settings"><SectionBar as="h2" id="display-settings" icon="settings" micro="DISPLAY">{uiText("Display")}</SectionBar>
    <div className="setting-row"><span id="price-colours">{uiText("Price colours")}</span><SegmentedToggle label={uiText("Price colours")} value={value}
      options={[{ id: 'red-up', label: 'Red up, green down' }, { id: 'green-up', label: 'Green up, red down' }]}
      disabledReason={readOnly ? STATE_COPY.readOnlyReason : undefined}
      onChange={next => { applySignConvention(next); setValue(next) }} /></div>
    <p className="small muted">{uiText("Changes colours only. Numbers, signs and exports stay the same.")}</p>
    <MotionSettingRow />
    <p className="small muted">{uiText("System follows the operating system's reduced-motion preference; On plays every effect even when it asks for less.")}</p>
  </section>
}
