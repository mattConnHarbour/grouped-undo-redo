import { useEffect, useRef, useState } from 'react';
import { SuperDocEditor, type SuperDocRef } from '@superdoc/react';
import type { BrowserDocumentApi, ContentControlInfo } from 'superdoc/ui';
import '@superdoc/react/style.css';
import { CompoundHistoryCoordinator } from './grouped-undo';

const undoCoordinator = new CompoundHistoryCoordinator('undo');
const redoCoordinator = new CompoundHistoryCoordinator('redo');

function reportDocumentError({ error }: { error: unknown }) {
  console.error('SuperDoc could not open the document.', error);
}

function failureMessage(result: unknown): string | null {
  if (!result || typeof result !== 'object' || !('success' in result) || result.success !== false) return null;
  const failure = 'failure' in result ? result.failure : null;
  return failure && typeof failure === 'object' && 'message' in failure && typeof failure.message === 'string'
    ? failure.message
    : 'The operation failed.';
}

export default function App() {
  const editorRef = useRef<SuperDocRef>(null);
  const [doc, setDoc] = useState<BrowserDocumentApi | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Open the document, then insert a content control.');

  useEffect(
    () => () => {
      undoCoordinator.detach();
      redoCoordinator.detach();
    },
    [],
  );

  async function applyUndo() {
    if (!doc) return;
    const result = await undoCoordinator.apply();
    if (result?.wasCompoundOperation && result.appliedCount > 1) {
      const { redoDepth } = await doc.history.get();
      redoCoordinator.arm(redoDepth, result.appliedCount);
    }
  }

  async function applyRedo() {
    if (!doc) return;
    const result = await redoCoordinator.apply();
    if (result?.wasCompoundOperation && result.appliedCount > 1) {
      const { undoDepth } = await doc.history.get();
      undoCoordinator.arm(undoDepth, result.appliedCount);
    }
  }

  useEffect(() => {
    if (!doc) return;
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.shiftKey) void applyRedo();
      else void applyUndo();
    };
    window.addEventListener('keydown', handleHistoryShortcut, true);
    return () => window.removeEventListener('keydown', handleHistoryShortcut, true);
  }, [doc]);

  async function insertContentControl() {
    if (!doc || busy) return;
    setBusy(true);
    try {
      const selection = await doc.selection.current({ includeText: true });
      if (!selection.selectionTarget) throw new Error('Place the caret or select text in the document first.');
      const result = await doc.create.contentControl({
        kind: 'inline',
        controlType: 'text',
        lockMode: 'contentLocked',
        tag: `grouped-undo-demo.${Date.now()}`,
        alias: 'Grouped undo demo',
        content: selection.empty ? 'Demo content control' : undefined,
        at: selection.selectionTarget,
      });
      const failure = failureMessage(result);
      if (failure) throw new Error(failure);
      setStatus('Inserted a content-locked content control at the current selection.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The content control could not be inserted.');
    } finally {
      setBusy(false);
    }
  }

  async function unlockBoldRelockAll() {
    if (!doc || busy) return;
    setBusy(true);
    try {
      const { items } = await doc.contentControls.list();
      const controls = items.filter(
        (control: ContentControlInfo): control is ContentControlInfo & { selectionTarget: NonNullable<ContentControlInfo['selectionTarget']> } =>
          Boolean(control.selectionTarget),
      );
      if (controls.length === 0) throw new Error('No addressable content controls were found.');

      for (const control of controls) {
        const result = await doc.contentControls.setLockMode({ target: control.target, lockMode: 'unlocked' });
        const failure = failureMessage(result);
        if (failure) throw new Error(failure);
      }
      for (const control of controls) {
        const result = await doc.format.bold({ target: control.selectionTarget, value: true });
        const failure = failureMessage(result);
        if (failure) throw new Error(failure);
      }
      for (const control of controls) {
        const result = await doc.contentControls.setLockMode({ target: control.target, lockMode: 'contentLocked' });
        const failure = failureMessage(result);
        if (failure) throw new Error(failure);
      }
      const historyAfterOperation = await doc.history.get();
      const undoDepthAfterOperation = historyAfterOperation.undoDepth;
      undoCoordinator.arm(undoDepthAfterOperation, 3);
      redoCoordinator.disarm();
      setStatus(
        `Updated ${controls.length} content control${controls.length === 1 ? '' : 's'} and armed grouped undo.`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The content controls could not be updated.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <header className="demo-controls">
        <div>
          <h1>Grouped undo and redo demo</h1>
          <p>{status}</p>
        </div>
        <div className="button-row">
          <button disabled={!doc || busy} onClick={() => void applyUndo()} type="button">
            Undo
          </button>
          <button disabled={!doc || busy} onClick={() => void applyRedo()} type="button">
            Redo
          </button>
          <button disabled={!doc || busy} onClick={() => void insertContentControl()} type="button">
            Insert SDT
          </button>
          <button disabled={!doc || busy} onClick={() => void unlockBoldRelockAll()} type="button">
            Unlock, bold, and relock all SDTs
          </button>
        </div>
      </header>
      <SuperDocEditor
        document="/sample.docx"
        onContentError={reportDocumentError}
        onException={reportDocumentError}
        onReady={({ superdoc }) => {
          const readyDoc = superdoc.activeEditor?.doc ?? null;
          setDoc(readyDoc);
          if (readyDoc) {
            undoCoordinator.attach(readyDoc);
            redoCoordinator.attach(readyDoc);
            setStatus('Open the document, then insert a content control.');
          }
        }}
        ref={editorRef}
      />
    </main>
  );
}
