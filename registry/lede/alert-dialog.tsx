import * as React from 'react';
import { AlertDialog as Base } from '@base-ui/react/alert-dialog';
import { Button } from './button';
import { cn } from './cn';
import { ThemeScope } from './theme-provider';
import type { ToneSubset } from './tone';

export interface AlertDialogProps {
  /** The question, such as “Delete edge-sfo-2?”. It names the dialog. */
  title: React.ReactNode;
  /** What happens if the person confirms, such as “Its 3 deploy runs go too. You can’t undo this.” It describes the dialog. */
  description?: React.ReactNode;
  /** The confirm button’s label, a verb for what it does, such as “Delete”. */
  confirmLabel: string;
  /** The cancel button’s label. Default “Cancel”. */
  cancelLabel?: string;
  /** `'critical'` for an action that destroys something: the confirm button turns critical, and focus opens on Cancel. Default `'primary'`. */
  tone?: ToneSubset<'primary' | 'critical'>;
  /** Runs when the person confirms, before the dialog closes. */
  onConfirm: () => void;
  /** The control that opens the dialog, such as a Button. Leave it unset and pass `open` to open it from elsewhere, such as a row action. */
  trigger?: React.ReactElement;
  /** Whether the dialog is open, for a parent that controls it. */
  open?: boolean;
  /** Whether the dialog is open at first. Default `false`. */
  defaultOpen?: boolean;
  /** Called with the new state when the dialog opens or closes, by a button, Escape or the trigger. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Where focus goes when the dialog closes. Default: the trigger, or the control that had focus when it opened. Pass
   * an element when that control is gone, such as a row the action deleted.
   */
  finalFocus?: React.RefObject<HTMLElement | null>;
  /** Classes for the dialog’s box. */
  className?: string;
}

/**
 * A modal that asks before an action that needs a second thought: Base UI AlertDialog, a `role="alertdialog"` named by
 * its title and described by its description, with Cancel and a confirm Button. Focus opens on the confirm button, or on
 * Cancel when `tone` is `'critical'`, stays inside while it’s open and returns to where it was. Escape cancels, and a
 * press outside does nothing.
 */
export function AlertDialog({
  title, description, confirmLabel, cancelLabel = 'Cancel', tone = 'primary', onConfirm, trigger, open, defaultOpen,
  onOpenChange, finalFocus, className,
}: AlertDialogProps) {
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const confirmRef = React.useRef<HTMLButtonElement>(null);
  const critical = tone === 'critical';
  return (
    <Base.Root open={open} defaultOpen={defaultOpen} onOpenChange={(o) => onOpenChange?.(o)}>
      {trigger ? <Base.Trigger render={trigger} /> : null}
      <Base.Portal>
        <ThemeScope>
          <Base.Backdrop className="ld-dialog-backdrop" />
          <Base.Viewport className="ld-dialog-viewport">
            <Base.Popup
              className={cn('ld-dialog', className)}
              initialFocus={critical ? cancelRef : confirmRef}
              finalFocus={finalFocus}
            >
              <Base.Title className="ld-dialog-title">{title}</Base.Title>
              {description ? <Base.Description className="ld-dialog-description">{description}</Base.Description> : null}
              <div className="ld-dialog-actions">
                <Base.Close render={<Button ref={cancelRef} />}>{cancelLabel}</Base.Close>
                <Base.Close render={<Button ref={confirmRef} variant="filled" tone={critical ? 'critical' : undefined} />} onClick={onConfirm}>
                  {confirmLabel}
                </Base.Close>
              </div>
            </Base.Popup>
          </Base.Viewport>
        </ThemeScope>
      </Base.Portal>
    </Base.Root>
  );
}
