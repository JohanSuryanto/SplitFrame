import type { ReactNode } from 'react';
import { DrawIcon, LayoutIcon, StyleIcon } from './icons';
import { SHEET_IGNORE_ATTR } from './Sheet';
import styles from './Dock.module.css';

export type PanelName = 'layout' | 'style' | 'export';

interface DockProps {
  panel: PanelName | null;
  drawing: boolean;
  onTogglePanel: (panel: 'layout' | 'style') => void;
  onToggleDraw: () => void;
}

function Item(props: { label: string; icon: ReactNode; active: boolean; onClick: () => void; controls?: string; toggle?: boolean }) {
  return (
    <button
      type="button"
      className={styles.item}
      data-active={props.active ? '' : undefined}
      aria-pressed={props.toggle ? props.active : undefined}
      aria-expanded={props.toggle ? undefined : props.active}
      aria-controls={props.controls}
      onClick={props.onClick}
    >
      {props.icon}
      <span>{props.label}</span>
    </button>
  );
}

/** The floating tool dock at the bottom of the screen, where thumbs reach on a phone. */
export function Dock({ panel, drawing, onTogglePanel, onToggleDraw }: DockProps) {
  return (
    <nav className={styles.dock} aria-label="Tools" {...{ [SHEET_IGNORE_ATTR]: '' }}>
      <Item label="Layout" icon={<LayoutIcon />} active={panel === 'layout'} controls="layout-sheet" onClick={() => onTogglePanel('layout')} />
      <Item label="Draw" icon={<DrawIcon />} active={drawing} toggle onClick={onToggleDraw} />
      <Item label="Style" icon={<StyleIcon />} active={panel === 'style'} controls="style-sheet" onClick={() => onTogglePanel('style')} />
    </nav>
  );
}
