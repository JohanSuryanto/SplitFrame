import { useEffect, useRef } from 'react';
import { SAMPLE_IDS, SAMPLE_NAMES, type SampleId } from '../samples/plan';
import { sampleThumbnail } from '../samples/samples';
import styles from './SamplePicker.module.css';

interface SamplePickerProps {
  onPick: (id: SampleId) => void;
  onCancel: () => void;
}

/** Choose one of the built-in sample artworks for a cell. */
export function SamplePicker({ onPick, onCancel }: SamplePickerProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="samples-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCancel();
      }}
    >
      <h2 id="samples-title" className={styles.title}>
        Sample photos
      </h2>
      <p className={styles.sub}>Built into SplitFrame, so you can try layouts without your own photos.</p>
      <div className={styles.grid}>
        {SAMPLE_IDS.map((id) => (
          <button key={id} type="button" className={styles.item} onClick={() => onPick(id)}>
            <img className={styles.thumb} src={sampleThumbnail(id)} alt="" />
            <span>{SAMPLE_NAMES[id]}</span>
          </button>
        ))}
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </dialog>
  );
}
