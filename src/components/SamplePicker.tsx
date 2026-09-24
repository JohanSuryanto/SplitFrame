import { useEffect, useRef } from 'react';
import { SAMPLE_IDS, SAMPLE_NAMES, type SampleId } from '../samples/plan';
import { sampleThumbnail } from '../samples/samples';
import styles from './SamplePicker.module.css';

interface SamplePickerProps {
  onPick: (id: SampleId) => void;
  onCancel: () => void;
  /** When set, the dialog becomes "Add a photo": your own photos first, samples below. */
  onDevice?: () => void;
}

/** Choose a photo source for a cell: the device's photos (optional) or one of the built-in samples. */
export function SamplePicker({ onPick, onCancel, onDevice }: SamplePickerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const adding = onDevice !== undefined;

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
        {adding ? 'Add a photo' : 'Sample photos'}
      </h2>
      {adding ? (
        <>
          <button type="button" className={styles.device} onClick={onDevice}>
            <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2.5" y="4" width="15" height="12" rx="2.5" />
              <circle cx="7.5" cy="8.5" r="1.5" />
              <path d="m17.5 13-4-4-7 7" />
            </svg>
            Choose from your photos
          </button>
          <p className={styles.or}>Or use a sample</p>
        </>
      ) : (
        <p className={styles.sub}>Built into SplitFrame, so you can try layouts without your own photos.</p>
      )}
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
