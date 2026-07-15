interface SlabChipProps {
  gradeCo: string | null;
  grade: string | null;
}

export default function SlabChip({ gradeCo, grade }: SlabChipProps) {
  if (!gradeCo && !grade) return null;
  return (
    <span className="slab-chip">
      {gradeCo && <span>{gradeCo}</span>}
      {grade && <span>{grade}</span>}
    </span>
  );
}
