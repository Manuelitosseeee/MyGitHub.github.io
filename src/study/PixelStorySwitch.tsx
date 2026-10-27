import { store, useStore } from '../data/store';
import { Switch } from '../ui/primitives';
import './studio-controls.css';

/** Same persisted preference as Settings; switching never resets the room. */
export function PixelStorySwitch() {
  const enabled = Boolean(useStore().settings.pixelStory);
  return <div className="studio-mode-control">
    <div><span className="row-title">Pixel Story</span><span className="row-sub">{enabled ? 'Studia nella tua stanza' : 'Attiva la tua stanza di studio'}</span></div>
    <Switch label="Pixel Story in Studio" on={enabled} onChange={pixelStory => store.updateSettings({ pixelStory })} />
  </div>;
}
