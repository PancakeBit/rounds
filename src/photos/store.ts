import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export type Phase = 'start' | 'end';
export type Subject = { kind: 'person'; personId: number; phase: Phase } | { kind: 'group'; phase: Phase };

const FACE_PX = 720; // big enough to fill a collage tile, not just a 44–96dp avatar
const GROUP_PX = 1080;

// Shrinks a fresh camera capture, keeps it in the app's own storage, and deletes the full-size capture.
// Returns the stored file URI.
export async function keepPhoto(nightId: number, subject: Subject, captureUri: string): Promise<string> {
  const dir = new Directory(Paths.document, 'photos', `night-${nightId}`);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const ref = await ImageManipulator.manipulate(captureUri)
    .resize({ width: subject.kind === 'group' ? GROUP_PX : FACE_PX })
    .renderAsync();
  const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  // A new name for every take, so a retake never shows the previous image from the image cache.
  const name = subject.kind === 'group' ? `group-${subject.phase}` : `${subject.phase}-${subject.personId}`;
  const dest = new File(dir, `${name}-${Date.now()}.jpg`);
  await new File(saved.uri).move(dest);
  dropFile(captureUri);
  return dest.uri;
}

export function dropFile(uri: string | null | undefined): void {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Already gone. Nothing else depends on it.
  }
}
