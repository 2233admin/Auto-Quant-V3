import { useState } from 'react'
import { translate, useLanguage } from '../i18n'
import { applyMotion, storedMotion, type MotionSetting as Setting } from './motion'
import { SegmentedToggle } from '../components/workbench/SegmentedToggle'

/** 动效 / Motion: on, follow the system, or off. Default on; stored like the language setting. */
export function MotionSettingRow() {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  const [value, setValue] = useState<Setting>(storedMotion)
  const options = [
    { id: 'on', label: t('On', '开') },
    { id: 'system', label: t('System', '跟随系统') },
    { id: 'off', label: t('Off', '关') },
  ] as const
  return (
    <div className="setting-row">
      <span id="motion-setting">{t('Motion', '动效')}</span>
      <SegmentedToggle label={t('Motion', '动效')} value={value} options={options} onChange={(next) => { applyMotion(next); setValue(next) }} />
    </div>
  )
}
